/*
 * Copyright (c) 2011 The Native Client Authors. All rights reserved.
 * Use of this source code is governed by a BSD-style license that can be
 * found in the LICENSE file.
 */
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
#include "ssh_plugin.h"

extern "C" {

#define DECLARE(name) typeof(__nacl_irt_##name) __nacl_irt_##name##_real;
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

const char* __progname = "ssh";

void debug_log(const char* format, ...) {
  va_list ap;
  va_start(ap, format);
  vfprintf(stderr, format, ap);
  va_end(ap);
}

int WRAP(open)(const char *pathname, int oflag, mode_t cmode, int *newfd) {
  LOG("open: %s\n", pathname);
  return FileSystem::GetFileSystem()->open(pathname, oflag, cmode, newfd);
}

int WRAP(close)(int fd) {
  LOG("close: %d\n", fd);
  return FileSystem::GetFileSystem()->close(fd);
}

int WRAP(read)(int fd, void *buf, size_t count, size_t *nread) {
  LOG("read: %d %d\n", fd, count);
  return FileSystem::GetFileSystem()->read(fd, (char*)buf, count, nread);
}

int WRAP(write)(int fd, const void *buf, size_t count, size_t *nwrote) {
  if (fd != 1 && fd != 2)
    LOG("write: %d %d\n", fd, count);
#ifndef NDEBUG
  if (fd == 1 || fd == 2) {
    REAL(write)(fd, buf, count, nwrote);
    if (fd == 2)
      return 0;
  }
#endif
  return FileSystem::GetFileSystem()->write(fd, (const char*)buf, count, nwrote);
}

int WRAP(seek)(int fd, nacl_abi_off_t offset, int whence,
               nacl_abi_off_t* new_offset) {
  LOG("seek: %d %d %d\n", fd, (int)offset, whence);
  return FileSystem::GetFileSystem()->seek(fd, offset, whence, new_offset);
}

int WRAP(dup)(int fd, int* newfd) {
  LOG("dup: %d\n", fd);
  return FileSystem::GetFileSystem()->dup(fd, newfd);
}

int WRAP(dup2)(int fd, int newfd) {
  LOG("dup2: %d\n", fd);
  return FileSystem::GetFileSystem()->dup2(fd, newfd);
}

int WRAP(stat)(const char *pathname, struct nacl_abi_stat *buf) {
  LOG("stat: %s\n", pathname);
  return FileSystem::GetFileSystem()->stat(pathname, buf);
}

int WRAP(fstat)(int fd, struct nacl_abi_stat *buf) {
  LOG("fstat: %d\n", fd);
  return FileSystem::GetFileSystem()->fstat(fd, buf);
}

int WRAP(getdents)(int fd, dirent* nacl_buf, size_t nacl_count, size_t *nread) {
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
  LOG("select: %d\n", nfds);
  return FileSystem::GetFileSystem()->select(nfds, readfds, writefds, exceptfds,
                                           timeout);
}

//------------------------------------------------------------------------------

void exit(int status) {
  LOG("exit: %d\n", status);
  SshPluginInstance::GetInstance()->SessionClosed(status);
  pthread_exit(NULL);
}

void _exit(int status) {
  LOG("_exit: %d\n", status);
  SshPluginInstance::GetInstance()->SessionClosed(status);
  pthread_exit(NULL);
}

void abort() {
  LOG("abort\n");
  SshPluginInstance::GetInstance()->SessionClosed(-1);
  pthread_exit(NULL);
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
  strncpy(name, kHostname, strlen(kHostname));
  return 0;
}

struct hostent* gethostbyname(const char* name) {
  LOG("gethostbyname: %s\n", name);
  static struct hostent he;
  static struct in_addr addr;
  static struct in_addr* paddr[2] = { &addr, NULL };
  he.h_name = (char*)name;
  addr.s_addr = FileSystem::GetFileSystem()->gethostbyname(name);
  he.h_addr_list = (char**)paddr;
  return &he;
}

int socket(int socket_family, int socket_type, int protocol) {
  LOG("socket: %d %d %d\n", socket_family, socket_type, protocol);
  return FileSystem::GetFileSystem()->socket(
      socket_family, socket_type, protocol);
}

int connect(int sockfd, const struct sockaddr *serv_addr, socklen_t addrlen) {
  struct HostPort {
    unsigned short port;
    unsigned short laddr;
    unsigned short haddr;
  } __attribute__ ((aligned(1)));
  HostPort* temp = (HostPort*)&serv_addr->sa_data;
  unsigned short port = ntohs(temp->port);
  unsigned long addr = temp->laddr | (temp->haddr << 16);
  LOG("connect: %d %x:%d\n", sockfd, addr, port);
  return FileSystem::GetFileSystem()->connect(sockfd, addr, port);
}

pid_t waitpid(pid_t pid, int *status, int options) {
  LOG("waitpid: %d\n", pid);
  return -1;
}

int accept(int sockfd, struct sockaddr *addr, socklen_t *addrlen) {
  LOG("accept: %d\n", sockfd);
  return -1;
}

int sigaction(int signum, const struct sigaction *act, struct sigaction *oldact) {
  LOG("sigaction: %d\n", signum);
  return -1;
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
  return -1;
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
  LOG("listen: %d\n", sockfd);
  return -1;
}

int setsockopt(int socket, int level, int option_name,
               const void *option_value, socklen_t option_len) {
  LOG("setsockopt: %d\n", socket);
  return 0;
}

int getsockopt(int socket, int level, int option_name,
               void * option_value, socklen_t * option_len) {
  LOG("getsockopt: %d\n", socket);
  return -1;
}

int shutdown(int s, int how) {
  LOG("shutdown: %d\n", s);
  return -1;
}

int tcgetattr(int fd, struct termios *termios_p) {
  LOG("tcgetattr: %d\n", fd);
  memset(termios_p, 0, sizeof(*termios_p));
  return 0;
}

int tcsetattr(int fd, int optional_actions, const struct termios *termios_p) {
  LOG("tcsetattr: %d\n", fd);
  errno = ENOSYS;
  return -1;
}

char* getenv(const char* name) {
  LOG("getenv: %s\n", name);
  if (!strcmp(name, "TERM"))
    return (char*)"xterm";
  return NULL;
}

int mkdir(const char* pathname, mode_t mode) {
  LOG("mkdir: %s\n", pathname);
  return FileSystem::GetFileSystem()->mkdir(pathname, mode);
}

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
