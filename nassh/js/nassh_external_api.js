// Copyright 2018 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

'use strict';

lib.rtdep('lib.fs');

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
 * @const
 */
nassh.External.ROOT_DIR = '/external';

/**
 * Unique identifier for each session.
 * @private
 */
nassh.External.sessionCounter_ = 0;

/**
 * Performs SFTP mount.
 *
 * @param {{username: !string, hostname: !string, port: number=,
 *     identityFile: !string, knownHosts: !string, fileSystemId: !string,
 *     displayName: !string}} request Request to mount specified host.
 * @param {{id: !string}} sender chrome.runtime.MessageSender
 * @param {function(Object=)} sendResponse called to send response.
 */
nassh.External.COMMANDS.mount = (request, sender, sendResponse) => {
  const sessionId = nassh.External.sessionCounter_++;
  const knownHosts = `${nassh.External.ROOT_DIR}/${sessionId}.known_hosts`;
  const identityFile = `${nassh.External.ROOT_DIR}/${sessionId}.identity_file`;
  function writeFile(filename, content, resolve, reject) {
    lib.fs.overwriteFile(
        nassh.External.fileSystem_.root, filename, content, resolve, reject);
  }
  Promise.all([
      new Promise(writeFile.bind(this, knownHosts, request.knownHosts)),
      new Promise(writeFile.bind(this, identityFile, request.identityFile)),
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
 * Invoked when external app/extension calls chrome.remote.sendMessage.
 * https://developer.chrome.com/apps/runtime#event-onMessageExternal.
 * @private
 */
nassh.External.onMessageExternal_ = (request, sender, sendResponse) => {
  // Execute specified command.
  if (!nassh.External.COMMANDS.hasOwnProperty(request.command)) {
    sendResponse(
        {error: true, message: `unsupported command ${request.command}`});
    return;
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
  nassh.External.io_ = new hterm.Terminal.IO({
    setProfile: () => {},
    screenSize: {width: 0, height: 0},
    showOverlay: () => {},
  });

  // Get handle on FileSystem, cleanup files, and register listener.
  nassh.getFileSystem((fileSystem) => {
    /** @private */
    nassh.External.fileSystem_ = fileSystem;
    new Promise((deleteDone) => {
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

      // Init complete.
      onInit();
    });
  });
});
