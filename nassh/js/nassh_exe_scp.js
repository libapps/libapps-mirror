// Copyright (c) 2015 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

nassh.exe.scp = function(cx) {
  var scp = new nassh.Scp(cx);
  scp.run().then(function(value) {
    cx.closeOk(0);
  }, function(err) {
    cx.closeError(err);
  });

  return cx.ephemeralPromise;
};

nassh.exe.scp.signature = {
  'help|h': '?',
  'r': '?',
  'p': '?',
  'v': '?',
  "_": '@'
};

nassh.Scp = function(cx) {
  this.resolveRead_ = null;
  this.readBuffer_ = '';
  this.errors_ = 0;
  this.remoteClosed_ = false;

  this.mtimeSec_ = 0;
  this.mtimeUsec_ = 0;
  this.atimeSec_ = 0;
  this.atimeUsec_ = 0;

  this.fileMode_ = 0;
  this.fileSize_ = 0;
  this.fileName_ = '';

  this.destIsDir_ = false;
  this.destFile_ = '';
  this.dirStack_ = [];

  this.verbose_ = false;
  this.isRecursive_ = false;
  this.withTimestamp_ = false;

  this.cx = cx;
};

nassh.Scp.prototype.run = function() {
  var CMD_USAGE_STRING =
      'usage: scp [[user]@host1:]file1 ... [[user@]host2:]file2';
  this.cx.ready();
  var list = this.cx.getArg('_', []);
  if (list.length < 2 || this.cx.getArg('help')) {
    this.cx.stderr.write(CMD_USAGE_STRING + '\n');
    return this.cx.closeOk();
  }

  // TODO(binji): remove this code until HERE. Just a hack to support flags.
  var nonFlags = [];
  var i;
  var j;
  for (i = 0; i < list.length; ++i) {
    var item = list[i];
    if (item.lastIndexOf('-', 0) == 0) {
      if (item[1] != '-') {
        for (j = 1; j < item.length; ++j) {
          if (item[j] == 'r') {
            this.isRecursive_ = true;
          }
          if (item[j] == 'p') {
            this.withTimestamp_ = true;
          }
          if (item[j] == 'v') {
            this.verbose_ = true;
          }
        }
      } else {
        // Long flag name.
      }
    } else {
      nonFlags.push(item);
    }
  }
  list = nonFlags;
  // HERE

  if (this.cx.getArg('r')) {
    this.isRecursive_ = true;
  }

  if (this.cx.getArg('p')) {
    this.withTimestamp_ = true;
  }

  if (this.cx.getArg('v')) {
    this.verbose_ = true;
  }

  var sources = list.slice(0, list.length - 1);
  var dest = list[list.length - 1];
  var destHostFile = this.parseHostFile_(dest);

  this.destFile_ = destHostFile.file;

  if (destHostFile.host != '') {
    return this.toRemote_(destHostFile, sources);
  } else {
    return this.toLocal_(sources);
  }
};

nassh.Scp.prototype.parseHostFile_ = function(arg) {
  var flag = 0;
  var i;
  var user = '';
  var host = '';
  var file = arg;

  if (arg[i] == ':') {  // leading colon is part of file name.
    return {host: host, user: user, file: file};
  }

  if (arg[i] == '[') {
    flag = 1;
  }

  for (i = 0; i < arg.length; ++i) {
    if (arg[i] == '@' && arg[i + 1] == '[') {
      flag = 1;
    }

    if (arg[i] == ']' && arg[i + 1] == ':' && flag) {
      host = arg.slice(0, i + 1);
      file = arg.slice(i + 2);
      break;
    }

    if (arg[i] == ':' && !flag) {
      host = arg.slice(0, i);
      file = arg.slice(i + 1);
      break;
    }

    if (arg[i] == '/') {
      return {host: host, user: user, file: file};
    }
  }

  if (host == '') {
    return {host: host, user: user, file: file};
  }

  // Check whether "host" is a fileSystem name. If so, assume that the user
  // actually wants to write to a local fileSystem, and not a server with that
  // name. It is always valid to wrap the hostname in (e.g. "[hostname]") if
  // the other behavior is desired.
  var fsm = this.cx.fileSystemManager;
  var fss = fsm.getFileSystems();
  for (i = 0; i < fss.length; ++i) {
    if (fss[i].name == host) {
      return {host: '', user: '', file: arg};
    }
  }

  var at = host.lastIndexOf('@');

  if (at != -1) {
    user = host.slice(0, at);
    host = host.slice(at + 1);
  }

  // Clean the host (i.e. remove square brackets, if any).
  if (host[0] == '[' && host[host.length - 1] == ']') {
    host = host.slice(1, host.length - 1);
  }

  return {host: host, user: user, file: file};
}

nassh.Scp.prototype.toRemote_ = function(destHostFile, sources) {
  var p = this.doCmd_(this.makeCommand_(destHostFile, false))
              .then(this.readResponseAndHandleError_.bind(this));

  sources.forEach(function(source) {
    var sourceHostFile = this.parseHostFile_(source);
    if (sourceHostFile.host != '') {
      // Remote to remote.
      // TODO(binji): implement?
      this.cx.stderr.write('Failed to copy ' + source +
                           '. Remote to remote not supported.\n');
      return;
    } else {
      // Local to remote.
      var sourcePath = new axiom.fs.path.Path(sourceHostFile.file);
      p = p.then(function() {
            return this.getPathInfo_(sourcePath);
          }.bind(this))
          .then(function(result) {
            if (!result.exists) {
              return this.errorExit('File not found: ' + sourceHostFile.file);
            }

            if (result.isDir && !this.isRecursive_) {
              // TODO(binji): support
              return this.errorExit(sourceHostFile.file +
                                    ': not a regular file');
            }

            if (result.isDir) {
              return this.sendRemoteDirectory_(sourcePath, result.stat);
            } else {
              return this.sendRemoteFile_(sourcePath, result.stat);
            }
          }.bind(this));
    }
  }.bind(this));

  return p;
};

nassh.Scp.prototype.makeCommand_ = function(hostFile, remoteIsSource) {
  var command = [
    '-x',
    '-oForwardAgent=no',
    '-oPermitLocalCommand=no',
    '-oClearAllForwardings=yes',
  ];

  if (hostFile.user != '') {
    command.push('-l');
    command.push(hostFile.user);
  }

  command.push('--');
  command.push(hostFile.host);
  command.push('scp');
  command.push('-q');
  if (remoteIsSource) {
    command.push('-f');  // from
  } else {
    command.push('-t');  // to
  }

  if (this.verbose_) {
    command.push('-v');
  }
  if (this.isRecursive_) {
    command.push('-r');
  }
  if (this.withTimestamp_) {
    command.push('-p');
  }
  command.push(hostFile.file);
  return command;
};

nassh.Scp.prototype.getPathInfo_ = function(path) {
  return this.cx.fileSystemManager.stat(path).then(
      // stat success
      function(statResult) {
        return {
          exists: true,
          isDir: (statResult.mode & axiom.fs.path.Path.Mode.D) != 0,
          stat: statResult
        };
      },
      // stat fail
      function(error) {
        return {exists: false, isDir: false, stat: null};
      });
};

nassh.Scp.prototype.sendRemoteDirectory_ = function(sourcePath, sourceStat) {
  var p;

  if (this.withTimestamp_) {
    // T<mtime> 0 <atime> 0\n
    // TODO(binji): The second value should be atime, but that isn't supported
    // in axiom (yet?)
    var timestamp = 'T' + sourceStat.mtime + ' 0 ' + sourceStat.mtime + ' 0\n';
    this.remoteWrite_(timestamp);

    p = this.readResponseAndHandleError_();
  } else {
    p = Promise.resolve();
  }

  return p.then(function() {
        // D<mode in octal> 0 <file name>\n
        // TODO(binji): read file mode when/if supported by axiom.
        var control = 'D0755 0 ' + sourcePath.getBaseName() + '\n';
        this.remoteWrite_(control);
        return this.readResponseAndHandleError_();
      }.bind(this))
      .then(function() {
        return this.cx.fileSystemManager.list(sourcePath);
      }.bind(this))
      .then(function(listResult) {
        var names = Object.keys(listResult).sort();
        var p = Promise.resolve();

        names.forEach(function(name) {
          var stat = listResult[name];
          var path = sourcePath.combine(name);

          if ((stat.mode & axiom.fs.path.Path.Mode.D) != 0) {
            p = p.then(function() {
              return this.sendRemoteDirectory_(path, stat);
            }.bind(this));
          } else {
            p = p.then(function() {
              return this.sendRemoteFile_(path, stat);
            }.bind(this));
          }
        }.bind(this));

        p = p.then(function() {
          this.remoteWrite_('E\n');
          return this.readResponseAndHandleError_();
        }.bind(this));

        return p;
      }.bind(this));
};

nassh.Scp.prototype.remoteWrite_ = function(value) {
  this.stdioSource.stdin.write(value);
};

nassh.Scp.prototype.readResponseAndHandleError_ = function() {
  return this.readBytes_(1).then(this.handleError_.bind(this));
};

nassh.Scp.prototype.readBytes_ = function(numBytes) {
  var onRead = function(success) {
    if (!success) {
      return Promise.resolve(null);
    }

    if (this.readBuffer_.length < numBytes) {
      return this.read_().then(onRead);
    }

    var data = this.readBuffer_.slice(0, numBytes);
    this.readBuffer_ = this.readBuffer_.slice(numBytes);
    return Promise.resolve(data);
  }.bind(this);

  // Try reading from the buffer first.
  return onRead(true);
};

nassh.Scp.prototype.read_ = function() {
  if (this.remoteClosed_) {
    if (this.readBuffer_.length > 0) {
      console.error('Buffer has extra unparsed data. length ' +
                    this.readBuffer_.length + '\n' + this.readBuffer_);
    }

    return Promise.resolve(false);
  }

  if (this.resolveRead_ != null) {
    // TODO(binji): better assert?
    throw new Error('resolveRead_ not null when calling read_.');
  }

  return new Promise(function(resolve, reject) {
    this.resolveRead_ = function(value) {
      this.resolveRead_ = null;
      resolve(value);
    }.bind(this);
  }.bind(this));
};

nassh.Scp.prototype.sendRemoteFile_ = function(sourcePath, sourceStat) {
  var dataType = axiom.fs.data_type.DataType.UTF8String;
  var openMode = axiom.fs.open_mode.OpenMode.fromString('r');
  var readResult;
  var p;

  if (this.withTimestamp_) {
    // T<mtime> 0 <atime> 0\n
    // TODO(binji): The second value should be atime, but that isn't supported
    // in axiom (yet?)
    var timestamp = 'T' + sourceStat.mtime + ' 0 ' + sourceStat.mtime + ' 0\n';
    this.remoteWrite_(timestamp);

    p = this.readResponseAndHandleError_();
  } else {
    p = Promise.resolve();
  }

  return p.then(function() {
        return this.cx.fileSystemManager.readFile(sourcePath, dataType,
                                                  openMode);
      }.bind(this))
      .then(function(result) {
        readResult = result;
        var control = 'C0644 ' + readResult.data.length + ' ' +
                      sourcePath.getBaseName() + '\n';
        this.remoteWrite_(control);
        return this.readResponseAndHandleError_();
      }.bind(this))
      .then(function() {
        // TODO(binji): Write the file data to the plugin in smaller chunks.
        // TODO(binji): Should print an error here (instead of \0) if the write
        // failed.
        this.remoteWrite_(readResult.data + '\0');
        return this.readResponseAndHandleError_();
      }.bind(this));
};

nassh.Scp.prototype.handleError_ = function(errorCode) {
  if (errorCode == '\0') {
    return;
  }

  return this.readLine_()
      .then(function(line) {
        line += '\n';
        if (errorCode == '\u0002') {
          this.cx.stderr.write(line);
          return Promise.reject(line);
        } else {
          this.cx.stderr.write(line);
        }
      }.bind(this));
};

nassh.Scp.prototype.toLocal_ = function(sources) {
  var destPath = new axiom.fs.path.Path(this.destFile_);
  var p;

  p = this.getPathInfo_(destPath)
      .then(function(result) {
        this.destIsDir_ = result.isDir;
        if (sources.length > 1 && !this.destIsDir_) {
          return Promise.reject('Expected ' + this.destFile_ +
                                ' to be directory.');
        }
      }.bind(this));

  sources.forEach(function(source) {
    var sourceHostFile = this.parseHostFile_(source);
    if (sourceHostFile.host == '') {
      // Local to local.
      // TODO(binji): implement via cp
      this.cx.stderr.write('Failed to copy ' + sourceHostFile.file +
                           '. Local to local not supported.\n');
      return;
    } else {
      // Remote to local.
      p = p.then(function() {
            return this.doCmd_(this.makeCommand_(sourceHostFile, true));
          }.bind(this))
          .then(function() {
            this.remoteWrite_('\0');
          }.bind(this))
          .then(this.readAndParseLine_.bind(this));
    }
  }.bind(this));

  return p;
};

nassh.Scp.prototype.readAndParseLine_ = function() {
  return this.readLine_().then(this.parseLine_.bind(this));
};

nassh.Scp.prototype.doCmd_ = function(args) {
  var nassh = new axiom.fs.path.Path('jsfs:/exe/nassh');
  this.stdioSource = new axiom.fs.stdio_source.StdioSource();

  return this.cx.fileSystemManager.createExecuteContext(
                                       nassh, this.stdioSource.stdio, args)
      .then(function(cx) {
        this.sshcx = cx;
        cx.dependsOn(this.cx);

        cx.onClose.addListener(function(reason, value) {
          this.remoteClosed_ = true;
          if (this.resolveRead_) {
            this.resolveRead_(false);
          }
        }.bind(this));

        this.stdioSource.stdout.onData.addListener(function(value) {
          this.readBuffer_ += value;
          if (this.resolveRead_) {
            this.resolveRead_(true);
          }
        }.bind(this));
        this.stdioSource.stdout.resume();

        this.stdioSource.stderr.onData.addListener(
            this.cx.stderr.write.bind(this.cx.stderr));
        this.stdioSource.stderr.resume();

        this.stdioSource.ttyout.onData.addListener(
            this.cx.stderr.write.bind(this.cx.stderr));
        this.stdioSource.ttyout.resume();

        this.cx.stdin.onData.addListener(
            this.stdioSource.ttyin.write.bind(this.stdioSource.ttyin));

        cx.execute();
      }.bind(this));
};

nassh.Scp.prototype.readLine_ = function() {
  var onRead = function(success) {
    if (!success) {
      return Promise.resolve(null);
    }

    var nl = this.readBuffer_.indexOf('\n');
    if (nl == -1) {
      return this.read_().then(onRead);
    }

    var line = this.readBuffer_.slice(0, nl);
    this.readBuffer_ = this.readBuffer_.slice(nl + 1);
    return Promise.resolve(line);
  }.bind(this);

  // Try reading from the buffer first.
  return onRead(true);
};

nassh.Scp.prototype.parseLine_ = function(line) {
  if (line == null) {
    // No more data, the remote end must have closed.
    return Promise.resolve();
  }

  var c = line[0];
  var msg;
  var match;

  switch (c) {
    case '\u0001':
    case '\u0002':
      // Error.
      this.errors_++;
      msg = line.slice(1);
      this.cx.stderr.write(msg + '\n');

      if (c == '\u0002') {
        // Fatal error.
        return Promise.reject(msg);
      }
      break;

    case 'T':
      // Timestamp
      match = /T(\d+) (\d+) (\d+) (\d+)/.exec(line);
      if (!match) {
        return this.errorExit('unable to parse timestamp: ' + line);
      }

      this.mtimeSec_ = parseInt(match[1], 10);
      this.mtimeUsec_ = parseInt(match[2], 10);
      this.atimeSec_ = parseInt(match[3], 10);
      this.atimeUsec_ = parseInt(match[4], 10);
      this.remoteWrite_('\0');
      break;

    case 'C':
    case 'D':
      match = /(C|D)([0-7]+) (\d+) (.*)/.exec(line);
      if (!match) {
        return this.errorExit('unable to parse control line: ' + line);
      }

      this.fileMode_ = parseInt(match[2], 8);
      this.fileSize_ = parseInt(match[3], 10);
      this.fileName_ = match[4];
      this.remoteWrite_('\0');

      if (c == 'C') {
        // Regular file
        // TODO(binji): read/write file at the same time, rather than reading
        // it all in at once.
        return this.readBytes_(this.fileSize_)
            .then(this.writeLocalFile_.bind(this))
            .then(this.readResponseAndHandleError_.bind(this))
            .then(function() {
              this.remoteWrite_('\0');
            }.bind(this))
            .then(this.readAndParseLine_.bind(this));
      } else {
        // Directory
        var path = this.makePath_();
        return this.getPathInfo_(path)
            .then(function(result) {
              if (result.exists) {
                // File exists, make sure it is a directory.
                if (!result.isDir) {
                  return this.errorExit('expected \"' + path +
                                        '\" to be directory');
                }
              } else {
                // Directory doesn't exist? Try to create it.
                return this.cx.fileSystemManager.mkdir(path);
              }
            }.bind(this))
            .then(function() {
              this.dirStack_.push(this.fileName_);
            }.bind(this))
            .then(this.readAndParseLine_.bind(this));
      }
      break;

    case 'E':
      this.dirStack_.pop();
      this.remoteWrite_('\0');
      break;

    default:
      return this.errorExit('expected control record');
  }

  return this.readAndParseLine_();
};

nassh.Scp.prototype.makePath_ = function() {
  var path = new axiom.fs.path.Path(this.destFile_);
  if (this.destIsDir_) {
    if (this.dirStack_) {
      path = path.combine(this.dirStack_.join('/'));
    }

    path = path.combine(this.fileName_);
  }

  return path;
};

nassh.Scp.prototype.writeLocalFile_ = function(data) {
  var path = this.makePath_();
  var dataType = axiom.fs.data_type.DataType.UTF8String;
  var openMode = axiom.fs.open_mode.OpenMode.fromString('ctw');

  // TODO(binji): Set timestamp and file mode...?
  return this.cx.fileSystemManager.writeFile(path, dataType, data, openMode);
};

nassh.Scp.prototype.error = function(msg) {
  msg += '\n';
  this.remoteWrite_('\u0001' + msg);
  this.cx.stderr.write(msg);
};

nassh.Scp.prototype.errorExit = function(msg) {
  msg += '\n';
  this.remoteWrite_('\u0002' + msg);
  this.cx.stderr.write(msg);
  // TODO(binji): Wait until msg is sent to remote end? How to do this?
  return Promise.reject(msg);
};
