// Copyright (c) 2012 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

#include "tcp_server_socket.h"

#include <assert.h>
#include <string.h>

#include "ppapi/c/pp_errors.h"
#include "ppapi/cpp/module.h"
#include "ppapi/cpp/private/net_address_private.h"

#include "file_system.h"

TCPServerSocket::TCPServerSocket(int fd, int oflag,
                                 const char* host, uint16_t port)
  : ref_(1), fd_(fd), oflag_(oflag), factory_(this), socket_(NULL),
    host_(host), port_(port), resource_(0) {
}

TCPServerSocket::~TCPServerSocket() {
  assert(!socket_);
  assert(!ref_);
}

void TCPServerSocket::addref() {
  ++ref_;
}

void TCPServerSocket::release() {
  if (!--ref_)
    delete this;
}

FileStream* TCPServerSocket::dup(int fd) {
  return NULL;
}

int TCPServerSocket::read(char* buf, size_t count, size_t* nread) {
  return -1;
}

int TCPServerSocket::write(const char* buf, size_t count, size_t* nwrote) {
  return -1;
}

void TCPServerSocket::close() {
  if (socket_) {
    int32_t result = PP_OK_COMPLETIONPENDING;
    pp::Module::Get()->core()->CallOnMainThread(0,
        factory_.NewCallback(&TCPServerSocket::Close, &result));
    FileSystem* sys = FileSystem::GetFileSystem();
    while(result == PP_OK_COMPLETIONPENDING)
      sys->cond().wait(sys->mutex());
  }
}

int TCPServerSocket::fcntl(int cmd,  va_list ap) {
  if (cmd == F_GETFL) {
    return oflag_;
  } else if (cmd == F_SETFL) {
    oflag_ = va_arg(ap, long);
    return 0;
  } else {
    return -1;
  }
}

bool TCPServerSocket::is_read_ready() {
  return !is_open() || resource_;
}

bool TCPServerSocket::is_write_ready() {
  return !is_open();
}

bool TCPServerSocket::is_exception() {
  return !is_open();
}

bool TCPServerSocket::listen(int backlog) {
  int32_t result = PP_OK_COMPLETIONPENDING;
  pp::Module::Get()->core()->CallOnMainThread(0,
      factory_.NewCallback(&TCPServerSocket::Listen, backlog, &result));
  FileSystem* sys = FileSystem::GetFileSystem();
  while(result == PP_OK_COMPLETIONPENDING)
    sys->cond().wait(sys->mutex());
  return result == PP_OK;
}

PP_Resource TCPServerSocket::accept() {
  if (!resource_)
    return 0;

  PP_Resource ret = resource_;
  resource_ = 0;
  pp::Module::Get()->core()->CallOnMainThread(0,
      factory_.NewCallback(&TCPServerSocket::Accept,
                           static_cast<int32_t*>(NULL)));

  return ret;
}

void TCPServerSocket::Listen(int32_t result, int backlog, int32_t* pres) {
  FileSystem* sys = FileSystem::GetFileSystem();
  Mutex::Lock lock(sys->mutex());
  assert(!socket_);
  socket_ = new pp::TCPServerSocketPrivate(sys->instance());

  // Ignore bind address and always bind to localhost.
  uint8_t localhost_ip[4] = { 127, 0, 0, 1 };
  PP_NetAddress_Private localhost = {};
  if (pp::NetAddressPrivate::CreateFromIPv4Address(
          localhost_ip, port_, &localhost)) {
    LOG("TCPServerSocket::Listen: %s\n",
        pp::NetAddressPrivate::Describe(localhost, true).c_str());
    *pres = socket_->Listen(&localhost, backlog,
        factory_.NewCallback(&TCPServerSocket::Accept, pres));
  } else {
    *pres = PP_ERROR_FAILED;
  }

  if (*pres != PP_OK_COMPLETIONPENDING)
    sys->cond().broadcast();
}

void TCPServerSocket::Accept(int32_t result, int32_t* pres) {
  FileSystem* sys = FileSystem::GetFileSystem();
  Mutex::Lock lock(sys->mutex());
  assert(socket_);
  if (result == PP_OK) {
    result = socket_->Accept(&resource_,
        factory_.NewCallback(&TCPServerSocket::OnAccept));
    if (result == PP_OK_COMPLETIONPENDING)
      result = PP_OK;
  }
  if (pres)
    *pres = result;
  sys->cond().broadcast();
}

void TCPServerSocket::OnAccept(int32_t result) {
  FileSystem* sys = FileSystem::GetFileSystem();
  Mutex::Lock lock(sys->mutex());
  assert(socket_);
  sys->cond().broadcast();
}

void TCPServerSocket::Close(int32_t result, int32_t* pres) {
  FileSystem* sys = FileSystem::GetFileSystem();
  Mutex::Lock lock(sys->mutex());
  delete socket_;
  socket_ = NULL;
  *pres = PP_OK;
  sys->cond().broadcast();
}
