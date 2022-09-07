// Copyright 2020 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

// Implementation for termios APIs.
// For now we assume there is only ever one tty.

#include <termios.h>
#include <unistd.h>

#include "debug.h"

static struct termios tio = {
  .c_iflag = ICRNL | IXON | IXOFF | IUTF8,
  .c_oflag = OPOST | ONLCR,
  .c_cflag = CREAD | 077,
  .c_lflag =
      ISIG | ICANON | ECHO | ECHOE | ECHOK | IEXTEN,
  .c_ispeed = B38400,
  .c_ospeed = B38400,
  .c_cc[VINTR] = 3,
  .c_cc[VQUIT] = 28,
  .c_cc[VERASE] = 127,
  .c_cc[VKILL] = 21,
  .c_cc[VEOF] = 4,
  .c_cc[VTIME] = 0,
  .c_cc[VMIN] = 1,
  .c_cc[VSTART] = 17,
  .c_cc[VSTOP] = 19,
  .c_cc[VSUSP] = 26,
  .c_cc[VEOL] = 0,
};

speed_t cfgetispeed(const struct termios* termios_p) {
  _ENTER("termios=%p", termios_p);
  _EXIT("ret = %u", termios_p->c_ispeed);
  return termios_p->c_ispeed;
}

speed_t cfgetospeed(const struct termios* termios_p) {
  _ENTER("termios=%p", termios_p);
  _EXIT("ret = %u", termios_p->c_ospeed);
  return termios_p->c_ospeed;
}

int cfsetispeed(struct termios* termios_p, speed_t speed) {
  _ENTER("termios=%p speed=%u", termios_p, speed);
  termios_p->c_ispeed = speed;
  _EXIT("ret = 0");
  return 0;
}

int cfsetospeed(struct termios* termios_p, speed_t speed) {
  _ENTER("termios=%p speed=%u", termios_p, speed);
  termios_p->c_ospeed = speed;
  _EXIT("ret = 0");
  return 0;
}

int tcgetattr(int fd, struct termios* termios_p) {
  _ENTER("fd=%i termios=%p", fd, termios_p);
  *termios_p = tio;
  _EXIT("ret = 0");
  return 0;
}

int tcsetattr(int fd, int optional_actions, const struct termios* termios_p) {
  _ENTER("fd=%i actions=%i termios=%p", fd, optional_actions, termios_p);
  switch (optional_actions) {
    case TCSANOW:
      _MID("TCSANOW");
      break;
    case TCSADRAIN:
      _MID("TCSADRAIN");
      break;
    case TCSAFLUSH:
      _MID("TCSAFLUSH");
      break;
    default:
      _MID("actions=???");
      break;
  }
  _MID("c_iflag=%#x c_oflag=%#x c_cflag=%#x c_lflag=%#x",
       termios_p->c_iflag, termios_p->c_oflag, termios_p->c_cflag,
       termios_p->c_lflag);
#define LOG_FLAG(flag) _MID(" %s" #flag, termios_p->c_lflag & flag ? "" : "-")
  LOG_FLAG(ICANON);
  LOG_FLAG(ISIG);
  LOG_FLAG(ECHO);
  LOG_FLAG(ECHOE);
  LOG_FLAG(ECHOK);
  LOG_FLAG(ECHONL);
#undef LOG_FLAG

  tio = *termios_p;
  _EXIT("ret = 0");
  return 0;
}
