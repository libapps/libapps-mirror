// Copyright (c) 2012 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.
#include <errno.h>
#include <netdb.h>
#include <pthread.h>
#include <pwd.h>
#include <stdarg.h>
#include <string.h>
#include <stdio.h>
#include <sys/socket.h>
#include <sys/types.h>
#include <sys/stat.h>
#include <termios.h>

#include "nacl-mounts/base/irt_syscalls.h"

#include "file_system.h"

extern "C" {

#define VLOG_SYSCALL_ENTER() VLOG("SYSCALL: %s(", __func__)
#define VLOG_SYSCALL_EXIT(ret) VLOG(") = %i\n", ret)
#define LOG_SYSCALL_ENTER() LOG("SYSCALL: %s(", __func__)
#define LOG_SYSCALL_EXIT(ret) \
  do { \
    LOG(") = %i", ret); \
    if (ret == -1) \
      LOG(" errno=%i(%s)", errno, strerror(errno)); \
    LOG("\n"); \
  } while (0)
#define LOG_SYSCALL_STUB(ret, fmt, args...) \
  LOG("SYSCALL: [stub] %s(" fmt ") = %i\n", __func__, ##args, ret)

#define WRAP(name) __user_irt_##name
#define REAL(name) libnacl_##name

/*
 * Wrapped functions will return 0/errno on success, and pass back the real
 * value via an argument.  Shuffle the values around to match standard C lib
 * API where errors are set in errno.
 */
#define HANDLE_ERRNO(call, success) \
  ({ \
    __typeof(success) ret = (call); \
    if (ret) { \
      errno = ret; \
      ret = -1; \
    } else { \
      ret = (success); \
    } \
    ret; \
  })

void debug_log(const char* format, ...) {
  // This shouldn't be necessary, but can't rely on the underlying C lib
  // not messing with the errno value.
  int saved = errno;
  va_list ap;
  va_start(ap, format);
  vfprintf(stderr, format, ap);
  va_end(ap);
  errno = saved;
}

static bool g_exit_called = false;

static int WRAP(open)(const char* pathname, int oflag, mode_t cmode,
                      int* newfd) {
  return FileSystem::GetFileSystem()->open(pathname, oflag, cmode, newfd);
}

#ifndef O_TMPFILE
# define O_TMPFILE 0
#endif
int open(const char* file, int oflag, ...) {
  LOG_SYSCALL_ENTER();
  int newfd;
  mode_t cmode = 0;

  // Only peel off the mode if the call requires it.  Otherwise we enter
  // "undefined" territory and get garbage or a crash or ...
  if (oflag & (O_CREAT | O_TMPFILE)) {
    va_list ap;
    va_start(ap, oflag);
    cmode = va_arg(ap, mode_t);
    va_end(ap);
  }
  LOG("file=\"%s\", flags=%#x[", file, oflag);
  switch (oflag & O_ACCMODE) {
    case O_RDONLY:
      LOG("O_RDONLY");
      break;
    case O_WRONLY:
      LOG("O_WRONLY");
      break;
    case O_RDWR:
      LOG("O_RDWR");
      break;
  }
  LOG("], mode=%#o", cmode);
  int ret = HANDLE_ERRNO(WRAP(open)(file, oflag, cmode, &newfd), newfd);
  LOG_SYSCALL_EXIT(ret);
  return ret;
}

static int WRAP(close)(int fd) {
  return FileSystem::GetFileSystem()->close(fd);
}

int close(int fd) {
  LOG_SYSCALL_ENTER();
  LOG("fd=%i", fd);
  int ret = HANDLE_ERRNO(WRAP(close)(fd), 0);
  LOG_SYSCALL_EXIT(ret);
  return ret;
}

static int WRAP(read)(int fd, void* buf, size_t count, size_t* nread) {
  return FileSystem::GetFileSystem()->read(fd, (char*)buf, count, nread);
}

ssize_t read(int fd, void* buf, size_t count) {
  VLOG_SYSCALL_ENTER();
  VLOG("fd=%d, buf=%p, count=%d", fd, buf, count);
  ssize_t rv;
  ssize_t ret = HANDLE_ERRNO(WRAP(read)(fd, buf, count, (size_t*)&rv), rv);
  VLOG_SYSCALL_EXIT(ret);
  return ret;
}

/* TODO(olonho): ugly hack to get access to the real write(). Fortunately,
   NaCl library ABI is pretty stable.*/
#define NACL_IRT_FDIO_v0_1      "nacl-irt-fdio-0.1"
extern struct nacl_irt_fdio __libnacl_irt_fdio;
struct nacl_irt_fdio {
  int (*close)(int fd);
  int (*dup)(int fd, int* newfd);
  int (*dup2)(int fd, int newfd);
  int (*read)(int fd, void* buf, size_t count, size_t* nread);
  int (*write)(int fd, const void* buf, size_t count, size_t* nwrote);
  int (*seek)(int fd, off_t offset, int whence, off_t* new_offset);
  int (*fstat)(int fd, struct stat* );
};

int libnacl_write(int fd, const void* buf, size_t count, size_t* nwrote) {
  return __libnacl_irt_fdio.write(fd, buf, count, nwrote);
}

static int WRAP(write)(int fd, const void* buf, size_t count, size_t* nwrote) {
#ifndef NDEBUG
  // Have debug builds write stdout/stderr to the program's stdout/stderr too.
  // This helps when debugging on Linux systems.  We also pass it back to the
  // JS layer as CrOS doesn't have a way of viewing the program's stdout/stderr.
  if (fd == 1 || fd == 2) {
    REAL(write)(fd, buf, count, nwrote);
  }
#endif
  return FileSystem::GetFileSystem()->write(fd, (const char*)buf, count,
                                            nwrote);
}

ssize_t write(int fd, const void* buf, size_t count) {
  if (fd != 1 && fd != 2) {
    VLOG_SYSCALL_ENTER();
    VLOG("fd=%i, buf=%p, count=%zu", fd, buf, count);
  }
  ssize_t rv;
  ssize_t ret = HANDLE_ERRNO(WRAP(write)(fd, buf, count, (size_t*)&rv), rv);
  if (fd != 1 && fd != 2)
    VLOG_SYSCALL_EXIT(ret);
  return ret;
}

static int WRAP(seek)(int fd, nacl_abi_off_t offset, int whence,
               nacl_abi_off_t* new_offset) {
  LOG("SYSCALL: seek: fd=%d offset=%d whence=%d\n", fd, (int)offset, whence);
  return FileSystem::GetFileSystem()->seek(fd, offset, whence, new_offset);
}

off_t lseek(int fd, off_t offset, int whence) {
  nacl_abi_off_t rv;
  return HANDLE_ERRNO(WRAP(seek)(fd, offset, whence, &rv), rv);
}

static int WRAP(dup)(int fd, int* newfd) {
  return FileSystem::GetFileSystem()->dup(fd, newfd);
}

int dup(int oldfd) {
  LOG_SYSCALL_ENTER();
  LOG("oldfd=%i", oldfd);
  int rv;
  int ret = HANDLE_ERRNO(WRAP(dup)(oldfd, &rv), rv);
  LOG_SYSCALL_EXIT(ret);
  return ret;
}

static int WRAP(dup2)(int fd, int newfd) {
  return FileSystem::GetFileSystem()->dup2(fd, newfd);
}

int dup2(int oldfd, int newfd) {
  LOG_SYSCALL_ENTER();
  LOG("oldfd=%i, newfd=%i", oldfd, newfd);
  int ret = HANDLE_ERRNO(WRAP(dup2)(oldfd, newfd), newfd);
  LOG_SYSCALL_EXIT(ret);
  return ret;
}

static int WRAP(stat)(const char* pathname, struct nacl_abi_stat* buf) {
  return FileSystem::GetFileSystem()->stat(pathname, buf);
}

static void stat_n2u(struct nacl_abi_stat* nacl_buf, struct stat* buf) {
  buf->st_dev = nacl_buf->nacl_abi_st_dev;
  buf->st_ino = nacl_buf->nacl_abi_st_ino;
  buf->st_mode = nacl_buf->nacl_abi_st_mode;
  buf->st_nlink = nacl_buf->nacl_abi_st_nlink;
  buf->st_uid = nacl_buf->nacl_abi_st_uid;
  buf->st_gid = nacl_buf->nacl_abi_st_gid;
  buf->st_rdev = nacl_buf->nacl_abi_st_rdev;
  buf->st_size = nacl_buf->nacl_abi_st_size;
  buf->st_blksize = nacl_buf->nacl_abi_st_blksize;
  buf->st_blocks = nacl_buf->nacl_abi_st_blocks;
  buf->st_atime = nacl_buf->nacl_abi_st_atime;
  buf->st_mtime = nacl_buf->nacl_abi_st_mtime;
  buf->st_ctime = nacl_buf->nacl_abi_st_ctime;
}

int stat(const char* path, struct stat* buf) {
  LOG_SYSCALL_ENTER();
  LOG("path=\"%s\", buf=%p", path, buf);
  struct nacl_abi_stat nacl_buf;
  int rv = WRAP(stat)(path, &nacl_buf);
  if (rv == 0)
    stat_n2u(&nacl_buf, buf);
  int ret = HANDLE_ERRNO(rv, 0);
  LOG_SYSCALL_EXIT(ret);
  return ret;
}

static int WRAP(fstat)(int fd, struct nacl_abi_stat* buf) {
  return FileSystem::GetFileSystem()->fstat(fd, buf);
}

int fstat(int fd, struct stat* buf) {
  LOG_SYSCALL_ENTER();
  LOG("fd=%i, buf=%p", fd, buf);
  struct nacl_abi_stat nacl_buf;
  int rv = WRAP(fstat)(fd, &nacl_buf);
  if (rv == 0)
    stat_n2u(&nacl_buf, buf);
  int ret = HANDLE_ERRNO(rv, 0);
  LOG_SYSCALL_EXIT(ret);
  return ret;
}

int isatty(int fd) {
  LOG_SYSCALL_ENTER();
  LOG("fd=%i", fd);
  int ret = FileSystem::GetFileSystem()->isatty(fd);
  LOG_SYSCALL_EXIT(ret);
  return ret;
}

int fcntl(int fd, int cmd, ...) {
  LOG_SYSCALL_ENTER();
  LOG("fd=%i, cmd=%#x", fd, cmd);
  va_list ap;
  va_start(ap, cmd);
  int ret = FileSystem::GetFileSystem()->fcntl(fd, cmd, ap);
  va_end(ap);
  LOG_SYSCALL_EXIT(ret);
  return ret;
}

int ioctl(int fd, unsigned long request, ...) {
  LOG_SYSCALL_ENTER();
  LOG("fd=%i, request=%#lx", fd, request);
  va_list ap;
  va_start(ap, request);
  int ret = FileSystem::GetFileSystem()->ioctl(fd, request, ap);
  va_end(ap);
  LOG_SYSCALL_EXIT(ret);
  return ret;
}

int select(int nfds, fd_set* readfds, fd_set* writefds,
           fd_set* exceptfds, struct timeval* timeout) {
  VLOG_SYSCALL_ENTER();
  VLOG("nfds=%d", nfds);
  int ret = FileSystem::GetFileSystem()->select(
      nfds, readfds, writefds, exceptfds, timeout);
  VLOG_SYSCALL_EXIT(ret);
  return ret;
}

//------------------------------------------------------------------------------

// Wrap exit and _exit so JavaScript gets our exit code. We don't wrap
// abort so that we have something to chain to, but abort has no exit
// code to report anyway.
void exit(int status) {
  LOG_SYSCALL_ENTER();
  LOG("status=%i", status);
  g_exit_called = true;
  FileSystem::GetFileSystem()->exit(status);
  LOG_SYSCALL_EXIT(status);
  abort();  // Can we chain to the real exit?
}

void _exit(int status) {
  LOG_SYSCALL_ENTER();
  LOG("status=%i", status);
  if (g_exit_called) {
    // Infinity exit loop detected. It happens in case of NewLib when abort
    // calls exit inside. The only thing we can do is to stop this thread.
    pthread_exit(NULL);
  }
  g_exit_called = true;
  FileSystem::GetFileSystem()->exit(status);
  LOG_SYSCALL_EXIT(status);
  abort();  // Can we chain to the real _exit?
}

int seteuid(uid_t euid) {
  LOG_SYSCALL_STUB(0, "euid=%i", euid);
  return 0;
}

int setresgid(gid_t rgid, gid_t egid, gid_t sgid) {
  LOG_SYSCALL_STUB(0, "rgid=%i, egid=%i, sgid=%i", rgid, egid, sgid);
  return 0;
}

int setresuid(uid_t ruid, uid_t euid, uid_t suid) {
  LOG_SYSCALL_STUB(0, "ruid=%i, euid=%i, suid=%i", ruid, euid, suid);
  return 0;
}

// We disable the threadsafe lint func here because it applies to the standard
// C library versions, not our stub one here that is actually safe.
struct passwd* getpwuid(uid_t uid) {  // NOLINT(runtime/threadsafe_fn)
  static struct passwd pwd;
  LOG("SYSCALL: [stub] %s(uid=%i) = %p\n", __func__, uid, &pwd);
  pwd.pw_name = (char*)"";
  pwd.pw_passwd = (char*)"";
  pwd.pw_uid = 0;
  pwd.pw_gid = 0;
  pwd.pw_gecos = (char*)"";
  pwd.pw_dir = (char*)"";
  pwd.pw_shell = (char*)"";
  return &pwd;
}

int gethostname(char* name, size_t len) {
  const char* kHostname = "localhost";
  strncpy(name, kHostname, len);
  LOG("SYSCALL: [stub] %s(name=%p[%s], len=%zu) = 0\n",
      __func__, name, name, len);
  return 0;
}

int getaddrinfo(const char* hostname, const char* servname,
                const struct addrinfo* hints, struct addrinfo** res) {
  LOG("SYSCALL: getaddrinfo: %s %s\n",
      hostname ? hostname : "", servname ? servname : "");
  return FileSystem::GetFileSystem()->getaddrinfo(
      hostname, servname, hints, res);
}

void freeaddrinfo(struct addrinfo* ai) {
  LOG("SYSCALL: freeaddrinfo\n");
  return FileSystem::GetFileSystem()->freeaddrinfo(ai);
}

int getnameinfo(const struct sockaddr* sa, socklen_t salen,
                char* host, socklen_t hostlen,
                char* serv, socklen_t servlen, unsigned int flags) {
  LOG("SYSCALL: getnameinfo\n");
  return FileSystem::GetFileSystem()->getnameinfo(
      sa, salen, host, hostlen, serv, servlen, flags);
}

int socket(int socket_family, int socket_type, int protocol) {
  LOG("SYSCALL: socket: %d %d %d\n", socket_family, socket_type, protocol);
  return FileSystem::GetFileSystem()->socket(
      socket_family, socket_type, protocol);
}

int connect(int sockfd, const struct sockaddr* serv_addr, socklen_t addrlen) {
  LOG("SYSCALL: connect: %d\n", sockfd);
  return FileSystem::GetFileSystem()->connect(sockfd, serv_addr, addrlen);
}

pid_t waitpid(pid_t pid, int* status, int options) {
  LOG_SYSCALL_STUB(-1, "pid=%i, status=%p, options=%i",
                   pid, status, options);
  return -1;
}

int accept(int sockfd, struct sockaddr* addr, socklen_t* addrlen) {
  LOG("SYSCALL: accept(sockfd=%i)\n", sockfd);
  return FileSystem::GetFileSystem()->accept(sockfd, addr, addrlen);
}

int sigaction(int signum, const struct sigaction* act,
              struct sigaction* oldact) {
  LOG_SYSCALL_ENTER();
  LOG("signum=%i, act=%p, oldact=%p", signum, act, oldact);
  int ret = FileSystem::GetFileSystem()->sigaction(signum, act, oldact);
  LOG_SYSCALL_EXIT(ret);
  return ret;
}

int kill(pid_t pid, int sig) {
  LOG_SYSCALL_STUB(-1, "pid=%i, sig=%i", pid, sig);
  return -1;
}

pid_t fork(void) {
  LOG_SYSCALL_STUB(-1, "");
  return -1;
}

pid_t getpid(void) {
  LOG_SYSCALL_STUB(100, "");
  return 100;
}

int bind(int sockfd, const struct sockaddr* my_addr, socklen_t addrlen) {
  LOG("SYSCALL: bind(sockfd=%i)\n", sockfd);
  return FileSystem::GetFileSystem()->bind(sockfd, my_addr, addrlen);
}

int getpeername(int socket, struct sockaddr* address,
                socklen_t* address_len) {
  LOG_SYSCALL_STUB(-1, "socket=%i, address=%p, addrlen=%p",
                   socket, address, address_len);
  return -1;
}

int getsockname(int s, struct sockaddr* name, socklen_t* namelen) {
  LOG("SYSCALL: getsockname(socket=%i)\n", s);
  return FileSystem::GetFileSystem()->getsockname(s, name, namelen);
}

int listen(int sockfd, int backlog) {
  LOG("SYSCALL: listen(sockfd=%i, backlog=%i)\n", sockfd, backlog);
  return FileSystem::GetFileSystem()->listen(sockfd, backlog);
}

int setsockopt(int socket, int level, int option_name,
               const void* option_value, socklen_t option_len) {
  LOG_SYSCALL_STUB(0, "socket=%i, level=%i, optname=%i, optval=%p, optlen=%i",
                   socket, level, option_name, option_value, option_len);
  return 0;
}

int getsockopt(int socket, int level, int option_name,
               void* option_value, socklen_t* option_len) {
  LOG_SYSCALL_STUB(0, "socket=%i, level=%i, optname=%i, optval=%p, optlen=%p",
                   socket, level, option_name, option_value, option_len);
  memset(option_value, 0, *option_len);
  return 0;
}

int shutdown(int s, int how) {
  LOG("SYSCALL: shutdown(socket=%i, how=%i)\n", s, how);
  return FileSystem::GetFileSystem()->shutdown(s, how);
}

int tcgetattr(int fd, struct termios* termios_p) {
  LOG_SYSCALL_ENTER();
  LOG("fd=%i, termios_p=%p", fd, termios_p);
  int ret = FileSystem::GetFileSystem()->tcgetattr(fd, termios_p);
  LOG_SYSCALL_EXIT(ret);
  return ret;
}

int tcsetattr(int fd, int optional_actions, const struct termios* termios_p) {
  LOG_SYSCALL_ENTER();
  LOG("fd=%i, actions=%i[", fd, optional_actions);
  switch (optional_actions) {
    case TCSANOW:
      LOG("TCSANOW");
      break;
    case TCSADRAIN:
      LOG("TCSADRAIN");
      break;
    case TCSAFLUSH:
      LOG("TCSAFLUSH");
      break;
    default:
      LOG("???");
      break;
  }
  LOG("], termios_p=%p", termios_p);
  if (termios_p) {
    LOG("{c_iflag=%#x, c_oflag=%#x, c_cflag=%#x, ",
        termios_p->c_iflag, termios_p->c_oflag, termios_p->c_cflag);
    LOG("c_lflag=%#x[", termios_p->c_lflag);
#define LOG_FLAG(flag) LOG(" %s" #flag, termios_p->c_lflag & flag ? "" : "-")
    LOG_FLAG(ICANON);
    LOG_FLAG(ISIG);
    LOG_FLAG(ECHO);
    LOG_FLAG(ECHOE);
    LOG_FLAG(ECHOK);
    LOG_FLAG(ECHONL);
#undef LOG_FLAG
    LOG("]}");
  }
  int ret = FileSystem::GetFileSystem()->tcsetattr(
      fd, optional_actions, termios_p);
  LOG_SYSCALL_EXIT(ret);
  return ret;
}

int mkdir(const char* pathname, mode_t mode) {
  LOG_SYSCALL_ENTER();
  LOG("path=\"%s\", mode=%#o", pathname, mode);
  int ret = FileSystem::GetFileSystem()->mkdir(pathname, mode);
  LOG_SYSCALL_EXIT(ret);
  return ret;
}

int sched_setscheduler(pid_t pid, int policy,
                       const struct sched_param* param) {
  LOG_SYSCALL_STUB(0, "pid=%i, policy=%i, param=%p", pid, policy, param);
  return 0;
}

ssize_t send(int fd, const void* buf, size_t count, int flags) {
  VLOG_SYSCALL_ENTER();
  VLOG("fd=%i, count=%i", fd, count);
  size_t sent = 0;
  int rv = FileSystem::GetFileSystem()->write(fd, (const char*)buf,
                                              count, &sent);
  ssize_t ret = HANDLE_ERRNO(rv, sent);
  VLOG_SYSCALL_EXIT(ret);
  return ret;
}

ssize_t recv(int fd, void* buf, size_t count, int flags) {
  VLOG_SYSCALL_ENTER();
  VLOG("fd=%i, buf=%p, len=%zu, flags=%#x", fd, buf, count, flags);
  size_t recvd = 0;
  int rv = FileSystem::GetFileSystem()->read(fd, (char*)buf, count, &recvd);
  ssize_t ret = HANDLE_ERRNO(rv, recvd);
  VLOG_SYSCALL_EXIT(ret);
  return ret;
}

ssize_t sendto(int sockfd, const void* buf, size_t len, int flags,
               const struct sockaddr* dest_addr, socklen_t addrlen) {
  LOG("SYSCALL: sendto(sockfd=%i, buf=%p, len=%zu, flags=%i, addr=%p, addrlen=%u)\n",
      sockfd, buf, len, flags, dest_addr, addrlen);
  return FileSystem::GetFileSystem()->sendto(sockfd, (char*)buf, len, flags,
                                             dest_addr, addrlen);
}

ssize_t recvfrom(int socket, void* buffer, size_t len, int flags,
                 struct sockaddr* addr, socklen_t* addrlen) {
  LOG("SYSCALL: recvfrom(sockfd=%i, buf=%p, len=%zu, flags=%i, addr=%p, addrlen=%p)\n",
      socket, buffer, len, flags, addr, addrlen);
  return FileSystem::GetFileSystem()->recvfrom(socket, (char*)buffer, len,
                                               flags, addr, addrlen);
}

int socketpair(int domain, int type, int protocol, int socket_vector[2]) {
  LOG_SYSCALL_STUB(-1, "domain=%i, type=%i, protocol=%i, sv=%p",
                   domain, type, protocol, socket_vector);
  errno = EACCES;
  return -1;
}

int clock_gettime(clockid_t clk_id, struct timespec* tp) {
  LOG_SYSCALL_STUB(-1, "clk_id=%i, timespec=%p", clk_id, tp);
  errno = EINVAL;
  return -1;
}

speed_t cfgetospeed(const struct termios* t) {
  return t->c_ospeed;
}

speed_t cfgetispeed(const struct termios* t) {
  return t->c_ispeed;
}

int cfsetospeed(struct termios* t, speed_t speed) {
  t->c_ospeed = speed;
  return 0;
}

int cfsetispeed(struct termios* t, speed_t speed) {
  t->c_ispeed = speed;
  return 0;
}

}  // extern "C"
