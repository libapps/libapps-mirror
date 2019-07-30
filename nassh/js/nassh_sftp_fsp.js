// Copyright (c) 2017 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

'use strict';

nassh.sftp.fsp = {};

/**
 * @fileoverview: This file manages the File System Provider API requests and
 *                currently active SFTP instances. File system requests are
 *                handled by their respective SFTP clients.
 */

// Map of file system ids to their SFTP instances
nassh.sftp.fsp.sftpInstances = {};

/**
 * Creates a new SFTP CommandInstance in the background page and connects to
 * the provided connection. Utilizes the same hterm.Terminal.IO as the
 * foreground page to authenticate the user before commencing SFTP communication.
 */
nassh.sftp.fsp.createSftpInstance = function(args) {
  var sftpInstance = new nassh.CommandInstance(args.argv);
  sftpInstance.connectTo(args.connectOptions);
};

/**
 * Sanitizes the provided file's metadata to the requirements specified in
 * 'options'.
 */
nassh.sftp.fsp.sanitizeMetadata = function(file, options) {
  var metadata = {};
  if (options.name) {
    if (file.filename) {
      metadata.name = file.filename;
    } else if (options.directoryPath) {
      metadata.name = options.directoryPath.split('/').pop();
    } else {
      metadata.name = options.entryPath.split('/').pop();
    }
  }
  if (options.isDirectory) {
    metadata.isDirectory = file.isDirectory;
  }
  if (options.size) {
    metadata.size = file.size;
  }
  if (options.modificationTime) {
    metadata.modificationTime = new Date(file.last_modified*1000);
  }
  return metadata;
};

/**
 * Metadata Requested handler. Retrieves the file attributes of the requested
 * file path.
 */
nassh.sftp.fsp.onGetMetadataRequested = function(options, onSuccess, onError) {
  if (!nassh.sftp.fsp.checkInstanceExists(options.fileSystemId, onError)) {
    return;
  }

  var client = nassh.sftp.fsp.sftpInstances[options.fileSystemId].sftpClient;
  var path = '.' + options.entryPath; // relative path
  client.fileStatus(path)
    .then(metadata => nassh.sftp.fsp.sanitizeMetadata(metadata, options))
    .then(onSuccess)
    .catch(response => {
        // If file not found
      if (response instanceof nassh.sftp.StatusError &&
          response.code == nassh.sftp.packets.StatusCodes.NO_SUCH_FILE) {
        onError('NOT_FOUND');
        return;
      }
      console.warn(response.name + ': ' + response.message);
      onError('FAILED');
    });
};

/**
 * Read Directory Requested handler. Retrieves the entries of the requested
 * directory.
 */
nassh.sftp.fsp.onReadDirectoryRequested = function(options, onSuccess, onError) {
  if (!nassh.sftp.fsp.checkInstanceExists(options.fileSystemId, onError)) {
    return;
  }

  var client = nassh.sftp.fsp.sftpInstances[options.fileSystemId].sftpClient;
  var directoryHandle;
  var path = '.' + options.directoryPath; // relative path
  client.openDirectory(path)
    .then(handle => { directoryHandle = handle; })
    .then(() => {
      return client.scanDirectory(directoryHandle, (entry) => {
        // Skip over the file if it's '.' or '..' pseudo paths.
        if (entry.filename == '.' || entry.filename == '..') {
          return false;
        }

        // If it's a symlink, resolve the target so we can see file-vs-dir.
        if (entry.isLink) {
          return client.fileStatus(`${path}/${entry.filename}`)
            .then((attrs) => {
              // Overlay the target's attributes on top of this entry.  This
              // will make it look like the symlink is a real path with the
              // target's settings.  This is more natural for users.
              Object.assign(entry, attrs);
              return nassh.sftp.fsp.sanitizeMetadata(entry, options);
            })
            .catch(() => {
              // If reading the symlink target failed (e.g. it's a broken
              // symlink), then just ignore it.  The FSP layers can't do
              // anything useful currently.
              return false;
            });
        }

        return nassh.sftp.fsp.sanitizeMetadata(entry, options);
      });
    })
    .then(entries => { onSuccess(entries, false); })
    .catch(response => {
      console.warn(response.name + ': ' + response.message);
      onError('FAILED');
    })
    .finally(() => {
      if (directoryHandle !== undefined) {
        return client.closeFile(directoryHandle);
      }
    });
};

/**
 * Write File Requested handler. Writes to the requested file.
 */
nassh.sftp.fsp.onWriteFileRequested = function(options, onSuccess, onError) {
  if (!nassh.sftp.fsp.checkInstanceExists(options.fileSystemId, onError)) {
    return;
  }

  var client = nassh.sftp.fsp.sftpInstances[options.fileSystemId].sftpClient;
  var fileHandle = client.openedFiles[options.openRequestId];
  if (!fileHandle) {
    onError('INVALID_OPERATION');
    return;
  }

  var writePromises = [];
  // Splits up the data to be written into chunks that the server can handle
  // and places them into multiple promises which will be resolved asynchronously.
  const data = new Uint8Array(options.data);
  for (let i = 0; i < data.length; i += client.writeChunkSize) {
    const chunk = data.subarray(i, i + client.writeChunkSize);
    var offset = options.offset + i;
    writePromises.push(client.writeChunk(fileHandle, offset, chunk));
  }

  Promise.all(writePromises)
    .then(onSuccess)
    .catch(response => {
      console.warn(response.name + ': ' + response.message);
      onError('FAILED');
    });
};

/**
 * Open File Requested handler. Opens the requested file and saves its handle.
 */
nassh.sftp.fsp.onOpenFileRequested = function(options, onSuccess, onError) {
  if (!nassh.sftp.fsp.checkInstanceExists(options.fileSystemId, onError)) {
    return;
  }

  var client = nassh.sftp.fsp.sftpInstances[options.fileSystemId].sftpClient;
  var pflags = 0;
  if (options.mode == "READ") {
    pflags |= nassh.sftp.packets.OpenFlags.READ;
  } else if (options.mode == "WRITE") {
    pflags |= nassh.sftp.packets.OpenFlags.WRITE;
  }

  var path = '.' + options.filePath; // relative path
  client.openFile(path, pflags)
    .then(handle => { client.openedFiles[options.requestId] = handle; })
    .then(onSuccess)
    .catch(response => {
      console.warn(response.name + ': ' + response.message);
      onError('FAILED');
    });
};

/**
 * Create File Requested handler. Creates a file at the requested file path and
 * saves its handle.
 */
nassh.sftp.fsp.onCreateFileRequested = function(options, onSuccess, onError) {
  if (!nassh.sftp.fsp.checkInstanceExists(options.fileSystemId, onError)) {
    return;
  }

  var client = nassh.sftp.fsp.sftpInstances[options.fileSystemId].sftpClient;
  var pflags = nassh.sftp.packets.OpenFlags.CREAT |
               nassh.sftp.packets.OpenFlags.EXCL;

  var path = '.' + options.filePath; // relative path
  client.openFile(path, pflags)
    .then(handle => { client.openedFiles[options.requestId] = handle; })
    .then(onSuccess)
    .catch(response => {
      console.warn(response.name + ': ' + response.message);
      onError('FAILED');
    });
};

/**
 * Truncate File Requested handler. Truncates the requested file path to 0
 * length and then closes it.
 */
nassh.sftp.fsp.onTruncateRequested = function(options, onSuccess, onError) {
  if (!nassh.sftp.fsp.checkInstanceExists(options.fileSystemId, onError)) {
    return;
  }

  var client = nassh.sftp.fsp.sftpInstances[options.fileSystemId].sftpClient;
  var pflags = nassh.sftp.packets.OpenFlags.CREAT |
               nassh.sftp.packets.OpenFlags.TRUNC;

  var path = '.' + options.filePath; // relative path
  client.openFile(path, pflags)
    .then((handle) => client.closeFile(handle))
    .then(onSuccess)
    .catch(response => {
      console.warn(response.name + ': ' + response.message);
      onError('FAILED');
    });
};

/**
 * Delete Entry Requested handler. Deletes the entry of the requested file path.
 * If the entry is a directory, deletes all sub-entries recursively.
 */
nassh.sftp.fsp.onDeleteEntryRequested = function(options, onSuccess, onError) {
  if (!nassh.sftp.fsp.checkInstanceExists(options.fileSystemId, onError)) {
    return;
  }

  var client = nassh.sftp.fsp.sftpInstances[options.fileSystemId].sftpClient;
  var path = '.' + options.entryPath; // relative path

  let ret;
  if (options.recursive) {
    // If the FSP layers thinks this is a directory but it's really a symlink
    // to a directory, make sure we remove the symlink instead.  This adds a
    // bit of overhead when deleting a directory, but we don't have a choice.
    ret = client.linkStatus(path)
      .then((metadata) => {
        if (metadata.isDirectory) {
          return client.removeDirectory(path, true);
        } else {
          return client.removeFile(path);
        }
      });
  } else {
    ret = client.removeFile(path);
  }
  return ret.then(onSuccess)
    .catch((response) => {
      // If file not found.
      if (response instanceof nassh.sftp.StatusError &&
          response.code == nassh.sftp.packets.StatusCodes.NO_SUCH_FILE) {
        onError('NOT_FOUND');
        return;
      }
      console.warn(response.name + ': ' + response.message);
      onError('FAILED');
    });
};

/**
 * Close File Requested handler. Closes the requested file and removes its
 * handle.
 */
nassh.sftp.fsp.onCloseFileRequested = function(options, onSuccess, onError) {
  if (!nassh.sftp.fsp.checkInstanceExists(options.fileSystemId, onError)) {
    return;
  }

  var client = nassh.sftp.fsp.sftpInstances[options.fileSystemId].sftpClient;
  if (!client.openedFiles[options.openRequestId]) {
    console.warn('File handle not found');
    onError('INVALID_OPERATION');
    return;
  }

  client.closeFile(client.openedFiles[options.openRequestId])
    .then(() => { delete client.openedFiles[options.openRequestId]; })
    .then(onSuccess)
    .catch(response => {
      console.warn(response.name + ': ' + response.message);
      onError('FAILED');
    });
};

/**
 * Create Directory Requested handler. Creates a directory at the requested
 * file path.
 */
nassh.sftp.fsp.onCreateDirectoryRequested = function(options, onSuccess, onError) {
  if (!nassh.sftp.fsp.checkInstanceExists(options.fileSystemId, onError)) {
    return;
  }

  var client = nassh.sftp.fsp.sftpInstances[options.fileSystemId].sftpClient;
  if (options.recursive) { // Not supported/implemented.
    onError('INVALID_OPERATION');
    return;
  }

  var path = '.' + options.directoryPath; // relative path
  client.makeDirectory(path)
    .then(onSuccess)
    .catch(response => {
      console.warn(response.name + ': ' + response.message);
      onError('FAILED');
    });
};

/**
 * Move Requested handler. Moves (renames) the requested source file path to the
 * target file path.
 */
nassh.sftp.fsp.onMoveEntryRequested = function(options, onSuccess, onError) {
  if (!nassh.sftp.fsp.checkInstanceExists(options.fileSystemId, onError)) {
    return;
  }

  var client = nassh.sftp.fsp.sftpInstances[options.fileSystemId].sftpClient;
  var sourcePath = '.' + options.sourcePath; // relative path
  var targetPath = '.' + options.targetPath; // relative path
  client.renameFile(sourcePath, targetPath)
    .then(onSuccess)
    .catch(response => {
      console.warn(response.name + ': ' + response.message);
      onError('FAILED');
    });
};

/**
 * Read File Requested handler. Reads the requested file and returns its data.
 */
nassh.sftp.fsp.onReadFileRequested = function(options, onSuccess, onError) {
  if (!nassh.sftp.fsp.checkInstanceExists(options.fileSystemId, onError)) {
    return;
  }

  var client = nassh.sftp.fsp.sftpInstances[options.fileSystemId].sftpClient;
  var fileHandle = client.openedFiles[options.openRequestId];
  if (!fileHandle) {
    onError('INVALID_OPERATION');
    return;
  }

  client.readChunks(fileHandle, (chunk) => onSuccess(chunk, true),
                    {offset: options.offset, length: options.length})
    .then(() => onSuccess(new ArrayBuffer(), false))
    .catch(response => {
      console.warn(response.name + ': ' + response.message);
      onError('FAILED');
    });
};

/**
 * Copy Entry Requested handler. Copies the entry of the requested file path.
 * If the entry is a directory, copies all sub-entries recursively.
 */
nassh.sftp.fsp.onCopyEntryRequested = function(options, onSuccess, onError) {
  if (!nassh.sftp.fsp.checkInstanceExists(options.fileSystemId, onError)) {
    return;
  }

  var client = nassh.sftp.fsp.sftpInstances[options.fileSystemId].sftpClient;
  var sourcePath = '.' + options.sourcePath; // relative path
  var targetPath = '.' + options.targetPath; // relative path
  return client.linkStatus(sourcePath)
    .then(metadata => {
      if (metadata.isLink) {
        return client.readLink(sourcePath)
          .then((response) => {
            return client.symLink(response.files[0].filename, targetPath);
          });
      } else if (metadata.isDirectory) {
        return nassh.sftp.fsp.copyDirectory_(sourcePath, targetPath, client);
      } else {
        return nassh.sftp.fsp.copyFile_(
            sourcePath, targetPath, metadata.size, client);
      }
    })
    .then(onSuccess)
    .catch(response => {
      console.warn(response.name + ': ' + response.message);
      onError('FAILED');
    });
};

/**
 * Copies the file at the remote source path to the remote target path.
 */
nassh.sftp.fsp.copyFile_ = function(sourcePath, targetPath, size, client) {
  var sourceHandle;
  var targetHandle;
  return client.openFile(sourcePath, nassh.sftp.packets.OpenFlags.READ)
    .then(handle => {

      sourceHandle = handle;
      var pflags = nassh.sftp.packets.OpenFlags.WRITE |
                   nassh.sftp.packets.OpenFlags.APPEND |
                   nassh.sftp.packets.OpenFlags.CREAT |
                   nassh.sftp.packets.OpenFlags.EXCL;
      return client.openFile(targetPath, pflags);

    })
    .then(handle => {

      targetHandle = handle;

      // If the server can do the copy, let it do it directly.
      if (client.protocolServerExtensions['copy-data'] !== undefined) {
        return client.copyData(sourceHandle, targetHandle, size);
      }

      var readWritePromises = [];
      // Splits up the data to be read and written into chunks that the server
      // can handle and places them into multiple promises which will be
      // resolved asynchronously.
      const chunkSize = Math.min(client.readChunkSize, client.writeChunkSize);
      for (var i = 0; i < size; i += chunkSize) {
        var offset = i;
        var readWritePromise = client.readChunk(sourceHandle, offset,
                                                chunkSize)
          .then(data => client.writeChunk(targetHandle, offset, data));

        readWritePromises.push(readWritePromise);
      }
      return Promise.all(readWritePromises);

    })
    .finally(() => {
      if (sourceHandle !== undefined) {
        return client.closeFile(sourceHandle);
      }
    })
    .finally(() => {
      if (targetHandle !== undefined) {
        return client.closeFile(targetHandle);
      }
    });
};

/**
 * Reads the remote directory and copies all of its entries before copying
 * itself.
 */
nassh.sftp.fsp.copyDirectory_ = function(sourcePath, targetPath, client) {
  let sourceHandle;
  return client.openDirectory(sourcePath)
    .then(handle => { sourceHandle = handle; })
    .then(() => client.makeDirectory(targetPath))
    .then(() => {
      return client.scanDirectory(sourceHandle, (entry) => {
        // Skip over the entry if it's '.' or '..'.
        return entry.filename != '.' && entry.filename != '..';
      });
    })
    .then(entries => {
      const copyPromises = [];
      for (let i = 0; i < entries.length; i++) {
        const file = entries[i];
        const fileSourcePath = `${sourcePath}/${file.filename}`;
        const fileTargetPath = `${targetPath}/${file.filename}`;
        if (file.isLink) {
          copyPromises.push(
            client.readLink(fileSourcePath)
              .then((response) => {
                return client.symLink(response.files[0].filename,
                                      fileTargetPath);
              })
          );
        } else if (file.isDirectory) {
          copyPromises.push(nassh.sftp.fsp.copyDirectory_(
              fileSourcePath, fileTargetPath, client));
        } else {
          copyPromises.push(nassh.sftp.fsp.copyFile_(
              fileSourcePath, fileTargetPath, file.size, client));
        }
      }

      return Promise.all(copyPromises);
    })
    .finally(() => {
      if (sourceHandle !== undefined) {
        return client.closeFile(sourceHandle);
      }
    });
};

/**
 * Mount Requested handler. Opens the Secure Shell main page which prompts the
 * user to mount a remote connection.
 *
 * Note: This is only called upon first installation of Secure Shell and when
 * the user clicks "Add New Service" from the File App.
 */
nassh.sftp.fsp.onMountRequested = function(onSuccess, onError) {
  lib.f.openWindow('html/nassh.html');
};

/**
 * Unmount Requested handler. Closes the SFTP connection and removes the SFTP
 * instance before unmounting the file system.
 */
nassh.sftp.fsp.onUnmountRequested = function(options, onSuccess, onError) {
  // We don't return immediately on errors.  If the caller is trying to unmount
  // us, then usually it means they think we're mounted even if we don't think
  // we are.  This can happen if the Secure Shell background page is killed, but
  // the Files app remembers all the connections.  Either way, it's more robust
  // for us to always unmount with the FSP layer.
  if (nassh.sftp.fsp.checkInstanceExists(options.fileSystemId, onError)) {
    // Only clear local state if we know about the mount.
    var sftpInstance = nassh.sftp.fsp.sftpInstances[options.fileSystemId];
    if (sftpInstance !== undefined) {
      sftpInstance.exit(0); // exit NaCl plugin
      delete nassh.sftp.fsp.sftpInstances[options.fileSystemId];
    }
  }

  if (window.chrome && chrome.fileSystemProvider) {
    chrome.fileSystemProvider.unmount(
      {fileSystemId: options.fileSystemId}, () => {
        const err = lib.f.lastError();
        if (err) {
          console.warn(err);
          onError('FAILED');
        } else {
          onSuccess();
        }
      });
  }
};

/**
 * Configure Requested handler.
 *
 * Shows a dialog for the user to tweak connection settings on the fly.
 */
nassh.sftp.fsp.onConfigureRequested = function(options, onSuccess, onError) {
  if (!nassh.sftp.fsp.checkInstanceExists(options.fileSystemId, onError)) {
    return;
  }

  lib.f.openWindow(
      `html/nassh_sftp_fsp_config_dialog.html` +
      `?profile-id=${options.fileSystemId}`, '',
      'chrome=no,close=yes,resize=yes,scrollbars=yes,minimizable=yes,' +
      'width=600,height=400');
  onSuccess();
};

/**
 * Checks if the file system id has an associated SFTP instance.
 */
nassh.sftp.fsp.checkInstanceExists = function(fsId, onError) {
  if (!nassh.sftp.fsp.sftpInstances[fsId]) {
    console.warn('SFTP Instance for file system id "' + fsId + '" not found!');
    onError('FAILED');
    return false;
  }
  return true;
};

/**
 * Object containing all supported File System Provider API methods.
 */
nassh.sftp.fsp.providerMethods = [
  'onGetMetadataRequested',
  'onReadDirectoryRequested',
  'onOpenFileRequested',
  'onCloseFileRequested',
  'onReadFileRequested',
  'onMountRequested',
  'onUnmountRequested',
  'onMoveEntryRequested',
  'onDeleteEntryRequested',
  'onWriteFileRequested',
  'onCreateFileRequested',
  'onTruncateRequested',
  'onCopyEntryRequested',
  'onCreateDirectoryRequested',
  'onConfigureRequested',
];

// Loop over the provider methods and link them to their handlers.
if (window.chrome && chrome.fileSystemProvider) {
  nassh.sftp.fsp.providerMethods.forEach(function(provider) {
    chrome.fileSystemProvider[provider].addListener(nassh.sftp.fsp[provider]);
  });
}
