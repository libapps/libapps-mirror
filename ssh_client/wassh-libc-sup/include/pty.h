// Copyright 2025 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

// https://man7.org/linux/man-pages/man3/openpty.3.html

#ifndef WASSH_PTY_H
#define WASSH_PTY_H

#include <termios.h>
#include <sys/ioctl.h>

__BEGIN_DECLS

int openpty(int* amaster, int* aslave, char* name, const struct termios* termp,
            const struct winsize* winp);

__END_DECLS

#endif
