// Copyright 2022 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview NaCl-specific module logic.
 * @suppress {moduleLoad}
 */

import {localize} from './nassh.js';
import {StreamSet} from './nassh_stream_set.js';
import {SftpStream} from './nassh_stream_sftp.js';
import {SshAgentStream} from './nassh_stream_sshagent.js';
import {SshAgentRelayStream} from './nassh_stream_sshagent_relay.js';
import {InputBuffer, TtyStream} from './nassh_stream_tty.js';

/**
 * Plugin message handlers.
 */
export class Plugin {
  /**
   * @param {{
   *   io: !Object,
   *   sshClientVersion: string,
   *   onExit: function(number),
   *   secureInput: function(string, number, boolean),
   *   authAgent: ?Object,
   *   authAgentAppID: string,
   *   relay: ?Object,
   *   isSftp: (boolean|undefined),
   *   sftpClient: (?Object|undefined),
   * }} opts
   */
  constructor({io, sshClientVersion, onExit, secureInput, authAgent,
               authAgentAppID, relay, isSftp, sftpClient}) {
    this.io = io;
    this.sshClientVersion_ = sshClientVersion;
    this.onExit_ = onExit;
    this.secureInput_ = secureInput;
    this.authAgent_ = authAgent;
    this.authAgentAppID_ = authAgentAppID;
    this.relay_ = relay;
    this.isSftp_ = isSftp;
    this.sftpClient_ = sftpClient;

    // Whether the plugin has exited.
    this.exited_ = false;

    /**
     * Handle to plugin embed object.
     *
     * @type {?Object}
     */
    this.plugin_ = null;

    // Buffer for data coming from the terminal.
    this.inputBuffer_ = new InputBuffer();

    // A set of open streams for this instance.
    this.streams_ = new StreamSet();
  }

  /**
   * @return {!Promise<void>} When the plugin has been initialized.
   */
  init() {
    this.io.onVTKeystroke = this.onVTKeystroke_.bind(this);
    this.io.sendString = this.sendString_.bind(this);
    this.io.onTerminalResize = this.onTerminalResize_.bind(this);

    const plugin = this.plugin_ = globalThis.document.createElement('embed');
    // Height starts at 1px, and is changed to 0 after inserting into body.
    // This modification to the plugin ensures that the 'load' event fires
    // when it is running in the background page.
    plugin.style.cssText =
        ('position: absolute;' +
         'top: -99px' +
         'width: 0;' +
         'height: 1px;');

    const pluginURL = `../plugin/${this.sshClientVersion_}/ssh_client.nmf`;

    return new Promise((resolve, reject) => {
      plugin.setAttribute('src', pluginURL);
      plugin.setAttribute('type', 'application/x-nacl');
      plugin.addEventListener('load', resolve);
      plugin.addEventListener('message', this.onMessage_.bind(this));

      const errorHandler = (ev) => {
        this.io.println(localize('PLUGIN_LOADING_FAILED'));
        console.error('loading plugin failed', ev);
        this.onExit_(-1 /* CommandInstance.EXIT_INTERNAL_ERROR */);
        reject();
      };
      plugin.addEventListener('crash', errorHandler);
      plugin.addEventListener('error', errorHandler);

      document.body.insertBefore(plugin, document.body.firstChild);
      // Force a relayout. Workaround for load event not being called on <embed>
      // for a NaCl module. https://crbug.com/699930
      plugin.style.height = '0';
    });
  }

  /**
   * Run the plugin.
   *
   * TODO(vapier): Move the startSession call here out of CommandInstance.
   *
   * @return {!Promise<void>}
   */
  async run() {}

  /**
   * Remove the plugin from the page.
   */
  remove() {
    // Close all streams upon exit.
    this.streams_.closeAllStreams();

    this.plugin_.remove();
    this.plugin_ = null;
  }

  /**
   * Called when the plugin sends us a message.
   *
   * Plugin messages are JSON strings rather than arbitrary JS values.  They
   * also use "arguments" instead of "argv".  This function translates the
   * plugin message into something dispatchMessage_ can digest.
   *
   * @param {!Object} e
   */
  onMessage_(e) {
    // TODO: We should adjust all our callees to avoid this.
    e.data.argv = e.data.arguments;
    this.dispatchMessage_('plugin', e.data);
  }

  /**
   * Dispatch a "message" to one of the message handlers.
   *
   * @param {string} desc
   * @param {!Object} msg
   * @suppress {checkTypes} Closure doesn't like the this[] lookup.
   */
  dispatchMessage_(desc, msg) {
    if (msg.name in this) {
      this[msg.name].apply(this, msg.argv);
    } else {
      console.log(`Unknown "${desc}" message: ${msg.name}`);
    }
  }

  /**
   * Send a message to the NaCl plugin.
   *
   * @param {string} name The name of the message to send.
   * @param {!Array} args The message arguments.
   */
  send(name, args) {
    try {
      this.plugin_.postMessage({name: name, arguments: args});
    } catch (e) {
      // When we tear down the plugin, we sometimes have pending calls.
      // Rather than try and chase all of those down, swallow errors when the
      // plugin doesn't exist.
      if (!this.exited_) {
        console.error(e);
      }
    }
  }

  /**
   * Callback when the user types into the terminal.
   *
   * @param {string} data The input from the terminal.
   */
  onVTKeystroke_(data) {
    this.inputBuffer_.write(data);
  }

  /**
   * Send a string to the remote host.
   *
   * @param {string} string The string to send.
   */
  sendString_(string) {
    this.inputBuffer_.write(string);
  }

  /**
   * Notify plugin about new terminal size.
   *
   * @param {string|number} width The new terminal width.
   * @param {string|number} height The new terminal height.
   */
  onTerminalResize_(width, height) {
    this.send('onResize', [Number(width), Number(height)]);
  }

  /**
   * Helper function to create a TTY stream.
   *
   * @param {number} fd The file descriptor index.
   * @param {boolean} allowRead True if this stream can be read from.
   * @param {boolean} allowWrite True if this stream can be written to.
   * @param {function(boolean, ?string=)} onOpen Callback to call when the
   *     stream is opened.
   * @return {!Object} The newly created stream.
   * @suppress {checkTypes} Closure can't figure out inputBuffer->lib.Event.
   */
  createTtyStream_(fd, allowRead, allowWrite, onOpen) {
    const arg = {
      fd: fd,
      allowRead: allowRead,
      allowWrite: allowWrite,
      inputBuffer: this.inputBuffer_,
      io: this.io,
    };

    const stream = this.streams_.openStream(TtyStream, fd, arg, onOpen);
    if (allowRead) {
      const onDataAvailable = (isAvailable) => {
        // Send current read status to plugin.
        this.send('onReadReady', [fd, isAvailable]);
      };

      this.inputBuffer_.onDataAvailable.addListener(onDataAvailable);

      stream.onClose = () => {
        this.inputBuffer_.onDataAvailable.removeListener(onDataAvailable);
        this.send('onClose', [fd]);
      };
    }

    return stream;
  }

  /**
   * Log a message from the plugin.
   *
   * @param {string} str Message to log to the console.
   */
  printLog(str) {
    console.log(`plugin log: ${str}`);
  }

  /**
   * Write data to the plugin.
   *
   * @param {number} fd The file handle to write to.
   * @param {!ArrayBuffer} data The content to write.
   */
  writeTo(fd, data) {
    this.send('onRead', [fd, data]);
  }

  /**
   * Plugin has exited.
   *
   * @param {number} code Exit code, 0 for success.
   */
  exit(code) {
    console.log(`plugin exit: ${code}`);
    this.onExit_(code);
    this.exited_ = true;
  }

  /**
   * Plugin wants to open a file.
   *
   * The plugin leans on JS to provide a persistent filesystem, which we do via
   * the HTML5 Filesystem API.
   *
   * In the future, the plugin may handle its own files.
   *
   * @param {number} fd The integer to associate with this request.
   * @param {string} path The path to the file to open.
   * @param {number} mode The mode to open the path.
   */
  openFile(fd, path, mode) {
    let isAtty;
    const onOpen = (success) => {
      this.send('onOpenFile', [fd, success, isAtty]);
    };

    const DEV_STDIN = '/dev/stdin';
    const DEV_STDOUT = '/dev/stdout';
    const DEV_STDERR = '/dev/stderr';

    if (path == '/dev/tty') {
      isAtty = true;
      this.createTtyStream_(fd, true, true, onOpen);
    } else if (this.isSftp_ && path == DEV_STDOUT) {
      isAtty = false;
      const info = {
        client: this.sftpClient_,
      };
      this.streams_.openStream(SftpStream, fd, info, onOpen);
    } else if (path == DEV_STDIN || path == DEV_STDOUT || path == DEV_STDERR) {
      isAtty = !this.isSftp_;
      const allowRead = path == DEV_STDIN;
      const allowWrite = path == DEV_STDOUT || path == DEV_STDERR;
      this.createTtyStream_(fd, allowRead, allowWrite, onOpen);
    } else {
      this.send('onOpenFile', [fd, false, false]);
    }
  }

  /**
   * @param {number} fd
   * @param {string} host
   * @param {number} port
   */
  openSocket(fd, host, port) {
    let stream = null;

    /**
     * @param {boolean} success
     * @param {?string=} error
     */
    const onOpen = (success, error) => {
      if (!success) {
        this.io.println(localize('STREAM_OPEN_ERROR', ['socket', error]));
      }
      this.send('onOpenSocket', [fd, success, false]);
    };

    if (port == 0 && host == this.authAgentAppID_) {
      // Request for auth-agent connection.
      if (this.authAgent_) {
        stream = this.streams_.openStream(
            SshAgentStream, fd, {authAgent: this.authAgent_}, onOpen);
      } else {
        stream = this.streams_.openStream(
            SshAgentRelayStream, fd,
            {authAgentAppID: this.authAgentAppID_}, onOpen);
      }
    } else {
      // Regular relay connection request.
      if (!this.relay_) {
        onOpen(false, '!this.relay_');
        return;
      }

      stream = this.relay_.openSocket(fd, host, port, this.streams_, onOpen);
    }

    stream.onDataAvailable = (data) => {
      this.send('onRead', [fd, data]);
    };

    stream.onClose = () => {
      this.send('onClose', [fd]);
    };
  }

  /**
   * Plugin wants to write some data to a file descriptor.
   *
   * This is used to write to HTML5 Filesystem files.
   *
   * @param {number} fd The file handle to write to.
   * @param {!ArrayBuffer} data The content to write.
   */
  write(fd, data) {
    const stream = this.streams_.getStreamByFd(fd);

    if (!stream) {
      console.warn(`Attempt to write to unknown fd: ${fd}`);
      return;
    }

    stream.asyncWrite(data, (writeCount) => {
      if (!stream.open) {
        // If the stream was closed before we got a chance to ack, then skip it.
        // We don't want to update the state of the plugin in case it re-opens
        // the same fd and we end up acking to a new fd.
        return;
      }

      this.send('onWriteAcknowledge', [fd, writeCount]);
    });
  }

  /**
   * Plugin wants to read from a fd.
   *
   * @param {number} fd The file handle to read from.
   * @param {number} size How many bytes to read.
   */
  read(fd, size) {
    const stream = this.streams_.getStreamByFd(fd);

    if (!stream) {
      console.warn('Attempt to read from unknown fd: ' + fd);
      return;
    }

    stream.asyncRead(size, (b64bytes) => {
      this.send('onRead', [fd, b64bytes]);
    });
  }

  /**
   * Plugin wants to close a file descriptor.
   *
   * @param {number} fd The file handle to close.
   */
  close(fd) {
    const stream = this.streams_.getStreamByFd(fd);

    if (!stream) {
      console.warn('Attempt to close unknown fd: ' + fd);
      return;
    }

    this.streams_.closeStream(fd);
  }

  /**
   * Plugin wants to read a password, or some other secured user input.
   *
   * @param {string} prompt The prompt for the user.
   * @param {number} buf_len Max length of user input.
   * @param {boolean} echo Whether to echo the user input.
   */
  readPass(prompt, buf_len, echo) {
    this.secureInput_(prompt, buf_len, echo).then((pass) => {
      this.send('onReadPass', [pass]);
    });
  }
}
