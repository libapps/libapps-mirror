// Copyright 2020 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

// https://linux.die.net/man/3/readpassphrase

#ifndef WASSH_READPASSPHRASE_H
#define WASSH_READPASSPHRASE_H

#include <sys/cdefs.h>

#define RPP_ECHO_OFF    0x00
#define RPP_ECHO_ON     0x01
#define RPP_REQUIRE_TTY 0x02

__BEGIN_DECLS

char* readpassphrase(const char* prompt, char* buf, size_t buf_len, int flags);

__END_DECLS

#endif
