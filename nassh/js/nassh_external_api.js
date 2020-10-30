// Copyright 2018 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

'use strict';

/**
 * nassh.External provides a remote API for external apps/extensions.
 */
nassh.External = {};

/**
 * Commands available.
 */
nassh.External.COMMANDS = new Map();

/**
 * Our own extension ids.
 */
nassh.External.SelfExtIds = new Set([
  'pnhechapfaindjhompbnflcldabbghjo',  // Secure Shell App (stable).
  'okddffdblfhhnmhodogpojmfkjmhinfp',  // Secure Shell App (dev).
  'iodihamcpbpeioajjeobimgagajmlibd',  // Secure Shell Extension (stable).
  'algkcnfjnajfhgimadimbjhmpaeohhln',  // Secure Shell Extension (dev).
  'nkoccljplnhpfnfiajclkommnmllphnl',  // Crosh.
]);

nassh.External.COMMANDS.set('hello',
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
nassh.External.ROOT_DIR = '/external';

/**
 * Unique identifier for each session.
 *
 * @private
 */
nassh.External.sessionCounter_ = 0;

nassh.External.COMMANDS.set('mount',
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
  const sessionId = nassh.External.sessionCounter_++;
  const knownHosts = `${nassh.External.ROOT_DIR}/${sessionId}.known_hosts`;
  const identityFile = `${nassh.External.ROOT_DIR}/${sessionId}.identity_file`;
  /**
   * @param {string} filename The filename to write to.
   * @param {string} content The data to write out.
   * @return {!Promise<void>} A promise completing when the write finishes.
   */
  const writeFile = (filename, content) => {
    return lib.fs.overwriteFile(
        nassh.External.fileSystem_.root, filename, content);
  };
  Promise.all([
      writeFile(knownHosts, request.knownHosts),
      writeFile(identityFile, request.identityFile),
  ]).then(() => {
    const args = {
      argv: {
        terminalIO: nassh.External.io_,
        isSftp: true,
        mountOptions: {
          fileSystemId: request.fileSystemId,
          displayName: request.displayName,
          writable: true,
        },
      },
      connectOptions: {
        username: request.username,
        hostname: request.hostname,
        port: request.port,
        argstr: `-i${identityFile} -oUserKnownHostsFile=${knownHosts}`,
      },
    };
    const success = nassh.sftp.fsp.createSftpInstance(args);
    sendResponse({error: !success, message: 'createSftpInstance'});
  }).catch((e) => {
    console.error(e);
    sendResponse({error: true, message: e.message, stack: e.stack});
  });
});

nassh.External.COMMANDS.set('unmount',
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
  nassh.sftp.fsp.onUnmountRequested(
      {fileSystemId},
      () => sendResponse({error: false, message: `unmounted ${fileSystemId}`}),
      (message) => sendResponse({error: true, message: message}));
});

/**
 * Container for holding mount information.
 */
nassh.External.MountInfo = class {
  /**
   * @param {!nassh.sftp.Client=} client Where to get info from.
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
   * @param {!nassh.sftp.Client} client The mount client to read.
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
   * @param {!nassh.External.MountInfo} info The settings to update from.
   * @param {!nassh.sftp.Client} client The mount client to update.
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
};

nassh.External.COMMANDS.set('getMountInfo',
/**
 * Get information about an existing mount.
 *
 * @param {{fileSystemId:string}} request Request to find the mount.
 * @param {!MessageSender} sender chrome.runtime.MessageSender
 * @param {function(!Object=)} sendResponse called to send response.
 */
function(request, sender, sendResponse) {
  if (!sender.internal && !nassh.External.SelfExtIds.has(sender.id)) {
    sendResponse(
        {error: true, message: 'getMountInfo: External access not allowed'});
    return;
  }

  const {fileSystemId} = request;
  const sftpInstance = nassh.sftp.fsp.sftpInstances[fileSystemId];
  if (sftpInstance === undefined) {
    sendResponse({error: true, message: `mount ${fileSystemId} not found`});
    return;
  }

  sendResponse({
    error: false,
    message: `info for ${fileSystemId} found`,
    info: new nassh.External.MountInfo(sftpInstance.sftpClient),
  });
});

nassh.External.COMMANDS.set('setMountInfo',
/**
 * Set information in an existing mount.
 *
 * @param {{fileSystemId:string, info:!nassh.External.MountInfo}} request
 *     Request to find and update the mount.
 * @param {!MessageSender} sender chrome.runtime.MessageSender
 * @param {function(!Object=)} sendResponse called to send response.
 */
function(request, sender, sendResponse) {
  if (!sender.internal && !nassh.External.SelfExtIds.has(sender.id)) {
    sendResponse(
        {error: true, message: 'setMountInfo: External access not allowed'});
    return;
  }

  const {fileSystemId, info} = request;
  const sftpInstance = nassh.sftp.fsp.sftpInstances[fileSystemId];
  if (sftpInstance === undefined) {
    sendResponse({error: true, message: `mount ${fileSystemId} not found`});
    return;
  }

  nassh.External.MountInfo.toClient(info, sftpInstance.sftpClient);
  sendResponse({error: false, message: `mount ${fileSystemId} updated`});
});

/**
 * @typedef {{
 *     url: string,
 *     width: (number|undefined),
 *     height: (number|undefined),
 * }}
 */
nassh.External.NewWindowSettings;

/**
 * Opens a new window.
 *
 * @param {!Object} response The response to send back to the caller.
 * @param {!nassh.External.NewWindowSettings} request Customize the new window
 *     behavior.
 * @param {!MessageSender} sender chrome.runtime.MessageSender.
 * @param {function(!Object=)} sendResponse called to send response.
 */
nassh.External.newWindow_ = function(
    response, request, sender, sendResponse) {
  // Set up some default values.
  request = /** @type {!nassh.External.NewWindowSettings} */ (Object.assign({
    width: 735,
    height: 440,
  }, request));

  const checkNumber = (field) => {
    const number = request[field];
    if (typeof number == 'number') {
      return number;
    } else {
      sendResponse(
          {error: true, message: `${field}: invalid number: ${number}`});
      return false;
    }
  };

  const width = checkNumber('width');
  if (width === false) {
    return;
  }

  const height = checkNumber('height');
  if (height === false) {
    return;
  }

  lib.f.openWindow(request.url, '',
                   'chrome=no,close=yes,resize=yes,scrollbars=yes,' +
                   `minimizable=yes,width=${width},height=${height}`);
  sendResponse(response);
};

nassh.External.COMMANDS.set('crosh',
/**
 * Opens a new crosh window.
 *
 * @param {!nassh.External.NewWindowSettings} request Customize the new window
 *     behavior.
 * @param {!MessageSender} sender chrome.runtime.MessageSender.
 * @param {function(!Object=)} sendResponse called to send response.
 */
function(request, sender, sendResponse) {
  if (!sender.internal) {
    delete request.url;
  }

  request = /** @type {!nassh.External.NewWindowSettings} */ (Object.assign({
    url: lib.f.getURL('/html/crosh.html'),
  }, request));

  nassh.External.newWindow_(
      {error: false, message: 'openCrosh'},
      request, sender, sendResponse);
});

nassh.External.COMMANDS.set('nassh',
/**
 * Opens a new nassh window.
 *
 * @param {!nassh.External.NewWindowSettings} request Customize the new window
 *     behavior.
 * @param {!MessageSender} sender chrome.runtime.MessageSender.
 * @param {function(!Object=)} sendResponse called to send response.
 */
function(request, sender, sendResponse) {
  if (!sender.internal) {
    delete request.url;
  }

  request = /** @type {!nassh.External.NewWindowSettings} */ (Object.assign({
    url: lib.f.getURL('/html/nassh.html'),
  }, request));

  nassh.External.newWindow_(
      {error: false, message: 'openNassh'},
      request, sender, sendResponse);
});

nassh.External.COMMANDS.set('prefsImport',
/**
 * Import new preferences.
 *
 * @param {{prefs:(!Object|string)}} request The preferences to import.
 * @param {!MessageSender} sender chrome.runtime.MessageSender
 * @param {function(!Object=)} sendResponse called to send response.
 */
function(request, sender, sendResponse) {
  if (!sender.internal && !nassh.External.SelfExtIds.has(sender.id)) {
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
  nassh.importPreferences(prefs, () => {
    sendResponse({error: false, message: 'prefsImport'});
  });
});

nassh.External.COMMANDS.set('prefsExport',
/**
 * Export existing preferences.
 *
 * @param {{asJson:boolean}} request How to export the preferences.
 * @param {!MessageSender} sender chrome.runtime.MessageSender
 * @param {function(!Object=)} sendResponse called to send response.
 */
function(request, sender, sendResponse) {
  if (!sender.internal && !nassh.External.SelfExtIds.has(sender.id)) {
    sendResponse(
        {error: true, message: 'prefsExport: External access not allowed'});
    return;
  }

  nassh.exportPreferences((prefs) => {
    if (request.asJson) {
      prefs = JSON.stringify(prefs);
    }
    sendResponse({error: false, message: 'prefsExport', prefs: prefs});
  });
});

nassh.External.COMMANDS.set('openProtoReg',
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

/**
 * Whether we've initialized enough for message handlers.
 *
 * @private
 */
let messageHandlersReady = false;

/** @typedef {{command:string}} */
nassh.External.OnMessageRequest;

/**
 * Common message dispatcher.
 *
 * @param {boolean} internal Whether the sender is this own extension.
 * @param {!nassh.External.OnMessageRequest} request
 * @param {!MessageSender} sender chrome.runtime.MessageSender.
 * @param {function(!Object=)} sendResponse called to send response.
 * @return {boolean} Whether sendResponse will be called asynchronously.
 * @private
 */
nassh.External.dispatchMessage_ = (internal, request, sender, sendResponse) => {
  // If we aren't ready yet, reschedule the call.
  if (!messageHandlersReady) {
    window.setTimeout(
        nassh.External.dispatchMessage_.bind(
            this, internal, request, sender, sendResponse),
        100);
    return true;
  }

  // Pass the internal setting down so the handler can easily detect.
  sender.internal = internal;

  // Execute specified command.
  if (typeof request != 'object') {
    sendResponse({error: true, message: `invalid request: ${request}`});
    return false;
  } else if (!nassh.External.COMMANDS.has(request.command)) {
    sendResponse(
        {error: true, message: `unsupported command '${request.command}'`});
    return false;
  }
  const senderInfo = `[id:${sender.id} internal:${sender.internal} ` +
                     `url:${sender.url} origin:${sender.origin}]`;
  console.log(`API: ${request.command} from ${senderInfo}`);
  try {
    nassh.External.COMMANDS.get(request.command).call(
        this, request, sender, sendResponse);

    // Return true to allow async sendResponse.
    return true;
  } catch (e) {
    console.error(e);
    sendResponse({error: true, message: e.message, stack: e.stack});
    return false;
  }
};

/**
 * Invoked when external app/extension calls chrome.runtime.sendMessage.
 * https://developer.chrome.com/apps/runtime#event-onMessageExternal.
 *
 * @param {*} request
 * @param {!MessageSender} sender chrome.runtime.MessageSender.
 * @param {function(*)} sendResponse called to send response.
 * @return {boolean} Whether sendResponse will be called asynchronously.
 * @private
 */
nassh.External.onMessageExternal_ = (request, sender, sendResponse) => {
  return nassh.External.dispatchMessage_.call(
      this, false, /** @type {!nassh.External.OnMessageRequest} */ (request),
      sender, /** @type {function(!Object=)} */ (sendResponse));
};

/**
 * Invoked when internal code calls chrome.runtime.sendMessage.
 * https://developer.chrome.com/apps/runtime#event-onMessage.
 *
 * @param {*} request
 * @param {!MessageSender} sender chrome.runtime.MessageSender.
 * @param {function(*): void} sendResponse called to send response.
 * @return {boolean} Whether sendResponse will be called asynchronously.
 * @private
 */
nassh.External.onMessage_ = (request, sender, sendResponse) => {
  return nassh.External.dispatchMessage_.call(
      this, true, /** @type {!nassh.External.OnMessageRequest} */ (request),
      sender, /** @type {function(!Object=)} */ (sendResponse));
};

// Initialize nassh.External.
lib.registerInit('external api', () => {
  // Create hterm.Terminal.IO required for SFTP using a mock hterm.Terminal.
  // External API calls will not require user IO to enter password, etc.
  /** @private */
  nassh.External.io_ = new hterm.Terminal.IO(/** @type {!hterm.Terminal} */ ({
    setProfile: () => {},
    screenSize: {width: 0, height: 0},
    showOverlay: () => {},
  }));

  // Get handle on FileSystem, cleanup files, and register listener.
  return nassh.getFileSystem().then((fileSystem) => {
    /** @private */
    nassh.External.fileSystem_ = fileSystem;
    return new Promise((deleteDone) => {
      // Remove existing contents of '/external/' before registering listener.
      fileSystem.root.getDirectory(
          nassh.External.ROOT_DIR,
          {},
          (f) => { f.removeRecursively(deleteDone, deleteDone); },
          deleteDone);
    }).then(() => {
      // We can start processing messages now.
      messageHandlersReady = true;
    });
  });
});

/**
 * Register listeners to receive messages.
 */
nassh.External.addListeners = function() {
  chrome.runtime.onMessageExternal.addListener(
      nassh.External.onMessageExternal_.bind(this));
  chrome.runtime.onMessage.addListener(
      nassh.External.onMessage_.bind(this));
};
