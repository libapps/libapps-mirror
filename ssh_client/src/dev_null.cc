// Copyright (c) 2011 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

#include "dev_null.h"

#include <assert.h>
#include <string.h>

DevNullHandler::DevNullHandler() : ref_(1) {
}

DevNullHandler::~DevNullHandler() {
  assert(!ref_);
}

void DevNullHandler::addref() {
  ++ref_;
}

void DevNullHandler::release() {
  if (!--ref_)
    delete this;
}

FileStream* DevNullHandler::open(int fd, const char* pathname, int oflag) {
  return new DevNull(fd, oflag);
}

int DevNullHandler::stat(const char* pathname, nacl_abi_stat* out) {
  memset(out, 0, sizeof(nacl_abi_stat));
  return 0;
}

//------------------------------------------------------------------------------

DevNull::DevNull(int fd, int oflag)
  : fd_(fd), oflag_(oflag), ref_(1) {
}

DevNull::~DevNull() {
  assert(!ref_);
}

void DevNull::addref() {
  ++ref_;
}

void DevNull::release() {
  if (!--ref_)
    delete this;
}

void DevNull::close() {
  fd_ = 0;
}

int DevNull::read(char* buf, size_t count, size_t* nread) {
  memset(buf, 0, count);
  *nread = count;
  return 0;
}

int DevNull::write(const char* buf, size_t count, size_t* nwrote) {
  *nwrote = count;
  return 0;
}

int DevNull::seek(nacl_abi_off_t offset, int whence,
                  nacl_abi_off_t* new_offset) {
  return ESPIPE;
}

int DevNull::fstat(nacl_abi_stat* out) {
  memset(out, 0, sizeof(nacl_abi_stat));
  return 0;
}

FileStream* DevNull::dup(int fd) {
  return new DevNull(fd, oflag_);
}

int DevNull::getdents(dirent* buf, size_t count, size_t* nread) {
  return ENOTDIR;
}

int DevNull::isatty() {
  return false;
}

int DevNull::fcntl(int cmd, va_list ap) {
  if (cmd == F_GETFL) {
    return oflag_;
  } else if (cmd == F_SETFL) {
    oflag_ = va_arg(ap, long);
    return 0;
  } else {
    return -1;
  }
}

int DevNull::ioctl(int request, va_list ap) {
  return EINVAL;
}

bool DevNull::is_read_ready() {
  return true;
}

bool DevNull::is_write_ready() {
  return true;
}

bool DevNull::is_exception() {
  return false;
}
