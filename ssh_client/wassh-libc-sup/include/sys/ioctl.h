// Copyright 2019 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

#ifndef WASSH_SYS_IOCTL_H
#define WASSH_SYS_IOCTL_H

#include_next <sys/ioctl.h>

#define TIOCGPGRP 0x540F
#define TIOCGWINSZ 0x5413
#define TIOCSWINSZ 0x5414

struct winsize {
  unsigned short ws_row;
  unsigned short ws_col;
  unsigned short ws_xpixel;
  unsigned short ws_ypixel;
};

#endif
