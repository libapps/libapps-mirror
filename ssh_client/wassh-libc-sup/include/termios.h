// Copyright 2019 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

// https://pubs.opengroup.org/onlinepubs/9699919799/basedefs/termios.h.html

#ifndef WASSH_TERMIOS_H
#define WASSH_TERMIOS_H

// Flags for c_iflag.
#define BRKINT    0x0001
#define ICRNL     0x0002
#define IGNBRK    0x0004
#define IGNCR     0x0008
#define IGNPAR    0x0010
#define INLCR     0x0020
#define INPCK     0x0040
#define ISTRIP    0x0080
#define IXANY     0x0100
#define IXOFF     0x0200
#define IXON      0x0400
#define PARMRK    0x0800
#define IUTF8     0x1000

// Flags for c_oflag.
#define OPOST     0x0001
#define ONLCR     0x0002
#define OCRNL     0x0004
#define ONOCR     0x0008
#define ONLRET    0x0010
#define OFDEL     0x0020
#define OFILL     0x0040

// Flags for c_cflag.
#define CSIZE     0x0003
#define CS5       0
#define CS6       1
#define CS7       2
#define CS8       3
#define CSTOPB    0x0004
#define CREAD     0x0008
#define PARENB    0x0010
#define PARODD    0x0020
#define HUPCL     0x0040
#define CLOCAL    0x0080

// Flags for c_lflag.
#define ECHO      0x0001
#define ECHOE     0x0002
#define ECHOK     0x0004
#define ECHONL    0x0008
#define ICANON    0x0010
#define IEXTEN    0x0020
#define ISIG      0x0040
#define NOFLSH    0x0080
#define TOSTOP    0x0100

// Indexes into c_cc.
#define VINTR     0
#define VQUIT     1
#define VERASE    2
#define VKILL     3
#define VEOF      4
#define VTIME     5
#define VMIN      6
#define VSTART    7
#define VSTOP     8
#define VSUSP     9
#define VEOL      10

// Constants for speed_t.
#define B0        0
#define B50       1
#define B75       2
#define B110      3
#define B134      4
#define B150      5
#define B200      6
#define B300      7
#define B600      8
#define B1200     9
#define B1800     10
#define B2400     11
#define B4800     12
#define B9600     13
#define B19200    14
#define B38400    15

// Commands for tcsetattr.
#define TCSANOW   0
#define TCSADRAIN 1
#define TCSAFLUSH 2

// Commands for tcflush.
#define TCIFLUSH  0
#define TCOFLUSH  1
#define TCIOFLUSH 2

// Commands for tcflow.
#define TCIOFF    0
#define TCION     1
#define TCOOFF    2
#define TCOON     3

typedef unsigned char cc_t;
typedef char speed_t;
typedef unsigned short tcflag_t;

#define NCCS 32
struct termios {
  // POSIX required fields.
  tcflag_t c_iflag;
  tcflag_t c_oflag;
  tcflag_t c_cflag;
  tcflag_t c_lflag;
  cc_t c_cc[NCCS];
  // Not required by POSIX directly, but everyone uses these names.
  speed_t c_ispeed;
  speed_t c_ospeed;
};

#include <sys/cdefs.h>

__BEGIN_DECLS

speed_t cfgetispeed(const struct termios*);
speed_t cfgetospeed(const struct termios*);
int cfsetispeed(struct termios*, speed_t);
int cfsetospeed(struct termios*, speed_t);
int tcdrain(int);
int tcflow(int, int);
int tcflush(int, int);
int tcgetattr(int, struct termios*);
int tcsendbreak(int, int);
int tcsetattr(int, int, const struct termios*);

__END_DECLS

#endif
