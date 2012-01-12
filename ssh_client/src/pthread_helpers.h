// Copyright (c) 2011 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

#ifndef PTHREAD_HELPERS_H
#define PTHREAD_HELPERS_H

#include <assert.h>
#include <stdint.h>
#include <pthread.h>

// A macro to disallow the evil copy constructor and operator= functions
// This should be used in the private: declarations for a class
#define DISALLOW_COPY_AND_ASSIGN(TypeName)      \
  TypeName(const TypeName&);                    \
  void operator=(const TypeName&)

// A macro to disallow all the implicit constructors, namely the
// default constructor, copy constructor and operator= functions.
//
// This should be used in the private: declarations for a class
// that wants to prevent anyone from instantiating it. This is
// especially useful for classes containing only static methods.
#define DISALLOW_IMPLICIT_CONSTRUCTORS(TypeName) \
  TypeName();                                    \
  DISALLOW_COPY_AND_ASSIGN(TypeName)

class Mutex {
 public:
  Mutex() {
    pthread_mutexattr_t attrs;
    int result = pthread_mutexattr_init(&attrs);
    assert(result == 0);
    result = pthread_mutexattr_settype(&attrs, PTHREAD_MUTEX_RECURSIVE);
    assert(result == 0);
    result = pthread_mutex_init(&mutex_, &attrs);
    assert(result == 0);
    pthread_mutexattr_destroy(&attrs);
  }

  ~Mutex() {
     pthread_mutex_destroy(&mutex_);
  }

  pthread_mutex_t* get() {
    return &mutex_;
  }

  class Lock {
   public:
    Lock(Mutex& mutex) : mutex_(mutex) {
      pthread_mutex_lock(mutex_.get());
    }

    ~Lock() {
      pthread_mutex_unlock(mutex_.get());
    }

   private:
    DISALLOW_COPY_AND_ASSIGN(Lock);
    Mutex& mutex_;
  };

 private:
  DISALLOW_COPY_AND_ASSIGN(Mutex);
  pthread_mutex_t mutex_;
};

class Cond {
 public:
  Cond() {
    pthread_cond_init(&cond_, NULL);
  }

  ~Cond() {
    pthread_cond_destroy(&cond_);
  }

  pthread_cond_t* get() {
    return &cond_;
  }

  void broadcast() {
    pthread_cond_broadcast(&cond_);
  }

  void signal() {
    pthread_cond_signal(&cond_);
  }

  int wait(Mutex& mutex) {
    return pthread_cond_wait(&cond_, mutex.get());
  }

  int timedwait(Mutex& mutex, const timespec* abstime) {
    return pthread_cond_timedwait(&cond_, mutex.get(), abstime);
  }

 private:
  DISALLOW_COPY_AND_ASSIGN(Cond);
  pthread_cond_t cond_;
};

class ThreadSafeRefCount {
 public:
  ThreadSafeRefCount()
      : ref_(0) {
  }

  int32_t AddRef() {
    __sync_fetch_and_add(&ref_, 1);
    return ref_;
  }

  int32_t Release() {
    __sync_fetch_and_sub(&ref_, 1);
    return ref_;
  }

 private:
  DISALLOW_COPY_AND_ASSIGN(ThreadSafeRefCount);
  int32_t ref_;
};

#ifndef NDEBUG
#define LOG(format, args...) \
  debug_log(format , ## args)
#else
#define LOG(format, args...)
#endif

extern "C" void debug_log(const char* format, ...);

#endif  // PTHREAD_HELPERS_H
