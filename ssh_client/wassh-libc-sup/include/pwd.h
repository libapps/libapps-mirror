// Copyright 2019 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

// https://pubs.opengroup.org/onlinepubs/9699919799/basedefs/pwd.h.html

#ifndef WASSH_PWD_H
#define WASSH_PWD_H

#include <sys/types.h>

#include <sys/cdefs.h>

__BEGIN_DECLS

struct passwd {
  // POSIX required fields.
  char* pw_name;    // User's login name.
  uid_t pw_uid;     // Numerical user ID.
  gid_t pw_gid;     // Numerical group ID.
  char* pw_dir;     // Initial working directory.
  char* pw_shell;   // Program to use as shell.

  // OpenSSH requires these fields.
  char* pw_passwd;  // Password.
};

struct passwd* getpwnam(const char*);  // NOLINT(runtime/threadsafe_fn)
struct passwd* getpwuid(uid_t);  // NOLINT(runtime/threadsafe_fn)

#define setpwent()
#define endpwent()
#define getpwent() NULL

__END_DECLS

#endif
