// Copyright 2019 The ChromiumOS Authors
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
#include <string.h>
#include <unistd.h>

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

SYSCALL(fd_dup)(__wasi_fd_t oldfd, __wasi_fd_t* newfd);
__wasi_fd_t fd_dup(__wasi_fd_t oldfd) {
  __wasi_fd_t ret;
  __wasi_errno_t error = __wassh_fd_dup(oldfd, &ret);
  if (error != 0) {
    errno = error;
    return -1;
  }
  return ret;
}

SYSCALL(fd_dup2)(__wasi_fd_t oldfd, __wasi_fd_t newfd);
__wasi_fd_t fd_dup2(__wasi_fd_t oldfd, __wasi_fd_t newfd) {
  __wasi_errno_t error = __wassh_fd_dup2(oldfd, newfd);
  if (error != 0) {
    errno = error;
    return -1;
  }
  return newfd;
}

SYSCALL(readpassphrase)(const char* prompt, __wasi_size_t prompt_len,
                        char* buf, __wasi_size_t buf_len, int echo);
char* wassh_readpassphrase(const char* prompt, char* buf, size_t buf_len,
                           bool echo) {
  __wasi_errno_t error = __wassh_readpassphrase(prompt, strlen(prompt), buf,
                                                buf_len, echo);
  if (error != 0) {
    errno = error;
    return NULL;
  }
  return buf;
}

SYSCALL(sock_accept)(__wasi_fd_t sock, __wasi_fd_t* newsock);
int sock_accept(__wasi_fd_t sock, __wasi_fd_t* newsock) {
  __wasi_errno_t error = __wassh_sock_accept(sock, newsock);
  if (error != 0) {
    errno = error;
    return -1;
  }
  return 0;
}

SYSCALL(sock_bind)(__wasi_fd_t sock, int domain, const uint8_t* addr,
                   uint16_t port);
int sock_bind(__wasi_fd_t sock, int domain, const uint8_t* addr,
              uint16_t port) {
  __wasi_errno_t error = __wassh_sock_bind(sock, domain, addr, port);
  if (error != 0) {
    errno = error;
    return -1;
  }
  return 0;
}

SYSCALL(sock_listen)(__wasi_fd_t sock, int backlog);
int sock_listen(__wasi_fd_t sock, int backlog) {
  __wasi_errno_t error = __wassh_sock_listen(sock, backlog);
  if (error != 0) {
    errno = error;
    return -1;
  }
  return 0;
}

SYSCALL(sock_register_fake_addr)(int idx, const char* name, size_t namelen);
void sock_register_fake_addr(int idx, const char* name) {
  size_t namelen = strlen(name);
  __wasi_errno_t error = __wassh_sock_register_fake_addr(idx, name, namelen);
  if (error != 0)
    errno = error;
}

SYSCALL(sock_create)(__wasi_fd_t* sock, int domain, int type, int protocol);
__wasi_fd_t sock_create(int domain, int type, int protocol) {
  __wasi_fd_t ret;
  __wasi_errno_t error = __wassh_sock_create(&ret, domain, type, protocol);
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

SYSCALL(sock_get_name)(__wasi_fd_t sock, int* family, uint16_t* port,
                       uint8_t* addr, int remote);
int sock_get_name(__wasi_fd_t sock, int* family, uint16_t* port, uint8_t* addr,
                  bool remote) {
  __wasi_errno_t error = __wassh_sock_get_name(
      sock, family, port, addr, !!remote);
  if (error != 0) {
    errno = error;
    return -1;
  }
  return 0;
}

SYSCALL(sock_get_opt)(__wasi_fd_t sock, int level, int optname, int* optvalue);
int sock_get_opt(__wasi_fd_t sock, int level, int optname, int* optvalue) {
  __wasi_errno_t error = __wassh_sock_get_opt(sock, level, optname, optvalue);
  if (error != 0) {
    errno = error;
    return -1;
  }
  return 0;
}

SYSCALL(sock_set_opt)(__wasi_fd_t sock, int level, int optname, int optvalue);
int sock_set_opt(__wasi_fd_t sock, int level, int optname, int optvalue) {
  __wasi_errno_t error = __wassh_sock_set_opt(sock, level, optname, optvalue);
  if (error != 0) {
    errno = error;
    return -1;
  }
  return 0;
}

SYSCALL(sock_recvfrom)(__wasi_fd_t sock, void* buf, size_t len, size_t* written,
                       int flags, int* domain, uint8_t* addr, uint16_t* port);
int sock_recvfrom(__wasi_fd_t sock, void* buf, size_t len, size_t* written,
                  int flags, int* domain, uint8_t* addr, uint16_t* port) {
  __wasi_errno_t error = __wassh_sock_recvfrom(
      sock, buf, len, written, flags, domain, addr, port);
  if (error != 0) {
    errno = error;
    return -1;
  }
  return 0;
}

SYSCALL(sock_sendto)(__wasi_fd_t sock, const void* buf, size_t len,
                     size_t* written, int flags, int domain,
                     const uint8_t* addr, uint16_t port);
int sock_sendto(__wasi_fd_t sock, const void* buf, size_t len, size_t* written,
                int flags, int domain, const uint8_t* addr, uint16_t port) {
  __wasi_errno_t error = __wassh_sock_sendto(
      sock, buf, len, written, flags, domain, addr, port);
  if (error != 0) {
    errno = error;
    return -1;
  }
  return 0;
}

SYSCALL(tty_get_window_size)(__wasi_fd_t fd, struct winsize* winsize);
int tty_get_window_size(__wasi_fd_t fd, struct winsize* winsize) {
  __wasi_errno_t error = __wassh_tty_get_window_size(fd, winsize);
  if (error != 0) {
    errno = error;
    return -1;
  }
  return 0;
}

SYSCALL(tty_set_window_size)(__wasi_fd_t fd, const struct winsize* winsize);
int tty_set_window_size(__wasi_fd_t fd, const struct winsize* winsize) {
  __wasi_errno_t error = __wassh_tty_set_window_size(fd, winsize);
  if (error != 0) {
    errno = error;
    return -1;
  }
  return 0;
}
