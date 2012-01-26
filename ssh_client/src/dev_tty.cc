// Copyright (c) 2012 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

#include "dev_tty.h"

#include <assert.h>
#include <string.h>

DevTtyHandler::DevTtyHandler(FileStream* stdin, FileStream* stdout)
    : ref_(1), stdin_(stdin), stdout_(stdout) {
  stdin_->addref();
  stdout_->addref();
}

DevTtyHandler::~DevTtyHandler() {
  assert(!ref_);
  stdin_->release();
  stdout_->release();
}

void DevTtyHandler::addref() {
  ++ref_;
}

void DevTtyHandler::release() {
  if (!--ref_)
    delete this;
}

FileStream* DevTtyHandler::open(int fd, const char* pathname, int oflag) {
  return new DevTty(fd, oflag, stdin_, stdout_);
}

int DevTtyHandler::stat(const char* pathname, nacl_abi_stat* out) {
  memset(out, 0, sizeof(nacl_abi_stat));
  return 0;
}

//------------------------------------------------------------------------------

DevTty::DevTty(int fd, int oflag, FileStream* stdin, FileStream* stdout)
  : ref_(1), fd_(fd), oflag_(oflag), stdin_(stdin), stdout_(stdout) {
  stdin_->addref();
  stdout_->addref();
}

DevTty::~DevTty() {
  assert(!ref_);
  stdin_->release();
  stdout_->release();
}

void DevTty::addref() {
  ++ref_;
}

void DevTty::release() {
  if (!--ref_)
    delete this;
}

FileStream* DevTty::dup(int fd) {
  return new DevTty(fd, oflag_, stdin_, stdout_);
}

void DevTty::close() {
  fd_ = 0;
}

int DevTty::read(char* buf, size_t count, size_t* nread) {
  return stdin_->read(buf, count, nread);
}

int DevTty::write(const char* buf, size_t count, size_t* nwrote) {
  return stdout_->write(buf, count, nwrote);
}

int DevTty::isatty() {
  return true;
}

int DevTty::tcgetattr(termios* termios_p) {
  return stdin_->tcgetattr(termios_p);
}

int DevTty::tcsetattr(int optional_actions, const termios* termios_p) {
  return stdin_->tcsetattr(optional_actions, termios_p);
}

int DevTty::fcntl(int cmd, va_list ap) {
  assert(0);
  if (cmd == F_GETFL) {
    return oflag_;
  } else if (cmd == F_SETFL) {
    oflag_ = va_arg(ap, long);
    return 0;
  } else {
    return -1;
  }
}

bool DevTty::is_read_ready() {
  return stdin_->is_read_ready();
}

bool DevTty::is_write_ready() {
  return stdout_->is_write_ready();
}
