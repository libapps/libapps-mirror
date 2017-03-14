// Copyright (c) 2013 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

'use strict';

/**
 * The shell read-eval-print loop.
 */
wash.Shell = function(executeContext) {
  this.executeContext = executeContext;
  executeContext.onStdIn.addListener(this.onStdIn_.bind(this));
  executeContext.onSignal.addListener(this.onSignal_.bind(this));
  executeContext.onClose.addListener(function() {
      var index = wash.Shell.instances.indexOf(this);
      wash.Shell.instances.splice(index, 1);
    }.bind(this));

  wash.Shell.instances.push(this);
  window.s_ = this;

  if (!this.executeContext.getEnv('PWD'))
    this.executeContext.setEnv('PWD', '/')

  this.inputHistory = [];
  this.executeContext.setEnv('PATH', ['/apps/wash/exe', '/apps/chrome/exe']);

  // The list of currently active jobs.
  this.executeContextList_ = [];

  // The job in the foreground (receives keyboard input).
  this.foregroundContext_ = null;

  /**
   * Fired when we're done with initialization.
   */
  this.onInit = new lib.Event(this.onInit_.bind(this));

  this.tc_ = new lib.wash.Termcap();
  this.promptString_ = this.tc_.output(
      '%set-attr(FG_BOLD, FG_CYAN)wash$ %set-attr()');

  this.jsfs = new wam.jsfs.FileSystem();
  wash.builtins.install
  (this, this.jsfs, '/',
   this.onInit,
   function(err) {
     console.log('Error initializing builtin fs: ' +
                 err);
   });

  this.builtinFS = new wam.binding.fs.FileSystem();
  this.jsfs.addBinding(this.builtinFS);
  this.builtinFS.ready();
};

wash.Shell.instances = [];

/**
 * The main entrypoint when invoked as a lib.wam.fs.Executable.
 */
wash.Shell.main = function(executeContext) {
  var shell = new wash.Shell(executeContext);
  shell.onInit.addListener(shell.repl.bind(shell));
};

wash.Shell.prototype.findExecutable = function(path, onSuccess, onError) {
  var searchList;

  var envPath = this.executeContext.getEnv('PATH', []);
  if (!envPath instanceof Array)
    envPath = [];

  if (path.substr(0, 1) == '/') {
    searchList = [path];
  } else {
    searchList = envPath.map(function(p) { return p + '/' + path });
  }

  var onStatSuccess = function(statResult) {
    if (statResult.abilities.indexOf('EXECUTE') != -1)
      onSuccess(searchList.shift());
  };

  var onStatError = function(value) {
    if (searchList.length > 1) {
      searchList.shift();
      searchNextPath();
    } else {
      onError(wam.mkerr('wam.FileSystem.Error.NotFound', [path]));
    }
  };

  var searchNextPath = function() {
    this.executeContext.fileSystem.stat(
      {path: searchList[0]}, onStatSuccess, onStatError);
  }.bind(this);

  searchNextPath();
};

/**
 * Read-eval-print-loop.
 */
wash.Shell.prototype.repl = function() {
  var ec = this.executeContext.call(
      '/apps/wash/exe/readline',
      {promptString: this.promptString_, inputHistory: this.inputHistory});

  ec.onClose.addListener(function(reason, value) {
    if (reason != 'ok') {
      this.printErrorValue(value);
      this.repl();
      return;
    }

    if (value == null) {
      // EOF from readline.
      this.executeContext.closeOk(null);
      return;
    }

    if (typeof value != 'string') {
      this.errorln('Unexpected type from readline: ' + (typeof value));
      setTimeout(this.repl.bind(this), 5000);
      return;
    }

    var str = value.trim();
    if (str) {
      if (str != this.inputHistory[0])
        this.inputHistory.unshift(str);

      var ary = this.parseShellInput(str);
      if (ary) {
        this.dispatch(ary[0], ary[1]);
      } else {
        this.repl();
      }
    } else {
      this.repl();
    }
  }.bind(this));
};

wash.Shell.prototype.parseShellInput = function(str) {
  var pos = str.indexOf(' ');
  var path, argv;
  if (pos > -1) {
    path = str.substr(0, pos);
    argv = this.parseArgv(str.substr(pos + 1).trim());
    if (!argv)
      return null;
  } else {
    path = str;
    argv = null;
  }

  if (path.substr(0, 2) == './')
    path = this.executeContext.getEnv('PWD', '/') + path.substr(2);

  return [path, argv];
};

wash.Shell.prototype.dispatch = function(path, argv) {
  if (wash.builtins.callbacks.hasOwnProperty(path)) {
    this.dispatchExecuteContext(
        this.builtinFS.createExecuteContext(), path, argv);
    return;
  }

  this.findExecutable
  (path,
   function(abspath) {
     var ec = this.executeContext.fileSystem.createExecuteContext();
     this.dispatchExecuteContext(ec, abspath, argv);
   }.bind(this),
   function(value) {
     this.printErrorValue(value);
     this.repl();
   }.bind(this));
};

wash.Shell.prototype.dispatchExecuteContext = function(ec, path, argv) {
  ec.onClose.addListener(function(reason, value) {
      if (reason == 'error') {
        this.printErrorValue(value);
      } else if (typeof value != 'undefined' && typeof value != 'number' &&
                 value != null) {
        this.println(JSON.stringify(value));
      }

      wam.async(this.repl, [this]);
    }.bind(this));

  this.executeContext.setCallee(ec);

  ec.execute(path, argv);
};

wash.Shell.prototype.parseArgv = function(argv) {
  if (!argv)
    return null;

  if (/[\{\[\"\']/.test(argv.substr(0, 1))) {
    // argv starts with {, [, ", or '... parse it as JSON.
    try {
      return JSON.parse(argv);
    } catch (ex) {
      this.errorln('Error parsing arguments: ' + ex);
      return null;
    }

  } else {
    return argv.split(/\s+/g);
  }
};

wash.Shell.prototype.printErrorValue = function(value) {
  var args = [];
  for (var key in value.errorArg) {
    args.push(key + ': ' + JSON.stringify(value.errorArg[key]));
  }

  var str = this.tc_.output('%set-attr(FG_BOLD, FG_RED)' + value.errorName +
                            '%set-attr()');
  if (args.length)
    str += ': ' + args.join(', ');

  this.errorln(str);
};

wash.Shell.prototype.println = function(str) {
  this.executeContext.stdout(str + '\n');
};

wash.Shell.prototype.errorln = function(str) {
  this.executeContext.stderr(str + '\n');
};

/**
 * Called when the shell initialization is complete.
 */
wash.Shell.prototype.onInit_ = function() {
  this.executeContext.ready();
  console.log('wash.Shell: ready');
  this.println('Welcome to wash ' + chrome.runtime.getManifest().version + '.');
};

/**
 * Hooked up to the onInput event of the message that started the shell.
 */
wash.Shell.prototype.onStdIn_ = function(value) {
  console.warn('Unhandled stdin: ' + value);
};

wash.Shell.prototype.onSignal_ = function(name) {
  console.log('Caught signal: ' + name);
  if (name == 'wam.FileSystem.Signal.Interrupt')
    this.repl();
};
