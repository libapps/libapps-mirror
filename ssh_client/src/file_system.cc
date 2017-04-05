// Copyright (c) 2012 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

#include "file_system.h"

#include <arpa/inet.h>
#include <netdb.h>
#include <netinet/in.h>
#include <signal.h>
#include <string.h>
#include <sys/socket.h>
#include <sys/time.h>

#include "irt.h"
#include "ppapi/cpp/file_ref.h"
#include "ppapi/cpp/private/net_address_private.h"

#include "dev_null.h"
#include "dev_random.h"
#include "js_file.h"
#include "pepper_file.h"
#include "tcp_server_socket.h"
#include "tcp_socket.h"
#include "udp_socket.h"

extern "C" void DoWrapSysCalls();

namespace {
const int64_t kMicrosecondsPerSecond = 1000 * 1000;
const int64_t kNanosecondsPerMicrosecond = 1000;

// Magic value; keep in sync with //ssh_client/openssh/authfd.c
const uint32_t kSshAgentFakeIP = 0x7F010203;
}

FileStream* const FileSystem::kBadFileStream = (FileStream*)-1;
FileSystem* FileSystem::file_system_ = NULL;

FileSystem::FileSystem(pp::Instance* instance, OutputInterface* out)
    : instance_(instance),
      output_(out),
      ppfs_(NULL),
      ppfs_path_handler_(NULL),
      fs_initialized_(false),
      factory_(this),
      host_resolver_(NULL),
      first_unused_addr_(kFirstAddr),
      use_js_socket_(false),
      col_(80), row_(24),
      is_resize_(false),
      handler_sigwinch_(SIG_DFL) {
  assert(!file_system_);
  file_system_ = this;

  pp::FileSystem* fs = new pp::FileSystem(instance,
                                          PP_FILESYSTEMTYPE_LOCALPERSISTENT);
  int32_t result = fs->Open(100 * 1024,
      factory_.NewCallback(&FileSystem::OnOpen, fs));
  if (result != PP_OK_COMPLETIONPENDING) {
    fs_initialized_ = true;
    delete fs;
  }

  JsFile::InitTerminal();
  JsFile* stdin_fs = new JsFile(0, O_RDONLY, out);
  if (out->OpenFile(0, "/dev/stdin", O_RDONLY, stdin_fs)) {
    AddFileStream(0, stdin_fs);
  }

  JsFile* stdout_fs = new JsFile(1, O_WRONLY, out);
  if (out->OpenFile(1, "/dev/stdout", O_WRONLY, stdout_fs)) {
    AddFileStream(1, stdout_fs);
  }

  JsFile* stderr_fs = new JsFile(2, O_WRONLY, out);
  if (out->OpenFile(2, "/dev/stderr", O_WRONLY, stderr_fs)) {
    AddFileStream(2, stderr_fs);
  }

  AddPathHandler("/dev/tty", new JsFileHandler(out));
  AddPathHandler("/dev/null", new DevNullHandler());

  nacl_irt_random random;
  if (nacl_interface_query(NACL_IRT_RANDOM_v0_1, &random, sizeof(random))) {
    AddPathHandler("/dev/random",
                   new DevRandomHandler(random.get_random_bytes));
  } else {
    LOG("Can't get " NACL_IRT_RANDOM_v0_1 " interface\n");
    abort();
  }

  // Add localhost 127.0.0.1
  AddHostAddress("localhost", 0x7F000001);

  DoWrapSysCalls();
}

FileSystem::~FileSystem() {
  for (PathHandlerMap::iterator it = paths_.begin(); it != paths_.end(); ++it)
    it->second->release();
  for (FileStreamMap::iterator it = streams_.begin(); it != streams_.end();
       ++it) {
    it->second->release();
  }
  if (ppfs_path_handler_)
    ppfs_path_handler_->release();
  delete ppfs_;
  file_system_ = NULL;
}

void FileSystem::OnOpen(int32_t result, pp::FileSystem* fs) {
  Mutex::Lock lock(mutex_);
  if (result == PP_OK) {
    ppfs_ = fs;
    ppfs_path_handler_ = new PepperFileHandler(fs);
  } else {
    delete fs;
  }
  fs_initialized_ = true;
  cond_.broadcast();
}

FileSystem* FileSystem::GetFileSystem() {
  assert(file_system_);
  return FileSystem::GetFileSystemNoCrash();
}

FileSystem* FileSystem::GetFileSystemNoCrash() {
  return file_system_;
}

void FileSystem::WaitForStdFiles() {
  JsFile* stdin_fs = static_cast<JsFile*>(GetStream(0));
  JsFile* stdout_fs = static_cast<JsFile*>(GetStream(1));
  JsFile* stderr_fs = static_cast<JsFile*>(GetStream(2));

  Mutex::Lock lock(mutex_);
  while (!(stdin_fs->is_open() && stdout_fs->is_open() && stderr_fs->is_open()))
    cond_.wait(mutex_);
}

void FileSystem::AddPathHandler(const std::string& path, PathHandler* handler) {
  assert(paths_.find(path) == paths_.end());
  paths_[path] = handler;
}

void FileSystem::AddFileStream(int fd, FileStream* stream) {
  assert(streams_.find(fd) == streams_.end() || !streams_.find(fd)->second);
  streams_[fd] = stream;
}

void FileSystem::RemoveFileStream(int fd) {
  assert(streams_.find(fd) != streams_.end());
  streams_.erase(fd);
}

int FileSystem::GetFirstUnusedDescriptor() {
  int fd = kFileIDOffset;
  while (IsKnowDescriptor(fd))
    fd++;
  return fd;
}

bool FileSystem::IsKnowDescriptor(int fd) {
  return streams_.find(fd) != streams_.end();
}

FileStream* FileSystem::GetStream(int fd) {
  FileStreamMap::iterator it = streams_.find(fd);
  return it != streams_.end() ? it->second : (FileStream*)NULL;
}

int FileSystem::open(const char* pathname, int oflag, mode_t cmode,
                     int* newfd) {
  Mutex::Lock lock(mutex_);
  PathHandlerMap::iterator it = paths_.find(pathname);
  PathHandler* handler = NULL;
  if (it != paths_.end()) {
    handler = it->second;
  } else {
    while (!fs_initialized_)
      cond_.wait(mutex_);
    handler = ppfs_path_handler_;
  }
  if (!handler)
    return ENOENT;

  int err;
  int fd = GetFirstUnusedDescriptor();
  // mark descriptor as used
  AddFileStream(fd, NULL);
  FileStream* stream = handler->open(fd, pathname, oflag, &err);
  if (!stream) {
    RemoveFileStream(fd);
    return err;
  }

  AddFileStream(fd, stream);
  *newfd = fd;
  return 0;
}

int FileSystem::close(int fd) {
  Mutex::Lock lock(mutex_);
  if (!IsKnowDescriptor(fd))
    return EBADF;

  FileStream* stream = GetStream(fd);
  if (stream && stream != kBadFileStream) {
    stream->close();
    stream->release();
  }
  RemoveFileStream(fd);
  return 0;
}

int FileSystem::read(int fd, char* buf, size_t count, size_t* nread) {
  Mutex::Lock lock(mutex_);
  FileStream* stream = GetStream(fd);
  if (stream && stream != kBadFileStream)
    return stream->read(buf, count, nread);
  else
    return EBADF;
}

int FileSystem::write(int fd, const char* buf, size_t count, size_t* nwrote) {
  Mutex::Lock lock(mutex_);
  FileStream* stream = GetStream(fd);
  if (stream && stream != kBadFileStream)
    return stream->write(buf, count, nwrote);
  else
    return EBADF;
}

int FileSystem::seek(int fd, nacl_abi_off_t offset, int whence,
                     nacl_abi_off_t* new_offset) {
  Mutex::Lock lock(mutex_);
  FileStream* stream = GetStream(fd);
  if (stream && stream != kBadFileStream)
    return stream->seek(offset, whence, new_offset);
  else
    return EBADF;
}

int FileSystem::dup(int fd, int* newfd) {
  Mutex::Lock lock(mutex_);
  FileStream* stream = GetStream(fd);
  if (!stream || stream == kBadFileStream)
    return EBADF;

  *newfd = GetFirstUnusedDescriptor();
  // Mark as used.
  AddFileStream(*newfd, NULL);
  FileStream* new_stream = stream->dup(*newfd);
  if (!new_stream) {
    RemoveFileStream(*newfd);
    return EACCES;
  }

  AddFileStream(*newfd, new_stream);
  return 0;
}

int FileSystem::dup2(int fd, int newfd) {
  Mutex::Lock lock(mutex_);
  FileStream* stream = GetStream(fd);
  if (!stream || stream == kBadFileStream)
    return EBADF;

  FileStream* new_stream = GetStream(newfd);
  if (stream == kBadFileStream) {
    return EBADF;
  } else if (!new_stream) {
    new_stream->close();
    new_stream->release();
    RemoveFileStream(newfd);
  }

  AddFileStream(newfd, NULL);
  new_stream = stream->dup(newfd);
  if (!new_stream)
    return EACCES;

  AddFileStream(newfd, new_stream);
  return 0;
}

int FileSystem::fstat(int fd, nacl_abi_stat* out) {
  Mutex::Lock lock(mutex_);
  FileStream* stream = GetStream(fd);
  if (stream && stream != kBadFileStream)
    return stream->fstat(out);
  else
    return EBADF;
}

int FileSystem::stat(const char* pathname, nacl_abi_stat* out) {
  Mutex::Lock lock(mutex_);
  PathHandlerMap::iterator it = paths_.find(pathname);
  PathHandler* handler = (it != paths_.end()) ? it->second : ppfs_path_handler_;
  if (!handler)
    return ENOENT;

  return handler->stat(pathname, out);
}

int FileSystem::getdents(int fd, dirent* buf, size_t count, size_t* nread) {
  Mutex::Lock lock(mutex_);
  FileStream* stream = GetStream(fd);
  if (stream && stream != kBadFileStream)
    return stream->getdents(buf, count, nread);
  else
    return EBADF;
}

int FileSystem::isatty(int fd) {
  Mutex::Lock lock(mutex_);
  FileStream* stream = GetStream(fd);
  if (stream && stream != kBadFileStream) {
    return stream->isatty();
  } else {
    errno = EBADF;
    return 0;
  }
}

int FileSystem::tcgetattr(int fd, struct termios* termios_p) {
  Mutex::Lock lock(mutex_);
  FileStream* stream = GetStream(fd);
  if (stream && stream != kBadFileStream) {
    return stream->tcgetattr(termios_p);
  } else {
    errno = EBADF;
    return -1;
  }
}

int FileSystem::tcsetattr(int fd, int optional_actions,
                          const termios* termios_p) {
  Mutex::Lock lock(mutex_);
  FileStream* stream = GetStream(fd);
  if (stream && stream != kBadFileStream) {
    return stream->tcsetattr(optional_actions, termios_p);
  } else {
    errno = EBADF;
    return -1;
  }
}

int FileSystem::fcntl(int fd, int cmd, va_list ap) {
  Mutex::Lock lock(mutex_);
  FileStream* stream = GetStream(fd);
  if (stream && stream != kBadFileStream) {
    return stream->fcntl(cmd, ap);
  } else if (IsKnowDescriptor(fd)) {
    // Socket with reserved FD but not allocated yet, for now just ignore.
    return 0;
  } else {
    errno = EBADF;
    return -1;
  }
}

int FileSystem::ioctl(int fd, int request, va_list ap) {
  Mutex::Lock lock(mutex_);
  FileStream* stream = GetStream(fd);
  if (stream && stream != kBadFileStream) {
    return stream->ioctl(request, ap);
  } else {
    errno = EBADF;
    return -1;
  }
}

int FileSystem::IsReady(int nfds, fd_set* fds, bool (FileStream::*is_ready)(),
                        bool apply) {
  if (!fds)
    return 0;

  int nset = 0;
  for (int i = 0; i < nfds; i++) {
    if (FD_ISSET(i, fds)) {
      FileStream* stream = GetStream(i);
      if (stream && (stream->*is_ready)()) {
        if (!apply)
          return 1;
        else
          nset++;
      } else {
        if (apply)
          FD_CLR(i, fds);
      }
    }
  }
  return nset;
}

bool FileSystem::IsInterrupted() {
  bool has_handler_sigwinch = handler_sigwinch_ != SIG_IGN &&
                              handler_sigwinch_ != SIG_DFL &&
                              handler_sigwinch_ != SIG_ERR;
  return has_handler_sigwinch && is_resize_;
}

int FileSystem::select(int nfds, fd_set* readfds, fd_set* writefds,
                       fd_set* exceptfds, struct timeval* timeout) {
  Mutex::Lock lock(mutex_);

  timespec ts_abs;
  if (timeout) {
    timespec ts;
    TIMEVAL_TO_TIMESPEC(timeout, &ts);
    timeval tv_now;
    gettimeofday(&tv_now, NULL);
    int64_t current_time_us =
        tv_now.tv_sec * kMicrosecondsPerSecond + tv_now.tv_usec;
    int64_t wakeup_time_us =
        current_time_us +
        timeout->tv_sec * kMicrosecondsPerSecond + timeout->tv_usec;
     ts_abs.tv_sec = wakeup_time_us / kMicrosecondsPerSecond;
     ts_abs.tv_nsec =
        (wakeup_time_us - ts_abs.tv_sec * kMicrosecondsPerSecond) *
        kNanosecondsPerMicrosecond;
  }

  while (!(IsInterrupted() ||
           IsReady(nfds, readfds, &FileStream::is_read_ready, false) ||
           IsReady(nfds, writefds, &FileStream::is_write_ready, false) ||
           IsReady(nfds, exceptfds, &FileStream::is_exception, false))) {
    if (timeout) {
      if (!timeout->tv_sec && !timeout->tv_usec)
        break;

      if (cond_.timedwait(mutex_, &ts_abs)) {
        if (errno == ETIMEDOUT)
          break;
        else
          return -1;
      }
    } else {
      cond_.wait(mutex_);
    }
  }

  if (IsInterrupted()) {
    is_resize_ = false;
    handler_sigwinch_(SIGWINCH);
    errno = EINTR;
    return -1;
  }

  int nread = IsReady(nfds, readfds, &FileStream::is_read_ready, true);
  int nwrite = IsReady(nfds, writefds, &FileStream::is_write_ready, true);
  int nexcpt = IsReady(nfds, exceptfds, &FileStream::is_exception, true);
  if (nread < 0 || nwrite < 0 || nexcpt < 0) {
    errno = EBADF;
    return -1;
  }
  return nread + nwrite + nexcpt;
}

uint32_t FileSystem::AddHostAddress(const char* name, uint32_t addr) {
  addr = htonl(addr);
  hosts_[name] = addr;
  addrs_[addr] = name;
  return addr;
}

addrinfo* FileSystem::CreateAddrInfo(const PP_NetAddress_Private& netaddr,
                                     const addrinfo* hints,
                                     const char* name) {
  addrinfo* ai = new addrinfo();
  sockaddr_in6* addr = new sockaddr_in6();

  ai->ai_addr = reinterpret_cast<sockaddr*>(addr);
  ai->ai_addrlen = sizeof(*addr);

  PP_NetAddressFamily_Private family =
      pp::NetAddressPrivate::GetFamily(netaddr);
  if (family == PP_NETADDRESSFAMILY_PRIVATE_IPV4)
    ai->ai_addr->sa_family = ai->ai_family = AF_INET;
  else if (family == PP_NETADDRESSFAMILY_PRIVATE_IPV6)
    ai->ai_addr->sa_family = ai->ai_family = AF_INET6;

  ai->ai_canonname = strdup(name);
  addr->sin6_port = pp::NetAddressPrivate::GetPort(netaddr);
  if (family == PP_NETADDRESSFAMILY_PRIVATE_IPV6) {
    pp::NetAddressPrivate::GetAddress(
        netaddr, &addr->sin6_addr, sizeof(in6_addr));
  } else {
    pp::NetAddressPrivate::GetAddress(
        netaddr, &((sockaddr_in*)addr)->sin_addr, sizeof(in_addr));
  }

  if (hints && hints->ai_socktype)
    ai->ai_socktype = hints->ai_socktype;
  else
    ai->ai_socktype = SOCK_STREAM;

  if (hints && hints->ai_protocol)
    ai->ai_protocol = hints->ai_protocol;

  return ai;
}

addrinfo* FileSystem::GetFakeAddress(const char* hostname, uint16_t port,
                                     const addrinfo* hints) {
  uint32_t addr;
  HostMap::iterator it = hosts_.find(hostname);
  if (it != hosts_.end())
    addr = it->second;
  else
    addr = AddHostAddress(hostname, first_unused_addr_++);

  addrinfo* ai = new addrinfo();
  sockaddr_in* addr_in = new sockaddr_in();
  ai->ai_addr = reinterpret_cast<sockaddr*>(addr_in);
  ai->ai_addrlen = sizeof(sockaddr_in);
  ai->ai_family = addr_in->sin_family = AF_INET;
  addr_in->sin_port = port;
  addr_in->sin_addr.s_addr = addr;

  if (hints && hints->ai_socktype)
    ai->ai_socktype = hints->ai_socktype;
  else
    ai->ai_socktype = SOCK_STREAM;

  if (hints && hints->ai_protocol)
    ai->ai_protocol = hints->ai_protocol;

  return ai;
}

int FileSystem::getaddrinfo(const char* hostname, const char* servname,
    const addrinfo* hints, addrinfo** res) {
  Mutex::Lock lock(mutex_);
  GetAddrInfoParams params;
  params.hostname = hostname;
  params.servname = servname;
  params.hints = hints;
  params.res = res;
  int32_t result = PP_OK_COMPLETIONPENDING;
  pp::Module::Get()->core()->CallOnMainThread(0, factory_.NewCallback(
      &FileSystem::Resolve, &params, &result));
  while (result == PP_OK_COMPLETIONPENDING)
    cond_.wait(mutex_);
  return result == PP_OK ? 0 : EAI_FAIL;
}

void FileSystem::Resolve(int32_t result, GetAddrInfoParams* params,
                         int32_t* pres) {
  Mutex::Lock lock(mutex_);
  const char* hostname = params->hostname;
  const char* servname = params->servname;
  const addrinfo* hints = params->hints;
  addrinfo** res = params->res;

  if (hints && hints->ai_family != AF_UNSPEC &&
      hints->ai_family != AF_INET &&
      hints->ai_family != AF_INET6) {
    *pres = PP_ERROR_FAILED;
    cond_.broadcast();
    return;
  }

  long port = 0;
  if (servname != NULL) {
    char* cp;
    port = strtol(servname, &cp, 10);
    if (port > 0 && port <= 65535 && *cp == '\0') {
      port = htons(port);
    } else {
      LOG("Bad port number %s\n", servname);
      port = 0;
    }
  }

  bool is_ipv6 = hints ? hints->ai_family == AF_INET6 : false;
  in6_addr in = {};
  bool is_numeric = hostname &&
      inet_pton(is_ipv6 ? AF_INET6 : AF_INET, hostname, &in);

  if (is_numeric) {
    PP_NetAddress_Private addr = {};
    if (is_ipv6) {
      // TODO: handle scope_id
      if (!pp::NetAddressPrivate::CreateFromIPv6Address(
              in.s6_addr, 0, port, &addr)) {
        LOG("NetAddressPrivate::CreateFromIPv6Address failed!\n");
        *pres = PP_ERROR_FAILED;
        cond_.broadcast();
        return;
      }
    } else {
      if (!pp::NetAddressPrivate::CreateFromIPv4Address(
              in.s6_addr, port, &addr)) {
        LOG("NetAddressPrivate::CreateFromIPv4Address failed!\n");
        *pres = PP_ERROR_FAILED;
        cond_.broadcast();
        return;
      }
    }
    *res = CreateAddrInfo(addr, hints, "");
    *pres = PP_OK;
    cond_.broadcast();
    return;
  }

  if (hints && hints->ai_flags & AI_PASSIVE) {
    // Numeric case we considered above so the only remaining case is any.
    PP_NetAddress_Private addr = {};
    if (!pp::NetAddressPrivate::GetAnyAddress(is_ipv6, &addr)) {
      LOG("NetAddressPrivate::GetAnyAddress failed!\n");
      *pres = PP_ERROR_FAILED;
      cond_.broadcast();
      return;
    }
    *res = CreateAddrInfo(addr, hints, "");
    *pres = PP_OK;
    cond_.broadcast();
    return;
  }

  if (!hostname) {
    PP_NetAddress_Private localhost = {};
    if (is_ipv6) {
      uint8_t localhost_ip[16] = {};
      localhost_ip[15] = 1;
      // TODO: handle scope_id
      if (!pp::NetAddressPrivate::CreateFromIPv6Address(
              localhost_ip, 0, port, &localhost)) {
        LOG("NetAddressPrivate::CreateFromIPv6Address failed!\n");
        *pres = PP_ERROR_FAILED;
        cond_.broadcast();
        return;
      }
    } else {
      uint8_t localhost_ip[4] = { 127, 0, 0, 1 };
      if (!pp::NetAddressPrivate::CreateFromIPv4Address(
              localhost_ip, port, &localhost)) {
        LOG("NetAddressPrivate::CreateFromIPv4Address failed!\n");
        *pres = PP_ERROR_FAILED;
        cond_.broadcast();
        return;
      }
    }
    *res = CreateAddrInfo(localhost, hints, "");
    *pres = PP_OK;
    cond_.broadcast();
    return;
  }

  if (hints && hints->ai_flags & AI_NUMERICHOST) {
    *pres = PP_ERROR_FAILED;
    cond_.broadcast();
    return;
  }

  // In case of JS socket don't use local host resolver.
  if (!use_js_socket_ && pp::HostResolverPrivate::IsAvailable()) {
    PP_HostResolver_Private_Hint hint = {
        PP_NETADDRESSFAMILY_PRIVATE_UNSPECIFIED, 0,
    };
    if (hints) {
      if (hints->ai_family == AF_INET)
        hint.family = PP_NETADDRESSFAMILY_PRIVATE_IPV4;
      else if (hints->ai_family == AF_INET6)
        hint.family = PP_NETADDRESSFAMILY_PRIVATE_IPV6;
      if (hints->ai_flags & AI_CANONNAME)
        hint.flags = PP_HOST_RESOLVER_PRIVATE_FLAGS_CANONNAME;
    }

    assert(host_resolver_ == NULL);
    host_resolver_ = new pp::HostResolverPrivate(instance_);
    *pres = host_resolver_->Resolve(hostname, port, hint,
        factory_.NewCallback(&FileSystem::OnResolve, params, pres));
    if (*pres != PP_OK_COMPLETIONPENDING) {
      delete host_resolver_;
      host_resolver_ = NULL;
      cond_.broadcast();
    }
  } else {
    *res = GetFakeAddress(hostname, port, hints);
    *pres = PP_OK;
    cond_.broadcast();
    return;
  }
}

void FileSystem::OnResolve(int32_t result, GetAddrInfoParams* params,
                           int32_t* pres) {
  Mutex::Lock lock(mutex_);
  assert(host_resolver_);
  const addrinfo* hints = params->hints;
  addrinfo** res = params->res;
  std::string host_name = host_resolver_->GetCanonicalName().AsString();
  if (result == PP_OK) {
    size_t size  = host_resolver_->GetSize();
    for (size_t i = 0; i < size; i++) {
      PP_NetAddress_Private address = {};
      if (host_resolver_->GetNetAddress(i, &address)) {
        *res = CreateAddrInfo(address, hints, host_name.c_str());
        res = &(*res)->ai_next;
      }
    }
  } else {
    char* cp;
    uint16_t port = htons(strtol(params->servname, &cp, 10));
    *res = GetFakeAddress(params->hostname, port, hints);
    result = PP_OK;
  }
  delete host_resolver_;
  host_resolver_ = NULL;
  *pres = result;
  cond_.broadcast();
}

void FileSystem::freeaddrinfo(addrinfo* ai) {
  while (ai != NULL) {
    addrinfo* next = ai->ai_next;
    free(ai->ai_canonname);
    delete ai->ai_addr;
    delete ai;
    ai = next;
  }
}

int FileSystem::getnameinfo(const sockaddr* sa, socklen_t salen,
                            char* host, size_t hostlen,
                            char* serv, size_t servlen, int flags) {
  if (sa->sa_family != AF_INET && sa->sa_family != AF_INET6)
    return EAI_FAMILY;

  if (serv)
    snprintf(serv, servlen, "%d", ntohs(((sockaddr_in*)sa)->sin_port));

  if (host) {
    if (sa->sa_family == AF_INET6)
      inet_ntop(AF_INET6, &((sockaddr_in6*)sa)->sin6_addr, host, hostlen);
    else
      inet_ntop(AF_INET, &((sockaddr_in*)sa)->sin_addr, host, hostlen);
  }

  return 0;
}

int FileSystem::socket(int socket_family, int socket_type, int protocol) {
  Mutex::Lock lock(mutex_);
  int fd = GetFirstUnusedDescriptor();
  socket_types_[fd] = socket_type;
  if (socket_types_[fd] == SOCK_DGRAM) {
    UDPSocket* socket = new UDPSocket(fd, 0);
    AddFileStream(fd, socket);
  } else {
    // mark descriptor as used
    AddFileStream(fd, NULL);
  }
  return fd;
}

bool FileSystem::GetHostPort(const sockaddr* serv_addr, socklen_t addrlen,
                             std::string* hostname, uint16_t* port) {
  if (serv_addr->sa_family == AF_INET) {
    const sockaddr_in* sin4 = reinterpret_cast<const sockaddr_in*>(serv_addr);
    *port = ntohs(sin4->sin_port);
    AddressMap::iterator it = addrs_.find(sin4->sin_addr.s_addr);
    if (it != addrs_.end()) {
      *hostname = it->second;
    } else {
      char buf[NI_MAXHOST];
      inet_ntop(AF_INET, &sin4->sin_addr, buf, sizeof(buf));
      *hostname = buf;
    }
  } else {
    const sockaddr_in6* sin6 = reinterpret_cast<const sockaddr_in6*>(serv_addr);
    *port = ntohs(sin6->sin6_port);
    char buf[NI_MAXHOST];
    inet_ntop(AF_INET6, &sin6->sin6_addr, buf, sizeof(buf));
    *hostname = buf;
  }
  return true;
}

bool FileSystem::IsAgentConnect(const sockaddr* serv_addr, socklen_t addrlen,
                                std::string* hostname, uint16_t* port) {
  if (addrlen >= sizeof(sockaddr_in) && serv_addr->sa_family == AF_INET) {
    const sockaddr_in* sin4 = reinterpret_cast<const sockaddr_in*>(serv_addr);
    const char* ssh_auth_sock = getenv("SSH_AUTH_SOCK");
    if (ntohs(sin4->sin_port) == 0 &&
        ntohl(sin4->sin_addr.s_addr) == kSshAgentFakeIP &&
        ssh_auth_sock != NULL) {
      *port = 0;
      *hostname = ssh_auth_sock;
      return true;
    }
  }
  return false;
}

int FileSystem::connect(int fd, const sockaddr* serv_addr, socklen_t addrlen) {
  Mutex::Lock lock(mutex_);
  if (streams_.find(fd) == streams_.end()) {
    errno = EBADF;
    return -1;
  }

  uint16_t port;
  std::string hostname;

  if (IsAgentConnect(serv_addr, addrlen, &hostname, &port)) {
    // If the request is for the auth agent,
    // make sure to punt request to JS proxy.
    use_js_socket_ = true;
  } else if (!GetHostPort(serv_addr, addrlen, &hostname, &port)) {
    errno = EAFNOSUPPORT;
    return -1;
  }
  LOG("FileSystem::connect: [%s] port %d\n", hostname.c_str(), port);

  FileStream* stream = NULL;
  if (use_js_socket_) {
    // Only first socket and auth sockets need JS proxy.
    // Clear flag so other sockets will use Pepper by default.
    use_js_socket_ = false;
    JsSocket* socket = new JsSocket(fd, O_RDWR, output_);
    if (!socket->connect(hostname.c_str(), port)) {
      errno = ECONNREFUSED;
      socket->release();
      return -1;
    }
    stream = socket;
  } else {
    TCPSocket* socket = new TCPSocket(fd, O_RDWR);
    if (!socket->connect(hostname.c_str(), port)) {
      errno = ECONNREFUSED;
      socket->release();
      return -1;
    }
    stream = socket;
  }

  AddFileStream(fd, stream);
  return 0;
}

int FileSystem::shutdown(int fd, int how) {
  Mutex::Lock lock(mutex_);
  FileStream* stream = GetStream(fd);
  if (stream && stream != kBadFileStream) {
    // Actually shutdown should be something more complicated but for now
    // it works. Method close can be called multiple time.
    stream->close();
    return 0;
  } else {
    errno = EBADF;
    return -1;
  }
}

int FileSystem::bind(int fd, const sockaddr* addr, socklen_t addrlen) {
  Mutex::Lock lock(mutex_);
  if (streams_.find(fd) == streams_.end() ||
      socket_types_.find(fd) == socket_types_.end()) {
    errno = EBADF;
    return -1;
  }

  switch (socket_types_[fd]) {
    case SOCK_STREAM:
      AddFileStream(fd, new TCPServerSocket(fd, 0, addr, addrlen));
      return 0;

    case SOCK_DGRAM: {
      UDPSocket* socket = static_cast<UDPSocket*>(GetStream(fd));
      if (socket && socket->bind(addr, addrlen)) {
        return 0;
      } else {
        errno = EADDRINUSE;
        return -1;
      }
    }

    default:
      return -1;
  }
}

int FileSystem::listen(int sockfd, int backlog) {
  Mutex::Lock lock(mutex_);
  FileStream* stream = GetStream(sockfd);
  if (stream && stream != kBadFileStream) {
    if (static_cast<TCPServerSocket*>(stream)->listen(backlog)) {
      return 0;
    } else {
      errno = EACCES;
      return -1;
    }
  } else {
    errno = EBADF;
    return -1;
  }
}

int FileSystem::accept(int sockfd, sockaddr* addr, socklen_t* addrlen) {
  Mutex::Lock lock(mutex_);
  FileStream* stream = GetStream(sockfd);
  if (stream && stream != kBadFileStream) {
    PP_Resource resource = static_cast<TCPServerSocket*>(stream)->accept();
    if (resource) {
      int fd = GetFirstUnusedDescriptor();
      TCPSocket* socket = new TCPSocket(fd, O_RDWR);
      if (socket->accept(resource)) {
        AddFileStream(fd, socket);
        return fd;
      } else {
        socket->release();
      }
    }
    errno = EINVAL;
    return -1;
  } else {
    errno = EBADF;
    return -1;
  }
}

int FileSystem::getsockname(int sockfd, sockaddr* name, socklen_t* namelen) {
  Mutex::Lock lock(mutex_);
  FileStream* stream = GetStream(sockfd);
  if (stream && stream != kBadFileStream &&
      socket_types_[sockfd] == SOCK_DGRAM) {
    UDPSocket* socket = static_cast<UDPSocket*>(stream);
    return socket->getsockname(name, namelen);
  } else {
    // TOOD(dpolukhin): implement getsockname for TCP sockets. Now it is
    // impossible to implement for TCP server sockets because Pepper doesn't
    // have method to get bound address.
    sockaddr_in* sin4 = reinterpret_cast<sockaddr_in*>(name);
    sin4->sin_family = AF_INET;
    sin4->sin_port = htons(0);
    inet_aton("127.0.0.1", &sin4->sin_addr);
    *namelen = sizeof(sockaddr_in);
    return 0;
  }
}

ssize_t FileSystem::sendto(int sockfd, const char* buf, size_t len, int flags,
                           const sockaddr* dest_addr, socklen_t addrlen) {
  Mutex::Lock lock(mutex_);
  FileStream* stream = GetStream(sockfd);
  if (stream && stream != kBadFileStream &&
      socket_types_[sockfd] == SOCK_DGRAM) {
    UDPSocket* socket = static_cast<UDPSocket*>(stream);
    return socket->sendto(buf, len, flags, dest_addr, addrlen);
  } else {
    errno = EBADF;
    return -1;
  }
}

ssize_t FileSystem::recvfrom(int sockfd, char* buffer, size_t len, int flags,
                             sockaddr* addr, socklen_t* addrlen) {
  Mutex::Lock lock(mutex_);
  FileStream* stream = GetStream(sockfd);
  if (stream && stream != kBadFileStream &&
      socket_types_[sockfd] == SOCK_DGRAM) {
    UDPSocket* socket = static_cast<UDPSocket*>(stream);
    return socket->recvfrom(buffer, len, flags, addr, addrlen);
  } else {
    errno = EBADF;
    return -1;
  }
}

int FileSystem::mkdir(const char* pathname, mode_t mode) {
  Mutex::Lock lock(mutex_);
  while (!fs_initialized_)
    cond_.wait(mutex_);

  if (!ppfs_) {
    LOG("FileSystem::mkdir: HTML5 file system not available!\n");
    return -1;
  }

  int32_t result = PP_OK_COMPLETIONPENDING;
  pp::Module::Get()->core()->CallOnMainThread(0,
      factory_.NewCallback(&FileSystem::MakeDirectory,
                                   pathname, &result));
  while (result == PP_OK_COMPLETIONPENDING)
    cond_.wait(mutex_);
  return (result == PP_OK) ? 0 : -1;
}

int FileSystem::sigaction(int signum,
                          const struct sigaction* act,
                          struct sigaction* oldact) {
  if (signum == SIGWINCH) {
    if (act)
      handler_sigwinch_ = act->sa_handler;
    if (oldact)
      oldact->sa_handler = handler_sigwinch_;
    return 0;
  } else {
    return -1;
  }
}

void FileSystem::exit(int status) {
  Mutex::Lock lock(mutex_);
  output_->SendExitCode(status);
  // Wait for the page to ACK it, so we can abort.
  while (!exit_code_acked_)
    cond_.wait(mutex_);
}

void FileSystem::ExitCodeAcked() {
  Mutex::Lock lock(mutex_);
  exit_code_acked_ = true;
}

void FileSystem::MakeDirectory(int32_t result, const char* pathname,
                               int32_t* pres) {
  Mutex::Lock lock(mutex_);
  pp::FileRef* file_ref = new pp::FileRef(*ppfs_, pathname);
  result = file_ref->MakeDirectory(PP_MAKEDIRECTORYFLAG_WITH_ANCESTORS,
      factory_.NewCallback(&FileSystem::OnMakeDirectory, file_ref, pres));
  if (result != PP_OK_COMPLETIONPENDING) {
    delete file_ref;
    *pres = result;
    cond_.broadcast();
  }
}

void FileSystem::OnMakeDirectory(int32_t result, pp::FileRef* file_ref,
                                 int32_t* pres) {
  Mutex::Lock lock(mutex_);
  delete file_ref;
  *pres = result;
  cond_.broadcast();
}

void FileSystem::SetTerminalSize(unsigned short col, unsigned short row) {
  Mutex::Lock lock(mutex_);
  col_ = col;
  row_ = row;
  is_resize_ = true;
  cond_.broadcast();
}

bool FileSystem::GetTerminalSize(unsigned short* col, unsigned short* row) {
  Mutex::Lock lock(mutex_);
  *col = col_;
  *row = row_;
  is_resize_ = false;
  return true;
}

void FileSystem::UseJsSocket(bool use_js) {
  use_js_socket_ = use_js;
}

bool FileSystem::CreateNetAddress(const sockaddr* saddr, socklen_t addrlen,
                                  PP_NetAddress_Private* addr) {
  if (saddr->sa_family == AF_INET) {
    const sockaddr_in* sin4 = reinterpret_cast<const sockaddr_in*>(saddr);
    if (!pp::NetAddressPrivate::CreateFromIPv4Address(
            reinterpret_cast<const uint8_t*>(&sin4->sin_addr),
            ntohs(sin4->sin_port), addr)) {
      return false;
    }
  } else if (saddr->sa_family == AF_INET6) {
    const sockaddr_in6* sin6 = reinterpret_cast<const sockaddr_in6*>(saddr);
    if (!pp::NetAddressPrivate::CreateFromIPv6Address(
            reinterpret_cast<const uint8_t*>(&sin6->sin6_addr), 0,
            ntohs(sin6->sin6_port), addr)) {
      return false;
    }
  } else {
    return false;
  }
  return true;
}

bool FileSystem::CreateSocketAddress(const PP_NetAddress_Private& addr,
                                     sockaddr* saddr, socklen_t* addrlen) {
  PP_NetAddressFamily_Private family = pp::NetAddressPrivate::GetFamily(addr);
  if (family == PP_NETADDRESSFAMILY_PRIVATE_IPV4) {
    *addrlen = sizeof(sockaddr_in);
    sockaddr_in* sin4 = reinterpret_cast<sockaddr_in*>(saddr);
    sin4->sin_family = AF_INET;
    sin4->sin_port = htons(pp::NetAddressPrivate::GetPort(addr));
    pp::NetAddressPrivate::GetAddress(addr, &sin4->sin_addr,
                                      sizeof(sin4->sin_addr));
    return true;
  } else if (family == PP_NETADDRESSFAMILY_PRIVATE_IPV6) {
    *addrlen = sizeof(sockaddr_in6);
    sockaddr_in6* sin6 = reinterpret_cast<sockaddr_in6*>(saddr);
    sin6->sin6_family = AF_INET6;
    sin6->sin6_port = htons(pp::NetAddressPrivate::GetPort(addr));
    pp::NetAddressPrivate::GetAddress(addr, &sin6->sin6_addr,
                                      sizeof(sin6->sin6_addr));
    return true;
  }
  return false;
}
