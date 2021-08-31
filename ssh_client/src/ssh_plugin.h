// Copyright (c) 2012 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

#ifndef SSH_PLUGIN_H
#define SSH_PLUGIN_H

#include <string>
#include <map>

#include "ppapi/cpp/completion_callback.h"
#include "ppapi/cpp/instance.h"
#include "ppapi/cpp/var.h"
#include "ppapi/cpp/var_array.h"
#include "ppapi/cpp/var_dictionary.h"

#include "pthread_helpers.h"
#include "file_system.h"

class SshPluginInstance : public pp::Instance,
                          public OutputInterface {
 public:
  explicit SshPluginInstance(PP_Instance instance);
  virtual ~SshPluginInstance();

  virtual void HandleMessage(const pp::Var& message_data);

  static SshPluginInstance* GetInstance() { return instance_; }
  pp::Core* core() { return core_; }
  pthread_t openssh_thread() { return openssh_thread_; }

  // Implements OutputInterface.
  virtual bool OpenFile(int fd, const char* name, int mode,
                        InputInterface* stream);
  virtual bool OpenSocket(int fd, const char* host, uint16_t port,
                          InputInterface* stream);
  virtual bool Write(int fd, const char* data, size_t size);
  virtual bool Read(int fd, size_t size);
  virtual bool Close(int fd);
  virtual void ReadPass(const char* prompt, size_t size, bool echo);
  virtual size_t GetWriteWindow();
  virtual void SendExitCode(int error);

 private:
  typedef std::map<int, InputInterface*> InputStreams;

  void StartSession(const pp::VarArray& args);
  void OnOpen(const pp::VarArray& args);
  void OnRead(const pp::VarArray& args);
  void OnWriteAcknowledge(const pp::VarArray& args);
  void OnClose(const pp::VarArray& args);
  void OnReadReady(const pp::VarArray& args);
  void OnResize(const pp::VarArray& args);
  void OnExitAcknowledge(const pp::VarArray& args);
  void OnReadPass(const pp::VarArray& args);

  void SessionThreadImpl();
  static void* SessionThread(void* arg);

  void Invoke(const std::string& function, const pp::VarArray& args);
  void InvokeJS(const std::string& function, const pp::VarArray& args);

  void PrintLog(const std::string& msg);
  void PrintLogImpl(int32_t result, const std::string& msg);

  void SendExitCodeImpl(int32_t result, int error);

  static SshPluginInstance* instance_;

  pp::Core* core_;
  pthread_t openssh_thread_;
  pp::VarDictionary session_args_;
  pp::CompletionCallbackFactory<SshPluginInstance> factory_;
  InputStreams streams_;
  FileSystem file_system_;

  DISALLOW_COPY_AND_ASSIGN(SshPluginInstance);
};

#endif  // SSH_PLUGIN_H
