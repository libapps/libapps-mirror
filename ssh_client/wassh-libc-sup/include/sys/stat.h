// Copyright 2019 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

// https://pubs.opengroup.org/onlinepubs/9699919799/basedefs/sys_stat.h.html

#ifndef WASSH_SYS_STAT_H
#define WASSH_SYS_STAT_H

#include_next <sys/stat.h>

#include <sys/cdefs.h>

__BEGIN_DECLS

mode_t umask(mode_t);
int chown(const char*, uid_t, gid_t);
int chmod(const char*, mode_t);
int fchmod(int, mode_t);

__END_DECLS

#endif
