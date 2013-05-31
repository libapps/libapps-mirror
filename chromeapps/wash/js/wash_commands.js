// Copyright (c) 2013 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

'use strict';

/**
 * The list of commands we want to export as lib.wa.fs.Executables in our
 * '/exe' directory.
 *
 * See wash.App..initFileSystem.
 */
wash.Commands = function(app) {
  this.app = app;
};

/**
 * Install our commands at the provided path in this.app.fileSystem.
 *
 * @param {string} path The path to install.  Must be an existing directory.
 * @param {function()} onSuccess The function to invoke when installation
 *     succeeds.
 * @param {function(name, arg)} onError The function to invoke when an
 *     error occurs.
 */
wash.Commands.prototype.install = function(path, onSuccess, onError) {
  var onResolveSuccess = function(entry) {
    if (entry.type != lib.wa.fs.entryType.DIRECTORY) {
      onError(lib.wa.error.FS_NOT_A_DIRECTORY, path);
      return;
    }

    var sequence = new lib.f.Sequence
    (this,
     [function(cx) {
        cx.expected = Object.keys(wash.Commands.on).length;

        for (var key in wash.Commands.on) {
          var executable = new lib.wa.fs.Executable(
              wash.Commands.on[key].bind(this));

          entry.link(key, executable, cx.next, cx.error);
        }
       }
     ]);

    sequence.run(onSuccess, onError);
  }.bind(this);

  var onResolveError = function(code, reason) {
    console.warn('Error installing commands: ' + code + ': ' + reason);
    onError(code, reason);
  };

  this.app.fileSystem.resolvePath(path, onResolveSuccess, onResolveError);
};

/**
 * The list of callbacks for the executables.
 *
 * These will be bound to a wash.Commands instance.
 *
 * Each of these functions get a reference to the inbound 'execute' message
 * that spawned it.
 *
 * The can communicate back to the shell with execMsg.strout/strerr/reply
 * and any other reply method from lib.wa.Message.prototype.
 *
 * They can subscribe to input from the shell via execMsg.meta.onInput, which
 * is a lib.Event instance.
 *
 * Each function MUST call execMsg.closeOk or execMsg.closeError exactly once
 * to indicate that it has completed.
 */
wash.Commands.on = {};

/**
 * Echo.
 *
 * echo.
 */
wash.Commands.on['echo'] = function(execMsg) {
  execMsg.strout(execMsg.arg.argv + '\n');
  execMsg.closeOk(null);
};

/**
 * Launch an instance of lib.wa.Readline, yay!
 */
wash.Commands.on['readline'] = function(execMsg) {
  lib.wa.Readline.main(this.app, execMsg);
};

/**
 * Launch the shell.
 */
wash.Commands.on['wash'] = function(execMsg) {
  wash.Shell.main(this.app, execMsg);
};

/**
 * Bare-bones directory listing.
 *
 * This just returns the directory listing as an array argument to the
 * 'ok' message.  When the terminal sees this, it just stringifies and
 * displays the value.
 */
wash.Commands.on['ls'] = function(execMsg) {
  var argv = execMsg.arg.argv;
  var path = (argv && argv.path) || '/';
  if (!path) {
    msg.closeError(lib.wa.error.MISSING_PARAM, 'path');
    return;
  }

  this.app.waitReady
  ('open', {path: path},
   function onSuccess(openReadyMsg) {
     if (openReadyMsg.name != 'ready')
       return;

     openReadyMsg.reply
     ('read', null,
      function(readMsg) {
        if (readMsg.isFinalReply) {
          openReadyMsg.closeOk(null);
          // This just forwards the message we got back from 'read' as if
          // we sent it.  The readMsg is either going to be an 'ok', with
          // the directory contents as an array, or an 'error' with a reason.
          //
          // Because the message we're forwarding isFinalReply, our reply will
          // also be final, which means we're free to exit.
          execMsg.forward(readMsg);
        }
      });
   },
   function onError(openErrorMsg) {
     execMsg.forward(openErrorMsg);
   }
  );
};

/**
 * Mount the filesystem exported chrome app or extension that happens to be
 * listening with lib.wa.ChromePortTransport.
 */
wash.Commands.on['mount.chrome'] = function(execMsg) {
  var argv = execMsg.arg.argv;
  var localPath = argv.localPath || '/mnt/' + argv.extensionId;
  var remotePath = argv.remotePath || '/';

  if (!argv.extensionId) {
    execMsg.closeError(lib.wa.error.MISSING_PARAM, 'extensionId');
    return;
  }

  var verbose = function(str) {
    if (argv.verbose)
      execMsg.strerr('-*- ' + str + '\n');
  };

  // Called when the transport connects to something.
  var onConnect = function(transport) {
    if (!transport) {
      execMsg.closeError(lib.wa.error.UNEXPECTED_ERROR,
                         'Error establishing transport to ' + argv.extensionId);
      return;
    }

    verbose('Transport established.');

    var channel = new lib.wa.Channel(transport);
    channel.name = 'mount';

    channel.offerHandshake
    (null,
     function onHandshakeReply(hsReplyMsg) {
       if (hsReplyMsg.name != 'ready')
         return;

       verbose('Handshake complete.');

       this.app.fileSystem.mount(
           hsReplyMsg, localPath, remotePath,
           function() {
             verbose('Mount ready: ' + localPath);
             execMsg.closeOk(null);
           },
           function(code, reason) {
             execMsg.closeError(lib.wa.error.UNEXPECTED_ERROR,
                                'Mount failed: ' + code + ': ' + reason);
           });
     }.bind(this),
     function onHandshakeError(msg) {
       transport.disconnect();
       execMsg.closeError(lib.wa.error.UNEXPECTED_ERROR,
                          'Handshake failed: ' + reason);
       return;
     });
  }.bind(this);

  verbose('Mounting chrome app/extension: ' + argv.extensionId);
  lib.wa.ChromePortTransport.connect(argv.extensionId, onConnect);
};
