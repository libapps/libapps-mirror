/*
 * Copyright (c) 2014 The Native Client Authors. All rights reserved.
 * Use of this source code is governed by a BSD-style license that can be
 * found in the LICENSE file.
 */
#ifndef GLIBCEMU_RESOLV_H
#define GLIBCEMU_RESOLV_H 1

#include <sys/cdefs.h>

__BEGIN_DECLS

int b64_ntop(unsigned char const *, size_t, char *, size_t);
int b64_pton(char const *, unsigned char *, size_t);

__END_DECLS

#endif  /* GLIBCEMU_RESOLV_H */
