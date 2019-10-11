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

#include <wasi/core.h>

#include <sys/cdefs.h>

__BEGIN_DECLS

__wasi_fd_t sock_create(int domain, int type);
int sock_connect(__wasi_fd_t sock, int domain, const uint8_t* addr,
                 uint16_t port);

__END_DECLS

#endif
