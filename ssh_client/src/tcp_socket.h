// Copyright (c) 2012 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

#ifndef SOCKET_H
#define SOCKET_H

#include <queue>
#include <vector>

#include "ppapi/cpp/completion_callback.h"
#include "ppapi/cpp/private/tcp_socket_private.h"

#include "file_system.h"
#include "pthread_helpers.h"

class TCPSocket : public FileStream {
 public:
  TCPSocket(int fd, int oflag);
  virtual ~TCPSocket();

  int fd() { return fd_; }
  int oflag() { return oflag_; }
  bool is_block() { return !(oflag_ & O_NONBLOCK); }
  bool is_open() { return socket_ != NULL; }

  bool connect(const char* host, uint16_t port);

  virtual void addref();
  virtual void release();
  virtual FileStream* dup(int fd);

  virtual void close();
  virtual int read(char* buf, size_t count, size_t* nread);
  virtual int write(const char* buf, size_t count, size_t* nwrote);

  virtual int fcntl(int cmd,  va_list ap);

  virtual bool is_read_ready();
  virtual bool is_write_ready();
  virtual bool is_exception();

 private:
  void sendtask();

  void Connect(int32_t result, const char* host, uint16_t port, int32_t* pres);
  void OnConnect(int32_t result, int32_t* pres);

  void Read(int32_t result, int32_t* pres);
  void OnRead(int32_t result, int32_t* pres);

  void Write(int32_t result, int32_t* pres);
  void OnWrite(int32_t result, int32_t* pres);

  void Close(int32_t result, int32_t* pres);

  static const size_t kBufSize = 64 * 1024;

  int ref_;
  int fd_;
  int oflag_;
  pp::CompletionCallbackFactory<TCPSocket, ThreadSafeRefCount> factory_;
  pp::TCPSocketPrivate* socket_;
  std::deque<char> in_buf_;
  std::vector<char> out_buf_;
  std::vector<char> read_buf_;
  std::vector<char> write_buf_;
  bool write_sent_;

  DISALLOW_COPY_AND_ASSIGN(TCPSocket);
};

#endif  // SOCKET_H
