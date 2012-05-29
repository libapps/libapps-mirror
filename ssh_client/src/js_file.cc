// Copyright (c) 2012 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

#include "js_file.h"

#include <assert.h>
#include <string.h>

#include "ppapi/cpp/module.h"

#include "file_system.h"
#include "proxy_stream.h"

termios JsFile::tio_ = {};

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
      factory_.NewCallback(&JsFileHandler::Open, stream, pathname));

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
    factory_(this), out_task_sent_(false), is_open_(false),
    write_sent_(0), write_acknowledged_(0) {
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
  // TODO(dpolukhin): implement simple line editing.
  if (isatty() && (tio_.c_lflag & ECHO)) {
    for (size_t i = 0; i < size; i++) {
      if ((tio_.c_iflag & ICRNL) && buf[i] == '\r') {
        ::write(1, "\n", 1);
      } else {
        ::write(1, &buf[i], 1);
      }
    }
  }
  sys->cond().broadcast();
}

void JsFile::OnWriteAcknowledge(uint64_t count) {
  FileSystem* sys = FileSystem::GetFileSystem();
  Mutex::Lock lock(sys->mutex());
  assert(write_acknowledged_ <= write_sent_);
  write_acknowledged_ = count;
  sendtask();
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

FileStream* JsFile::dup(int fd) {
  return new ProxyStream(fd, oflag_, this);
}

void JsFile::close() {
  if (is_open()) {
    assert(fd_ >= 3);
    pp::Module::Get()->core()->CallOnMainThread(0,
        factory_.NewCallback(&JsFile::Close));

    FileSystem* sys = FileSystem::GetFileSystem();
    while(out_task_sent_)
      sys->cond().wait(sys->mutex());
    while(is_open_)
      sys->cond().wait(sys->mutex());

    fd_ = -1;
  }
}

int JsFile::read(char* buf, size_t count, size_t* nread) {
  if (is_open() && in_buf_.empty()) {
    pp::Module::Get()->core()->CallOnMainThread(0,
        factory_.NewCallback(&JsFile::Read, count));
  }

  FileSystem* sys = FileSystem::GetFileSystem();
  if (is_block()) {
    while(is_open() && in_buf_.empty())
      sys->cond().wait(sys->mutex());
  }

  *nread = 0;
  while (*nread < count) {
    if (in_buf_.empty())
      break;

    buf[(*nread)++] = in_buf_.front();
    in_buf_.pop_front();
  }

  if (*nread == 0 && !is_block() && is_open()) {
    *nread = -1;
    return EAGAIN;
  }

  return 0;
}

int JsFile::write(const char* buf, size_t count, size_t* nwrote) {
  if (!is_open())
    return EIO;

  out_buf_.insert(out_buf_.end(), buf, buf + count);
  *nwrote = count;
  sendtask();
  return 0;
}

int JsFile::fstat(nacl_abi_stat* out) {
  memset(out, 0, sizeof(nacl_abi_stat));
  // openssl uses st_ino and st_dev to distinguish random sources and doesn't
  // expect 0 there.
  out->nacl_abi_st_ino = fd_;
  out->nacl_abi_st_dev = fd_;
  return 0;
}

int JsFile::isatty() {
  return fd_ < 3;
}

void JsFile::InitTerminal() {
  // Some sane values that produce good result.
  tio_.c_iflag = ICRNL | IXON | IXOFF | IUTF8;
  tio_.c_oflag = OPOST | ONLCR;
  tio_.c_cflag = CREAD | 077;
  tio_.c_lflag =
      ISIG | ICANON | ECHO | ECHOE | ECHOK | ECHOCTL | ECHOKE | IEXTEN;
  tio_.c_cc[VINTR] = 3;
  tio_.c_cc[VQUIT] = 28;
  tio_.c_cc[VERASE] = 127;
  tio_.c_cc[VKILL] = 21;
  tio_.c_cc[VEOF] = 4;
  tio_.c_cc[VTIME] = 0;
  tio_.c_cc[VMIN] = 1;
  tio_.c_cc[VSWTC] = 0;
  tio_.c_cc[VSTART] = 17;
  tio_.c_cc[VSTOP] = 19;
  tio_.c_cc[VSUSP] = 26;
  tio_.c_cc[VEOL] = 0;
  tio_.c_cc[VREPRINT] = 18;
  tio_.c_cc[VDISCARD] = 15;
  tio_.c_cc[VWERASE] = 23;
  tio_.c_cc[VLNEXT] = 22;
  tio_.c_cc[VEOL2] = 0;
}

int JsFile::tcgetattr(termios* termios_p) {
  *termios_p = tio_;
  return 0;
}

int JsFile::tcsetattr(int optional_actions, const termios* termios_p) {
  tio_ = *termios_p;
  return 0;
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
    FileSystem* sys = FileSystem::GetFileSystem();
    winsize* argp = va_arg(ap, winsize*);
    if (sys->GetTerminalSize(&argp->ws_col, &argp->ws_row)) {
      argp->ws_xpixel = 0;
      argp->ws_ypixel = 0;
      return 0;
    }
  }
  return -1;
}

bool JsFile::is_read_ready() {
  // HACK: fd_ != 0 is required for reading /dev/random in openssl, it expects
  // that /dev/random has some data ready to read. If there is no data,
  // it won't call read at all.
  return fd_ != 0 || !in_buf_.empty();
}

bool JsFile::is_write_ready() {
  return (write_sent_ - write_acknowledged_) < out_->GetWriteWindow();
}

void JsFile::sendtask() {
  if (!out_task_sent_ && !out_buf_.empty()) {
    pp::Module::Get()->core()->CallOnMainThread(
        0, factory_.NewCallback(&JsFile::Write));
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

  if (!is_write_ready()) {
    LOG("JsFile::Write: %d is not ready for write\n", fd_);
    return;
  }

  if (isatty() && (tio_.c_lflag & ICANON)) {
    // It could be performance issue to do this conversion in-place but
    // fortunately it's used only for first few lines like password prompt.
    for (size_t i = 0; i < out_buf_.size(); i++) {
      if (out_buf_[i] == '\n') {
        out_buf_.insert(out_buf_.begin() + i++, '\r');
      }
    }
  }

  if (out_->Write(fd_, &out_buf_[0], out_buf_.size())) {
    write_sent_ += out_buf_.size();
    out_buf_.clear();
    sys->cond().broadcast();
  } else {
    assert(0);
    sendtask();
  }
}

void JsFile::Close(int32_t result) {
  out_->Close(fd_);
}

//------------------------------------------------------------------------------

JsSocket::JsSocket(int fd, int oflag, OutputInterface* out)
  : JsFile(fd, oflag, out), factory_(this) {
}

JsSocket::~JsSocket() {
}

bool JsSocket::connect(const char* host, uint16_t port) {
  pp::Module::Get()->core()->CallOnMainThread(0,
      factory_.NewCallback(&JsSocket::Connect, host, port));
  FileSystem* sys = FileSystem::GetFileSystem();
  while(!is_open())
    sys->cond().wait(sys->mutex());

  if (fd() == -1)
    return false;

  return true;
}

bool JsSocket::is_read_ready() {
  return !in_buf_.empty();
}

void JsSocket::Connect(int32_t result, const char* host, uint16_t port) {
  FileSystem* sys = FileSystem::GetFileSystem();
  Mutex::Lock lock(sys->mutex());
  out_->OpenSocket(fd_, host, port, this);
}
