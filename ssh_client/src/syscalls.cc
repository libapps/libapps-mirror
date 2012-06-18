// Copyright (c) 2012 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.
#include <netdb.h>
#include <pthread.h>
#include <pwd.h>
#include <stdarg.h>
#include <string.h>
#include <stdio.h>
#include <sys/socket.h>
#include <sys/types.h>
#include <termios.h>

#include "nacl-mounts/base/irt_syscalls.h"

#include "file_system.h"

extern "C" {

#define DECLARE(name) static __typeof__(__nacl_irt_##name) \
    __nacl_irt_##name##_real;
#define DO_WRAP(name) do { \
    __nacl_irt_##name##_real = __nacl_irt_##name; \
    __nacl_irt_##name = __nacl_irt_##name##_wrap; \
  } while (0)
#define WRAP(name) __nacl_irt_##name##_wrap
#define REAL(name) __nacl_irt_##name##_real

DECLARE(open);
DECLARE(close);
DECLARE(read);
DECLARE(write);
DECLARE(seek);
DECLARE(dup);
DECLARE(dup2);
DECLARE(stat);
DECLARE(fstat);
DECLARE(getdents);

void debug_log(const char* format, ...) {
  va_list ap;
  va_start(ap, format);
  vfprintf(stderr, format, ap);
  va_end(ap);
}

static int WRAP(open)(const char *pathname, int oflag, mode_t cmode,
                      int *newfd) {
  LOG("open: %s\n", pathname);
  return FileSystem::GetFileSystem()->open(pathname, oflag, cmode, newfd);
}

static int WRAP(close)(int fd) {
  LOG("close: %d\n", fd);
  return FileSystem::GetFileSystem()->close(fd);
}

static int WRAP(read)(int fd, void *buf, size_t count, size_t *nread) {
  VLOG("read: %d %d\n", fd, count);
  return FileSystem::GetFileSystem()->read(fd, (char*)buf, count, nread);
}

static int WRAP(write)(int fd, const void *buf, size_t count, size_t *nwrote) {
  if (fd != 1 && fd != 2)
    VLOG("write: %d %d\n", fd, count);
#ifndef NDEBUG
  if (fd == 1 || fd == 2) {
    REAL(write)(fd, buf, count, nwrote);
    if (fd == 2)
      return 0;
  }
#endif
  return FileSystem::GetFileSystem()->write(fd, (const char*)buf, count, nwrote);
}

static int WRAP(seek)(int fd, nacl_abi_off_t offset, int whence,
               nacl_abi_off_t* new_offset) {
  LOG("seek: %d %d %d\n", fd, (int)offset, whence);
  return FileSystem::GetFileSystem()->seek(fd, offset, whence, new_offset);
}

static int WRAP(dup)(int fd, int* newfd) {
  LOG("dup: %d\n", fd);
  return FileSystem::GetFileSystem()->dup(fd, newfd);
}

static int WRAP(dup2)(int fd, int newfd) {
  LOG("dup2: %d\n", fd);
  return FileSystem::GetFileSystem()->dup2(fd, newfd);
}

static int WRAP(stat)(const char *pathname, struct nacl_abi_stat *buf) {
  LOG("stat: %s\n", pathname);
  return FileSystem::GetFileSystem()->stat(pathname, buf);
}

static int WRAP(fstat)(int fd, struct nacl_abi_stat *buf) {
  LOG("fstat: %d\n", fd);
  return FileSystem::GetFileSystem()->fstat(fd, buf);
}

static int WRAP(getdents)(int fd, dirent* nacl_buf, size_t nacl_count,
                          size_t *nread) {
  LOG("getdents: %d\n", fd);
  return FileSystem::GetFileSystem()->getdents(fd, nacl_buf, nacl_count, nread);
}

int isatty(int fd) {
  LOG("isatty: %d\n", fd);
  return FileSystem::GetFileSystem()->isatty(fd);
}

int fcntl(int fd, int cmd, ...) {
  LOG("fcntl: %d %d\n", fd, cmd);
  va_list ap;
  va_start(ap, cmd);
  int ret = FileSystem::GetFileSystem()->fcntl(fd, cmd, ap);
  va_end(ap);
  return ret;
}

int ioctl(int fd, long unsigned request, ...) {
  LOG("ioctl: %d %d\n", fd, request);
  va_list ap;
  va_start(ap, request);
  int ret = FileSystem::GetFileSystem()->ioctl(fd, request, ap);
  va_end(ap);
  return ret;
}

int select(int nfds, fd_set *readfds, fd_set *writefds,
           fd_set *exceptfds, struct timeval *timeout) {
  VLOG("select: %d\n", nfds);
  return FileSystem::GetFileSystem()->select(nfds, readfds, writefds, exceptfds,
                                             timeout);
}

//------------------------------------------------------------------------------

void exit(int status) {
  LOG("exit: %d\n", status);
  FileSystem::GetFileSystem()->exit(status);
  assert(0);
}

void _exit(int status) {
  LOG("_exit: %d\n", status);
  FileSystem::GetFileSystem()->exit(status);
  assert(0);
}

void abort() {
  LOG("abort\n");
  FileSystem::GetFileSystem()->exit(-1);
  assert(0);
}

int seteuid(uid_t euid) {
  LOG("seteuid: %d\n", euid);
  return 0;
}

int setresgid(gid_t rgid, gid_t egid, gid_t sgid) {
  LOG("setresgid: %d %d %d\n", rgid, egid, sgid);
  return 0;
}

int setresuid(uid_t ruid, uid_t euid, uid_t suid) {
  LOG("setresuid: %d %d %d\n", ruid, euid, suid);
  return 0;
}

struct passwd* getpwuid(uid_t uid) {
  LOG("getpwuid: %d\n", uid);
  static struct passwd pwd;
  pwd.pw_name = (char*)"";
  pwd.pw_passwd = (char*)"";
  pwd.pw_uid = 0;
  pwd.pw_gid = 0;
  pwd.pw_gecos = (char*)"";
  pwd.pw_dir = (char*)"";
  pwd.pw_shell = (char*)"";
  return &pwd;
}

int gethostname(char *name, size_t len) {
  const char* kHostname = "localhost";
  strncpy(name, kHostname, len);
  return 0;
}

int getaddrinfo(const char* hostname, const char* servname,
                const struct addrinfo* hints, struct addrinfo** res) {
  LOG("getaddrinfo: %s %s\n",
      hostname ? hostname : "", servname ? servname : "");
  return FileSystem::GetFileSystem()->getaddrinfo(
      hostname, servname, hints, res);
}

void freeaddrinfo(struct addrinfo* ai) {
  LOG("freeaddrinfo\n");
  return FileSystem::GetFileSystem()->freeaddrinfo(ai);
}

int getnameinfo(const struct sockaddr *sa, socklen_t salen,
                char *host, socklen_t hostlen,
                char *serv, socklen_t servlen, unsigned int flags) {
  LOG("getnameinfo\n");
  return FileSystem::GetFileSystem()->getnameinfo(
      sa, salen, host, hostlen, serv, servlen, flags);
}

int socket(int socket_family, int socket_type, int protocol) {
  LOG("socket: %d %d %d\n", socket_family, socket_type, protocol);
  return FileSystem::GetFileSystem()->socket(
      socket_family, socket_type, protocol);
}

int connect(int sockfd, const struct sockaddr *serv_addr, socklen_t addrlen) {
  LOG("connect: %d\n", sockfd);
  return FileSystem::GetFileSystem()->connect(sockfd, serv_addr, addrlen);
}

pid_t waitpid(pid_t pid, int *status, int options) {
  LOG("waitpid: %d\n", pid);
  return -1;
}

int accept(int sockfd, struct sockaddr *addr, socklen_t *addrlen) {
  LOG("accept: %d\n", sockfd);
  return FileSystem::GetFileSystem()->accept(sockfd, addr, addrlen);
}

int sigaction(int signum, const struct sigaction *act, struct sigaction *oldact) {
  LOG("sigaction: %d\n", signum);
  return FileSystem::GetFileSystem()->sigaction(signum, act, oldact);
}

int kill(pid_t pid, int sig) {
  LOG("kill: %d\n", pid);
  return -1;
}

pid_t fork(void) {
  LOG("fork\n");
  return -1;
}

pid_t getpid(void) {
  LOG("getpid\n");
  return 100;
}

int bind(int sockfd, const struct sockaddr *my_addr, socklen_t addrlen) {
  LOG("bind: %d\n", sockfd);
  return FileSystem::GetFileSystem()->bind(sockfd, my_addr, addrlen);
}

int getpeername(int socket, struct sockaddr * address,
                socklen_t * address_len) {
  LOG("getpeername: %d\n", socket);
  return -1;
}

int getsockname(int s, struct sockaddr *name, socklen_t *namelen) {
  LOG("getsockname: %d\n", s);
  return -1;
}

int listen(int sockfd, int backlog) {
  LOG("listen: %d %d\n", sockfd, backlog);
  return FileSystem::GetFileSystem()->listen(sockfd, backlog);
}

int setsockopt(int socket, int level, int option_name,
               const void *option_value, socklen_t option_len) {
  LOG("setsockopt: %d %d %d\n", socket, level, option_name);
  return 0;
}

int getsockopt(int socket, int level, int option_name,
               void * option_value, socklen_t * option_len) {
  LOG("getsockopt: %d %d %d\n", socket, level, option_name);
  memset(option_value, 0, *option_len);
  return 0;
}

int shutdown(int s, int how) {
  LOG("shutdown: %d %d\n", s, how);
  return FileSystem::GetFileSystem()->shutdown(s, how);
}

int tcgetattr(int fd, struct termios* termios_p) {
  LOG("tcgetattr: %d\n", fd);
  return FileSystem::GetFileSystem()->tcgetattr(fd, termios_p);
}

int tcsetattr(int fd, int optional_actions, const struct termios* termios_p) {
  LOG("tcsetattr: %d\n", fd);
  return FileSystem::GetFileSystem()->tcsetattr(
      fd, optional_actions, termios_p);
}

char* getenv(const char* name) {
  LOG("getenv: %s\n", name);
  FileSystem* sys = FileSystem::GetFileSystemNoCrash();
  if (!sys)
    return NULL;

  char* value = const_cast<char*>(sys->getenv(name));
  LOG("  ->ENV[%s]=%s\n", name, value ? value : "<NULL>");
  return value;
}

int mkdir(const char* pathname, mode_t mode) {
  LOG("mkdir: %s\n", pathname);
  return FileSystem::GetFileSystem()->mkdir(pathname, mode);
}

int sched_setscheduler(pid_t pid, int policy,
                       const struct sched_param *param) {
  LOG("sched_setscheduler: %d %d\n", pid, policy);
  return 0;
}

ssize_t send(int fd, const void* buf, size_t count, int flags) {
  VLOG("send: %d %d\n", fd, count);
  size_t sent = 0;
  int rv = FileSystem::GetFileSystem()->write(fd, (const char*)buf,
                                              count, &sent);
  return rv == 0 ? sent : -1;
}

ssize_t recv(int fd, void *buf, size_t count, int flags) {
  VLOG("recv: %d %d\n", fd, count);
  size_t recvd = 0;
  int rv = FileSystem::GetFileSystem()->read(fd, (char*)buf, count, &recvd);
  return rv == 0 ? recvd : -1;
}

#if 0
ssize_t sendto(int sockfd, const void* buf, size_t len, int flags,
               const struct sockaddr* dest_addr, socklen_t addrlen) {
  LOG("sendto: %d %d %d\n", sockfd, len, flags);
  return FileSystem::GetFileSystem()->sendto(sockfd, buf, len, flags,
                                             dest_addr, addrlen);
}

ssize_t recvfrom(int socket, void *restrict buffer, size_t len, int flags,
                 struct sockaddr* restrict addr, socklen_t* restrict addrlen) {
  LOG("recvfrom: %d %d %d\n", socket, len, flags);
  return FileSystem::GetFileSystem()->recvfrom(socket, buffer, len, flags,
                                               addr, addrlen);
}
#endif

}

extern "C" void DoWrapSysCalls() {
  LOG("DoWrapSysCalls...\n");
  DO_WRAP(open);
  DO_WRAP(close);
  DO_WRAP(read);
  DO_WRAP(write);
  DO_WRAP(seek);
  DO_WRAP(dup);
  DO_WRAP(dup2);
  DO_WRAP(stat);
  DO_WRAP(fstat);
  DO_WRAP(getdents);
  LOG("DoWrapSysCalls done\n");
}
