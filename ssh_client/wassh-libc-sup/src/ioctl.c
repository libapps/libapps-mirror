// Copyright 2020 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

// Ioctl implementation.  While wasi-libc provides a minimal implementation for
// FIONREAD & FIONBIO, it errors out for all others.  We need others.

#include <errno.h>
#include <stdarg.h>

#include <sys/ioctl.h>

#include "bh-syscalls.h"
#include "debug.h"

int ioctl(int fd, int request, ...) {
  _ENTER("fd=%i request=%#x", fd, request);
  int ret = -1;
  va_list ap;
  va_start(ap, request);

  switch (request) {
    case TIOCGWINSZ: {
      // Get terminal window size.
      struct winsize* ws = va_arg(ap, struct winsize*);
      ret = tty_get_window_size(fd, ws);
      _MID("TIOCGWINSZ: row=%u col=%u", ws->ws_row, ws->ws_col);
      break;
    }

    case TIOCSWINSZ: {
      // Set terminal window size.
      const struct winsize* ws = va_arg(ap, const struct winsize*);
      _MID("TIOCSWINSZ: row=%u col=%u", ws->ws_row, ws->ws_col);
      ret = tty_set_window_size(fd, ws);
      break;
    }

    default:
      errno = ENOTTY;
      break;
  }

  va_end(ap);
  _EXIT("ret = %i", ret);
  return ret;
}
