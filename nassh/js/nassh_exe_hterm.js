// Copyright (c) 2015 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

(function() {
  'use strict';

  var onTerminalReady = function(htermcx, terminal) {
    terminal.reset();
    terminal.installKeyboard();

    htermcx.fileSystem.createExecuteContext(
        new axiom.fs.path.Path(htermcx.arg['command'] || '/exe/wash'),
        htermcx.arg['arg'] || {}).then(
      function(spawncx) {
        spawncx.onClose.addListener(function(value) {
          terminal.uninstallKeyboard();
        });

        spawncx.onStdOut.addListener(function(value, opt_onAck) {
          terminal.io.writeUTF8(value.replace(/\n/g, '\r\n'));
          if (opt_onAck)
            setTimeout(opt_onAck);
        });

        spawncx.onStdErr.addListener(function(value, opt_onAck) {
          terminal.io.writeUTF8(value.replace(/\n/g, '\r\n'));
          if (opt_onAck)
            setTimeout(opt_onAck);
        });

        spawncx.onTTYRequest.addListener(function (e) {
          if ('interrupt' in e) {
            var tty = new axiom.fs.tty_state.TTYState();
            tty.setInterrupt(e.interrupt);
            spawncx.setTTY(tty);
          }
        });

        terminal.io.onVTKeystroke = function(str) {
          if (str == spawncx.getTTY().getInterrupt()) {
            spawncx.signal('interrupt', null);
          } else {
            spawncx.stdin(str);
          }
        };

        terminal.io.sendString = spawncx.stdin.bind(spawncx);

        terminal.io.onTerminalResize = function() {
          var tty = new axiom.fs.tty_state.TTYState();
          tty.isatty = true;
          tty.rows = terminal.io.rowCount;
          tty.columns = terminal.io.columnCount;
          spawncx.setTTY(tty);
        };

        terminal.io.onTerminalResize();

        spawncx.setEnvs(htermcx.getEnvs());
        if (typeof htermcx.arg['envs'] == 'object')
          spawncx.setEnvs(htermcx.arg['envs']);

        spawncx.execute();
      });

    htermcx.closeOk();
  };

  var onTerminalDom = function(htermcx, dom) {
    var terminal = new hterm.Terminal(htermcx.arg['profile-name'] || 'default');
    terminal.decorate(dom);
    terminal.onTerminalReady = onTerminalReady.bind(null, htermcx, terminal);
  };

  nassh.exe.hterm = function(cx) {
    cx.ready();
    var win;
    if (cx.arg['terminal-dom']) {
      var dom = cx.arg['terminal-dom'];
      onTerminalDom(cx, dom);
    } else if (cx.arg['terminal']) {
      var terminal = cx.arg['terminal'];
      onTerminalReady(cx, terminal);
    } else if (nassh.v2) {
      throw new Error('TODO');
    } else {
      win = window.open('/html/hterm.html');
      win.addEventListener('load', function() {
        win.attached = true;
        var dom = win.document.querySelector('#terminal');
        onTerminalDom(cx, dom);
      });
    }

    return cx.ephemeralPromise;
  };

  nassh.exe.hterm.argSigil = '%';
})();
