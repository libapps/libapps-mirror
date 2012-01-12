// Copyright (c) 2011 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

#ifndef DEV_RANDOM_H
#define DEV_RANDOM_H

#include "file_interfaces.h"
#include "pthread_helpers.h"

class DevRandomHandler : public PathHandler {
 public:
  DevRandomHandler(
      int (*get_random_bytes)(void *buf, size_t count, size_t *nread));
  virtual ~DevRandomHandler();

  virtual void addref();
  virtual void release();

  virtual FileStream* open(int fd, const char* pathname, int oflag);
  virtual int stat(const char* pathname, nacl_abi_stat* out);

 private:
  int ref_;
  int (*get_random_bytes_)(void *buf, size_t count, size_t *nread);

  DISALLOW_COPY_AND_ASSIGN(DevRandomHandler);
};

class DevRandom : public FileStream {
 public:
  DevRandom(int fd, int oflag,
            int (*get_random_bytes)(void *buf, size_t count, size_t *nread));
  virtual ~DevRandom();

  virtual void addref();
  virtual void release();

  virtual void close();
  virtual int read(char* buf, size_t count, size_t* nread);
  virtual int write(const char* buf, size_t count, size_t* nwrote);
  virtual int seek(nacl_abi_off_t offset, int whence,
                   nacl_abi_off_t* new_offset);
  virtual int fstat(nacl_abi_stat* out);
  virtual FileStream* dup(int fd);
  virtual int getdents(dirent* buf, size_t count, size_t* nread);

  virtual int isatty();
  virtual int fcntl(int cmd,  va_list ap);
  virtual int ioctl(int request,  va_list ap);

  virtual bool is_read_ready();
  virtual bool is_write_ready();
  virtual bool is_exception();

 private:
  int fd_;
  int oflag_;
  int ref_;
  int (*get_random_bytes_)(void *buf, size_t count, size_t *nread);

  DISALLOW_COPY_AND_ASSIGN(DevRandom);
};

#endif  // DEV_RANDOM_H
