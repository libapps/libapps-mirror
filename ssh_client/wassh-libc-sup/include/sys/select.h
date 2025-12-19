// Copyright 2019 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

// https://pubs.opengroup.org/onlinepubs/9799919799/basedefs/sys_select.h.html

#ifndef WASSH_SYS_SELECT_H
#define WASSH_SYS_SELECT_H

// clang-format off
#include_next <sys/select.h>
// clang-format on

typedef unsigned long fd_mask;

#endif
