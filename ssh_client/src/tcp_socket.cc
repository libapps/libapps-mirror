// Copyright (c) 2012 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

#include "tcp_socket.h"

#include <assert.h>
#include <string.h>

#include "ppapi/c/pp_errors.h"
#include "ppapi/cpp/module.h"

#include "file_system.h"

TCPSocket::TCPSocket(int fd, int oflag)
  : ref_(1), fd_(fd), oflag_(oflag), factory_(this), socket_(NULL),
    read_buf_(kBufSize), write_sent_(false) {
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
  while(result == PP_OK_COMPLETIONPENDING)
    sys->cond().wait(sys->mutex());
  return result == PP_OK;
}

bool TCPSocket::accept(PP_Resource resource) {
  int32_t result = PP_OK_COMPLETIONPENDING;
  pp::Module::Get()->core()->CallOnMainThread(0,
      factory_.NewCallback(&TCPSocket::Accept, resource, &result));
  FileSystem* sys = FileSystem::GetFileSystem();
  while(result == PP_OK_COMPLETIONPENDING)
    sys->cond().wait(sys->mutex());
  return result == PP_OK;
}

void TCPSocket::close() {
  if (socket_) {
    int32_t result = PP_OK_COMPLETIONPENDING;
    pp::Module::Get()->core()->CallOnMainThread(0,
        factory_.NewCallback(&TCPSocket::Close, &result));
    FileSystem* sys = FileSystem::GetFileSystem();
    while(result == PP_OK_COMPLETIONPENDING)
      sys->cond().wait(sys->mutex());
  }
}

int TCPSocket::read(char* buf, size_t count, size_t* nread) {
  if (!is_open())
    return EIO;

  FileSystem* sys = FileSystem::GetFileSystem();
  if (is_block()) {
    while (in_buf_.empty() && is_open())
      sys->cond().wait(sys->mutex());
  }

  *nread = 0;
  while (*nread < count) {
    if (in_buf_.empty())
      break;

    buf[(*nread)++] = in_buf_.front();
    in_buf_.pop_front();
  }

  if (*nread == 0) {
    if (!is_open()) {
      return 0;
    } else {
      *nread = -1;
      return EAGAIN;
    }
  }

  return 0;
}

int TCPSocket::write(const char* buf, size_t count, size_t* nwrote) {
  if (!is_open())
    return EIO;

  out_buf_.insert(out_buf_.end(), buf, buf + count);
  if (is_block()) {
    int32_t result = PP_OK_COMPLETIONPENDING;
    pp::Module::Get()->core()->CallOnMainThread(0,
        factory_.NewCallback(&TCPSocket::Write, &result));
    FileSystem* sys = FileSystem::GetFileSystem();
    while(result == PP_OK_COMPLETIONPENDING)
      sys->cond().wait(sys->mutex());
    if ((size_t)result != count) {
      *nwrote = -1;
      return EIO;
    } else {
      *nwrote = count;
      return 0;
    }
  } else {
    if (!write_sent_) {
      write_sent_ = true;
      pp::Module::Get()->core()->CallOnMainThread(0,
        factory_.NewCallback(&TCPSocket::Write, (int32_t*)NULL));
    }
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
    Read(PP_OK, NULL);
  } else {
    delete socket_;
    socket_ = NULL;
  }
  *pres = result;
  sys->cond().broadcast();
}

void TCPSocket::Read(int32_t result, int32_t* pres) {
  FileSystem* sys = FileSystem::GetFileSystem();
  Mutex::Lock lock(sys->mutex());
  if (!is_open())
    return;

  result = socket_->Read(&read_buf_[0], read_buf_.size(),
      factory_.NewCallback(&TCPSocket::OnRead, pres));
  if (result != PP_OK_COMPLETIONPENDING) {
    delete socket_;
    socket_ = NULL;
    if (pres)
      *pres = result;
    sys->cond().broadcast();
  }
}

void TCPSocket::OnRead(int32_t result, int32_t* pres) {
  FileSystem* sys = FileSystem::GetFileSystem();
  Mutex::Lock lock(sys->mutex());
  if (!is_open())
    return;

  if (result > 0) {
    in_buf_.insert(in_buf_.end(), &read_buf_[0], &read_buf_[0]+result);
    Read(PP_OK, NULL);
  } else {
    delete socket_;
    socket_ = NULL;
  }
  if (pres)
    *pres = result;
  sys->cond().broadcast();
}

void TCPSocket::Write(int32_t result, int32_t* pres) {
  FileSystem* sys = FileSystem::GetFileSystem();
  Mutex::Lock lock(sys->mutex());
  if (!is_open())
    return;

  if (write_buf_.size()) {
    // Previous write operation is in progress.
    pp::Module::Get()->core()->CallOnMainThread(1,
        factory_.NewCallback(&TCPSocket::Write, &result));
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
    sys->cond().broadcast();
  }
  write_sent_ = false;
}

void TCPSocket::OnWrite(int32_t result, int32_t* pres) {
  FileSystem* sys = FileSystem::GetFileSystem();
  Mutex::Lock lock(sys->mutex());
  if (!is_open())
    return;

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
  Read(PP_OK, NULL);
  *pres = PP_OK;
  sys->cond().broadcast();
  return true;
}
