// Copyright (c) 2011 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

#include "js_file.h"

#include <assert.h>
#include <string.h>

#include "ppapi/cpp/module.h"

#include "file_system.h"
#include "proxy_stream.h"
#include "ssh_plugin.h"

JsFileHandler::JsFileHandler(OutputInterface* out)
    : ref_(1), factory_(this), out_(out) {
}

JsFileHandler::~JsFileHandler() {
  assert(!ref_);
}

void JsFileHandler::addref() {
  ++ref_;
}

void JsFileHandler::release() {
  if (!--ref_)
    delete this;
}

void JsFileHandler::Open(int32_t result, JsFile* stream, const char* pathname) {
  out_->OpenFile(stream->fd(), pathname, stream->oflag(), stream);
}

FileStream* JsFileHandler::open(int fd, const char* pathname, int oflag) {
  JsFile* stream = new JsFile(fd, (oflag & ~O_NONBLOCK), out_);
  pp::Module::Get()->core()->CallOnMainThread(0,
      factory_.NewRequiredCallback(&JsFileHandler::Open, stream, pathname));

  FileSystem* sys = FileSystem::GetFileSystem();
  while(!stream->is_open())
    sys->cond().wait(sys->mutex());

  if (stream->fd() == -1) {
    stream->release();
    return NULL;
  }

  return stream;
}

int JsFileHandler::stat(const char* pathname, nacl_abi_stat* out) {
  memset(out, 0, sizeof(nacl_abi_stat));
  return 0;
}

//------------------------------------------------------------------------------

JsFile::JsFile(int fd, int oflag, OutputInterface* out)
  : ref_(1), fd_(fd), oflag_(oflag), out_(out),
    factory_(this), out_task_sent_(false), is_open_(false) {
}

JsFile::~JsFile() {
  assert(!ref_);
}

void JsFile::OnOpen(bool success) {
  FileSystem* sys = FileSystem::GetFileSystem();
  Mutex::Lock lock(sys->mutex());
  is_open_ = true;
  if (!success)
    fd_ = -1;
  sys->cond().broadcast();
}

void JsFile::OnRead(const char* buf, size_t size) {
  FileSystem* sys = FileSystem::GetFileSystem();
  Mutex::Lock lock(sys->mutex());
  in_buf_.insert(in_buf_.end(), buf, buf + size);
  sys->cond().broadcast();
}

void JsFile::OnClose() {
  FileSystem* sys = FileSystem::GetFileSystem();
  Mutex::Lock lock(sys->mutex());
  is_open_ = false;
  sys->cond().broadcast();
}

void JsFile::addref() {
  ++ref_;
}

void JsFile::release() {
  if (!--ref_)
    delete this;
}

void JsFile::close() {
  assert(fd_ >= 3);
  pp::Module::Get()->core()->CallOnMainThread(0,
      factory_.NewRequiredCallback(&JsFile::Close));

  FileSystem* sys = FileSystem::GetFileSystem();
  while(out_task_sent_)
    sys->cond().wait(sys->mutex());
  while(is_open_)
    sys->cond().wait(sys->mutex());

  fd_ = -1;
}

int JsFile::read(char* buf, size_t count, size_t* nread) {
  if (is_open() && in_buf_.empty()) {
    LOG("JsFile::read: %d - send read\n", fd_);
    pp::Module::Get()->core()->CallOnMainThread(0,
        factory_.NewRequiredCallback(&JsFile::Read, count));
  }

  FileSystem* sys = FileSystem::GetFileSystem();
  if (is_block()) {
    LOG("JsFile::read: %d - wait data\n", fd_);
    while(is_open() && in_buf_.empty())
      sys->cond().wait(sys->mutex());
  }
  LOG("JsFile::read: %d - wait done\n", fd_);

  *nread = 0;
  while (*nread < count) {
    if (in_buf_.empty())
      break;

    buf[(*nread)++] = in_buf_.front();
    in_buf_.pop_front();
  }

  LOG("JsFile::read: %d - done %d\n", fd_, *nread);
  if (*nread == 0) {
    if (!is_open()) {
      return 0;
    } else {
      *nread = -1;
      return EAGAIN;
    }
  }

  return 0;
}

int JsFile::write(const char* buf, size_t count, size_t* nwrote) {
  out_buf_.insert(out_buf_.end(), buf, buf + count);
  *nwrote = count;
  sendtask();
  return 0;
}

int JsFile::seek(nacl_abi_off_t offset, int whence,
                  nacl_abi_off_t* new_offset) {
  return ESPIPE;
}

int JsFile::fstat(nacl_abi_stat* out) {
  memset(out, 0, sizeof(nacl_abi_stat));
  // openssl uses st_ino and st_dev to distinguish random sources and doesn't
  // expect 0 there.
  out->nacl_abi_st_ino = fd_;
  out->nacl_abi_st_dev = fd_;
  return 0;
}

FileStream* JsFile::dup(int fd) {
  return new ProxyStream(fd, oflag_, this);
}

int JsFile::getdents(dirent* buf, size_t count, size_t* nread) {
  return ENOTDIR;
}

int JsFile::isatty() {
  return fd_ == 0;
}

int JsFile::fcntl(int cmd, va_list ap) {
  if (cmd == F_GETFL) {
    return oflag_;
  } else if (cmd == F_SETFL) {
    oflag_ = va_arg(ap, long);
    return 0;
  } else {
    return -1;
  }
}

int JsFile::ioctl(int request, va_list ap) {
  if (request == TIOCGWINSZ) {
    winsize* argp = va_arg(ap, winsize*);
    if (SshPluginInstance::GetInstance()->GetTerminalSize(
            &argp->ws_row, &argp->ws_col)) {
      argp->ws_xpixel = 0;
      argp->ws_ypixel = 0;
      return 0;
    }
  }
  return -1;
}

bool JsFile::is_read_ready() {
  return fd_ != 0 || !in_buf_.empty();
}

bool JsFile::is_write_ready() {
  return true;
}

bool JsFile::is_exception() {
  return false;
}

void JsFile::sendtask() {
  if (!out_task_sent_) {
    pp::Module::Get()->core()->CallOnMainThread(
        0, factory_.NewRequiredCallback(&JsFile::Write));
    out_task_sent_ = true;
  }
}

void JsFile::Read(int32_t result, size_t size) {
  out_->Read(fd_, size);
}

void JsFile::Write(int32_t result) {
  FileSystem* sys = FileSystem::GetFileSystem();
  Mutex::Lock lock(sys->mutex());
  out_task_sent_ = false;
  if (out_->Write(fd_, &out_buf_[0], out_buf_.size())) {
    out_buf_.clear();
    sys->cond().broadcast();
  } else {
    sendtask();
  }
}

void JsFile::Close(int32_t result) {
  out_->Close(fd_);
}
