// Copyright (c) 2012 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

#ifndef FILE_SYSTEM_H
#define FILE_SYSTEM_H

#include <assert.h>
#include <errno.h>
#include <memory.h>
#include <netdb.h>
#include <stdarg.h>
#include <stdio.h>
#include <sys/ioctl.h>
#include <sys/types.h>
#include <termios.h>
#include <unistd.h>

#include <map>
#include <string>

#include "ppapi/cpp/file_ref.h"
#include "ppapi/cpp/file_system.h"
#include "ppapi/cpp/private/host_resolver_private.h"
#include "ppapi/utility/completion_callback_factory.h"

#include "file_interfaces.h"
#include "pthread_helpers.h"

class FileSystem {
 public:
  FileSystem(pp::Instance* instance, OutputInterface* out);
  ~FileSystem();

  static FileStream* const kBadFileStream;

  // Return current file system for process. Instance of FileSystem must be
  // created before calling this function.
  static FileSystem* GetFileSystem();
  // Same as above function but return NULL if FileSystem doesn't exist yet.
  static FileSystem* GetFileSystemNoCrash();

  void WaitForStdFiles();

  Cond& cond() { return cond_; }
  Mutex& mutex() { return mutex_; }
  pp::Instance* instance() { return instance_; }

  void SetTerminalSize(unsigned short col, unsigned short row);
  bool GetTerminalSize(unsigned short* col, unsigned short* row);

  // Switch TCP sockets between JS and Pepper implementations.
  void UseJsSocket(bool use_js);

  static bool CreateNetAddress(const sockaddr* saddr, socklen_t addrlen,
                               PP_NetAddress_Private* addr);
  static bool CreateSocketAddress(const PP_NetAddress_Private& addr,
                                  sockaddr* saddr, socklen_t* addrlen);

  // Syscall implementations.
  int open(const char* pathname, int oflag, mode_t cmode, int* newfd);
  int close(int fd);
  int read(int fd, char* buf, size_t count, size_t* nread);
  int write(int fd, const char* buf, size_t count, size_t* nwrote);
  int seek(int fd, nacl_abi_off_t offset, int whence,
           nacl_abi_off_t* new_offset);
  int dup(int fd, int* newfd);
  int dup2(int fd, int newfd);
  int fstat(int fd, nacl_abi_stat* out);
  int stat(const char* pathname, nacl_abi_stat* out);
  void readpass(const char* prompt, char* buf, size_t buf_len, bool echo);

  int isatty(int fd);
  int tcgetattr(int fd, struct termios* termios_p);
  int tcsetattr(int fd, int optional_actions, const struct termios* termios_p);
  int fcntl(int fd, int cmd, va_list ap);
  int ioctl(int fd, int request, va_list ap);
  int select(int nfds, fd_set* readfds, fd_set* writefds,
             fd_set* exceptfds, struct timeval* timeout);

  int getaddrinfo(const char* hostname, const char* servname,
                  const addrinfo* hints, addrinfo** res);
  void freeaddrinfo(addrinfo* ai);
  int getnameinfo(const sockaddr* sa, socklen_t salen,
                  char* host, size_t hostlen,
                  char* serv, size_t servlen, int flags);

  int socket(int socket_family, int socket_type, int protocol);
  int connect(int sockfd, const sockaddr* serv_addr, socklen_t addrlen);
  int shutdown(int sockfd, int how);
  int bind(int sockfd, const sockaddr* serv_addr, socklen_t addrlen);
  int listen(int sockfd, int backlog);
  int accept(int sockfd, sockaddr* addr, socklen_t* addrlen);
  int getsockname(int s, sockaddr* name, socklen_t* namelen);
  ssize_t sendto(int sockfd, const char* buf, size_t len, int flags,
                 const sockaddr* dest_addr, socklen_t addrlen);
  ssize_t recvfrom(int socket, char* buffer, size_t len, int flags,
                   sockaddr* addr, socklen_t* addrlen);

  int mkdir(const char* pathname, mode_t mode);

  int sigaction(int signum,
                const struct sigaction* act,
                struct sigaction* oldact);
  void exit(int status);

  void ExitCodeAcked();
  void ReadPassResult(const std::string pass);

 private:
  typedef std::map<int, FileStream*> FileStreamMap;
  typedef std::map<std::string, PathHandler*> PathHandlerMap;
  typedef std::map<std::string, unsigned long> HostMap;
  typedef std::map<unsigned long, std::string> AddressMap;
  typedef std::map<int, int> SocketTypesMap;

  struct GetAddrInfoParams {
    const char* hostname;
    const char* servname;
    const struct addrinfo* hints;
    struct addrinfo** res;
  };

  void AddPathHandler(const std::string& path, PathHandler* handler);
  void AddFileStream(int fd, FileStream* stream);
  void RemoveFileStream(int fd);

  bool IsKnowDescriptor(int fd);
  FileStream* GetStream(int fd);

  uint32_t AddHostAddress(const char* name, uint32_t addr);
  addrinfo* CreateAddrInfo(const PP_NetAddress_Private& addr,
                           const addrinfo* hints,
                           const char* name);
  addrinfo* GetFakeAddress(const char* hostname, uint16_t port,
                           const addrinfo* hints);
  bool GetHostPort(const sockaddr* serv_addr, socklen_t addrlen,
                   std::string* hostname, uint16_t* port);
  bool IsAgentConnect(const sockaddr* serv_addr, socklen_t addrlen,
                      std::string* hostname, uint16_t* port);
  void Resolve(int32_t result, GetAddrInfoParams* params, int32_t* pres);
  void OnResolve(int32_t result, GetAddrInfoParams* params, int32_t* pres);

  void OnOpen(int32_t result, pp::FileSystem* fs);

  void MakeDirectory(int32_t result, const char* pathname, int32_t* pres);
  void OnMakeDirectory(int32_t result, pp::FileRef* file_ref, int32_t* pres);

  int GetFirstUnusedDescriptor();
  int IsReady(int nfds, fd_set* fds, bool (FileStream::*is_ready)(),
              bool apply);
  bool IsInterrupted();

  static const int kFileIDOffset = 100;
  static const unsigned long kFirstAddr = 0x00000000;

  static FileSystem* file_system_;

  pp::Instance* instance_;
  OutputInterface* output_;
  Cond cond_;
  Mutex mutex_;

  PathHandlerMap paths_;
  FileStreamMap streams_;
  pp::FileSystem* ppfs_;
  PathHandler* ppfs_path_handler_;
  bool fs_initialized_;
  pp::CompletionCallbackFactory<FileSystem> factory_;
  bool exit_code_acked_;
  std::string read_pass_result_;
  bool read_pass_available_;

  pp::HostResolverPrivate* host_resolver_;

  HostMap hosts_;
  AddressMap addrs_;
  unsigned long first_unused_addr_;
  bool use_js_socket_;

  unsigned short col_;
  unsigned short row_;
  bool is_resize_;
  void (*handler_sigwinch_)(int);

  // TODO(dpolukhin): remove this map and put all socket related info into
  // FileStream with type socket.
  SocketTypesMap socket_types_;

  DISALLOW_COPY_AND_ASSIGN(FileSystem);
};

#endif  // FILE_SYSTEM_H
