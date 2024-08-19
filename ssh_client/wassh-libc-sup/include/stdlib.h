// Copyright 2024 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

// https://pubs.opengroup.org/onlinepubs/9699919799/basedefs/stdlib.h.html

#ifndef WASSH_STDLIB_H
#define WASSH_STDLIB_H

#include_next <stdlib.h>

#include <sys/cdefs.h>

__BEGIN_DECLS

#define grantpt(fd) 0
#define unlockpt(fd) 0
char* ptsname(int fd);

__END_DECLS

#endif
