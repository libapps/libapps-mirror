// Copyright (c) 2012 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

#ifndef TCP_SERVER_SOCKET_H
#define TCP_SERVER_SOCKET_H

#include <netdb.h>
#include <netinet/in.h>

#include "ppapi/cpp/completion_callback.h"
#include "ppapi/cpp/private/tcp_server_socket_private.h"

#include "file_system.h"
#include "pthread_helpers.h"

class TCPServerSocket : public FileStream {
 public:
  TCPServerSocket(int fd, int oflag,
      const sockaddr* saddr, socklen_t addrlen);
  virtual ~TCPServerSocket();

  int fd() { return fd_; }
  bool is_open() { return socket_ != NULL; }

  virtual void addref();
  virtual void release();
  virtual FileStream* dup(int fd);

  virtual int read(char* buf, size_t count, size_t* nread);
  virtual int write(const char* buf, size_t count, size_t* nwrote);
  virtual void close();

  virtual int fcntl(int cmd,  va_list ap);

  virtual bool is_read_ready();
  virtual bool is_write_ready();
  virtual bool is_exception();

  bool listen(int backlog);
  PP_Resource accept();

 private:
  void Listen(int32_t result, int backlog, int32_t* pres);
  void Accept(int32_t result, int32_t* pres);
  void OnAccept(int32_t result);
  void Close(int32_t result, int32_t* pres);

  int ref_;
  int fd_;
  int oflag_;
  pp::CompletionCallbackFactory<TCPServerSocket> factory_;
  pp::TCPServerSocketPrivate* socket_;
  sockaddr_in6 sin6_;
  PP_Resource resource_;

  DISALLOW_COPY_AND_ASSIGN(TCPServerSocket);
};

#endif  // TCP_SERVER_SOCKET_H
