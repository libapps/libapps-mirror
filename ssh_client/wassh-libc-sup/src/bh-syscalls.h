// Copyright 2019 The Chromium OS Authors. All rights reserved.
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

void sock_register_fake_addr(int idx, const char* name);
__wasi_fd_t sock_create(int domain, int type, int protocol);
int sock_connect(__wasi_fd_t sock, int domain, const uint8_t* addr,
                 uint16_t port);
int sock_get_opt(__wasi_fd_t sock, int level, int optname, int* optvalue);
int sock_set_opt(__wasi_fd_t sock, int level, int optname, int optvalue);
__wasi_fd_t fd_dup(__wasi_fd_t oldfd);
__wasi_fd_t fd_dup2(__wasi_fd_t oldfd, __wasi_fd_t newfd);

__END_DECLS

#endif
