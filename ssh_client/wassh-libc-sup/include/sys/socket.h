// Copyright 2019 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

// https://pubs.opengroup.org/onlinepubs/9699919799/basedefs/sys_socket.h.html

#ifndef WASSH_SYS_SOCKET_H
#define WASSH_SYS_SOCKET_H

#include_next <sys/socket.h>

#include <sys/cdefs.h>

__BEGIN_DECLS

// These are the same defines that sys/socket.h has disabled.
#define SO_REUSEADDR 2
#define SO_ERROR     4
#define SO_KEEPALIVE 9

#define PF_UNSPEC    0
#define PF_LOCAL     1
#define PF_UNIX      PF_LOCAL

int accept(int, struct sockaddr*, socklen_t*);
int accept4(int, struct sockaddr*, socklen_t*, int);
int bind(int, const struct sockaddr*, socklen_t);
int connect(int, const struct sockaddr*, socklen_t);
int listen(int, int);
int shutdown(int, int);
int socket(int, int, int);

ssize_t send(int, const void*, size_t, int);
ssize_t sendto(int, const void*, size_t, int, const struct sockaddr*,
               socklen_t);
ssize_t recv(int, void*, size_t, int);
ssize_t recvfrom(int, void*, size_t, int, struct sockaddr*, socklen_t*);

int getsockopt(int, int, int, void*, socklen_t*);
int setsockopt(int, int, int, const void*, socklen_t);
int socketpair(int, int, int, int[2]);

int getsockname(int, struct sockaddr*, socklen_t*);
int getpeername(int, struct sockaddr*, socklen_t*);

__END_DECLS

#endif
