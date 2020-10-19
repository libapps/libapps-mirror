// Copyright 2019 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

// Stubs that haven't been implemented yet.
// Enough to get programs linking.

#include <assert.h>
#include <errno.h>
#include <netdb.h>
#include <pwd.h>
#include <stdarg.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <syslog.h>

#include <arpa/inet.h>
#include <netinet/in.h>
#include <netinet/ip.h>
#include <sys/socket.h>
#include <sys/types.h>

#include "debug.h"

#define STUB_ENOSYS(val, fmt, args...) { \
  _ENTER("STUB " fmt, ##args); \
  errno = ENOSYS; \
  _EXIT("ENOSYS"); \
  return val; \
}

#define STUB_RETURN(val, fmt, args...) { \
  _ENTER("STUB " fmt, ##args); \
  _EXIT("return " #val); \
  return val; \
}

int bind(int sockfd, const struct sockaddr* addr, socklen_t addrlen) {
  STUB_ENOSYS(-1, "sockfd=%i addr=%p addrlen=%i", sockfd, addr, addrlen);
}

int listen(int sockfd, int backlog) {
  STUB_ENOSYS(-1, "sockfd=%i backlog=%i", sockfd, backlog);
}
int accept(int sockfd, struct sockaddr* addr, socklen_t* addrlen) {
  STUB_ENOSYS(-1, "");
}

// ssize_t send(int sockfd, const void* buf, size_t len, int flags);
ssize_t sendto(int sockfd, const void* buf, size_t len, int flags,
               const struct sockaddr* dest_addr, socklen_t addrlen) {
  STUB_ENOSYS(-1, "");
}
// ssize_t sendmsg(int sockfd, const struct msghdr* msg, int flags);
// ssize_t recv(int sockfd, void* buf, size_t len, int flags);
ssize_t recvfrom(int sockfd, void* buf, size_t len, int flags,
                 struct sockaddr* src_addr, socklen_t* addrlen) {
  STUB_ENOSYS(-1, "");
}
// ssize_t recvmsg(int sockfd, struct msghdr* msg, int flags);

int socketpair(int domain, int type, int protocol, int sv[2]) {
  STUB_ENOSYS(-1, "domain=%i type=%i protocol=%i sv=%p",
              domain, type, protocol, sv);
}

int getsockname(int sockfd, struct sockaddr* addr, socklen_t* addrlen) {
  _ENTER("sockfd=%i addr=%p addrlen=%p[%i]", sockfd, addr, addrlen, *addrlen);
  struct sockaddr_in* sin = (struct sockaddr_in*)addr;
  memset(sin, 0, sizeof(*sin));
  *addrlen = sizeof(*sin);
  sin->sin_family = AF_INET;
  sin->sin_port = htons(22);
  sin->sin_addr.s_addr = htonl(0x7f000001);
  _EXIT("return 0 {IPv4, localhost, 22}");
  return 0;
}
int getpeername(int sockfd, struct sockaddr* addr, socklen_t* addrlen) {
  STUB_ENOSYS(-1, "sockfd=%i addr=%p addrlen=%p[%i]",
              sockfd, addr, addrlen, *addrlen);
}

struct servent* getservbyname(const char* name, const char* proto) {
  STUB_ENOSYS(NULL, "name={%s} proto={%s}", name, proto);
}
struct servent* getservbyport(int port, const char* proto) {
  STUB_ENOSYS(NULL, "port=%i[BE] proto={%s}", port, proto);
}

int gethostname(char* name, size_t len) {
  strncpy(name, "localhost", len);
  return 0;
}

const char* gai_strerror(int errcode) {
  _ENTER("errcode=%i", errcode);
  _EXIT("<stub gai_strerror>");
  return "<stub gai_strerror>";
}
int getaddrinfo(const char* node, const char* service,
                const struct addrinfo* hints, struct addrinfo** res) {
  _ENTER("node={%s} service={%s} hints=%p res=%p", node, service, hints, res);

  char* endptr;
  long sin_port = strtol(service, &endptr, 10);
  if (*endptr != '\0' || sin_port < 1 || sin_port > 0xffff) {
    _EXIT("EAI_FAIL: bad service");
    return EAI_FAIL;
  }

  uint32_t s_addr;
  if (!strcmp(node, "localhost")) {
    s_addr = htonl(0x7f000001);
  } else if (inet_pton(AF_INET, node, &s_addr) != 1) {
    _EXIT("EAI_FAIL: bad IPv4 addr");
    return EAI_FAIL;
  }

  struct addrinfo* ret = malloc(sizeof(*ret));
  memset(ret, 0, sizeof(*ret));
  ret->ai_flags = 0;  // ???
  ret->ai_family = AF_INET;
  ret->ai_socktype = SOCK_STREAM;
  ret->ai_protocol = 0;
  union {
    struct sockaddr_storage storage;
    struct sockaddr sa;
    struct sockaddr_in sin;
  }* sa = malloc(sizeof(*sa));
  memset(sa, 0, sizeof(*sa));
  struct sockaddr_in* sin = &sa->sin;
  sin->sin_family = AF_INET;
  sin->sin_port = htons(sin_port);
  sin->sin_addr.s_addr = s_addr;
  ret->ai_addrlen = sizeof(*sa);
  ret->ai_addr = &sa->sa;
  ret->ai_canonname = NULL;
  ret->ai_next = NULL;
  *res = ret;
  _EXIT("return 0");
  return 0;
}
int getnameinfo(const struct sockaddr* addr, socklen_t addrlen, char* host,
                socklen_t hostlen, char* serv, socklen_t servlen, int flags) {
  _ENTER("STUB");
  strcpy(host, "localhost");  // NOLINT(runtime/printf)
  strcpy(serv, "22");  // NOLINT(runtime/printf)
  _EXIT("host=localhost serv=22");
  return 0;
}

void openlog(const char* ident, int option, int facility) {}
void syslog(int priority, const char* format, ...) {
  va_list ap;
  fprintf(stderr, "syslog: ");
  va_start(ap, format);
  vprintf(format, ap);
  va_end(ap);
}
void closelog(void) {}

int pipe(int pipefd[2]) {
  STUB_ENOSYS(-1, "");
}

struct passwd* getpwuid(uid_t uid) {  // NOLINT(runtime/threadsafe_fn)
  static struct passwd pwd;
  pwd.pw_name = (char*)"";
  pwd.pw_passwd = (char*)"";
  pwd.pw_uid = 0;
  pwd.pw_gid = 0;
  pwd.pw_dir = (char*)"";
  pwd.pw_shell = (char*)"";
  return &pwd;
}
mode_t umask(mode_t mask) {
  STUB_RETURN(0, "mask=%o", mask);
}
pid_t waitpid(pid_t pid, int* status, int options) {
  STUB_ENOSYS(-1, "");
}
int execv(const char* path, char* const argv[]) {
  STUB_ENOSYS(-1, "");
}
int execvp(const char* file, char* const argv[]) {
  STUB_ENOSYS(-1, "");
}
int system(const char* command) {
  STUB_ENOSYS(-1, "");
}
int execl(const char* path, const char* arg, ...) {
  STUB_ENOSYS(-1, "");
}
int execlp(const char* file, const char* arg, ...) {
  STUB_ENOSYS(-1, "");
}
struct passwd* getpwnam(const char* name) {  // NOLINT(runtime/threadsafe_fn)
  return getpwuid(0);
}
pid_t getppid(void) {
  STUB_RETURN(1, "");
}
pid_t getpgrp(void) {
  STUB_RETURN(1, "");
}
int chown(const char* path, uid_t uid, gid_t gid) {
  STUB_RETURN(0, "path={%s} uid=%i gid=%i", path, uid, gid);
}
int chmod(const char* path, mode_t mode) {
  STUB_RETURN(0, "path={%s} mode=%o", path, mode);
}
int fchmod(int fd, mode_t mode) {
  STUB_RETURN(0, "fd=%i mode=%o", fd, mode);
}
