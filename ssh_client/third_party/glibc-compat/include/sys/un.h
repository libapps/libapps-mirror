/*
 * Copyright 2015 The Native Client Authors. All rights reserved.
 * Use of this source code is governed by a BSD-style license that can be
 * found in the LICENSE file.
 */
#ifndef GLIBCEMU_SYS_UN_H
#define GLIBCEMU_SYS_UN_H       1

#include <sys/socket.h>

struct sockaddr_un {
	sa_family_t     sun_family;      /* address family */
	char            sun_path[108];
};

#endif /* GLIBCEMU_SYS_UN_H */
