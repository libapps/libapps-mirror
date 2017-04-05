// Copyright (c) 2012 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

#include "tcp_socket.h"

#include <algorithm>
#include <assert.h>
#include <string.h>

#include "ppapi/c/pp_errors.h"
#include "ppapi/cpp/module.h"

#include "file_system.h"

TCPSocket::TCPSocket(int fd, int oflag)
  : ref_(1), fd_(fd), oflag_(oflag), factory_(this), socket_(NULL),
    read_buf_(kBufSize), read_sent_(false), write_sent_(false) {
}

TCPSocket::~TCPSocket() {
  assert(!socket_);
  assert(!ref_);
}

void TCPSocket::addref() {
  ++ref_;
}

void TCPSocket::release() {
  if (!--ref_)
    delete this;
}

FileStream* TCPSocket::dup(int fd) {
  return NULL;
}

bool TCPSocket::connect(const char* host, uint16_t port) {
  int32_t result = PP_OK_COMPLETIONPENDING;
  pp::Module::Get()->core()->CallOnMainThread(0,
      factory_.NewCallback(&TCPSocket::Connect, host, port, &result));
  FileSystem* sys = FileSystem::GetFileSystem();
  while (result == PP_OK_COMPLETIONPENDING)
    sys->cond().wait(sys->mutex());
  return result == PP_OK;
}

bool TCPSocket::accept(PP_Resource resource) {
  int32_t result = PP_OK_COMPLETIONPENDING;
  pp::Module::Get()->core()->CallOnMainThread(0,
      factory_.NewCallback(&TCPSocket::Accept, resource, &result));
  FileSystem* sys = FileSystem::GetFileSystem();
  while (result == PP_OK_COMPLETIONPENDING)
    sys->cond().wait(sys->mutex());
  return result == PP_OK;
}

void TCPSocket::close() {
  if (socket_) {
    int32_t result = PP_OK_COMPLETIONPENDING;
    pp::Module::Get()->core()->CallOnMainThread(0,
        factory_.NewCallback(&TCPSocket::Close, &result));
    FileSystem* sys = FileSystem::GetFileSystem();
    while (result == PP_OK_COMPLETIONPENDING)
      sys->cond().wait(sys->mutex());
  }
}

int TCPSocket::read(char* buf, size_t count, size_t* nread) {
  if (is_block()) {
    FileSystem* sys = FileSystem::GetFileSystem();
    while (in_buf_.empty() && is_open())
      sys->cond().wait(sys->mutex());
  }

  *nread = std::min(count, in_buf_.size());
  if (*nread) {
    std::copy(in_buf_.begin(), in_buf_.begin() + *nread, buf);
    in_buf_.erase(in_buf_.begin(), in_buf_.begin() + *nread);
  }

  if (*nread == 0) {
    if (!is_open()) {
      return 0;
    } else {
      *nread = -1;
      return EAGAIN;
    }
  }

  PostReadTask();

  return 0;
}

int TCPSocket::write(const char* buf, size_t count, size_t* nwrote) {
  if (!is_open())
    return EIO;

  out_buf_.insert(out_buf_.end(), buf, buf + count);
  if (is_block()) {
    int32_t result = PP_OK_COMPLETIONPENDING;
    PostWriteTask(&result, true);
    FileSystem* sys = FileSystem::GetFileSystem();
    while (result == PP_OK_COMPLETIONPENDING)
      sys->cond().wait(sys->mutex());
    if ((size_t)result != count) {
      *nwrote = -1;
      return EIO;
    } else {
      *nwrote = count;
      return 0;
    }
  } else {
    PostWriteTask(NULL, true);
    *nwrote = count;
    return 0;
  }
}

int TCPSocket::fcntl(int cmd, va_list ap) {
  if (cmd == F_GETFL) {
    return oflag_;
  } else if (cmd == F_SETFL) {
    oflag_ = va_arg(ap, long);
    return 0;
  } else {
    return -1;
  }
}

bool TCPSocket::is_read_ready() {
  return !is_open() || !in_buf_.empty();
}

bool TCPSocket::is_write_ready() {
  return !is_open() || out_buf_.size() < kBufSize;
}

bool TCPSocket::is_exception() {
  return !is_open();
}

void TCPSocket::PostReadTask() {
  if (is_open() && !read_sent_ && in_buf_.size() < kBufSize / 2) {
    read_sent_ = true;
    if (!pp::Module::Get()->core()->IsMainThread()) {
      pp::Module::Get()->core()->CallOnMainThread(
          0, factory_.NewCallback(&TCPSocket::Read));
    } else {
      // If on main Pepper thread and delay is not required call it directly.
      Read(PP_OK);
    }
  }
}

void TCPSocket::PostWriteTask(int32_t* pres, bool always_post) {
  if (is_open() && !write_sent_ && !out_buf_.empty()) {
    write_sent_ = true;
    if (always_post || !pp::Module::Get()->core()->IsMainThread()) {
      pp::Module::Get()->core()->CallOnMainThread(0,
          factory_.NewCallback(&TCPSocket::Write, pres));
    } else {
      // If on main Pepper thread and delay is not required call it directly.
      Write(PP_OK, pres);
    }
  }
}

void TCPSocket::Connect(int32_t result, const char* host, uint16_t port,
                        int32_t* pres) {
  FileSystem* sys = FileSystem::GetFileSystem();
  Mutex::Lock lock(sys->mutex());
  assert(!socket_);
  socket_ = new pp::TCPSocketPrivate(sys->instance());
  *pres = socket_->Connect(host, port,
      factory_.NewCallback(&TCPSocket::OnConnect, pres));
  if (*pres != PP_OK_COMPLETIONPENDING)
    sys->cond().broadcast();
}

void TCPSocket::OnConnect(int32_t result, int32_t* pres) {
  FileSystem* sys = FileSystem::GetFileSystem();
  Mutex::Lock lock(sys->mutex());
  if (result == PP_OK) {
    PostReadTask();
  } else {
    delete socket_;
    socket_ = NULL;
  }
  *pres = result;
  sys->cond().broadcast();
}

void TCPSocket::Read(int32_t result) {
  FileSystem* sys = FileSystem::GetFileSystem();
  Mutex::Lock lock(sys->mutex());

  if (!is_open()) {
    read_sent_ = false;
    sys->cond().broadcast();
    return;
  }

  result = socket_->Read(&read_buf_[0], read_buf_.size(),
      factory_.NewCallback(&TCPSocket::OnRead));
  if (result != PP_OK_COMPLETIONPENDING) {
    delete socket_;
    socket_ = NULL;
    read_sent_ = false;
    sys->cond().broadcast();
  }
}

void TCPSocket::OnRead(int32_t result) {
  FileSystem* sys = FileSystem::GetFileSystem();
  Mutex::Lock lock(sys->mutex());

  read_sent_ = false;
  if (!is_open()) {
    sys->cond().broadcast();
    return;
  }

  if (result > 0) {
    in_buf_.insert(in_buf_.end(),
                   read_buf_.begin(), read_buf_.begin() + result);
    PostReadTask();
  } else {
    delete socket_;
    socket_ = NULL;
  }
  sys->cond().broadcast();
}

void TCPSocket::Write(int32_t result, int32_t* pres) {
  FileSystem* sys = FileSystem::GetFileSystem();
  Mutex::Lock lock(sys->mutex());

  if (!is_open()) {
    if (pres)
      *pres = PP_ERROR_FAILED;
    write_sent_ = false;
    sys->cond().broadcast();
    return;
  }

  if (write_buf_.size()) {
    // Previous write operation is in progress.
    PostWriteTask(pres, true);
    return;
  }
  assert(out_buf_.size());
  write_buf_.swap(out_buf_);
  result = socket_->Write(&write_buf_[0], write_buf_.size(),
      factory_.NewCallback(&TCPSocket::OnWrite, pres));
  if (result != PP_OK_COMPLETIONPENDING) {
    LOG("TCPSocket::Write: failed %d %d %d\n", fd_, result, write_buf_.size());
    delete socket_;
    socket_ = NULL;
    if (pres)
      *pres = result;
    write_sent_ = false;
    sys->cond().broadcast();
  }
}

void TCPSocket::OnWrite(int32_t result, int32_t* pres) {
  FileSystem* sys = FileSystem::GetFileSystem();
  Mutex::Lock lock(sys->mutex());

  write_sent_ = false;
  if (!is_open()) {
    if (pres)
      *pres = PP_ERROR_FAILED;
    sys->cond().broadcast();
    return;
  }

  if (result < 0 || (size_t)result > write_buf_.size()) {
    // Write error.
    LOG("TCPSocket::OnWrite: close socket %d\n", fd_);
    delete socket_;
    socket_ = NULL;
  } else if ((size_t)result < write_buf_.size()) {
    // Partial write. Insert remaining bytes at the beginning of out_buf_.
    out_buf_.insert(out_buf_.begin(), &write_buf_[result], &*write_buf_.end());
  }
  if (pres)
    *pres = result;
  write_buf_.clear();
  sys->cond().broadcast();

  if (!is_block()) {
    // For async sockets some more data could be written while Pepper sends
    // previous portion so check do we have some data to write. For sync case,
    // we always wait write operation completion.
    PostWriteTask(NULL, false);
  }
}

void TCPSocket::Close(int32_t result, int32_t* pres) {
  FileSystem* sys = FileSystem::GetFileSystem();
  Mutex::Lock lock(sys->mutex());
  delete socket_;
  socket_ = NULL;
  if (pres)
    *pres = PP_OK;
  sys->cond().broadcast();
}

bool TCPSocket::Accept(int32_t result, PP_Resource resource, int32_t* pres) {
  FileSystem* sys = FileSystem::GetFileSystem();
  Mutex::Lock lock(sys->mutex());
  assert(!socket_);
  socket_ = new pp::TCPSocketPrivate(pp::PassRef(), resource);
  PostReadTask();
  *pres = PP_OK;
  sys->cond().broadcast();
  return true;
}
