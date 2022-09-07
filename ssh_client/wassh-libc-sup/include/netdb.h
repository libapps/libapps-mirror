// Copyright 2019 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

// https://pubs.opengroup.org/onlinepubs/9699919799/basedefs/netdb.h.html

#ifndef WASSH_NETDB_H
#define WASSH_NETDB_H

#include <sys/socket.h>

#include <sys/cdefs.h>

__BEGIN_DECLS

struct hostent {
  // POSIX required fields.
  char* h_name;
  char** h_aliases;
  int h_addrtype;
  int h_length;
  char** h_addr_list;
};

// This is the old/deprecated API.
struct hostent* gethostbyname(const char*);

struct servent {
  char* s_name;
  char** s_aliases;
  int s_port;
  char* s_proto;
};

// An old API, but we still need to at least provide stubs.
struct servent* getservbyname(const char*, const char*);
struct servent* getservbyport(int, const char*);

struct protoent {
  char* p_name;
  char** p_aliases;
  int p_proto;
};

struct addrinfo {
  int ai_flags;
  int ai_family;
  int ai_socktype;
  int ai_protocol;
  socklen_t ai_addrlen;
  struct sockaddr* ai_addr;
  char* ai_canonname;
  struct addrinfo* ai_next;
};

// The new API.
const char* gai_strerror(int);
void freeaddrinfo(struct addrinfo*);
int getaddrinfo(const char*, const char*, const struct addrinfo*,
                struct addrinfo**);
int getnameinfo(const struct sockaddr*, socklen_t, char*, socklen_t, char*,
                socklen_t, int);

// Flags for ai_flags.
#define AI_PASSIVE     0x00000001
#define AI_CANONNAME   0x00000002
#define AI_NUMERICHOST 0x00000004
#define AI_NUMERICSERV 0x00000008
#define AI_V4MAPPED    0x00000010
#define AI_ALL         0x00000020
#define AI_ADDRCONFIG  0x00000040

// Errors.
#define EAI_AGAIN    -1
#define EAI_BADFLAGS -2
#define EAI_FAIL     -3
#define EAI_FAMILY   -4
#define EAI_MEMORY   -5
#define EAI_NONAME   -6
#define EAI_SERVICE  -7
#define EAI_SOCKTYPE -8
#define EAI_SYSTEM   -9
#define EAI_OVERFLOW -10

// Flags for getnameinfo.
#define NI_NOFQDN       0x0001
#define NI_NUMERICHOST  0x0002
#define NI_NAMEREQD     0x0004
#define NI_NUMERICSERV  0x0008
#define NI_NUMERICSCOPE 0x0010
#define NI_DGRAM        0x0020

// Non-standard defines, but OpenSSL currently wants it.
#define NI_MAXHOST 1025
#define NI_MAXSERV 32

__END_DECLS

#endif
