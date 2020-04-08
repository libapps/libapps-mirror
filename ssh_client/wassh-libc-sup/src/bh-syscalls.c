// Copyright 2019 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

// This file is only for creating an interface for the syscall layer.  It takes
// care of setting up errno and such on errors.  There should be no other logic
// in here.  This is the "bottom half" of our C library implementation.
//
// For example, the WASI ABI defines a wassh.sock_create function that has three
// parameters (the new socket (output), and the socket domain/type (input)) and
// one return value (the error).  We define a nicer C library interface which
// returns the new socket directly and translates the error into errno.

#include <errno.h>
#include <stdint.h>

#include <wasi/api.h>

#include "bh-syscalls.h"

// Create a prototype for the underlying syscall import.
//
// Given |name|, we will expect to import a "wassh.|name|" function, and we will
// create a function here named "__wassh_|name|".  The import name is what WASM
// will see, and the __wassh symbol is what it'll get linked as.
//
// There's no hard requirement between these symbol names.  This is purely the
// convention we've adopted for namespacing reasons.
//
// NB: We'll use "wassh_experimental" until we've got this working.
#define SYSCALL(name) \
    __attribute__((__import_module__("wassh_experimental"), \
                   __import_name__(#name))) \
    __attribute__((__warn_unused_result__)) \
    __wasi_errno_t __wassh_##name

SYSCALL(sock_create)(__wasi_fd_t* sock, int domain, int type);
__wasi_fd_t sock_create(int domain, int type) {
  __wasi_fd_t ret;
  __wasi_errno_t error = __wassh_sock_create(&ret, domain, type);
  if (error != 0) {
    errno = error;
    return -1;
  }
  return ret;
}

SYSCALL(sock_connect)(__wasi_fd_t sock, int domain, const uint8_t* addr,
                      uint16_t port);
int sock_connect(__wasi_fd_t sock, int domain, const uint8_t* addr,
                 uint16_t port) {
  __wasi_errno_t error = __wassh_sock_connect(sock, domain, addr, port);
  if (error != 0) {
    errno = error;
    return -1;
  }
  return 0;
}
