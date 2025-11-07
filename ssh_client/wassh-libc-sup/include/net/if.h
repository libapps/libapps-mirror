// Copyright 2019 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

// https://pubs.opengroup.org/onlinepubs/9799919799/basedefs/net_if.h.html

#ifndef WASSH_NET_IF_H
#define WASSH_NET_IF_H

#include <sys/cdefs.h>

__BEGIN_DECLS

char* if_indextoname(unsigned, char*);
unsigned if_nametoindex(const char*);

__END_DECLS

#endif
