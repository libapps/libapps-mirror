// Copyright 2019 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

// https://pubs.opengroup.org/onlinepubs/9699919799/basedefs/grp.h.html

#ifndef WASSH_GRP_H
#define WASSH_GRP_H

#include <sys/cdefs.h>
#include <sys/types.h>

__BEGIN_DECLS

struct group {
  // POSIX required fields.
  char* gr_name;    // The name of the group.
  gid_t gr_gid;     // Numerical group ID.
  char** gr_mem;    // Member names.
};

#define getgrnam(name) NULL
#define getgrgid(gid) NULL

#define setgrent()
#define endgrent()
#define getgrent() NULL

__END_DECLS

#endif
