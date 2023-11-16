// Copyright 2022 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

// Network resolver logic.
// https://pubs.opengroup.org/onlinepubs/9699919799/functions/freeaddrinfo.html
// https://pubs.opengroup.org/onlinepubs/9699919799/functions/getnameinfo.html

#include <netdb.h>
#include <stdbool.h>
#include <stdlib.h>
#include <string.h>

#include <arpa/inet.h>
#include <netinet/in.h>
#include <sys/socket.h>
#include <sys/types.h>

#include "bh-syscalls.h"
#include "debug.h"

static const char *const gai_errors[] = {
  "Unknown error",
  "The name could not be resolved at this time",
  "The flags had an invalid value",
  "A non-recoverable error occurred",
  "The address family was not recognized",
  "Memory allocation failure",
  "The name does not resolve",
  "The service is not recognized",
  "The intended socket type was not recognized",
  "A system error occurred",
  "An argument buffer overflowed",
};

// Look up the network error code and convert it to a readable string.
const char* gai_strerror(int errcode) {
  const char* msg = gai_errors[0];
  _ENTER("errcode=%i", errcode);
  if (errcode <= EAI_AGAIN && errcode >= EAI_OVERFLOW)
    msg = gai_errors[-errcode];
  _EXIT("ret={%s}", msg);
  return msg;
}

// Determine whether the host is the "localhost".
static bool is_localhost(const char* node) {
  if (node == NULL)
    return true;

  if (!strcmp(node, "localhost"))
    return true;

  size_t len = strlen(node);
  static const char localdomain[] = ".localdomain";
  if (len >= sizeof(localdomain) &&
      !strcmp(node + len - sizeof(localdomain) + 1, localdomain))
    return true;

  static const char localhost[] = ".localhost";
  if (len >= sizeof(localhost) &&
      !strcmp(node + len - sizeof(localhost) + 1, localhost))
    return true;

  return false;
}

// Return addresses in the 0.0.0.0/8 "current network" pool.
static uint32_t next_fake_addr(const char* node) {
  static uint32_t fake_addr = 0;
  sock_register_fake_addr(fake_addr, node);
  return fake_addr++;
}

// Return addresses in the 100::/64 "discard" pool.
static struct in6_addr* next_fake_addr6(const char* node) {
  static struct in6_addr fake_addr = {1};
  // TODO(vapier): This only handles 256 IPv6 hosts.  Do we care?
  fake_addr.s6_addr[15] = next_fake_addr(node);
  return &fake_addr;
}

// Allocate a new addrinfo structure.
static struct addrinfo* new_addrinfo(int ai_family, int ai_socktype,
                                     int ai_protocol, long sin_port,
                                     void* s_addr) {
  struct addrinfo* ret = malloc(sizeof(*ret));
  memset(ret, 0, sizeof(*ret));
  // POSIX says flags are unused.
  ret->ai_flags = 0;
  ret->ai_socktype = ai_socktype;
  ret->ai_protocol = ai_protocol;
  union {
    struct sockaddr_storage storage;
    struct sockaddr sa;
    struct sockaddr_in sin;
    struct sockaddr_in6 sin6;
  }* sa = malloc(sizeof(*sa));
  memset(sa, 0, sizeof(*sa));
  if (ai_family == AF_INET6) {
    struct sockaddr_in6* sin6 = &sa->sin6;
    sin6->sin6_family = AF_INET6;
    sin6->sin6_port = htons(sin_port);
    memcpy(&sin6->sin6_addr, s_addr, sizeof(sin6->sin6_addr));
  } else {
    struct sockaddr_in* sin = &sa->sin;
    sin->sin_family = AF_INET;
    sin->sin_port = htons(sin_port);
    memcpy(&sin->sin_addr.s_addr, s_addr, sizeof(sin->sin_addr.s_addr));
  }
  ret->ai_family = ai_family;
  ret->ai_addrlen = sizeof(*sa);
  ret->ai_addr = &sa->sa;
  ret->ai_canonname = NULL;
  ret->ai_next = NULL;
  return ret;
}

// Resolve a hostname into an IP address.
//
// We don't implement AI_ADDRCONFIG or AI_V4MAPPED as nothing uses them atm.
//
// TODO(vapier): Implement support for AI_PASSIVE.
int getaddrinfo(const char* node, const char* service,
                const struct addrinfo* hints, struct addrinfo** res) {
  _ENTER("node={%s} service={%s} hints=%p res=%p", node, service, hints, res);

  int ai_protocol = 0;

  // Unpack the hints if specified.
  int ai_family = AF_UNSPEC;
  int ai_flags = 0;
  int ai_socktype = 0;
  if (hints) {
    ai_family = hints->ai_family;
    ai_flags = hints->ai_flags;
    ai_socktype = hints->ai_socktype;
    if (ai_family != AF_UNSPEC && ai_family != AF_INET &&
        ai_family != AF_INET6) {
      _EXIT("EAI_FAMILY: bad hints->ai_family");
      return EAI_FAMILY;
    }
  }

  // We only support numeric ports currently.
  long sin_port = 0;
  if (service) {
    char* endptr;
    sin_port = strtol(service, &endptr, 10);
    if (*endptr != '\0' || sin_port < 1 || sin_port > 0xffff) {
      if (ai_flags & AI_NUMERICSERV) {
        _EXIT("EAI_NONAME: non-numeric service (port)");
        return EAI_NONAME;
      } else {
        // We'd resolve the service here, if we wanted.
        _EXIT("EAI_FAIL: bad service (port)");
        return EAI_FAIL;
      }
    }
  }

  uint32_t s_addr;
  struct in6_addr sin6_addr;

  // If we're given an IP address w/AF_UNSPEC, lock the family to the right
  // value since trying to connect with AF_INET6 to an IPv4 address or vice
  // versa doesn't make sense.
  if (ai_family == AF_UNSPEC) {
    // If they passed an IP address in, then we don't need fake records.
    if (inet_pton(AF_INET6, node, &sin6_addr) == 1) {
      _MID("inet_pton detected numeric IPv6 address");
      ai_family = AF_INET6;
    } else if (inet_pton(AF_INET, node, &s_addr) == 1) {
      _MID("inet_pton detected numeric IPv4 address");
      ai_family = AF_INET;
    }
  }

  // Resolve a few known knowns and IP addresses.  Fake (delay) the rest.
  // The -1 protocol value indicates delayed hostname resolution -- the caller
  // uses that when creating the socket, so the JS side will see it and can
  // clearly differentiate between the two modes.
  if (ai_family == AF_INET6 || ai_family == AF_UNSPEC) {
    if (is_localhost(node)) {
      memcpy(&sin6_addr, &in6addr_loopback, sizeof(in6addr_loopback));
      ai_family = AF_INET6;
    } else if (inet_pton(AF_INET6, node, &sin6_addr) == 1) {
      ai_family = AF_INET6;
    } else {
      if (ai_flags & AI_NUMERICHOST) {
        _EXIT("EAI_NONAME: non-numeric IPv6 address");
        return EAI_NONAME;
      } else {
        _MID("adding fake IPv6 result");
        ai_protocol = -1;
        memcpy(&sin6_addr, next_fake_addr6(node), sizeof(sin6_addr));
      }
    }
  }
  if (ai_family == AF_INET || ai_family == AF_UNSPEC) {
    if (is_localhost(node)) {
      s_addr = htonl(0x7f000001);
      ai_family = AF_INET;
    } else if (inet_pton(AF_INET, node, &s_addr) == 1) {
      ai_family = AF_INET;
    } else {
      if (ai_flags & AI_NUMERICHOST) {
        _EXIT("EAI_NONAME: non-numeric IPv4 address");
        return EAI_NONAME;
      } else {
        _MID("adding fake IPv4 result");
        ai_protocol = -1;
        s_addr = next_fake_addr(node);
      }
    }
  }

  // Return the result.
  struct addrinfo* ret6;
  struct addrinfo* ret4;
  if (ai_family == AF_INET6 || ai_family == AF_UNSPEC) {
    _MID("adding AF_INET6 result");
    ret6 = new_addrinfo(AF_INET6, ai_socktype, ai_protocol, sin_port,
                        &sin6_addr);
    if (ai_family == AF_INET6) {
      *res = ret6;
      goto done;
    }
  }
  if (ai_family == AF_INET || ai_family == AF_UNSPEC) {
    _MID("adding AF_INET result");
    ret4 = new_addrinfo(AF_INET, ai_socktype, ai_protocol, sin_port, &s_addr);
    if (ai_family == AF_INET) {
      *res = ret4;
      goto done;
    }
  }
  // If we're still here, it's AF_UNSPEC, and we have 2 results.  The compiler
  // isn't able to detect this logic though, so help it a little.  We don't know
  // if the host actually has IPv6 & IPv4 records, but ssh will end up trying
  // both, and the Chrome side will handle the error when connecting.
  if (ai_family != AF_UNSPEC) {
    _EXIT("unsupported ai_family");
    return 1;
  }
  ret6->ai_next = ret4;
  *res = ret6;
 done:
  _EXIT("return 0");
  return 0;
}

// Free all the address structures.
void freeaddrinfo(struct addrinfo* ai) {
  _ENTER("ai=%p", ai);
  while (ai != NULL) {
    struct addrinfo* next = ai->ai_next;
    free(ai->ai_addr);
    _MID("free=%p", ai);
    free(ai);
    ai = next;
  }
  _EXIT("done");
}

// Translate a socket address to a hostname (if resolvable) & port.
//
// This stub always returns IP addresses and doesn't attempt reverse lookups.
int getnameinfo(const struct sockaddr* sa, socklen_t salen,
                char* node, socklen_t nodelen,
                char* service, socklen_t servicelen,
                int flags) {
  _ENTER("sa=%p salen=%u node=%p nodelen=%u service=%p servicelen=%u flags=%x",
         sa, salen, node, nodelen, service, servicelen, flags);

  if (sa->sa_family != AF_INET && sa->sa_family != AF_INET6) {
    _EXIT("EAI_FAMILY");
    return EAI_FAMILY;
  }

  const struct sockaddr_in6* sin6 = (const struct sockaddr_in6*)sa;
  const struct sockaddr_in* sin = (const struct sockaddr_in*)sa;

  if (node) {
    if (sa->sa_family == AF_INET6)
      inet_ntop(AF_INET6, &sin6->sin6_addr, node, nodelen);
    else
      inet_ntop(AF_INET, &sin->sin_addr, node, nodelen);
  }

  if (service)
    snprintf(service, servicelen, "%d", ntohs(sin->sin_port));

  _EXIT("node={%s} service={%s}", node ? : "", service ? : "");
  return 0;
}
