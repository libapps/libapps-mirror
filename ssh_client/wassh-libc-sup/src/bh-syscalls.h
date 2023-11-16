// Copyright 2019 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

// The bottom half of our C library.  These are syscall interfaces so the top
// half can implement standard C library interfaces.
//
// For example, this defines the socket syscalls, but not the socket() C library
// function that users expect.

#ifndef _WASSH_SYSCALLS_H
#define _WASSH_SYSCALLS_H

#include <stdbool.h>
#include <stdint.h>

#include <wasi/api.h>

#include <sys/cdefs.h>

__BEGIN_DECLS

struct winsize;

int sock_accept(__wasi_fd_t sock, __wasi_fd_t* newsock);
int sock_bind(__wasi_fd_t sock, int domain, const uint8_t* addr,
              uint16_t port);
int sock_listen(__wasi_fd_t sock, int backlog);
void sock_register_fake_addr(int idx, const char* name);
__wasi_fd_t sock_create(int domain, int type, int protocol);
int sock_connect(__wasi_fd_t sock, int domain, const uint8_t* addr,
                 uint16_t port);
int sock_get_name(__wasi_fd_t sock, int* family, uint16_t* port, uint8_t* addr,
                  bool remote);
int sock_get_opt(__wasi_fd_t sock, int level, int optname, int* optvalue);
int sock_set_opt(__wasi_fd_t sock, int level, int optname, int optvalue);
int sock_recvfrom(__wasi_fd_t sock, void* buf, size_t len, size_t* written,
                  int flags, int* domain, uint8_t* addr, uint16_t* port);
int sock_sendto(__wasi_fd_t sock, const void* buf, size_t len, size_t* written,
                int flags, int domain, const uint8_t* addr, uint16_t port);
__wasi_fd_t fd_dup(__wasi_fd_t oldfd);
__wasi_fd_t fd_dup2(__wasi_fd_t oldfd, __wasi_fd_t newfd);
int tty_get_window_size(__wasi_fd_t fd, struct winsize* winsize);
int tty_set_window_size(__wasi_fd_t fd, const struct winsize* winsize);
char* wassh_readpassphrase(const char* prompt, char* buf, size_t buf_len,
                           bool echo);

__END_DECLS

#endif
