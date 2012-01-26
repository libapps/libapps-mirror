// Copyright (c) 2012 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

#ifndef DEV_TTY_H
#define DEV_TTY_H

#include "file_system.h"
#include "pthread_helpers.h"

class DevTtyHandler : public PathHandler {
 public:
  DevTtyHandler(FileStream* stdin, FileStream* stdout);
  virtual ~DevTtyHandler();

  virtual void addref();
  virtual void release();

  virtual FileStream* open(int fd, const char* pathname, int oflag);
  virtual int stat(const char* pathname, nacl_abi_stat* out);

 private:
  int ref_;
  FileStream* stdin_;
  FileStream* stdout_;

  DISALLOW_COPY_AND_ASSIGN(DevTtyHandler);
};

class DevTty : public FileStream {
 public:
  DevTty(int fd, int oflag, FileStream* stdin, FileStream* stdout);
  virtual ~DevTty();

  virtual void addref();
  virtual void release();
  virtual FileStream* dup(int fd);

  virtual void close();
  virtual int read(char* buf, size_t count, size_t* nread);
  virtual int write(const char* buf, size_t count, size_t* nwrote);

  virtual int isatty();
  virtual int tcgetattr(termios* termios_p);
  virtual int tcsetattr(int optional_actions, const termios* termios_p);
  virtual int fcntl(int cmd,  va_list ap);

  virtual bool is_read_ready();
  virtual bool is_write_ready();

 private:
  int ref_;
  int fd_;
  int oflag_;
  FileStream* stdin_;
  FileStream* stdout_;

  DISALLOW_COPY_AND_ASSIGN(DevTty);
};

#endif  // DEV_TTY_H
