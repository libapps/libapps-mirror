// Copyright 2019 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

// Stubs that haven't been implemented yet.
// Enough to get programs linking.

#include <assert.h>
#include <errno.h>
#include <net/if.h>
#include <netdb.h>
#include <pty.h>
#include <pwd.h>
#include <stdarg.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/socket.h>
#include <sys/types.h>
#include <syslog.h>

#include "debug.h"

#define STUB_ENOSYS(val, fmt, args...) \
  {                                    \
    _ENTER("STUB " fmt, ##args);       \
    errno = ENOSYS;                    \
    _EXIT("ENOSYS");                   \
    return val;                        \
  }

#define STUB_RETURN(val, fmt, args...) \
  {                                    \
    _ENTER("STUB " fmt, ##args);       \
    _EXIT("return " #val);             \
    return val;                        \
  }

ssize_t sendmsg(int sockfd, const struct msghdr* msg, int flags) {
  STUB_ENOSYS(-1, "sockfd=%i msg=%p flags=%#x", sockfd, msg, flags);
}

int socketpair(int domain, int type, int protocol, int sv[2]) {
  STUB_ENOSYS(-1, "domain=%i type=%i protocol=%i sv=%p", domain, type, protocol,
              sv);
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

// Chrome APIs don't currently support network interfaces which can show up in
// IPv6 link-local addresses.
char* if_indextoname(unsigned ifindex, char* ifname) {
  STUB_ENOSYS(NULL, "ifindex=%i ifname=%p", ifindex, ifname);
}
unsigned if_nametoindex(const char* ifname) {
  STUB_RETURN(1, "ifname={%s}", ifname);
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

char* ptsname(int fd) {
  static char path[10];
  strncpy(path, "/dev/tty", sizeof(path));
  return path;
}

int openpty(int* amaster,
            int* aslave,
            char* name,
            const struct termios* termp,
            const struct winsize* winp) {
  errno = ENOENT;
  return -1;
}

struct passwd* getpwuid(uid_t uid) {  // NOLINT(runtime/threadsafe_fn)
  static struct passwd pwd;
  struct passwd* result;
  getpwuid_r(uid, &pwd, NULL, 0, &result);
  return result;
}
int getpwuid_r(uid_t uid,
               struct passwd* pwd,
               char* buffer,
               size_t buflen,
               struct passwd** result) {
  pwd->pw_name = (char*)"";
  pwd->pw_passwd = (char*)"";
  pwd->pw_uid = 0;
  pwd->pw_gid = 0;
  pwd->pw_dir = (char*)"";
  pwd->pw_shell = (char*)"";
  *result = pwd;
  return 0;
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
int execve(const char* path, char* const argv[], char* const envp[]) {
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

// The WASI system requires us to pass in a bunch of open file descriptors for
// access to file system paths.  If we close them, then we're shut off from the
// entire file system.  Plus, we know that we aren't leaking random fd's into
// the process that ssh has to protect itself from.
//
// POSIX also recognizes this as a possibility in a conforming environment which
// is why they don't support the fundamental concept of blindly closing fds.
// https://man7.org/linux/man-pages/man3/close.3p.html#RATIONALE
//
// For example, basic ssh breaks pretty quickly if it sanitizes on startup.
// https://crbug.com/1312165
int closefrom(int fd) {
  STUB_RETURN(0, "fd=%i", fd);
}

// C++ exceptions are fatal and never caught.  Which is OK if the codebase only
// throws exceptions to abort rather than dynamic recovery.
void* __cxa_allocate_exception(size_t thrown_size) {
  fprintf(stderr, "\r\nC++ (allocate) exceptions are disabled.\r\n");
  abort();
}
void __cxa_throw(void* thrown_exception, void* tinfo, void (*dest)(void*)) {
  fprintf(stderr, "\r\nC++ (throw) exceptions are disabled.\r\n");
  abort();
}
