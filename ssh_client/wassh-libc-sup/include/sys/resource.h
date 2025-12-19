// Copyright 2024 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

// https://pubs.opengroup.org/onlinepubs/9799919799/basedefs/sys_resource.h.html

#ifndef WASSH_SYS_RESOURCE_H
#define WASSH_SYS_RESOURCE_H

// clang-format off
#include_next <sys/resource.h>
// clang-format on

#include <sys/cdefs.h>

__BEGIN_DECLS

typedef unsigned long long rlim_t;

struct rlimit {
  rlim_t rlim_cur;
  rlim_t rlim_max;
};

#define getrlimit(resource, rlim) 0
#define setrlimit(resource, rlim) 0

__END_DECLS

#endif
