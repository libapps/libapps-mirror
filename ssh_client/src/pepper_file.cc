// Copyright (c) 2011 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

#include "pepper_file.h"

#include <assert.h>

#include "ppapi/c/pp_errors.h"
#include "ppapi/c/ppb_file_io.h"
#include "ppapi/cpp/file_ref.h"

#include "file_system.h"

const size_t PepperFile::kBufSize;

PepperFileHandler::PepperFileHandler(pp::FileSystem* file_system)
    : ref_(1), file_system_(file_system) {
  assert(file_system);
}

PepperFileHandler::~PepperFileHandler() {
  assert(!ref_);
}

void PepperFileHandler::addref() {
  ++ref_;
}

void PepperFileHandler::release() {
  if (!--ref_)
    delete this;
}

FileStream* PepperFileHandler::open(int fd, const char* pathname, int oflag) {
  PepperFile* file = new PepperFile(fd, oflag, file_system_);
  if (file->open(pathname)) {
    return file;
  } else {
    file->release();
    return NULL;
  }
}

int PepperFileHandler::stat(const char* pathname, nacl_abi_stat* out) {
  memset(out, 0, sizeof(nacl_abi_stat));
  return 0;
}

//------------------------------------------------------------------------------

PepperFile::PepperFile(int fd, int oflag, pp::FileSystem* file_system)
  : ref_(1), fd_(fd), oflag_(oflag), factory_(this), file_system_(file_system),
    file_io_(NULL), offset_(0), file_info_(), write_sent_(false) {
}

PepperFile::~PepperFile() {
  assert(!ref_);
}

void PepperFile::addref() {
  ++ref_;
}

void PepperFile::release() {
  if (!--ref_)
    delete this;
}

bool PepperFile::open(const char* pathname) {
  int32_t result = PP_OK_COMPLETIONPENDING;
  pp::Module::Get()->core()->CallOnMainThread(0,
      factory_.NewRequiredCallback(&PepperFile::Open, pathname, &result));
  FileSystem* sys = FileSystem::GetFileSystem();
  while(result == PP_OK_COMPLETIONPENDING)
    sys->cond().wait(sys->mutex());
  return result == PP_OK;
}

void PepperFile::close() {
  int32_t result = PP_OK_COMPLETIONPENDING;
  pp::Module::Get()->core()->CallOnMainThread(0,
      factory_.NewRequiredCallback(&PepperFile::Close, &result));
  FileSystem* sys = FileSystem::GetFileSystem();
  while(result == PP_OK_COMPLETIONPENDING)
    sys->cond().wait(sys->mutex());
}

int PepperFile::read(char* buf, size_t count, size_t* nread) {
  if (!is_open())
    return EIO;

  FileSystem* sys = FileSystem::GetFileSystem();
  if (is_block() && in_buf_.empty()) {
    int32_t result = PP_OK_COMPLETIONPENDING;
    pp::Module::Get()->core()->CallOnMainThread(0,
        factory_.NewRequiredCallback(&PepperFile::Read, count, &result));
    while(result == PP_OK_COMPLETIONPENDING)
      sys->cond().wait(sys->mutex());
    if (result < 0) {
      *nread = -1;
      return EIO;
    }
  }

  *nread = 0;
  while (*nread < count) {
    if (in_buf_.empty())
      break;

    buf[(*nread)++] = in_buf_.front();
    offset_++;
    in_buf_.pop_front();
  }

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

int PepperFile::write(const char* buf, size_t count, size_t* nwrote) {
  if (!is_open())
    return EIO;

  out_buf_.insert(out_buf_.end(), buf, buf + count);
  if (is_block()) {
    int32_t result = PP_OK_COMPLETIONPENDING;
    pp::Module::Get()->core()->CallOnMainThread(0,
        factory_.NewRequiredCallback(&PepperFile::Write, &result));
    FileSystem* sys = FileSystem::GetFileSystem();
    while(result == PP_OK_COMPLETIONPENDING)
      sys->cond().wait(sys->mutex());
    if ((size_t)result != count) {
      *nwrote = -1;
      return EIO;
    } else {
      *nwrote = count;
      return 0;
    }
  } else {
    if (!write_sent_) {
      write_sent_ = true;
      pp::Module::Get()->core()->CallOnMainThread(0,
        factory_.NewRequiredCallback(&PepperFile::Write, (int32_t*)NULL));
    }
    *nwrote = count;
    return 0;
  }
}

int PepperFile::seek(nacl_abi_off_t offset, int whence,
                     nacl_abi_off_t* new_offset) {
  switch (whence) {
    case SEEK_SET:
      offset_ = offset;
      if (new_offset)
        *new_offset = offset_;
      return 0;

    case SEEK_CUR:
      offset_ += offset;
      if (new_offset)
        *new_offset = offset_;
      return 0;

    case SEEK_END:
      offset_ = file_info_.size + offset;
      if (new_offset)
        *new_offset = offset_;
      return 0;

    default:
      if (new_offset)
        *new_offset = -1;
      return EINVAL;
  }
}

int PepperFile::fstat(nacl_abi_stat* out) {
  memset(out, 0, sizeof(nacl_abi_stat));
  out->nacl_abi_st_size = file_info_.size;
  return 0;
}

FileStream* PepperFile::dup(int fd) {
  assert(0);
  return NULL;
}

int PepperFile::getdents(dirent* buf, size_t count, size_t* nread) {
  return ENOTDIR;
}

int PepperFile::isatty() {
  return false;
}

int PepperFile::fcntl(int cmd, va_list ap) {
  if (cmd == F_GETFL) {
    return oflag_;
  } else if (cmd == F_SETFL) {
    int oflag = va_arg(ap, long);
    if (is_block() && (oflag & O_NONBLOCK)) {
      pp::Module::Get()->core()->CallOnMainThread(0,
          factory_.NewRequiredCallback(&PepperFile::Read,
                                       kBufSize, (int32_t*)NULL));
    }
    oflag_ = oflag;
    return 0;
  } else {
    return -1;
  }
}

int PepperFile::ioctl(int request, va_list ap) {
  return EINVAL;
}

bool PepperFile::is_read_ready() {
  return !in_buf_.empty();
}

bool PepperFile::is_write_ready() {
  return out_buf_.size() < kBufSize;
}

bool PepperFile::is_exception() {
  return !is_open();
}

void PepperFile::Open(int32_t result, const char* pathname, int32_t* pres) {
  FileSystem* sys = FileSystem::GetFileSystem();
  Mutex::Lock lock(sys->mutex());
  pp::FileRef file_ref(*file_system_, pathname);
  file_io_ = new pp::FileIO(sys->instance());
  int open_flags;
  if ((oflag_ & O_ACCMODE) == O_WRONLY)
    open_flags = PP_FILEOPENFLAG_WRITE;
  else if ((oflag_ & O_ACCMODE) == O_RDONLY)
    open_flags = PP_FILEOPENFLAG_READ;
  else
    open_flags = PP_FILEOPENFLAG_READ | PP_FILEOPENFLAG_WRITE;
  if (oflag_ & O_CREAT)
    open_flags |= PP_FILEOPENFLAG_CREATE;
  if (oflag_ & O_TRUNC)
    open_flags |= PP_FILEOPENFLAG_TRUNCATE;
  *pres = file_io_->Open(file_ref, open_flags,
      factory_.NewRequiredCallback(&PepperFile::OnOpen, pres));
  if (*pres != PP_OK_COMPLETIONPENDING)
    sys->cond().broadcast();
}

void PepperFile::OnOpen(int32_t result, int32_t* pres) {
  FileSystem* sys = FileSystem::GetFileSystem();
  Mutex::Lock lock(sys->mutex());
  if (result == PP_OK) {
    result = file_io_->Query(&file_info_,
        factory_.NewRequiredCallback(&PepperFile::OnQuery, pres));
    if (result == PP_OK_COMPLETIONPENDING)
      return;
  }
  delete file_io_;
  file_io_ = NULL;
  *pres = result;
  sys->cond().broadcast();
}

void PepperFile::OnQuery(int32_t result, int32_t* pres) {
  FileSystem* sys = FileSystem::GetFileSystem();
  Mutex::Lock lock(sys->mutex());
  if (result == PP_OK) {
    if (oflag_ & O_APPEND) {
      offset_ = file_info_.size;
    } else {
      if (!is_block())
        Read(PP_OK, kBufSize, NULL);
    }
  } else {
    delete file_io_;
    file_io_ = NULL;
  }
  *pres = result;
  sys->cond().broadcast();
}

void PepperFile::Read(int32_t result, size_t count, int32_t* pres) {
  FileSystem* sys = FileSystem::GetFileSystem();
  Mutex::Lock lock(sys->mutex());
  assert(file_io_);
  read_buf_.resize(count);
  result = file_io_->Read(offset_, &read_buf_[0], read_buf_.size(),
      factory_.NewRequiredCallback(&PepperFile::OnRead, pres));
  if (result != PP_OK_COMPLETIONPENDING) {
    delete file_io_;
    file_io_ = NULL;
    if (pres)
      *pres = result;
    sys->cond().broadcast();
  }
}

void PepperFile::OnRead(int32_t result, int32_t* pres) {
  FileSystem* sys = FileSystem::GetFileSystem();
  Mutex::Lock lock(sys->mutex());
  if (result >= 0) {
    in_buf_.insert(in_buf_.end(), &read_buf_[0], &read_buf_[0] + result);
    if (result && !is_block() && in_buf_.size() < kBufSize)
      Read(PP_OK, kBufSize, NULL);
  } else {
    delete file_io_;
    file_io_ = NULL;
  }
  if (pres)
    *pres = result;
  sys->cond().broadcast();
}

void PepperFile::Write(int32_t result, int32_t* pres) {
  FileSystem* sys = FileSystem::GetFileSystem();
  Mutex::Lock lock(sys->mutex());
  assert(file_io_);
  if (result == PP_OK) {
    if (write_buf_.size()) {
      // Previous write operation is in progress.
      pp::Module::Get()->core()->CallOnMainThread(1,
          factory_.NewRequiredCallback(&PepperFile::Write, &result));
      return;
    }
    assert(out_buf_.size());
    write_buf_.swap(out_buf_);
    result = file_io_->Write(offset_, &write_buf_[0], write_buf_.size(),
        factory_.NewRequiredCallback(&PepperFile::OnWrite, pres));
    write_sent_ = false;
  } else {
    result = PP_ERROR_FAILED;
  }
  if (result != PP_OK_COMPLETIONPENDING) {
    delete file_io_;
    file_io_ = NULL;
    if (pres)
      *pres = result;
    sys->cond().broadcast();
  }
}

void PepperFile::OnWrite(int32_t result, int32_t* pres) {
  FileSystem* sys = FileSystem::GetFileSystem();
  Mutex::Lock lock(sys->mutex());
  if ((size_t)result != write_buf_.size()) {
    delete file_io_;
    file_io_ = NULL;
  } else {
    offset_ += result;
  }
  if (pres)
    *pres = result;
  write_buf_.clear();
  sys->cond().broadcast();
}

void PepperFile::Close(int32_t result, int32_t* pres) {
  FileSystem* sys = FileSystem::GetFileSystem();
  Mutex::Lock lock(sys->mutex());
  delete file_io_;
  file_io_ = NULL;
  if (pres)
    *pres = PP_OK;
  sys->cond().broadcast();
}
