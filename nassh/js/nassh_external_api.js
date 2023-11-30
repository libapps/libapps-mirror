// Copyright 2018 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview A remote API for external apps/extensions.
 */

import {lib} from '../../libdot/index.js';

import {hterm} from '../../hterm/index.js';

import {overwriteFile} from './lib_fs.js';
import {getSyncStorage} from './nassh.js';
import {exportPreferences, importPreferences} from './nassh_background.js';
import {CommandInstance} from './nassh_command_instance.js';
import {getDomFileSystem} from './nassh_fs.js';
import {Client as sftpClient} from './nassh_sftp_client.js';
import {SftpFsp} from './nassh_sftp_fsp.js';

/**
 * Commands available.
 */
const COMMANDS = new Map();

/**
 * Our own extension ids.
 */
const selfExtIds = new Set([
  'pnhechapfaindjhompbnflcldabbghjo',  // Secure Shell App (stable).
  'okddffdblfhhnmhodogpojmfkjmhinfp',  // Secure Shell App (dev).
  'iodihamcpbpeioajjeobimgagajmlibd',  // Secure Shell Extension (stable).
  'algkcnfjnajfhgimadimbjhmpaeohhln',  // Secure Shell Extension (dev).
  'nkoccljplnhpfnfiajclkommnmllphnl',  // Crosh.
]);

COMMANDS.set('hello',
/**
 * Probe the extension.
 *
 * @param {*} request The hello message.
 * @param {!MessageSender} sender chrome.runtime.MessageSender
 * @param {function(!Object=)} sendResponse called to send response.
 */
function(request, sender, sendResponse) {
  sendResponse({
    error: false,
    message: 'hello',
    internal: sender.internal,
    id: sender.id,
  });
});

/**
 * Root dir for all files to be written under.
 *
 * @const
 */
const ROOT_DIR = '/external';

/**
 * Unique identifier for each session.
 *
 * @private
 */
let sessionCounter_ = 0;

COMMANDS.set('mount',
/**
 * Performs SFTP mount.
 *
 * @param {{username:string, hostname:string, port:(number|undefined),
 *     identityFile:string, knownHosts:string, fileSystemId:string,
 *     displayName:string}} request Request to mount specified host.
 * @param {!MessageSender} sender chrome.runtime.MessageSender
 * @param {function(!Object=)} sendResponse called to send response.
 */
function(request, sender, sendResponse) {
  const sessionId = sessionCounter_++;
  const knownHosts = `${ROOT_DIR}/${sessionId}.known_hosts`;
  const identityFile = `${ROOT_DIR}/${sessionId}.identity_file`;
  /**
   * @param {string} filename The filename to write to.
   * @param {string} content The data to write out.
   * @return {!Promise<void>} A promise completing when the write finishes.
   */
  const writeFile = (filename, content) => {
    // TODO(vapier): Move to indexeddb-fs once SFTP works w/WASM.
    return overwriteFile(this.fileSystem_.root, filename, content);
  };
  Promise.all([
      writeFile(knownHosts, request.knownHosts),
      writeFile(identityFile, request.identityFile),
  ]).then(async () => {
    const argv = {
      io: this.io_,
      syncStorage: getSyncStorage(),
      isSftp: true,
      isMount: true,
      fsp: lib.notNull(this.fsp_),
      mountOptions: {
        fileSystemId: request.fileSystemId,
        displayName: request.displayName,
        writable: true,
      },
    };
    const connectOptions = {
      username: request.username,
      hostname: request.hostname,
      port: request.port,
      argstr: `-i${identityFile} -oUserKnownHostsFile=${knownHosts}`,
    };
    const instance = new CommandInstance(argv);
    await instance.connectTo(connectOptions);
    // TODO(vapier): Plumb back up success/failure.
    sendResponse({error: false, message: 'createSftpInstance'});
  }).catch((e) => {
    console.error(e);
    sendResponse({error: true, message: e.message, stack: e.stack});
  });
});

COMMANDS.set('unmount',
/**
 * Unmount an existing SFTP mount.
 *
 * @param {{fileSystemId:string}} request Request to unmount specified mount.
 * @param {!MessageSender} sender chrome.runtime.MessageSender
 * @param {function(!Object=)} sendResponse called to send response.
 */
function(request, sender, sendResponse) {
  const {fileSystemId} = request;
  // Always call the unmount API.  It will handle unknown mounts for us, and
  // will clean up FSP state that Chrome knows about but we don't.
  this.fsp_.onUnmountRequested(
      {fileSystemId},
      () => sendResponse({error: false, message: `unmounted ${fileSystemId}`}),
      (message) => sendResponse({error: true, message: message}));
});

/**
 * Container for holding mount information.
 */
export class MountInfo {
  /**
   * @param {!sftpClient=} client Where to get info from.
   */
  constructor(client = undefined) {
    /** @type {string} */
    this.basePath = '';
    /** @type {number} */
    this.readChunkSize = 0;
    /** @type {number} */
    this.writeChunkSize = 0;
    /** @type {number} */
    this.protocolClientVersion = 0;
    /** @type {number} */
    this.protocolServerVersion = 0;
    /** @type {!Array<!Array<string>>} */
    this.protocolServerExtensions = [];
    /** @type {number} */
    this.requestId = 0;
    /** @type {string} */
    this.buffer = '';
    /** @type {!Array<string>} */
    this.pendingRequests = [];
    /** @type {!Array<string>} */
    this.openedFiles = [];

    if (client) {
      this.fromClient(client);
    }
  }

  /**
   * Extract details from a mount.
   *
   * @param {!sftpClient} client The mount client to read.
   */
  fromClient(client) {
    this.basePath = client.basePath_;
    this.readChunkSize = client.readChunkSize;
    this.writeChunkSize = client.writeChunkSize;
    this.protocolClientVersion = client.protocolClientVersion;
    this.protocolServerVersion = client.protocolServerVersion;
    this.protocolServerExtensions =
        Object.entries(client.protocolServerExtensions);
    this.requestId = client.requestId_;
    this.buffer = client.buffer_.toString();
    this.pendingRequests = Object.keys(client.pendingRequests_);
    this.openedFiles = Object.keys(client.openedFiles);
  }

  /**
   * Update configurable mount settings.
   *
   * @param {!MountInfo} info The settings to update from.
   * @param {!sftpClient} client The mount client to update.
   */
  static toClient(info, client) {
    if (info.basePath !== undefined) {
      if (typeof info.basePath !== 'string') {
        throw new Error('basePath must be a string');
      }
      // The path has to always have a trailing slash.
      if (info.basePath.length && info.basePath[-1] != '/') {
        info.basePath += '/';
      }
      client.basePath_ = info.basePath;
    }

    if (client.readChunkSize !== undefined) {
      if (typeof client.readChunkSize !== 'number') {
        throw new Error('readChunkSize must be a number');
      }
      client.readChunkSize = info.readChunkSize;
    }

    if (client.writeChunkSize !== undefined) {
      if (typeof client.writeChunkSize !== 'number') {
        throw new Error('writeChunkSize must be a number');
      }
      client.writeChunkSize = info.writeChunkSize;
    }
  }
}

COMMANDS.set('getMountInfo',
/**
 * Get information about an existing mount.
 *
 * @param {{fileSystemId:string}} request Request to find the mount.
 * @param {!MessageSender} sender chrome.runtime.MessageSender
 * @param {function(!Object=)} sendResponse called to send response.
 */
function(request, sender, sendResponse) {
  if (!sender.internal && !selfExtIds.has(sender.id)) {
    sendResponse(
        {error: true, message: 'getMountInfo: External access not allowed'});
    return;
  }

  const {fileSystemId} = request;
  const sftpInstance = this.fsp_.getMount(fileSystemId);
  if (sftpInstance === undefined) {
    sendResponse({error: true, message: `mount ${fileSystemId} not found`});
    return;
  }

  sendResponse({
    error: false,
    message: `info for ${fileSystemId} found`,
    info: new MountInfo(sftpInstance.sftpClient),
  });
});

COMMANDS.set('setMountInfo',
/**
 * Set information in an existing mount.
 *
 * @param {{fileSystemId:string, info:!MountInfo}} request Request to find and
 *     update the mount.
 * @param {!MessageSender} sender chrome.runtime.MessageSender
 * @param {function(!Object=)} sendResponse called to send response.
 */
function(request, sender, sendResponse) {
  if (!sender.internal && !selfExtIds.has(sender.id)) {
    sendResponse(
        {error: true, message: 'setMountInfo: External access not allowed'});
    return;
  }

  const {fileSystemId, info} = request;
  const sftpInstance = this.fsp_.getMount(fileSystemId);
  if (sftpInstance === undefined) {
    sendResponse({error: true, message: `mount ${fileSystemId} not found`});
    return;
  }

  MountInfo.toClient(info, sftpInstance.sftpClient);
  sendResponse({error: false, message: `mount ${fileSystemId} updated`});
});

/**
 * @typedef {{
 *     url: string,
 *     width: (number|undefined),
 *     height: (number|undefined),
 * }}
 */
export let NewWindowSettings;

/**
 * Opens a new window.
 *
 * @param {!Object} response The response to send back to the caller.
 * @param {!NewWindowSettings} request Customize the new window behavior.
 * @param {!MessageSender} sender chrome.runtime.MessageSender.
 * @param {function(!Object=)} sendResponse called to send response.
 */
function newWindow_(response, request, sender, sendResponse) {
  const width = request.width ?? 735;
  if (typeof width !== 'number') {
    sendResponse({error: true, message: `width: invalid number: ${width}`});
    return;
  }

  const height = request.height ?? 440;
  if (typeof height !== 'number') {
    sendResponse({error: true, message: `height: invalid number: ${height}`});
    return;
  }

  lib.f.openWindow(request.url, '',
                   'chrome=no,close=yes,resize=yes,scrollbars=yes,' +
                   `minimizable=yes,width=${width},height=${height}`);
  sendResponse(response);
}

COMMANDS.set('crosh',
/**
 * Opens a new crosh window.
 *
 * @param {!NewWindowSettings} request Customize the new window behavior.
 * @param {!MessageSender} sender chrome.runtime.MessageSender.
 * @param {function(!Object=)} sendResponse called to send response.
 */
function(request, sender, sendResponse) {
  if (!sender.internal) {
    delete request.url;
  }

  request = /** @type {!NewWindowSettings} */ (Object.assign({
    url: lib.f.getURL('/html/crosh.html'),
  }, request));

  newWindow_(
      {error: false, message: 'openCrosh'},
      request, sender, sendResponse);
});

COMMANDS.set('nassh',
/**
 * Opens a new nassh window.
 *
 * @param {!NewWindowSettings} request Customize the new window behavior.
 * @param {!MessageSender} sender chrome.runtime.MessageSender.
 * @param {function(!Object=)} sendResponse called to send response.
 */
function(request, sender, sendResponse) {
  if (!sender.internal) {
    delete request.url;
  }

  request = /** @type {!NewWindowSettings} */ (Object.assign({
    url: lib.f.getURL('/html/nassh_connect_dialog.html'),
  }, request));

  newWindow_(
      {error: false, message: 'openNassh'},
      request, sender, sendResponse);
});

COMMANDS.set('prefsImport',
/**
 * Import new preferences.
 *
 * @param {{prefs:(!Object|string)}} request The preferences to import.
 * @param {!MessageSender} sender chrome.runtime.MessageSender
 * @param {function(!Object=)} sendResponse called to send response.
 */
async function(request, sender, sendResponse) {
  if (!sender.internal && !selfExtIds.has(sender.id)) {
    sendResponse(
        {error: true, message: 'prefsImport: External access not allowed'});
    return;
  }

  let prefs;
  if (request.asJson) {
    lib.assert(typeof request.prefs == 'string');
    prefs = /** @type {!Object} */ (JSON.parse(request.prefs));
  } else {
    lib.assert(typeof request.prefs == 'object');
    prefs = request.prefs;
  }
  await importPreferences(prefs);
  sendResponse({error: false, message: 'prefsImport'});
});

COMMANDS.set('prefsExport',
/**
 * Export existing preferences.
 *
 * @param {{asJson:boolean}} request How to export the preferences.
 * @param {!MessageSender} sender chrome.runtime.MessageSender
 * @param {function(!Object=)} sendResponse called to send response.
 */
async function(request, sender, sendResponse) {
  if (!sender.internal && !selfExtIds.has(sender.id)) {
    sendResponse(
        {error: true, message: 'prefsExport: External access not allowed'});
    return;
  }

  let prefs = await exportPreferences();
  if (request.asJson) {
    prefs = JSON.stringify(prefs);
  }
  sendResponse({error: false, message: 'prefsExport', prefs: prefs});
});

COMMANDS.set('openProtoReg',
/**
 * Show the protocol registration dialog.
 *
 * @param {*} request Not used.
 * @param {!MessageSender} sender chrome.runtime.MessageSender
 * @param {function(!Object=)} sendResponse Called to send response.
 */
function(request, sender, sendResponse) {
  lib.f.openWindow(lib.f.getURL('/html/nassh_preferences_editor.html#handlers'),
                   '_blank');
  sendResponse({error: false, message: 'openProtoReg'});
});

/** @typedef {{command:string}} */
const OnMessageRequest = undefined;

/**
 * Common message dispatcher.
 *
 * @param {boolean} internal Whether the sender is this own extension.
 * @param {!OnMessageRequest} request
 * @param {!MessageSender} sender chrome.runtime.MessageSender.
 * @param {function(!Object=)} sendResponse called to send response.
 * @return {boolean} Whether sendResponse will be called asynchronously.
 * @this {ExternalApi}
 * @private
 */
function dispatchMessage_(internal, request, sender, sendResponse) {
  // If we aren't ready yet, reschedule the call.
  if (!this.handlersReady_) {
    setTimeout(
        dispatchMessage_.bind(this, internal, request, sender, sendResponse),
        100);
    return true;
  }

  // Pass the internal setting down so the handler can easily detect.
  sender.internal = internal;

  // Execute specified command.
  if (typeof request != 'object') {
    sendResponse({error: true, message: `invalid request: ${request}`});
    return false;
  } else if (!COMMANDS.has(request.command)) {
    sendResponse(
        {error: true, message: `unsupported command '${request.command}'`});
    return false;
  }
  const senderInfo = `[id:${sender.id} internal:${sender.internal} ` +
                     `url:${sender.url} origin:${sender.origin}]`;
  console.log(`API: message '${request.command}' from ${senderInfo}`);
  try {
    COMMANDS.get(request.command).call(
        this, request, sender, sendResponse);

    // Return true to allow async sendResponse.
    return true;
  } catch (e) {
    console.error(e);
    sendResponse({error: true, message: e.message, stack: e.stack});
    return false;
  }
}

/**
 * Invoked when external app/extension calls chrome.runtime.sendMessage.
 * https://developer.chrome.com/extensions/runtime#event-onMessageExternal.
 *
 * @param {*} request
 * @param {!MessageSender} sender chrome.runtime.MessageSender.
 * @param {function(*)} sendResponse called to send response.
 * @return {boolean} Whether sendResponse will be called asynchronously.
 * @private
 */
function onMessageExternal_(request, sender, sendResponse) {
  return dispatchMessage_.call(
      this, false, /** @type {!OnMessageRequest} */ (request),
      sender, /** @type {function(!Object=)} */ (sendResponse));
}

/**
 * Invoked when internal code calls chrome.runtime.sendMessage.
 * https://developer.chrome.com/extensions/runtime#event-onMessage.
 *
 * @param {*} request
 * @param {!MessageSender} sender chrome.runtime.MessageSender.
 * @param {function(*): void} sendResponse called to send response.
 * @return {boolean} Whether sendResponse will be called asynchronously.
 * @private
 */
function onMessage_(request, sender, sendResponse) {
  return dispatchMessage_.call(
      this, true, /** @type {!OnMessageRequest} */ (request),
      sender, /** @type {function(!Object=)} */ (sendResponse));
}

/**
 * Commands available.
 */
const CONNECTIONS = new Map();

CONNECTIONS.set('hello',
/**
 * Probe the extension.
 *
 * @param {!Port} port The new communication channel.
 */
function(port) {
  const {sender} = port;
  const responseBase = {error: false, internal: sender.internal, id: sender.id};

  // Post a message.  On failure, just disconnect.
  const post = (msg) => {
    try {
      port.postMessage(msg);
    } catch (e) {
      console.log(`API: hello: postMessage failed: ${e}`);
      port.disconnect();
    }
  };

  // Process each incoming message.
  port.onMessage.addListener((msg) => {
    switch (msg) {
      case 'hello':
        post({...responseBase, message: 'hello indeed'});
        break;
      case 'hi':
        post({...responseBase, message: 'おはよう'});
        break;
      case 'bye':
        post({...responseBase, message: 'tschüß!'});
        port.disconnect();
        break;
      default:
        post({...responseBase, error: true,
              message: `sorry, i do not understand "${msg}"`});
        port.disconnect();
        break;
    }
  });
});

CONNECTIONS.set('mount',
/**
 * Performs interactive mount.
 *
 * @param {!Port} port The new communication channel.
 */
function(port) {
  // Post a message.  On failure, just disconnect.
  const post = (msg) => {
    try {
      port.postMessage(msg);
    } catch (e) {
      console.log(`API: mount: postMessage failed: ${e}`);
      port.disconnect();
    }
  };

  // Not sure we want to open this up to anyone else (yet?).
  const {sender} = port;
  if (!sender.internal && !selfExtIds.has(sender.id)) {
    post({error: true, message: 'mount: External access not allowed'});
    port.disconnect();
    return;
  }

  // The CommandInstance pokes the terminal a little more than it should.
  // Until we clean that up, set up a stub object.
  const stubTerminal = /** @type {!hterm.Terminal} */ ({
    interpret: (message) => {
      // SSH wants to send something to the user (terminal).
      post({error: false, command: 'write', message});
    },
    clearHome: () => {},
    setProfile: () => {},
    screenSize: {width: 0, height: 0},
    showOverlay: (message, timeout) => {
      post({error: false, command: 'overlay', message, timeout});
    },
  });
  const pipeIo = new hterm.Terminal.IO(stubTerminal);
  stubTerminal.io = pipeIo;

  let instance;
  let inputResolve;

  // Process each incoming message.
  port.onMessage.addListener((msg) => {
    const {command} = msg;
    switch (command) {
      case 'connect': {
        // UI wants us to start a connection.
        const {argv, connectOptions} = msg;
        argv.io = pipeIo;
        argv.fsp = this.fsp_;
        argv.syncStorage = getSyncStorage();
        argv.onExit = (status) => {
          post({error: false, command: 'exit', status});
          port.disconnect();
        };
        argv.sftpStartupCallback = (success, message) => {
          post({error: !success, command: 'done', message});
          port.disconnect();
        };
        instance = new CommandInstance(argv);
        instance.secureInput = (message, buf_len, echo) => {
          post({error: false, command: 'input', message, echo, buf_len});
          return new Promise((resolve) => {
            inputResolve = resolve;
          });
        };
        instance.connectTo(connectOptions).catch((e) => {
          console.error(e);
          post({error: true, message: e.message, stack: e.stack});
        });
        break;
      }

      case 'write': {
        // UI (probably the user) wants to send something to ssh.
        if (instance === undefined) {
          post({error: true, message: 'not connected'});
          port.disconnect();
          return;
        }
        pipeIo.sendString(msg.data);
        break;
      }

      case 'input': {
        inputResolve(msg.data);
        inputResolve = null;
        break;
      }

      default:
        post({error: true, message: `unknown command '${command}'`});
        port.disconnect();
        break;
    }
  });
});

/**
 * Common connect dispatcher.
 *
 * @param {boolean} internal Whether the sender is this own extension.
 * @param {!Port} port The new communication channel.
 * @return {?boolean} Whether we were able to initiate the connection.
 * @this {ExternalApi}
 * @private
 */
function dispatchConnect_(internal, port) {
  // If we aren't ready yet, reschedule the call.
  if (!this.handlersReady_) {
    setTimeout(dispatchConnect_.bind(this, internal, port), 100);
    return null;
  }

  const {name, sender} = port;

  // Pass the internal setting down so the handler can easily detect.
  sender.internal = internal;

  // If the requested endpoint doesn't exist, abort.
  if (!CONNECTIONS.has(name)) {
    try {
      port.postMessage({
        error: true,
        message: `unsupported connection '${name}'`,
      });
    } catch (e) {
      console.log('API: ignoring error during early disconnect', e);
    }
    port.disconnect();
    return false;
  }

  const senderInfo = `[id:${sender.id} internal:${sender.internal} ` +
                     `url:${sender.url} origin:${sender.origin}]`;
  console.log(`API: connect '${name}' from ${senderInfo}`);

  port.onDisconnect.addListener(() => {
    const err = lib.f.lastError();
    if (err) {
      console.warn(
          `API: disconnect '${name}' from ${senderInfo} failed: ${err}`);
    } else {
      console.log(`API: disconnect '${name}' from ${senderInfo}`);
    }
  });

  // Execute specified connection.
  try {
    CONNECTIONS.get(name).call(this, port);

    // Return true to allow async sendResponse.
    return true;
  } catch (e) {
    console.error(e);
    try {
      port.postMessage({error: true, message: e.message, stack: e.stack});
    } catch (e) {
      console.log('API: ignoring error during late disconnect', e);
    }
    port.disconnect();
    return false;
  }
}

/**
 * Invoked when external app/extension calls chrome.runtime.connect.
 * https://developer.chrome.com/extensions/runtime#event-onConnectExternal.
 *
 * @param {!Port} port The new communication channel.
 * @private
 */
function onConnectExternal_(port) {
  dispatchConnect_.call(this, false, port);
}

/**
 * Invoked when internal code calls chrome.runtime.connect.
 * https://developer.chrome.com/extensions/runtime#event-onConnect.
 *
 * @param {!Port} port The new communication channel.
 * @private
 */
function onConnect_(port) {
  dispatchConnect_.call(this, true, port);
}

/**
 * Class for managing our API.
 */
export class ExternalApi {
  constructor() {
    /**
     * Mock to satisfy SFTP APIs.  This is a hack that should get fixed someday.
     *
     * External API calls will not require user IO to enter password, etc.
     */
     this.io_ = new hterm.Terminal.IO(/** @type {!hterm.Terminal} */ ({
       setProfile: () => {},
       screenSize: {width: 0, height: 0},
       showOverlay: () => {},
     }));

    /**
     * Whether we've initialized enough to process requests.
     */
    this.handlersReady_ = false;

    /**
     * SftpFsp instance.
     *
     * @type {?SftpFsp}
     */
    this.fsp_ = null;

    /**
     * Filesystem handle for accessing /.ssh files.
     *
     * @type {?FileSystem}
     */
    this.fileSystem_ = null;
  }

  /**
   * Initialize runtime state that requires callbacks.
   *
   * @param {!SftpFsp} fsp
   * @return {!Promise<void>} When init has finished.
   */
  async init(fsp) {
    this.fsp_ = fsp;

    // Get handle on FileSystem & cleanup files.
    try {
      this.fileSystem_ = await getDomFileSystem() ?? null;
      if (this.fileSystem_) {
        await new Promise((deleteDone) => {
          // Remove existing contents of '/external/' before registering.
          this.fileSystem_.root.getDirectory(
              ROOT_DIR,
              {},
              (f) => { f.removeRecursively(deleteDone, deleteDone); },
              deleteDone);
        });
      }
    } catch (e) {
      console.warn(`Setting up DOM fs failed`, e);
    }

    // We can start processing messages now.
    this.handlersReady_ = true;
  }

  /**
   * Register listeners to receive messages.
   */
  addListeners() {
    chrome.runtime.onConnectExternal.addListener(onConnectExternal_.bind(this));
    chrome.runtime.onConnect.addListener(onConnect_.bind(this));
    chrome.runtime.onMessageExternal.addListener(onMessageExternal_.bind(this));
    chrome.runtime.onMessage.addListener(onMessage_.bind(this));
  }
}
