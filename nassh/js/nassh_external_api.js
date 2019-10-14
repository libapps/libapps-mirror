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
nassh.External.COMMANDS = {};

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

/**
 * Performs SFTP mount.
 *
 * @param {{username:string, hostname:string, port:(number|undefined),
 *     identityFile:string, knownHosts:string, fileSystemId:string,
 *     displayName:string}} request Request to mount specified host.
 * @param {{id:string}} sender chrome.runtime.MessageSender
 * @param {function(!Object=)} sendResponse called to send response.
 */
nassh.External.COMMANDS.mount = (request, sender, sendResponse) => {
  const sessionId = nassh.External.sessionCounter_++;
  const knownHosts = `${nassh.External.ROOT_DIR}/${sessionId}.known_hosts`;
  const identityFile = `${nassh.External.ROOT_DIR}/${sessionId}.identity_file`;
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
        }
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
};

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
 * @param {{id:string}} sender chrome.runtime.MessageSender.
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

  let width = checkNumber('width');
  if (width === false) {
    return;
  }

  let height = checkNumber('height');
  if (height === false) {
    return;
  }

  lib.f.openWindow(request.url, '',
                   'chrome=no,close=yes,resize=yes,scrollbars=yes,' +
                   `minimizable=yes,width=${width},height=${height}`);
  sendResponse(response);
};

/**
 * Opens a new crosh window.
 *
 * @param {!nassh.External.NewWindowSettings} request Customize the new window
 *     behavior.
 * @param {{id:string}} sender chrome.runtime.MessageSender.
 * @param {function(!Object=)} sendResponse called to send response.
 */
nassh.External.COMMANDS.crosh = function(request, sender, sendResponse) {
  if (!sender.internal) {
    delete request.url;
  }

  request = /** @type {!nassh.External.NewWindowSettings} */ (Object.assign({
    url: lib.f.getURL('/html/crosh.html'),
  }, request));

  nassh.External.newWindow_(
      {error: false, message: 'openCrosh'},
      request, sender, sendResponse);
};

/**
 * Opens a new nassh window.
 *
 * @param {!nassh.External.NewWindowSettings} request Customize the new window
 *     behavior.
 * @param {{id:string}} sender chrome.runtime.MessageSender.
 * @param {function(!Object=)} sendResponse called to send response.
 */
nassh.External.COMMANDS.nassh = function(request, sender, sendResponse) {
  if (!sender.internal) {
    delete request.url;
  }

  request = /** @type {!nassh.External.NewWindowSettings} */ (Object.assign({
    url: lib.f.getURL('/html/nassh.html'),
  }, request));

  nassh.External.newWindow_(
      {error: false, message: 'openNassh'},
      request, sender, sendResponse);
};

/** @typedef {{command:string}} */
nassh.External.OnMessageRequest;

/**
 * Invoked when external app/extension calls chrome.runtime.sendMessage.
 * https://developer.chrome.com/apps/runtime#event-onMessageExternal.
 *
 * @param {!nassh.External.OnMessageRequest} request
 * @param {{id:string}} sender chrome.runtime.MessageSender.
 * @param {function(!Object=)} sendResponse called to send response.
 * @return {boolean}
 * @private
 */
nassh.External.onMessageExternal_ = (request, sender, sendResponse) => {
  sender.internal = false;

  // Execute specified command.
  if (!nassh.External.COMMANDS.hasOwnProperty(request.command)) {
    sendResponse(
        {error: true, message: `unsupported command ${request.command}`});
    return false;
  }
  try {
    nassh.External.COMMANDS[request.command].call(
        this, request, sender, sendResponse);

    // Return true to allow async sendResponse.
    return true;
  } catch (e) {
    console.error(e);
    sendResponse({error: true, message: e.message, stack: e.stack});
  }
};

/**
 * Invoked when internal code calls chrome.runtime.sendMessage.
 * https://developer.chrome.com/apps/runtime#event-onMessageExternal.
 *
 * @param {!nassh.External.OnMessageRequest} request
 * @param {{id:string}} sender chrome.runtime.MessageSender.
 * @param {function(!Object=)} sendResponse called to send response.
 * @return {boolean}
 * @private
 */
nassh.External.onMessage_ = (request, sender, sendResponse) => {
  sender.internal = true;

  // Execute specified command.
  if (!nassh.External.COMMANDS.hasOwnProperty(request.command)) {
    sendResponse(
        {error: true, message: `unsupported command ${request.command}`});
    return false;
  }
  try {
    nassh.External.COMMANDS[request.command].call(
        this, request, sender, sendResponse);

    // Return true to allow async sendResponse.
    return true;
  } catch (e) {
    console.error(e);
    sendResponse({error: true, message: e.message, stack: e.stack});
  }
};

// Initialize nassh.External.
lib.registerInit('external api', (onInit) => {
  // Create hterm.Terminal.IO required for SFTP using a mock hterm.Terminal.
  // External API calls will not require user IO to enter password, etc.
  /** @private */
  nassh.External.io_ = new hterm.Terminal.IO(/** @type {!hterm.Terminal} */ ({
    setProfile: () => {},
    screenSize: {width: 0, height: 0},
    showOverlay: () => {},
  }));

  // Get handle on FileSystem, cleanup files, and register listener.
  nassh.getFileSystem().then((fileSystem) => {
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
      // Register listener to receive messages.
      chrome.runtime.onMessageExternal.addListener(
          nassh.External.onMessageExternal_.bind(this));

      // Register listener to receive messages.
      chrome.runtime.onMessage.addListener(
          nassh.External.onMessage_.bind(this));

      // Init complete.
      onInit();
    });
  });
});
