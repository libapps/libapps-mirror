// Copyright (c) 2012 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

#ifndef PROXY_STREAM_H
#define PROXY_STREAM_H

#include "file_system.h"
#include "pthread_helpers.h"

class ProxyStream : public FileStream {
 public:
  ProxyStream(int fd, int oflag, FileStream* orig)
    : ref_(1), fd_(fd), oflag_(oflag), orig_(orig) {
    orig->addref();
  }
  virtual ~ProxyStream() {
    orig_->release();
  }

  void addref() {
    ++ref_;
  }
  void release() {
    if (!--ref_)
      delete this;
  }
  virtual FileStream* dup(int fd) {
    return new ProxyStream(fd, oflag_, orig_);
  }

  virtual void close() {
  }
  virtual int read(char* buf, size_t count, size_t* nread) {
    return orig_->read(buf, count, nread);
  }
  virtual int write(const char* buf, size_t count, size_t* nwrote) {
    return orig_->write(buf, count, nwrote);
  }

  virtual int seek(nacl_abi_off_t offset, int whence,
                   nacl_abi_off_t* new_offset) {
    return orig_->seek(offset, whence, new_offset);
  }
  virtual int fstat(nacl_abi_stat* out) {
    return orig_->fstat(out);
  }
  virtual int getdents(dirent* buf, size_t count, size_t* nread) {
    return orig_->getdents(buf, count, nread);
  }

  virtual int isatty() {
    return orig_->isatty();
  }
  virtual int tcgetattr(termios* termios_p) {
    return orig_->tcgetattr(termios_p);
  }
  virtual int tcsetattr(int optional_actions, const termios* termios_p) {
    return orig_->tcsetattr(optional_actions, termios_p);
  }
  virtual int fcntl(int cmd,  va_list ap) {
    return orig_->fcntl(cmd, ap);
  }
  virtual int ioctl(int request, va_list ap) {
    return orig_->ioctl(request, ap);
  }

  virtual bool is_read_ready() {
    return orig_->is_read_ready();
  }
  virtual bool is_write_ready() {
    return orig_->is_write_ready();
  }
  virtual bool is_exception() {
    return orig_->is_exception();
  }

 private:
  int ref_;
  int fd_;
  int oflag_;
  FileStream* orig_;

  DISALLOW_COPY_AND_ASSIGN(ProxyStream);
};

#endif  //  PROXY_STREAM_H
