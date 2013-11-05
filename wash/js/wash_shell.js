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

  shell.onInit.addListener(function() {
      var sequence = new lib.f.Sequence
      (null,
       [function(cx) {
          // Mount the modified Secure Shell extension.
          // TODO(rginda) This is handy for testing, but in the real world
          // we wouldn't want to hardcode mount points like this.
          var job = shell.execute(
              '/exe/mount.chrome',
              {'extensionId': 'okddffdblfhhnmhodogpojmfkjmhinfp',
               'verbose': true});

          job.execMsg.onClose.addListener(cx.next);
        },
       ]);

      sequence.run(function() { setTimeout(shell.repl.bind(shell), 0) });
    });
};

/**
 * Create a new job and execute it.
 *
 * @param {string} path The path to the lib.wa.fs.Executable.
 * @param {*} argv The argument value for the executable.
 * @param {function(lib.wa.Message)} opt_onReply The optional callback to invoke
 *     with messages sent by the executable.  This takes the place of the
 *     shell's build-in onExecuteReply_.  Messages will not reach the terminal
 *     unless you explicitly send them.
 * @param {function(lib.wa.Message)} opt_onError The optional callback to
 *     invoke if the executable fails to start.
 */
wash.Shell.prototype.execute = function(path, argv, opt_onReply, opt_onError) {
  var job = { readyMsg: null };

  var onReply = opt_onReply || this.onExecuteReply_.bind(this, job);
  var onError = opt_onError || this.onExecuteError_.bind(this, job) ;

  job.execMsg = this.app.waitReady
  ('execute', {path: path, argv: argv},
   function(msg) {
     if (msg.name == 'ready') {
       job.readyMsg = msg;
     } else if (msg.isFinalReply) {
       job.finalMsg = msg;
     }

     onReply(msg);
   }, onError);

  job.execMsg.onClose.addListener(this.onExecuteClose_.bind(this, job));

  this.jobs_.push(job);
  this.foregroundJob_ = job;

  return job;
};

/**
 * Remote a job from the list of running jobs.
 */
wash.Shell.prototype.removeJob = function(job) {
  if (job.execMsg.isOpen) {
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
  var readline = this.execute
  ('/exe/readline', {promptString: this.promptString_},
   function onReply(msg) {
     if (/^(isatty|strout|strerr)$/.test(msg.name)) {
       this.execMsg.forward(msg);
       return;
     }
   }.bind(this));

  readline.execMsg.onClose.addListener
  (function() {
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
      argv = line.substr(pos + 1).trim();
      try {
        argv = JSON.parse(argv);
      } catch (ex) {
        this.strerr('Error parsing argument: ' + ex + '\n');
        this.repl();
        return;
      }
    } else {
      path = line;
      argv = '';
    }

    var shellJob = this.execute(path, argv);
    shellJob.execMsg.onClose.addListener(this.repl.bind(this));
  }.bind(this));
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
wash.Shell.prototype.onExecuteReply_ = function(job, msg) {
  //console.log('wash: execute reply: ' +
  //            msg.name + ': ' + JSON.stringify(msg.arg));

  if (msg.name == 'ready')
    return;

  if (/^(isatty|strout|strerr)$/.test(msg.name)) {
    this.execMsg.forward(msg);

  } else if (msg.name == 'error') {
    var errstr;
    if (msg.arg && msg.arg.name && msg.arg.arg) {
      errstr = msg.arg.name + ': ' + JSON.stringify(msg.arg.arg);
    } else {
      errstr = JSON.stringify(msg.arg);
    }

    this.strerr('\x1b[37;41m ERROR \x1b[m ' + errstr + '\n');
  } else if (msg.name != 'ok') {
    console.warn('Unknown execute reply: ' + msg.name);
  }

  if (msg.isFinalReply) {
    if (msg.name == 'ok' && msg.arg) {
      // If the job ended with a true-ish ok argument, display it.
      this.strout(JSON.stringify(msg.arg, null, 1) + '\n');
    }
  }
};

/**
 * Called when a job's execMsg is closed.
 */
wash.Shell.prototype.onExecuteClose_ = function(job) {
  this.removeJob(job);
};

/**
 * Called when a job fails to start.
 */
wash.Shell.prototype.onExecuteError_ = function(job, msg) {
  var name, arg;
  if (msg.name = 'error') {
    name = msg.arg.name;
    arg = JSON.stringify(msg.arg.arg);
  } else {
    name = lib.wa.error.UNEXPECTED_MESSAGE;
    arg = msg.name;
  }

  this.strerr('\x1b[37;41m ERROR \x1b[m Not started: ' + name + ': ' + arg +
              '\n');
};

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
