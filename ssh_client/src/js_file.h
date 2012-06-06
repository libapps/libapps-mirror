// Copyright (c) 2012 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

#ifndef JS_FILE_H
#define JS_FILE_H

#include <queue>

#include "ppapi/cpp/completion_callback.h"

#include "file_system.h"
#include "pthread_helpers.h"

class JsFile : public FileStream,
               public InputInterface {
 public:
  JsFile(int fd, int oflag, OutputInterface* out);
  virtual ~JsFile();

  static void InitTerminal();

  int fd() { return fd_; }
  int oflag() { return oflag_; }
  bool is_block() { return !(oflag_ & O_NONBLOCK); }
  bool is_open() { return is_open_; }

  virtual void OnOpen(bool success);
  virtual void OnRead(const char* buf, size_t size);
  virtual void OnWriteAcknowledge(uint64_t count);
  virtual void OnClose();

  virtual void addref();
  virtual void release();
  virtual FileStream* dup(int fd);

  virtual void close();
  virtual int read(char* buf, size_t count, size_t* nread);
  virtual int write(const char* buf, size_t count, size_t* nwrote);
  virtual int fstat(nacl_abi_stat* out);

  virtual int isatty();
  virtual int tcgetattr(termios* termios_p);
  virtual int tcsetattr(int optional_actions, const termios* termios_p);
  virtual int fcntl(int cmd,  va_list ap);
  virtual int ioctl(int request,  va_list ap);

  virtual bool is_read_ready();
  virtual bool is_write_ready();

 protected:
  void PostWriteTask(bool always_post);

  void Read(int32_t result, size_t size);
  void Write(int32_t result);
  void Close(int32_t result);

  int ref_;
  int fd_;
  int oflag_;
  OutputInterface* out_;
  pp::CompletionCallbackFactory<JsFile, ThreadSafeRefCount> factory_;
  std::deque<char> in_buf_;
  std::deque<char> out_buf_;
  bool out_task_sent_;
  bool is_open_;
  uint64_t write_sent_;
  uint64_t write_acknowledged_;
  static termios tio_;

  DISALLOW_COPY_AND_ASSIGN(JsFile);
};

class JsFileHandler : public PathHandler {
 public:
  explicit JsFileHandler(OutputInterface* out);
  virtual ~JsFileHandler();

  virtual void addref();
  virtual void release();

  void Open(int32_t result, JsFile* stream, const char* pathname);

  virtual FileStream* open(int fd, const char* pathname, int oflag);
  virtual int stat(const char* pathname, nacl_abi_stat* out);

 private:
  int ref_;
  pp::CompletionCallbackFactory<JsFileHandler, ThreadSafeRefCount> factory_;
  OutputInterface* out_;

  DISALLOW_COPY_AND_ASSIGN(JsFileHandler);
};

class JsSocket : public JsFile {
 public:
  JsSocket(int fd, int oflag, OutputInterface* out);
  virtual ~JsSocket();

  bool connect(const char* host, uint16_t port);

  bool is_read_ready();

 private:
  void Connect(int32_t result, const char* host, uint16_t port);

  pp::CompletionCallbackFactory<JsSocket, ThreadSafeRefCount> factory_;
  DISALLOW_COPY_AND_ASSIGN(JsSocket);
};

#endif  // JS_FILE_H
