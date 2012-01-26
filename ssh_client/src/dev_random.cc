// Copyright (c) 2012 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

#include "dev_random.h"

#include <assert.h>
#include <stdio.h>
#include <string.h>

DevRandomHandler::DevRandomHandler(
    int (*get_random_bytes)(void *buf, size_t count, size_t *nread))
    : ref_(1), get_random_bytes_(get_random_bytes) {
  assert(get_random_bytes);
}

DevRandomHandler::~DevRandomHandler() {
  assert(!ref_);
}

void DevRandomHandler::addref() {
  ++ref_;
}

void DevRandomHandler::release() {
  if (!--ref_)
    delete this;
}

FileStream* DevRandomHandler::open(int fd, const char* pathname, int oflag) {
  return new DevRandom(fd, oflag, get_random_bytes_);
}

int DevRandomHandler::stat(const char* pathname, nacl_abi_stat* out) {
  memset(out, 0, sizeof(nacl_abi_stat));
  return 0;
}

//------------------------------------------------------------------------------

DevRandom::DevRandom(int fd, int oflag,
    int (*get_random_bytes)(void *buf, size_t count, size_t *nread))
  : fd_(fd), oflag_(oflag), ref_(1), get_random_bytes_(get_random_bytes) {
}

DevRandom::~DevRandom() {
  assert(!ref_);
}

void DevRandom::addref() {
  ++ref_;
}

void DevRandom::release() {
  if (!--ref_)
    delete this;
}

FileStream* DevRandom::dup(int fd) {
  return new DevRandom(fd, oflag_, get_random_bytes_);
}

void DevRandom::close() {
  fd_ = 0;
}

int DevRandom::read(char* buf, size_t count, size_t* nread) {
  return get_random_bytes_(buf, count, nread);
}

int DevRandom::write(const char* buf, size_t count, size_t* nwrote) {
  return EPERM;
}

int DevRandom::fstat(nacl_abi_stat* out) {
  memset(out, 0, sizeof(nacl_abi_stat));
  // openssl uses st_ino and st_dev to distinguish random sources and doesn't
  // expect 0 there.
  out->nacl_abi_st_ino = fd_;
  out->nacl_abi_st_dev = fd_;
  return 0;
}

int DevRandom::fcntl(int cmd, va_list ap) {
  if (cmd == F_GETFL) {
    return oflag_;
  } else if (cmd == F_SETFL) {
    oflag_ = va_arg(ap, long);
    return 0;
  } else {
    return -1;
  }
}
