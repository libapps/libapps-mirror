// Copyright (c) 2012 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

#ifndef FILE_INTERFACES_H
#define FILE_INTERFACES_H

#include <errno.h>
#include <fcntl.h>
#include <sys/dir.h>
#include <sys/ioctl.h>
#include <sys/types.h>
#include <stdarg.h>
#include <string.h>
#include <termios.h>
#include <unistd.h>

#include "nacl-mounts/base/nacl_dirent.h"

class FileStream {
 public:
  virtual ~FileStream() {}

  virtual void addref() = 0;
  virtual void release() = 0;
  virtual FileStream* dup(int fd) = 0;

  virtual void close() = 0;
  virtual int read(char* buf, size_t count, size_t* nread) = 0;
  virtual int write(const char* buf, size_t count, size_t* nwrote) = 0;
  virtual int seek(nacl_abi_off_t offset, int whence,
                   nacl_abi_off_t* new_offset) {
    return ESPIPE;
  }
  virtual int fstat(nacl_abi_stat* out) {
    memset(out, 0, sizeof(nacl_abi_stat));
    return 0;
  }
  virtual int getdents(dirent* buf, size_t count, size_t* nread) {
    return ENOTDIR;
  }

  virtual int isatty() {
    errno = EINVAL;
    return 0;
  }
  virtual int tcgetattr(termios* termios_p) {
    errno = EINVAL;
    return -1;
  }
  virtual int tcsetattr(int optional_actions, const termios* termios_p) {
    errno = EINVAL;
    return -1;
  }
  virtual int fcntl(int cmd,  va_list ap) {
    errno = EINVAL;
    return -1;
  }
  virtual int ioctl(int request,  va_list ap) {
    errno = EINVAL;
    return -1;
  }

  virtual bool is_read_ready() {
    return true;
  }
  virtual bool is_write_ready() {
    return true;
  }
  virtual bool is_exception() {
    return false;
  }
};

class PathHandler {
 public:
  virtual ~PathHandler() {}

  virtual void addref() = 0;
  virtual void release() = 0;

  virtual FileStream* open(int fd, const char* pathname, int oflag) = 0;
  virtual int stat(const char* pathname, nacl_abi_stat* out) = 0;
};

class InputInterface {
 public:
  virtual ~InputInterface() {}

  virtual void OnOpen(bool success) = 0;
  virtual void OnRead(const char* buf, size_t size) = 0;
  virtual void OnWriteAcknowledge(uint64_t count) = 0;
  virtual void OnClose() = 0;
};

class OutputInterface {
 public:
  virtual ~OutputInterface() {}

  virtual bool OpenFile(int fd, const char* name, int mode,
                        InputInterface* stream) = 0;
  virtual bool OpenSocket(int fd, const char* host, uint16_t port,
                          InputInterface* stream) = 0;
  virtual bool Write(int fd, const char* data, size_t size) = 0;
  virtual bool Read(int fd, size_t size) = 0;
  virtual bool Close(int fd) = 0;
  virtual size_t GetWriteWindow() = 0;
};

#endif  // FILE_INTERFACES_H
