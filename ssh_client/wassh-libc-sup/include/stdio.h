// Copyright 2019 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

// https://pubs.opengroup.org/onlinepubs/9799919799/basedefs/stdio.h.html

#ifndef WASSH_STDIO_H
#define WASSH_STDIO_H

// clang-format off
#include_next <stdio.h>
// clang-format on

#include <sys/cdefs.h>

__BEGIN_DECLS

#define popen(...) NULL
#define pclose(...) 0

__END_DECLS

#endif
