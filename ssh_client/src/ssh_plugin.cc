// Copyright (c) 2012 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

#include "ssh_plugin.h"

#include <stdio.h>
#include <string.h>
#include <resolv.h>

#include "ppapi/cpp/module.h"
#include "ppapi/cpp/var_array_buffer.h"

#include "file_system.h"

const char kMessageNameAttr[] = "name";
const char kMessageArgumentsAttr[] = "arguments";

// These are C++ the method names as JavaScript sees them.
const char kStartSessionMethodId[] = "startSession";
const char kOnOpenFileMethodId[] = "onOpenFile";
const char kOnOpenSocketMethodId[] = "onOpenSocket";
const char kOnReadMethodId[] = "onRead";
const char kOnWriteAcknowledgeMethodId[] = "onWriteAcknowledge";
const char kOnCloseMethodId[] = "onClose";
const char kOnReadReadyMethodId[] = "onReadReady";
const char kOnResizeMethodId[] = "onResize";
const char kOnExitAcknowledgeMethodId[] = "onExitAcknowledge";

// Known startSession attributes.
const char kUsernameAttr[] = "username";
const char kHostAttr[] = "host";
const char kPortAttr[] = "port";
const char kTerminalWidthAttr[] = "terminalWidth";
const char kTerminalHeightAttr[] = "terminalHeight";
const char kUseJsSocketAttr[] = "useJsSocket";
const char kEnvironmentAttr[] = "environment";
const char kArgumentsAttr[] = "arguments";
const char kWriteWindowAttr[] = "writeWindow";
const char kAuthAgentAppID[] = "authAgentAppID";
const char kSubsystemAttr[] = "subsystem";

// These are JavaScript method names as C++ code sees them.
const char kPrintLogMethodId[] = "printLog";
const char kExitMethodId[] = "exit";
const char kOpenFileMethodId[] = "openFile";
const char kOpenSocketMethodId[] = "openSocket";
const char kWriteMethodId[] = "write";
const char kReadMethodId[] = "read";
const char kCloseMethodId[] = "close";

const size_t kDefaultWriteWindow = 64 * 1024;

extern "C" int ssh_main(int ac, const char** av, const char *subsystem);

//------------------------------------------------------------------------------

SshPluginInstance* SshPluginInstance::instance_ = NULL;

SshPluginInstance::SshPluginInstance(PP_Instance instance)
    : pp::Instance(instance),
      core_(pp::Module::Get()->core()),
      openssh_thread_(NULL),
      factory_(this),
      file_system_(this, this) {
  instance_ = this;
}

SshPluginInstance::~SshPluginInstance() {
  instance_ = NULL;
}

void SshPluginInstance::HandleMessage(const pp::Var& message_data) {
  if (message_data.is_dictionary()) {
    pp::VarDictionary message(message_data);
    pp::Var function_var = message.Get(kMessageNameAttr);
    pp::Var args_var = message.Get(kMessageArgumentsAttr);

    if (function_var.is_string() && args_var.is_array()) {
      const std::string function = function_var.AsString();
      if (!function.empty()) {
        const pp::VarArray args(args_var);
        Invoke(function, args);
      }
    }
  }
}

void SshPluginInstance::Invoke(const std::string& function,
                               const pp::VarArray& args) {
  if (function == kStartSessionMethodId) {
    StartSession(args);
  } else if (function == kOnOpenFileMethodId ||
             function == kOnOpenSocketMethodId) {
    OnOpen(args);
  } else if (function == kOnReadMethodId) {
    OnRead(args);
  } else if (function == kOnWriteAcknowledgeMethodId) {
    OnWriteAcknowledge(args);
  } else if (function == kOnCloseMethodId) {
    OnClose(args);
  } else if (function == kOnReadReadyMethodId) {
    OnReadReady(args);
  } else if (function == kOnResizeMethodId) {
    OnResize(args);
  } else if (function == kOnExitAcknowledgeMethodId) {
    OnExitAcknowledge(args);
  }
}

void SshPluginInstance::InvokeJS(const std::string& function,
                                 const pp::VarArray& args) {
  pp::VarDictionary dict;
  dict.Set(kMessageNameAttr, pp::Var(function));
  dict.Set(kMessageArgumentsAttr, args);
  PostMessage(dict);
}

void SshPluginInstance::PrintLogImpl(int32_t result, const std::string& msg) {
  pp::VarArray call_args;
  call_args.SetLength(1);
  call_args.Set(0, msg);
  InvokeJS(kPrintLogMethodId, call_args);
}

void SshPluginInstance::PrintLog(const std::string& msg) {
  core_->CallOnMainThread(0, factory_.NewCallback(
      &SshPluginInstance::PrintLogImpl, msg));
}

void SshPluginInstance::SendExitCodeImpl(int32_t result, int error) {
  pp::VarArray call_args;
  call_args.SetLength(1);
  call_args.Set(0, error);
  InvokeJS(kExitMethodId, call_args);
}

void SshPluginInstance::SendExitCode(int error) {
  core_->CallOnMainThread(0, factory_.NewCallback(
      &SshPluginInstance::SendExitCodeImpl, error));
  openssh_thread_ = NULL;
}

bool SshPluginInstance::OpenFile(int fd, const char* name, int mode,
                                 InputInterface* stream) {
  if (name) {
    pp::VarArray call_args;
    call_args.SetLength(3);
    call_args.Set(0, fd);
    call_args.Set(1, name);
    call_args.Set(2, mode);
    InvokeJS(kOpenFileMethodId, call_args);
  }
  assert(streams_.find(fd) == streams_.end());
  streams_[fd] = stream;
  return true;
}

bool SshPluginInstance::OpenSocket(int fd, const char* host, uint16_t port,
                                   InputInterface* stream) {
  pp::VarArray call_args;
  call_args.SetLength(3);
  call_args.Set(0, fd);
  call_args.Set(1, host);
  call_args.Set(2, port);
  InvokeJS(kOpenSocketMethodId, call_args);
  assert(streams_.find(fd) == streams_.end());
  streams_[fd] = stream;
  return true;
}

bool SshPluginInstance::Write(int fd, const char* data, size_t size) {
  const size_t kMaxWriteSize = 32 * 1024;
  pp::VarArray call_args;
  size_t start = 0;

  call_args.SetLength(2);
  call_args.Set(0, fd);

  while (start < size) {
    size_t chunk_size = ((size - start) <= kMaxWriteSize) ? (size - start)
                                                          : kMaxWriteSize;

    pp::VarArrayBuffer arr(chunk_size);
    char* buf = static_cast<char*>(arr.Map());
    memcpy(buf, data + start, chunk_size);
    arr.Unmap();

    call_args.Set(1, arr);

    start += chunk_size;
    InvokeJS(kWriteMethodId, call_args);
  }
  return true;
}

bool SshPluginInstance::Read(int fd, size_t size) {
  pp::VarArray call_args;
  call_args.SetLength(2);
  call_args.Set(0, fd);
  call_args.Set(1, (int32_t)size);
  InvokeJS(kReadMethodId, call_args);
  return true;
}

bool SshPluginInstance::Close(int fd) {
  pp::VarArray call_args;
  call_args.SetLength(1);
  call_args.Set(0, fd);
  InvokeJS(kCloseMethodId, call_args);
  return true;
}

size_t SshPluginInstance::GetWriteWindow() {
  if (session_args_.HasKey(kWriteWindowAttr)) {
    const pp::Var arg = session_args_.Get(kWriteWindowAttr);
    if (arg.is_number())
      return arg.AsInt();
  }
  return kDefaultWriteWindow;
}

void SshPluginInstance::SessionThreadImpl() {
  file_system_.WaitForStdFiles();

  // Call renamed ssh main.
  std::vector<const std::string> argv;
  // argv[0]
  argv.push_back("ssh");
  if (session_args_.HasKey(kArgumentsAttr)) {
    const pp::Var arg = session_args_.Get(kArgumentsAttr);
    if (arg.is_array()) {
      const pp::VarArray args(arg);
      for (size_t i = 0; i < args.GetLength(); i++) {
        if (args.Get(i).is_string())
          argv.push_back(args.Get(i).AsString());
        else
          PrintLog("startSession: invalid argument\n");
      }
    }
  }

  std::string port;
  if (session_args_.HasKey(kPortAttr)) {
    char buf[64];
    snprintf(buf, sizeof(buf), "-p%d", session_args_.Get(kPortAttr).AsInt());
    port = buf;
    argv.push_back(port.c_str());
  }

  std::string username_hostname;
  if (session_args_.HasKey(kUsernameAttr) &&
      session_args_.HasKey(kHostAttr)) {
    username_hostname = session_args_.Get(kUsernameAttr).AsString() + "@" +
        session_args_.Get(kHostAttr).AsString();
    argv.push_back(username_hostname.c_str());
  }

  std::string subsystem;
  const char *csubsystem = NULL;
  if (session_args_.HasKey(kSubsystemAttr)) {
    subsystem = session_args_.Get(kSubsystemAttr).AsString();
    csubsystem = subsystem.c_str();
  }

  LOG("ssh main args:\n");
  for (size_t i = 0; i < argv.size(); i++)
    LOG("  argv[%d] = %s\n", i, argv[i]);

  std::vector<const char *> cargv;
  for (auto it = argv.begin(); it != argv.end(); ++it)
    cargv.push_back(it->c_str());
  SendExitCode(ssh_main(cargv.size(), &cargv[0], csubsystem));
}

void* SshPluginInstance::SessionThread(void* arg) {
  SshPluginInstance* instance = static_cast<SshPluginInstance*>(arg);
  instance->SessionThreadImpl();
  return NULL;
}

void SshPluginInstance::StartSession(const pp::VarArray& args) {
  if (openssh_thread_) {
    PrintLogImpl(0, "startSession: session already started!\n");
    return;
  }

  if (args.GetLength() != 1) {
    PrintLogImpl(0, "startSession: args must be one element only\n");
    return;
  }

  const pp::Var session_arg = args.Get(0);
  if (!session_arg.is_dictionary()) {
    PrintLogImpl(0, "startSession: args[0] must be a dictionary of settings\n");
    return;
  }

  session_args_ = pp::VarDictionary(session_arg);

  if (session_args_.HasKey(kTerminalWidthAttr) &&
      session_args_.Get(kTerminalWidthAttr).is_number() &&
      session_args_.HasKey(kTerminalHeightAttr) &&
      session_args_.Get(kTerminalHeightAttr).is_number()) {
    file_system_.SetTerminalSize(session_args_.Get(kTerminalWidthAttr).AsInt(),
                                 session_args_.Get(kTerminalHeightAttr).AsInt());
  }
  if (session_args_.HasKey(kUseJsSocketAttr) &&
      session_args_.Get(kUseJsSocketAttr).is_bool()) {
    file_system_.UseJsSocket(session_args_.Get(kUseJsSocketAttr).AsBool());
  }
  if (session_args_.HasKey(kEnvironmentAttr) &&
      session_args_.Get(kEnvironmentAttr).is_dictionary()) {
    const pp::VarDictionary env(session_args_.Get(kEnvironmentAttr));
    const pp::VarArray keys = env.GetKeys();
    for (size_t i = 0; i < keys.GetLength(); ++i) {
      const pp::Var key(keys.Get(i));
      const pp::Var value(env.Get(key));
      if (key.is_string() && value.is_string())
        setenv(key.AsString().c_str(), value.AsString().c_str(), 1);
    }
  }
  if (session_args_.HasKey(kAuthAgentAppID) &&
      session_args_.Get(kAuthAgentAppID).is_string()) {
    const pp::Var agent(session_args_.Get(kAuthAgentAppID));
    setenv("SSH_AUTH_SOCK", agent.AsString().c_str(), 1);
  }
  if (pthread_create(&openssh_thread_, NULL,
                     &SshPluginInstance::SessionThread, this)) {
    SendExitCodeImpl(0, -1);
  }
}

void SshPluginInstance::OnOpen(const pp::VarArray& args) {
  const pp::Var fd = args.Get(0);
  const pp::Var success = args.Get(1);
  const pp::Var is_atty = args.Get(2);
  if (fd.is_number() && success.is_bool() && is_atty.is_bool()) {
    InputStreams::iterator it = streams_.find(fd.AsInt());
    if (it != streams_.end()) {
      it->second->OnOpen(success.AsBool(), is_atty.AsBool());
      if (!success.AsBool())
        streams_.erase(it);
    } else {
      PrintLogImpl(0, "onOpen: for unknown file descriptor\n");
    }
  } else {
    PrintLogImpl(0, "onOpen: invalid arguments\n");
  }
}

void SshPluginInstance::OnRead(const pp::VarArray& args) {
  const pp::Var fd = args.Get(0);
  const pp::Var data = args.Get(1);

  if (!fd.is_number()) {
    PrintLogImpl(0, "onRead: bad fd argument (non-numeric)\n");
    return;
  }

  InputStreams::iterator it = streams_.find(fd.AsInt());
  if (it == streams_.end()) {
    PrintLogImpl(0, "onRead: for unknown file descriptor\n");
    return;
  }

  if (data.is_string()) {
    const std::string& str = data.AsString();
    std::vector<char> buf(str.size() * 3 / 4);
    int res = b64_pton(str.c_str(), (unsigned char*)&buf[0], buf.size());
    assert(res >= 0);
    it->second->OnRead(&buf[0], res);
  } else if (data.is_array()) {
    const pp::VarArray arr(data);
    std::vector<char> buf(arr.GetLength());
    for (size_t i = 0; i < buf.size(); ++i)
      buf[i] = arr.Get(i).AsInt();
    it->second->OnRead(&buf[0], buf.size());
  } else if (data.is_array_buffer()) {
    pp::VarArrayBuffer arr(data);
    const char* buf = static_cast<char*>(arr.Map());
    it->second->OnRead(buf, arr.ByteLength());
    arr.Unmap();
  } else {
    PrintLogImpl(0, "onRead: invalid data argument (not string or array)\n");
  }
}

void SshPluginInstance::OnWriteAcknowledge(const pp::VarArray& args) {
  const pp::Var fd = args.Get(0);
  const pp::Var count = args.Get(1);
  if (fd.is_number() && count.is_number()) {
    InputStreams::iterator it = streams_.find(fd.AsInt());
    if (it != streams_.end()) {
      // TODO(dpolukhin): UInt here is only 32-bit, current version of API
      // don't support 64-bit integer numbers.
      it->second->OnWriteAcknowledge(count.AsInt());
    } else {
      PrintLogImpl(0, "onWriteAcknowledge: for unknown file descriptor\n");
    }
  } else {
    PrintLogImpl(0, "onWriteAcknowledge: invalid arguments\n");
  }
}

void SshPluginInstance::OnClose(const pp::VarArray& args) {
  const pp::Var fd = args.Get(0);
  InputStreams::iterator it = streams_.find(fd.AsInt());
  if (it != streams_.end()) {
    it->second->OnClose();
    streams_.erase(it);
  } else {
    PrintLogImpl(0, "onClose: for unknown file descriptor\n");
  }
}

void SshPluginInstance::OnReadReady(const pp::VarArray& args) {
  const pp::Var fd = args.Get(0);
  const pp::Var result = args.Get(1);
  if (fd.is_number() && result.is_bool()) {
    InputStreams::iterator it = streams_.find(fd.AsInt());
    if (it != streams_.end()) {
      it->second->OnReadReady(result.AsBool());
    } else {
      PrintLogImpl(0, "onReadReady: for unknown file descriptor\n");
    }
  } else {
    PrintLogImpl(0, "onReadReady: invalid arguments\n");
  }
}

void SshPluginInstance::OnResize(const pp::VarArray& args) {
  file_system_.SetTerminalSize(args.Get(0).AsInt(),
                               args.Get(1).AsInt());
}

void SshPluginInstance::OnExitAcknowledge(const pp::VarArray& args) {
  file_system_.ExitCodeAcked();
}

//------------------------------------------------------------------------------

namespace pp {

class SshPluginModule : public pp::Module {
 public:
  SshPluginModule() : pp::Module() {}
  virtual ~SshPluginModule() {}

  virtual pp::Instance* CreateInstance(PP_Instance instance) {
    return new SshPluginInstance(instance);
  }
};

Module* CreateModule() {
  return new SshPluginModule();
}

}  // namespace pp
