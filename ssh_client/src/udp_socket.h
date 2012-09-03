// Copyright (c) 2012 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

#ifndef UDP_SOCKET_H
#define UDP_SOCKET_H

#include <sys/socket.h>
#include <netinet/in.h>

#include <deque>
#include <utility>
#include <vector>

#include "ppapi/cpp/completion_callback.h"
#include "ppapi/cpp/private/udp_socket_private.h"

#include "file_system.h"
#include "pthread_helpers.h"

class UDPSocket : public FileStream {
 public:
  UDPSocket(int fd, int oflag);
  virtual ~UDPSocket();

  int fd() { return fd_; }
  int oflag() { return oflag_; }
  bool is_block() { return !(oflag() & O_NONBLOCK); }
  bool is_open() { return socket_ != NULL; }

  bool bind(const sockaddr* saddr, socklen_t addrlen);
  int getsockname(sockaddr* name, socklen_t* namelen);
  ssize_t sendto(const char* buf, size_t len, int flags,
                 const sockaddr* dest_addr, socklen_t addrlen);
  ssize_t recvfrom(char* buffer, size_t len, int flags,
                   sockaddr* addr, socklen_t* addrlen);

  virtual void addref();
  virtual void release();
  virtual FileStream* dup(int fd);

  virtual void close();
  virtual int read(char* buf, size_t count, size_t* nread);
  virtual int write(const char* buf, size_t count, size_t* nwrote);

  virtual int fcntl(int cmd, va_list ap);

  virtual bool is_read_ready();
  virtual bool is_write_ready();
  virtual bool is_exception();

 private:
  typedef std::deque<std::pair<sockaddr_in6, std::vector<char> > > MessageQueue;

  void Close(int32_t result, int32_t* pres);

  void Bind(int32_t result, const sockaddr* saddr, socklen_t addrlen,
            int32_t* pres);
  void OnBind(int32_t result, int32_t* pres);

  void GetBoundAddress(int32_t result, sockaddr* name, socklen_t* namelen,
                       int32_t* pres);

  void Read(int32_t result);
  void OnRead(int32_t result);

  void Write(int32_t result);
  void OnWrite(int32_t result);

  void PostReadTask();
  void PostWriteTask();

  // Number of messages in incoming queue that we can read ahead.
  static const size_t kQueueSize = 16;

  // Read buffer size for incoming message.
  static const size_t kBufSize = 64 * 1024;

  int ref_;
  int fd_;
  int oflag_;
  pp::CompletionCallbackFactory<UDPSocket> factory_;
  pp::UDPSocketPrivate* socket_;
  MessageQueue in_queue_;
  MessageQueue out_queue_;
  std::vector<char> read_buf_;
  std::vector<char> write_buf_;
  PP_NetAddress_Private write_addr_;
  bool read_sent_;
  bool write_sent_;

  DISALLOW_COPY_AND_ASSIGN(UDPSocket);
};

#endif  // UDP_SOCKET_H
