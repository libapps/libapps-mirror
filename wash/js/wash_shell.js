// Copyright (c) 2013 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

'use strict';

/**
 * The shell read-eval-print loop.
 *
 * This is exposed as a lib.wa.fs.Executable from wash.Commands.
 *
 * @param {wash.App} app The application that owns this object.
 * @param {lib.wa.Message} execMsg The 'execute' message that invoked the shell.
 */
wash.Shell = function(app, execMsg) {
  this.app = app;
  this.execMsg = execMsg;

  this.searchPath = ['/exe'];
  this.env = {TERM: 'xterm-256color'};

  // Route incoming messages to our onInput handler.
  execMsg.meta.onInput.addListener(this.onInput_, this);

  // The list of currently active jobs.
  this.jobs_ = [];

  // The job in the foreground (receives keyboard input).
  this.foregroundJob_ = null;

  /**
   * Fired when we're done with intialization.
   */
  this.onInit = new lib.Event(this.onInit_.bind(this));

  this.tc_ = new lib.hterm.Termcap();
  this.promptString_ = this.tc_.output(
      '%set-attr(FG_BOLD, FG_CYAN)wash$ %set-attr()');

  // TODO(rginda): We don't actually need async init right now, but we used to,
  // and we may again, so we'll continue to fire onInit for now.
  setTimeout(function() { this.onInit() }.bind(this), 0);
};

/**
 * The main entrypoint when invoked as a lib.wa.fs.Executable.
 */
wash.Shell.main = function(app, execMsg) {
  var shell = new wash.Shell(app, execMsg);
  shell.repl();
};

/**
 * Search a list of paths for a file.
 *
 * If found, the file will be executed and the onReply callback will be
 * connected to the open message.
 *
 * If not found, the onError callback will be the error message returned by
 * the an attempt to execute via the final search path.
 */
wash.Shell.prototype.findAndExecute = function(path, arg, onReply, onError) {
  this.find('execute', path, arg, onReply, onError);
};

/**
 * Search a list of paths for a file.
 *
 * If found, the file will be opened and the onReply callback will be connected
 * to the open message.
 *
 * If not found, the onError callback will be the error message returned by
 * the an attempt to open via the final search path.
 */
wash.Shell.prototype.findAndOpen = function(path, arg, onReply, onError) {
  this.find('open', path, arg, onReply, onError);
};

/**
 * Search a list of paths for a file.
 *
 * The search happens by sending a message with a given name repeatedly, once
 * for each string in searchPath, or until the first successful waitReady.
 *
 * If called, the onReply callback will be associated with the first successful
 * waitReady's onReply callback.
 *
 * If called, the onError callback will be associated with the last failed
 * waitReady's onError callback.
 */
wash.Shell.prototype.find = function(messageName, path, arg, onReply, onError) {
  arg = arg || {};

  if (path.substr(0, 1) == '/') {
    arg.path = path;
    var outboundMsg = this.app.waitReady
        (messageName, arg,
         function(msg) { onReply(msg, outboundMsg) },
         function(msg) { onError(msg, outboundMsg) });

  } else if (this.pwdReadyReply_ && path.substr(0, 2) == './') {
    // TODO: pwd things.
    throw new Error('so pwd                 much not implemented');
    //arg.path = path.substr(2);
    //this.pwdReadyReply_.waitReady(messageName, arg, onReply, onError);
  } else {
    // Copy search path to make it async-safe.
    var pwd = this.pwd;
    var searchPath = [].concat(this.searchPath);
    var tryIndex = function(i) {
      arg.path = searchPath[i] + '/' + path;
      var outboundMsg = this.app.waitReady
      (messageName, arg,
       function(msg) { onReply(msg, outboundMsg) },
       function(msg) {
         if (i < searchPath.length - 1) {
           tryIndex(i + 1);
         } else {
           onError(msg, outboundMsg);
         }
       });
    }.bind(this);

    tryIndex(0);
  }
};

wash.Shell.Job = function(argv, env) {
  this.argv = argv;
  this.env = env;

  this.path = null;

  this.execMsg = null;
  this.readyMsg = null;
  this.finalMsg = null;
  this.errorMsg = null;

  this.onClose = new lib.Event();
  this.onReply = new lib.Event();
  this.onError = new lib.Event();
};

/**
 * Create a new job and execute it.
 *
 * @param {string} path The path to the lib.wa.fs.Executable.
 * @param {*} argv The argument value for the executable.
 * @param {*} env The environment value for the executable.
 * @param {function(lib.wa.Message)} opt_onReply The optional callback to invoke
 *     with messages sent by the executable.  This takes the place of the
 *     shell's build-in onExecuteReply_.  Messages will not reach the terminal
 *     unless you explicitly send them.
 * @param {function(lib.wa.Message)} opt_onError The optional callback to
 *     invoke if the executable fails to start.
 */
wash.Shell.prototype.execute = function(path, argv, env) {
  var job = new wash.Shell.Job(argv, env);

  job.onClose.addListener
  (function() {
    this.removeJob(job);
  }, this);

  job.onReply.addListener
  (function(msg, execMsg) {
    if (msg.name == 'ready') {
      job.path = execMsg.path;
      job.readyMsg = msg;
      job.execMsg = execMsg;
      execMsg.onClose.addListener(job.onClose);
    } else if (msg.isFinalReply) {
      job.finalMsg = msg;
    }
  }, this);

  job.onError.addListener
  (function(msg) {
    job.errorMsg = msg;
    job.onClose();
  }, this);

  this.findAndExecute(path, {argv: argv, env: env}, job.onReply, job.onError);
  this.jobs_.push(job);
  return job;
};

/**
 * Create a new job and execute it in the foreground.
 */
wash.Shell.prototype.foregroundExecute = function(path, argv) {
  var job = this.execute(path, argv, this.env);

  job.onReply.addListener(function(msg) {
    if (msg.name == 'ready')
      return;

    if (/^(isatty|strout|strerr)$/.test(msg.name)) {
      this.execMsg.forward(msg);
    }
  }.bind(this));

  this.foregroundJob_ = job;
  return job;
};

/**
 * Create a new job, execute it in the foreground, and echo the final result
 * to the terminal.
 *
 * Used for jobs that were started from the shell prompt in repl().
 */
wash.Shell.prototype.interactiveForegroundExecute = function(path, argv) {
  var job = this.foregroundExecute(path, argv);

  job.onReply.addListener(function(msg) {
    if (msg.name == 'error') {
      var errstr;
      if (msg.arg && msg.arg.name && msg.arg.arg) {
        errstr = msg.arg.name + ': ' + JSON.stringify(msg.arg.arg);
      } else {
        errstr = JSON.stringify(msg.arg);
      }

      this.strerr('\x1b[37;41m ERROR \x1b[m ' + errstr + '\n');
    }

    if (msg.isFinalReply) {
      if (msg.name == 'ok' && msg.arg) {
        // If the job ended with a true-ish ok argument, display it.
        this.strout(JSON.stringify(msg.arg, null, 1) + '\n');
      }
    }
  }.bind(this));

  job.onError.addListener(function(msg) {
    var errstr;
    if (msg.arg && msg.arg.name && msg.arg.arg) {
      errstr = msg.arg.name + ': ' + JSON.stringify(msg.arg.arg);
    } else {
      errstr = JSON.stringify(msg.arg);
    }

    this.strerr('\x1b[37;41m ERROR \x1b[m ' + errstr + '\n');
  }.bind(this));

  return job;
};

/**
 * Remote a job from the list of running jobs.
 */
wash.Shell.prototype.removeJob = function(job) {
  if (job.execMsg && job.execMsg.isOpen) {
    console.warn('Attempt to remove running job.');
    return;
  }

  var pos = this.jobs_.indexOf(job);
  if (pos != -1) {
    this.jobs_.splice(pos, 1);
  } else {
    console.warn('Attempt to remove unknown job');
  }

  if (this.foregroundJob_ == job)
    this.foregroundJob_ = null;
};

/**
 * Read-eval-print-loop.
 *
 * 10 Use /exe/readline to read in a line of text.
 * 20 Assume everything before the first space is the path to an executable,
 *    execute it.
 * 30 Echo strout/strerr/error message to the terminal, echo the final 'ok'
 *    message's value if it's defined.
 * 40 GOTO 10.
 */
wash.Shell.prototype.repl = function() {
  var readline = this.foregroundExecute(
      '/exe/readline', {promptString: this.promptString_});

  readline.onClose.addListener
  (function() {
    console.log('readline done');

    if (readline.finalMsg.name != 'ok') {
      this.strout('Error from readline: ' + readline.finalMsg.name + ': ' +
                  JSON.stringify(readline.finalMsg.arg) + '\n');
      return;
    }

    var line = readline.finalMsg.arg.trim();
    if (!line) {
      this.repl();
      return;
    }

    var pos = line.indexOf(' ');
    var path, argv;
    if (pos > -1) {
      path = line.substr(0, pos);
      argv = this.parseArgv(line.substr(pos + 1).trim());
      if (!argv) {
        this.repl();
        return;
      }
    } else {
      path = line;
      argv = '';
    }

    var job = this.interactiveForegroundExecute(path, argv);
    job.onClose.addListener(this.repl.bind(this));
  }.bind(this));
};

wash.Shell.prototype.parseArgv = function(argv) {
  if (/[\{\[\"\']/.test(argv.substr(0, 1))) {
    // argv starts with {, [, ", or '... parse it as JSON.
    try {
      return JSON.parse(argv);
    } catch (ex) {
      this.strerr('Error parsing argument: ' + ex + '\n');
      return null;
    }

  } else {
    return argv.split(/\s+/g);
  }
};

/**
 * Send a message back to the sender of the 'execute' message.
 */
wash.Shell.prototype.send = function(name, arg, opt_replyTo) {
  this.execMsg.reply(name, arg, opt_replyTo);
};

/**
 * Send a string reply (think STDOUT).
 */
wash.Shell.prototype.strout = function(str) {
  this.send('strout', str);
};

/**
 * Send a string error reply (think STDERR).
 */
wash.Shell.prototype.strerr = function(str) {
  this.send('strerr', str);
};

/**
 * Default handler for inbound messages from a job.
 */

/**
 * Called when the shell initialization is complete.
 */
wash.Shell.prototype.onInit_ = function() {
  this.strout('Welcome to wash ' + chrome.runtime.getManifest().version +
              '.\n');
};

/**
 * Hooked up to the onInput event of the message that started the shell.
 */
wash.Shell.prototype.onInput_ = function(msg) {
  if (msg.name == 'strin' || msg.name == 'tty-resize') {
    if (this.foregroundJob_) {
      if (this.foregroundJob_.readyMsg) {
        this.foregroundJob_.readyMsg.forward(msg);
      } else {
        console.warn('shell input before foreground job is ready: ' +
                     msg.name + ': ' + JSON.stringify(msg.arg));
      }
    } else {
      // No foreground job?  That's not right.  We should at least be running
      // readline to get the next command.
      console.warn('raw shell input: ' + msg.name + ': ' +
                   JSON.stringify(msg.arg));
    }

    return;
  }

  if (msg.isFinalReply) {
    // Input is closing down.
    return;
  }

  console.warn('Unknown input: ' + msg.name + ': ' + JSON.stringify(msg.arg));
};
