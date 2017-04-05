// Copyright (c) 2012 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

#include "udp_socket.h"

#include <algorithm>
#include <assert.h>
#include <string.h>

#include "ppapi/c/pp_errors.h"
#include "ppapi/cpp/module.h"
#include "ppapi/cpp/private/net_address_private.h"

#include "file_system.h"

UDPSocket::UDPSocket(int fd, int oflag)
  : ref_(1), fd_(fd), oflag_(oflag), factory_(this), socket_(NULL),
    read_buf_(kBufSize), read_sent_(false), write_sent_(false) {
}

UDPSocket::~UDPSocket() {
  assert(!socket_);
  assert(!ref_);
}

void UDPSocket::addref() {
  ++ref_;
}

void UDPSocket::release() {
  if (!--ref_)
    delete this;
}

FileStream* UDPSocket::dup(int fd) {
  return NULL;
}

bool UDPSocket::bind(const sockaddr* saddr, socklen_t addrlen) {
  int32_t result = PP_OK_COMPLETIONPENDING;
  pp::Module::Get()->core()->CallOnMainThread(0,
      factory_.NewCallback(&UDPSocket::Bind, saddr, addrlen, &result));
  FileSystem* sys = FileSystem::GetFileSystem();
  while (result == PP_OK_COMPLETIONPENDING)
    sys->cond().wait(sys->mutex());
  return result == PP_OK;
}

int UDPSocket::getsockname(sockaddr* name, socklen_t* namelen) {
  int32_t result = PP_OK_COMPLETIONPENDING;
  pp::Module::Get()->core()->CallOnMainThread(0,
      factory_.NewCallback(&UDPSocket::GetBoundAddress,
                           name, namelen, &result));
  FileSystem* sys = FileSystem::GetFileSystem();
  while (result == PP_OK_COMPLETIONPENDING)
    sys->cond().wait(sys->mutex());
  return result == PP_OK ? 0 : -1;
}

ssize_t UDPSocket::sendto(const char* buf, size_t len, int flags,
                          const sockaddr* dest_addr, socklen_t addrlen) {
  if (!is_open()) {
    // UDP sockets allow to send data without bind but Pepper requires bind
    // before send/receive so bind it to any address now.
    sockaddr_in saddr = { AF_INET };
    if (!bind((sockaddr*)&saddr, sizeof(saddr)))
      return -1;
  }
  out_queue_.resize(out_queue_.size() + 1);
  memcpy(&out_queue_.back().first, dest_addr,
         std::min(addrlen, sizeof(sockaddr_in6)));
  out_queue_.back().second.assign(buf, buf + len);
  PostWriteTask();
  return 0;
}

ssize_t UDPSocket::recvfrom(char* buffer, size_t len, int flags,
                            sockaddr* addr, socklen_t* addrlen) {
  if (is_block()) {
    FileSystem* sys = FileSystem::GetFileSystem();
    while (in_queue_.empty() && is_open())
      sys->cond().wait(sys->mutex());
  }

  if (!in_queue_.empty()) {
    *addrlen = std::min(*addrlen, sizeof(sockaddr_in6));
    memcpy(addr, &in_queue_.front().first, *addrlen);
    len = std::min(len, in_queue_.front().second.size());
    std::copy(in_queue_.front().second.begin(),
              in_queue_.front().second.begin() + len,
              (char*)buffer);
    if (flags != MSG_PEEK) {
      if (len == in_queue_.front().second.size()) {
        in_queue_.pop_front();
      } else {
        in_queue_.front().second.erase(in_queue_.front().second.begin(),
                                       in_queue_.front().second.begin() + len);
      }
    }
    PostReadTask();
    return len;
  } else {
    if (!is_open()) {
      errno = EACCES;
      return -1;
    } else {
      errno = EAGAIN;
      return 0;
    }
  }
}

void UDPSocket::close() {
  if (socket_) {
    int32_t result = PP_OK_COMPLETIONPENDING;
    pp::Module::Get()->core()->CallOnMainThread(0,
        factory_.NewCallback(&UDPSocket::Close, &result));
    FileSystem* sys = FileSystem::GetFileSystem();
    while (result == PP_OK_COMPLETIONPENDING)
      sys->cond().wait(sys->mutex());
  }
}

int UDPSocket::read(char* buf, size_t count, size_t* nread) {
  *nread = 0;
  return EINVAL;
}

int UDPSocket::write(const char* buf, size_t count, size_t* nwrote) {
  *nwrote = 0;
  return EINVAL;
}

int UDPSocket::fcntl(int cmd, va_list ap) {
  if (cmd == F_GETFL) {
    return oflag_;
  } else if (cmd == F_SETFL) {
    oflag_ = va_arg(ap, long);
    return 0;
  } else {
    return -1;
  }
}

bool UDPSocket::is_read_ready() {
  return !in_queue_.empty();
}

bool UDPSocket::is_write_ready() {
  return true;
}

bool UDPSocket::is_exception() {
  return !is_open();
}

void UDPSocket::Close(int32_t result, int32_t* pres) {
  FileSystem* sys = FileSystem::GetFileSystem();
  delete socket_;
  socket_ = NULL;
  *pres = PP_OK;
  sys->cond().broadcast();
}

void UDPSocket::Bind(int32_t result, const sockaddr* saddr, socklen_t addrlen,
                     int32_t* pres) {
  FileSystem* sys = FileSystem::GetFileSystem();
  Mutex::Lock lock(sys->mutex());
  assert(!socket_);
  socket_ = new pp::UDPSocketPrivate(sys->instance());

  PP_NetAddress_Private addr = {};
  if (FileSystem::CreateNetAddress(saddr, addrlen, &addr)) {
    LOG("UDPSocket::Bind: %d %s\n",
        fd_, pp::NetAddressPrivate::Describe(addr, true).c_str());
    *pres = socket_->Bind(&addr,
        factory_.NewCallback(&UDPSocket::OnBind, pres));
  } else {
    *pres = PP_ERROR_FAILED;
  }

  if (*pres != PP_OK_COMPLETIONPENDING)
    sys->cond().broadcast();
}

void UDPSocket::OnBind(int32_t result, int32_t* pres) {
  FileSystem* sys = FileSystem::GetFileSystem();
  Mutex::Lock lock(sys->mutex());
  if (result == PP_OK) {
    PostReadTask();
  } else {
    LOG("UDPSocket::OnBind: %d failed %d\n", fd_, result);
    delete socket_;
    socket_ = NULL;
  }
  *pres = result;
  sys->cond().broadcast();
}

void UDPSocket::GetBoundAddress(int32_t result, sockaddr* name,
                                socklen_t* namelen, int32_t* pres) {
  FileSystem* sys = FileSystem::GetFileSystem();
  Mutex::Lock lock(sys->mutex());
  PP_NetAddress_Private addr = {};
  if (socket_ && socket_->GetBoundAddress(&addr)) {
    LOG("UDPSocket::GetBoundAddress: %d %s\n",
        fd_, pp::NetAddressPrivate::Describe(addr, true).c_str());
    if (FileSystem::CreateSocketAddress(addr, name, namelen)) {
      *pres = PP_OK;
    } else {
      *pres = PP_ERROR_FAILED;
    }
  } else {
    *pres = PP_ERROR_FAILED;
  }
  sys->cond().broadcast();
}

void UDPSocket::Read(int32_t result) {
  FileSystem* sys = FileSystem::GetFileSystem();
  Mutex::Lock lock(sys->mutex());

  if (!is_open()) {
    socket_ = new pp::UDPSocketPrivate(sys->instance());
  }

  result = socket_->RecvFrom(&read_buf_[0], read_buf_.size(),
      factory_.NewCallback(&UDPSocket::OnRead));
  if (result != PP_OK_COMPLETIONPENDING) {
    delete socket_;
    socket_ = NULL;
    read_sent_ = false;
    sys->cond().broadcast();
  }
}

void UDPSocket::OnRead(int32_t result) {
  FileSystem* sys = FileSystem::GetFileSystem();
  Mutex::Lock lock(sys->mutex());

  read_sent_ = false;
  if (!is_open()) {
    sys->cond().broadcast();
    return;
  }

  PP_NetAddress_Private addr = {};
  if (result > 0 && socket_->GetRecvFromAddress(&addr)) {
    LOG("UDPSocket::OnRead: %d %s\n",
        fd_, pp::NetAddressPrivate::Describe(addr, true).c_str());
    in_queue_.resize(in_queue_.size() + 1);
    socklen_t dummy;
    FileSystem::CreateSocketAddress(
        addr, (sockaddr*)&in_queue_.back().first, &dummy);
    in_queue_.back().second.assign(read_buf_.begin(),
                                   read_buf_.begin() + result);
    PostReadTask();
  } else {
    delete socket_;
    socket_ = NULL;
  }
  sys->cond().broadcast();
}

void UDPSocket::Write(int32_t result) {
  FileSystem* sys = FileSystem::GetFileSystem();
  Mutex::Lock lock(sys->mutex());

  assert(!write_buf_.size());
  FileSystem::CreateNetAddress(
      (sockaddr*)&out_queue_.front().first, sizeof(sockaddr_in6), &write_addr_);
  LOG("UDPSocket::Write: %d %s\n",
      fd_, pp::NetAddressPrivate::Describe(write_addr_, true).c_str());
  write_buf_.swap(out_queue_.front().second);
  out_queue_.pop_front();
  result = socket_->SendTo(&write_buf_[0], write_buf_.size(), &write_addr_,
      factory_.NewCallback(&UDPSocket::OnWrite));
  if (result != PP_OK_COMPLETIONPENDING) {
    LOG("UDPSocket::Write: failed %d %d\n", fd_, result);
    delete socket_;
    socket_ = NULL;
    write_sent_ = false;
    sys->cond().broadcast();
  }
}

void UDPSocket::OnWrite(int32_t result) {
  FileSystem* sys = FileSystem::GetFileSystem();
  Mutex::Lock lock(sys->mutex());

  write_sent_ = false;
  if (!is_open()) {
    sys->cond().broadcast();
    return;
  }

  if (result < 0 || (size_t)result > write_buf_.size()) {
    // Write error.
    LOG("TCPSocket::OnWrite: close socket %d\n", fd_);
    delete socket_;
    socket_ = NULL;
  } else if ((size_t)result < write_buf_.size()) {
    // Partial write.
    assert(0);
  }
  write_buf_.clear();
  sys->cond().broadcast();

  if (!is_block()) {
    // For async sockets some more data could be written while Pepper sends
    // previous portion so check do we have some data to write. For sync case,
    // we always wait write operation completion.
    PostWriteTask();
  }
}

void UDPSocket::PostReadTask() {
  if (is_open() && !read_sent_ && in_queue_.size() < kQueueSize) {
    read_sent_ = true;
    if (!pp::Module::Get()->core()->IsMainThread()) {
      pp::Module::Get()->core()->CallOnMainThread(
          0, factory_.NewCallback(&UDPSocket::Read));
    } else {
      // If on main Pepper thread and delay is not required call it directly.
      Read(PP_OK);
    }
  }
}

void UDPSocket::PostWriteTask() {
  if (is_open() && !write_sent_ && !out_queue_.empty()) {
    write_sent_ = true;
    if (!pp::Module::Get()->core()->IsMainThread()) {
      pp::Module::Get()->core()->CallOnMainThread(
          0, factory_.NewCallback(&UDPSocket::Write));
    } else {
      // If on main Pepper thread and delay is not required call it directly.
      Write(PP_OK);
    }
  }
}
