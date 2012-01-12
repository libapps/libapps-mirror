// Copyright (c) 2011 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

#ifndef PEPPER_FILE_H
#define PEPPER_FILE_H

#include <deque>
#include <vector>

#include "ppapi/cpp/completion_callback.h"
#include "ppapi/cpp/file_io.h"
#include "ppapi/cpp/file_system.h"

#include "file_interfaces.h"
#include "pthread_helpers.h"

class PepperFileHandler : public PathHandler {
 public:
  explicit PepperFileHandler(pp::FileSystem* file_system);
  virtual ~PepperFileHandler();

  virtual void addref();
  virtual void release();

  virtual FileStream* open(int fd, const char* pathname, int oflag);
  virtual int stat(const char* pathname, nacl_abi_stat* out);

 private:
  int ref_;
  pp::FileSystem* file_system_;

  DISALLOW_COPY_AND_ASSIGN(PepperFileHandler);
};

class PepperFile : public FileStream {
 public:
  PepperFile(int fd, int oflag, pp::FileSystem* file_system);
  virtual ~PepperFile();

  bool is_block() { return !(oflag_ & O_NONBLOCK); }
  bool is_open() { return file_io_ != NULL; }

  bool open(const char* pathname);

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
  void Open(int32_t result, const char* pathname, int32_t* pres);
  void OnOpen(int32_t result, int32_t* pres);
  void OnQuery(int32_t result, int32_t* pres);

  void Read(int32_t result, size_t count, int32_t* pres);
  void OnRead(int32_t result, int32_t* pres);

  void Write(int32_t result, int32_t* pres);
  void OnWrite(int32_t result, int32_t* pres);

  void Close(int32_t result, int32_t* pres);

  static const size_t kBufSize = 64 * 1024;

  int ref_;
  int fd_;
  int oflag_;
  pp::CompletionCallbackFactory<PepperFile, ThreadSafeRefCount> factory_;
  pp::FileSystem* file_system_;
  pp::FileIO* file_io_;
  int64_t offset_;
  PP_FileInfo file_info_;
  std::deque<char> in_buf_;
  std::vector<char> out_buf_;
  std::vector<char> read_buf_;
  std::vector<char> write_buf_;
  bool write_sent_;

  DISALLOW_COPY_AND_ASSIGN(PepperFile);
};

#endif  // PEPPER_FILE_H
