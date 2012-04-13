// Copyright (c) 2012 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

#include "file_system.h"

#include <arpa/inet.h>
#include <netinet/in.h>
#include <signal.h>
#include <string.h>
#include <sys/socket.h>
#include <sys/time.h>

#include "irt/irt.h"
#include "ppapi/cpp/file_ref.h"

#include "dev_null.h"
#include "dev_random.h"
#include "dev_tty.h"
#include "js_file.h"
#include "pepper_file.h"
#include "tcp_server_socket.h"
#include "tcp_socket.h"

extern "C" void DoWrapSysCalls();

static const int64_t kMicrosecondsPerSecond = 1000 * 1000;
static const int64_t kNanosecondsPerMicrosecond = 1000;

FileStream* const FileSystem::kBadFileStream = (FileStream*)-1;
FileSystem* FileSystem::file_system_ = NULL;

FileSystem::FileSystem(pp::Instance* instance, OutputInterface* out)
    : instance_(instance),
      output_(out),
      ppfs_(NULL),
      ppfs_path_handler_(NULL),
      fs_initialized_(false),
      factory_(this),
      first_unused_addr_(kFirstAddr),
      use_js_socket_(false),
      col_(80), row_(24),
      is_resize_(false) {
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
  JsFile* stdin = new JsFile(0, O_RDONLY, out);
  AddFileStream(0, stdin);
  out->OpenFile(0, NULL, O_WRONLY, stdin);
  stdin->OnOpen(true);

  JsFile* stdout = new JsFile(1, O_WRONLY, out);
  AddFileStream(1, stdout);

  AddFileStream(2, new JsFile(2, O_WRONLY, out));

  AddPathHandler("/dev/null", new DevNullHandler());
  AddPathHandler("/dev/tty", new DevTtyHandler(stdin, stdout));

  // NACL_IRT_RANDOM_v0_1 is available starting from M18. For testing purpose
  // is JS path for all browsers.
//  nacl_irt_random random;
//  if (nacl_interface_query(NACL_IRT_RANDOM_v0_1, &random, sizeof(random))) {
//    AddPathHandler("/dev/random",
//                   new DevRandomHandler(random.get_random_bytes));
//  } else {
    // LOG("Can't get " NACL_IRT_RANDOM_v0_1 " interface\n");
    AddPathHandler("/dev/random", new JsFileHandler(out));
//  }

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
  return file_system_;
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
  PathHandler* handler = (it != paths_.end()) ? it->second : ppfs_path_handler_;
  if (!handler)
    return ENOENT;

  int fd = GetFirstUnusedDescriptor();
  // mark descriptor as used
  AddFileStream(fd, NULL);
  FileStream* stream = handler->open(fd, pathname, oflag);
  if (!stream) {
    RemoveFileStream(fd);
    return EACCES;
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

int FileSystem::dup(int fd, int *newfd) {
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

int FileSystem::stat(const char *pathname, nacl_abi_stat* out) {
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
      if (!stream)
        return -1;
      if ((stream->*is_ready)()) {
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

  while(!(IsReady(nfds, readfds, &FileStream::is_read_ready, false) ||
          IsReady(nfds, writefds, &FileStream::is_write_ready, false) ||
          IsReady(nfds, exceptfds, &FileStream::is_exception, false) ||
          is_resize_)) {
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

  if (is_resize_) {
    is_resize_ = false;
    if (handler_sigwinch_ != SIG_IGN &&
        handler_sigwinch_ != SIG_DFL &&
        handler_sigwinch_ != SIG_ERR) {
      handler_sigwinch_(SIGWINCH);
      errno = EINTR;
      return -1;
    }
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

void FileSystem::AddHostAddress(const char* name, unsigned long addr) {
  addr = htonl(addr);
  hosts_[name] = addr;
  addrs_[addr] = name;
}

unsigned long FileSystem::gethostbyname(const char* name) {
  Mutex::Lock lock(mutex_);
  HostMap::iterator it = hosts_.find(name);
  if (it != hosts_.end())
    return it->second;

  int addr = htonl(first_unused_addr_++);
  hosts_[name] = addr;
  addrs_[addr] = name;
  return addr;
}

int FileSystem::socket(int socket_family, int socket_type, int protocol) {
  Mutex::Lock lock(mutex_);
  int fd = GetFirstUnusedDescriptor();
  // mark descriptor as used
  AddFileStream(fd, NULL);
  return fd;
}

int FileSystem::connect(int fd, unsigned long addr, unsigned short port) {
  Mutex::Lock lock(mutex_);
  if (streams_.find(fd) == streams_.end()) {
    errno = EBADF;
    return -1;
  }

  std::string host;
  AddressMap::iterator it = addrs_.find(addr);
  if (it != addrs_.end()) {
    host = it->second;
  } else {
    in_addr iaddr;
    iaddr.s_addr = addr;
    host = inet_ntoa(iaddr);
  }

  FileStream* stream = NULL;
  if (use_js_socket_) {
    // Only first socket will use JS proxy, other sockets are created for
    // connections made localhost so use Pepper sockets for them.
    use_js_socket_ = false;
    JsSocket* socket = new JsSocket(fd, O_RDWR, output_);
    if (!socket->connect(host.c_str(), port)) {
      errno = ECONNREFUSED;
      socket->release();
      return -1;
    }
    stream = socket;
  } else {
    TCPSocket* socket = new TCPSocket(fd, O_RDWR);
    if (!socket->connect(host.c_str(), port)) {
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
    // Actually shutdown should be something more complicated by for now
    // it works. Method close can be called multiple time.
    stream->close();
    return 0;
  } else {
    errno = EBADF;
    return -1;
  }
}

int FileSystem::bind(int fd, unsigned long addr, unsigned short port) {
  Mutex::Lock lock(mutex_);
  if (streams_.find(fd) == streams_.end()) {
    errno = EBADF;
    return -1;
  }

  std::string host;
  AddressMap::iterator it = addrs_.find(addr);
  if (it != addrs_.end()) {
    host = it->second;
  } else {
    in_addr iaddr;
    iaddr.s_addr = addr;
    host = inet_ntoa(iaddr);
  }

  AddFileStream(fd, new TCPServerSocket(fd, 0, host.c_str(), port));
  return 0;
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

int FileSystem::accept(int sockfd, struct sockaddr *addr, socklen_t *addrlen) {
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

int FileSystem::mkdir(const char* pathname, mode_t mode) {
  Mutex::Lock lock(mutex_);
  while(!fs_initialized_)
    cond_.wait(mutex_);

  if (!ppfs_) {
    LOG("FileSystem::mkdir: HTML5 file system not available!\n");
    return -1;
  }

  int32_t result = PP_OK_COMPLETIONPENDING;
  pp::Module::Get()->core()->CallOnMainThread(0,
      factory_.NewCallback(&FileSystem::MakeDirectory,
                                   pathname, &result));
  while(result == PP_OK_COMPLETIONPENDING)
    cond_.wait(mutex_);
  return (result == PP_OK) ? 0 : -1;
}

int FileSystem::sigaction(int signum,
                          const struct sigaction *act,
                          struct sigaction *oldact) {
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

void FileSystem::MakeDirectory(int32_t result, const char* pathname,
                               int32_t* pres) {
  Mutex::Lock lock(mutex_);
  pp::FileRef* file_ref = new pp::FileRef(*ppfs_, pathname);
  result = file_ref->MakeDirectoryIncludingAncestors(
      factory_.NewCallback(&FileSystem::OnMakeDirectory,
                                   file_ref, pres));
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
