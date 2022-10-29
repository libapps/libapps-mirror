// Copyright 2017 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview This file manages the File System Provider API requests and
 *                currently active SFTP mounts. File system requests are
 *                handled by their respective SFTP clients.
 */

import {lib} from '../../libdot/index.js';

import {Client as sftpClient} from './nassh_sftp_client.js';
import {
  File, FileAttrs, OpenFlags, StatusCodes,
} from './nassh_sftp_packet_types.js';
import {StatusError} from './nassh_sftp_status.js';

/**
 * Sanitizes the provided file's metadata to the requirements specified in
 * 'options'.
 *
 * @param {!File|!FileAttrs} file
 * @param {{
 *     name: (boolean|undefined),
 *     directoryPath: (string|undefined),
 *     entryPath: (string|undefined),
 *     isDirectory: (boolean|undefined),
 *     size: (boolean|undefined),
 *     modificationTime: (boolean|undefined),
 * }} options
 * @return {{
 *     name: (string|undefined),
 *     isDirectory: (boolean|undefined),
 *     size: (number|undefined),
 *     modificationTime: (!Date|undefined),
 * }}
 */
export function sanitizeMetadata(file, options) {
  const metadata = {};
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
    metadata.modificationTime =
        new Date(lib.notUndefined(file.lastModified) * 1000);
  }
  return metadata;
}

/**
 * Copies the file at the remote source path to the remote target path.
 *
 * @param {string} sourcePath
 * @param {string} targetPath
 * @param {number} size
 * @param {!sftpClient} client
 * @return {!Promise}
 */
function copyFile(sourcePath, targetPath, size, client) {
  let sourceHandle;
  let targetHandle;
  return client.openFile(sourcePath, OpenFlags.READ)
    .then((handle) => {

      sourceHandle = handle;
      const pflags = OpenFlags.WRITE | OpenFlags.APPEND | OpenFlags.CREAT |
          OpenFlags.EXCL;
      return client.openFile(targetPath, pflags);

    })
    .then((handle) => {

      targetHandle = handle;

      // If the server can do the copy, let it do it directly.
      if (client.protocolServerExtensions['copy-data'] !== undefined) {
        return client.copyData(sourceHandle, targetHandle, size);
      }

      const readWritePromises = [];
      // Splits up the data to be read and written into chunks that the server
      // can handle and places them into multiple promises which will be
      // resolved asynchronously.
      const chunkSize = Math.min(client.readChunkSize, client.writeChunkSize);
      for (let i = 0; i < size; i += chunkSize) {
        const offset = i;
        const readWritePromise = client.readChunk(sourceHandle, offset,
                                                  chunkSize)
          .then((data) => client.writeChunk(targetHandle, offset, data));

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
}

/**
 * Reads the remote directory and copies all of its entries before copying
 * itself.
 *
 * @param {string} sourcePath
 * @param {string} targetPath
 * @param {!sftpClient} client
 * @return {!Promise}
 */
function copyDirectory(sourcePath, targetPath, client) {
  let sourceHandle;
  return client.openDirectory(sourcePath)
    .then((handle) => { sourceHandle = handle; })
    .then(() => client.makeDirectory(targetPath))
    .then(() => {
      return client.scanDirectory(sourceHandle, (entry) => {
        // Skip over the entry if it's '.' or '..'.
        return entry.filename != '.' && entry.filename != '..';
      });
    })
    .then((entries) => {
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
              }),
          );
        } else if (file.isDirectory) {
          copyPromises.push(copyDirectory(
              fileSourcePath, fileTargetPath, client));
        } else {
          copyPromises.push(copyFile(
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
}

/**
 * @typedef {{
 *   exit: (undefined|function(number, boolean)),
 *   sftpClient: !sftpClient,
 * }}
 */
export let SftpMount;

/**
 * SFTP File System Provider.
 */
export class SftpFsp {
  constructor() {
    /**
     * Map of file system ids to their SFTP mounts.
     *
     * @private {!Map<string, !SftpMount>}
     * @const
     */
    this.mounts_ = new Map();
  }

  /**
   * Add SFTP mount.
   *
   * @param {string} fileSystemId
   * @param {!SftpMount} mount
   */
  addMount(fileSystemId, mount) {
    this.mounts_.set(fileSystemId, mount);
  }


  /**
   * Get SFTP mount info.
   *
   * @param {string} fileSystemId
   * @return {!SftpMount|undefined}
   */
  getMount(fileSystemId) {
    return this.mounts_.get(fileSystemId);
  }

  /**
   * Remove mount.
   *
   * @param {string} fileSystemId
   * @return {!Promise<void>}
   */
  unmount(fileSystemId) {
    return new Promise((resolve, reject) => {
      this.onUnmountRequested({fileSystemId}, resolve, reject);
    });
  }

  /**
   * Metadata Requested handler. Retrieves the file attributes of the requested
   * file path.
   *
   * @param {!Object} options
   * @param {function(!chrome.fileSystemProvider.EntryMetadata)} onSuccess
   * @param {function(!chrome.fileSystemProvider.ProviderError)} onError
   */
  onGetMetadataRequested(options, onSuccess, onError) {
    const sftp = this.mounts_.get(options.fileSystemId);
    if (sftp === undefined) {
      return;
    }

    const client = sftp.sftpClient;
    const path = '.' + options.entryPath; // relative path
    client.fileStatus(path)
      .then((metadata) => sanitizeMetadata(metadata, options))
      .then(onSuccess)
      .catch((response) => {
        // If file not found
        if (response instanceof StatusError &&
            response.code == StatusCodes.NO_SUCH_FILE) {
          onError(chrome.fileSystemProvider.ProviderError.NOT_FOUND);
          return;
        }
        console.warn(response.name + ': ' + response.message);
        onError(chrome.fileSystemProvider.ProviderError.FAILED);
      });
  }

  /**
   * Read Directory Requested handler. Retrieves the entries of the requested
   * directory.
   *
   * @param {!Object} options
   * @param {
   *   function(!Array<!chrome.fileSystemProvider.EntryMetadata>, boolean)
   * } onSuccess
   * @param {function(!chrome.fileSystemProvider.ProviderError)} onError
   */
  onReadDirectoryRequested(options, onSuccess, onError) {
    const sftp = this.mounts_.get(options.fileSystemId);
    if (sftp === undefined) {
      return;
    }

    const client = sftp.sftpClient;
    let directoryHandle;
    const path = '.' + options.directoryPath; // relative path
    client.openDirectory(path)
      .then((handle) => { directoryHandle = handle; })
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
                return sanitizeMetadata(entry, options);
              })
              .catch(() => {
                // If reading the symlink target failed (e.g. it's a broken
                // symlink), then just ignore it.  The FSP layers can't do
                // anything useful currently.
                return false;
              });
          }

          return sanitizeMetadata(entry, options);
        });
      })
      .then((entries) => { onSuccess(entries, false); })
      .catch((response) => {
        console.warn(response.name + ': ' + response.message);
        onError(chrome.fileSystemProvider.ProviderError.FAILED);
      })
      .finally(() => {
        if (directoryHandle !== undefined) {
          return client.closeFile(directoryHandle);
        }
      });
  }

  /**
   * Write File Requested handler. Writes to the requested file.
   *
   * @param {!Object} options
   * @param {function()} onSuccess
   * @param {function(!chrome.fileSystemProvider.ProviderError)} onError
   */
  onWriteFileRequested(options, onSuccess, onError) {
    const sftp = this.mounts_.get(options.fileSystemId);
    if (sftp === undefined) {
      return;
    }

    const client = sftp.sftpClient;
    const fileHandle = client.openedFiles[options.openRequestId];
    if (!fileHandle) {
      onError(chrome.fileSystemProvider.ProviderError.INVALID_OPERATION);
      return;
    }

    const writePromises = [];
    // Splits up the data to be written into chunks that the server can handle
    // and places them into multiple promises which will be resolved
    // asynchronously.
    const data = new Uint8Array(options.data);
    for (let i = 0; i < data.length; i += client.writeChunkSize) {
      const chunk = data.subarray(i, i + client.writeChunkSize);
      const offset = options.offset + i;
      writePromises.push(client.writeChunk(fileHandle, offset, chunk));
    }

    Promise.all(writePromises).then(onSuccess).catch((response) => {
      console.warn(response.name + ': ' + response.message);
      onError(chrome.fileSystemProvider.ProviderError.FAILED);
    });
  }

  /**
   * Open File Requested handler. Opens the requested file and saves its handle.
   *
   * @param {!Object} options
   * @param {function()} onSuccess
   * @param {function(!chrome.fileSystemProvider.ProviderError)} onError
   */
  onOpenFileRequested(options, onSuccess, onError) {
    const sftp = this.mounts_.get(options.fileSystemId);
    if (sftp === undefined) {
      return;
    }

    const client = sftp.sftpClient;
    let pflags = 0;
    if (options.mode == 'READ') {
      pflags |= OpenFlags.READ;
    } else if (options.mode == 'WRITE') {
      pflags |= OpenFlags.WRITE;
    }

    const path = '.' + options.filePath;  // relative path
    client.openFile(path, pflags)
        .then((handle) => {
          client.openedFiles[options.requestId] = handle;
        })
        .then(onSuccess)
        .catch((response) => {
          console.warn(response.name + ': ' + response.message);
          onError(chrome.fileSystemProvider.ProviderError.FAILED);
        });
  }

  /**
   * Create File Requested handler. Creates a file at the requested file path
   * and saves its handle.
   *
   * @param {!Object} options
   * @param {function()} onSuccess
   * @param {function(!chrome.fileSystemProvider.ProviderError)} onError
   */
  onCreateFileRequested(options, onSuccess, onError) {
    const sftp = this.mounts_.get(options.fileSystemId);
    if (sftp === undefined) {
      return;
    }

    const client = sftp.sftpClient;
    const pflags = OpenFlags.CREAT | OpenFlags.EXCL;

    const path = '.' + options.filePath;  // relative path
    client.openFile(path, pflags)
        .then((handle) => {
          client.openedFiles[options.requestId] = handle;
        })
        .then(onSuccess)
        .catch((response) => {
          console.warn(response.name + ': ' + response.message);
          onError(chrome.fileSystemProvider.ProviderError.FAILED);
        });
  }

  /**
   * Truncate File Requested handler. Truncates the requested file path to 0
   * length and then closes it.
   *
   * @param {!Object} options
   * @param {function()} onSuccess
   * @param {function(!chrome.fileSystemProvider.ProviderError)} onError
   */
  onTruncateRequested(options, onSuccess, onError) {
    const sftp = this.mounts_.get(options.fileSystemId);
    if (sftp === undefined) {
      return;
    }

    const client = sftp.sftpClient;
    const pflags = OpenFlags.CREAT | OpenFlags.TRUNC;

    const path = '.' + options.filePath;  // relative path
    client.openFile(path, pflags)
        .then((handle) => client.closeFile(handle))
        .then(onSuccess)
        .catch((response) => {
          console.warn(response.name + ': ' + response.message);
          onError(chrome.fileSystemProvider.ProviderError.FAILED);
        });
  }

  /**
   * Delete Entry Requested handler. Deletes the entry of the requested file
   * path. If the entry is a directory, deletes all sub-entries recursively.
   *
   * @param {!Object} options
   * @param {function()} onSuccess
   * @param {function(!chrome.fileSystemProvider.ProviderError)} onError
   * @return {!Promise}
   */
  onDeleteEntryRequested(options, onSuccess, onError) {
    const sftp = this.mounts_.get(options.fileSystemId);
    if (sftp === undefined) {
      return Promise.resolve();
    }

    const client = sftp.sftpClient;
    const path = '.' + options.entryPath;  // relative path

    let ret;
    if (options.recursive) {
      // If the FSP layers thinks this is a directory but it's really a symlink
      // to a directory, make sure we remove the symlink instead.  This adds a
      // bit of overhead when deleting a directory, but we don't have a choice.
      ret = client.linkStatus(path).then((metadata) => {
        if (metadata.isDirectory) {
          return client.removeDirectory(path, true);
        } else {
          return client.removeFile(path);
        }
      });
    } else {
      ret = client.removeFile(path);
    }
    return ret.then(onSuccess).catch((response) => {
      // If file not found.
      if (response instanceof StatusError &&
          response.code == StatusCodes.NO_SUCH_FILE) {
        onError(chrome.fileSystemProvider.ProviderError.NOT_FOUND);
        return;
      }
      console.warn(response.name + ': ' + response.message);
      onError(chrome.fileSystemProvider.ProviderError.FAILED);
    });
  }

  /**
   * Close File Requested handler. Closes the requested file and removes its
   * handle.
   *
   * @param {!Object} options
   * @param {function()} onSuccess
   * @param {function(!chrome.fileSystemProvider.ProviderError)} onError
   */
  onCloseFileRequested(options, onSuccess, onError) {
    const sftp = this.mounts_.get(options.fileSystemId);
    if (sftp === undefined) {
      return;
    }

    const client = sftp.sftpClient;
    if (!client.openedFiles[options.openRequestId]) {
      console.warn('File handle not found');
      onError(chrome.fileSystemProvider.ProviderError.INVALID_OPERATION);
      return;
    }

    client.closeFile(client.openedFiles[options.openRequestId])
        .then(() => {
          delete client.openedFiles[options.openRequestId];
        })
        .then(onSuccess)
        .catch((response) => {
          console.warn(response.name + ': ' + response.message);
          onError(chrome.fileSystemProvider.ProviderError.FAILED);
        });
  }

  /**
   * Create Directory Requested handler. Creates a directory at the requested
   * file path.
   *
   * @param {!Object} options
   * @param {function()} onSuccess
   * @param {function(!chrome.fileSystemProvider.ProviderError)} onError
   */
  onCreateDirectoryRequested(options, onSuccess, onError) {
    const sftp = this.mounts_.get(options.fileSystemId);
    if (sftp === undefined) {
      return;
    }

    const client = sftp.sftpClient;
    if (options.recursive) {  // Not supported/implemented.
      onError(chrome.fileSystemProvider.ProviderError.INVALID_OPERATION);
      return;
    }

    const path = '.' + options.directoryPath;  // relative path
    client.makeDirectory(path).then(onSuccess).catch((response) => {
      console.warn(response.name + ': ' + response.message);
      onError(chrome.fileSystemProvider.ProviderError.FAILED);
    });
  }

  /**
   * Move Requested handler. Moves (renames) the requested source file path to
   * the target file path.
   *
   * @param {!Object} options
   * @param {function()} onSuccess
   * @param {function(!chrome.fileSystemProvider.ProviderError)} onError
   */
  onMoveEntryRequested(options, onSuccess, onError) {
    const sftp = this.mounts_.get(options.fileSystemId);
    if (sftp === undefined) {
      return;
    }

    const client = sftp.sftpClient;
    const sourcePath = '.' + options.sourcePath;  // relative path
    const targetPath = '.' + options.targetPath;  // relative path
    client.renameFile(sourcePath, targetPath)
        .then(onSuccess)
        .catch((response) => {
          console.warn(response.name + ': ' + response.message);
          onError(chrome.fileSystemProvider.ProviderError.FAILED);
        });
  }

  /**
   * Read File Requested handler. Reads the requested file and returns its data.
   *
   * @param {!Object} options
   * @param {function(!ArrayBuffer, boolean)} onSuccess
   * @param {function(!chrome.fileSystemProvider.ProviderError)} onError
   */
  onReadFileRequested(options, onSuccess, onError) {
    const sftp = this.mounts_.get(options.fileSystemId);
    if (sftp === undefined) {
      return;
    }

    const client = sftp.sftpClient;
    const fileHandle = client.openedFiles[options.openRequestId];
    if (!fileHandle) {
      onError(chrome.fileSystemProvider.ProviderError.INVALID_OPERATION);
      return;
    }

    client
        .readChunks(
            fileHandle,
            (chunk) => onSuccess(chunk, true),
            options.offset,
            options.length)
        .then(() => onSuccess(new ArrayBuffer(0), false))
        .catch((response) => {
          console.warn(response.name + ': ' + response.message);
          onError(chrome.fileSystemProvider.ProviderError.FAILED);
        });
  }

  /**
   * Copy Entry Requested handler. Copies the entry of the requested file path.
   * If the entry is a directory, copies all sub-entries recursively.
   *
   * @param {!Object} options
   * @param {function()} onSuccess
   * @param {function(!chrome.fileSystemProvider.ProviderError)} onError
   * @return {!Promise}
   */
  onCopyEntryRequested(options, onSuccess, onError) {
    const sftp = this.mounts_.get(options.fileSystemId);
    if (sftp === undefined) {
      return Promise.resolve();
    }

    const client = sftp.sftpClient;
    const sourcePath = '.' + options.sourcePath;  // relative path
    const targetPath = '.' + options.targetPath;  // relative path
    return client.linkStatus(sourcePath)
        .then((metadata) => {
          if (metadata.isLink) {
            return client.readLink(sourcePath).then((response) => {
              return client.symLink(response.files[0].filename, targetPath);
            });
          } else if (metadata.isDirectory) {
            return copyDirectory(sourcePath, targetPath, client);
          } else {
            return copyFile(
                sourcePath,
                targetPath,
                lib.notUndefined(metadata.size),
                client);
          }
        })
        .then(onSuccess)
        .catch((response) => {
          console.warn(response.name + ': ' + response.message);
          onError(chrome.fileSystemProvider.ProviderError.FAILED);
        });
  }

  /**
   * Mount Requested handler. Opens the Secure Shell main page which prompts the
   * user to mount a remote connection.
   *
   * Note: This is only called upon first installation of Secure Shell and when
   * the user clicks "Add New Service" from the File App.
   *
   * @param {function()} onSuccess
   * @param {function(!chrome.fileSystemProvider.ProviderError)} onError
   */
  onMountRequested(onSuccess, onError) {
    lib.f.openWindow('/html/nassh_connect_dialog.html');
    onSuccess();
  }

  /**
   * Unmount Requested handler. Closes the SFTP connection and removes the SFTP
   * Mount before unmounting the file system.
   *
   * @param {!Object} options
   * @param {function()} onSuccess
   * @param {function(!chrome.fileSystemProvider.ProviderError)} onError
   */
  onUnmountRequested(options, onSuccess, onError) {
    // We don't return immediately on errors.  If the caller is trying to
    // unmount us, then usually it means they think we're mounted even if we
    // don't think we are.  This can happen if the Secure Shell background page
    // is killed, but the Files app remembers all the connections.  Either way,
    // it's more robust for us to always unmount with the FSP layer.
    const sftp = this.mounts_.get(options.fileSystemId);
    if (sftp !== undefined) {
      sftp.exit(0, true);  // exit NaCl plugin
      this.mounts_.delete(options.fileSystemId);
    }

    if (globalThis.chrome?.fileSystemProvider) {
      chrome.fileSystemProvider.unmount(
          {fileSystemId: options.fileSystemId}, () => {
            const err = lib.f.lastError();
            if (err) {
              console.warn(err);
              onError(chrome.fileSystemProvider.ProviderError.FAILED);
            } else {
              onSuccess();
            }
          });
    }
  }

  /**
   * Configure Requested handler.
   *
   * Shows a dialog for the user to tweak connection settings on the fly.
   *
   * @param {!Object} options
   * @param {function()} onSuccess
   * @param {function(!chrome.fileSystemProvider.ProviderError)} onError
   */
  onConfigureRequested(options, onSuccess, onError) {
    if (!this.mounts_.has(options.fileSystemId)) {
      return;
    }

    lib.f.openWindow(
        `/html/nassh_sftp_fsp_config_dialog.html` +
            `?profile-id=${options.fileSystemId}`,
        '',
        'chrome=no,close=yes,resize=yes,scrollbars=yes,minimizable=yes,' +
            'width=600,height=400');
    onSuccess();
  }

  /**
   * Supported File System Provider API methods.
   *
   * @return {!Array<function()>}
   */
  providerMethods() {
    return [
      this.onGetMetadataRequested,
      this.onReadDirectoryRequested,
      this.onOpenFileRequested,
      this.onCloseFileRequested,
      this.onReadFileRequested,
      this.onMountRequested,
      this.onUnmountRequested,
      this.onMoveEntryRequested,
      this.onDeleteEntryRequested,
      this.onWriteFileRequested,
      this.onCreateFileRequested,
      this.onTruncateRequested,
      this.onCopyEntryRequested,
      this.onCreateDirectoryRequested,
      this.onConfigureRequested,
    ];
  }

  /**
   * Loop over the provider methods and link them to their handlers.
   */
  addListeners() {
    if (globalThis.chrome?.fileSystemProvider) {
      this.providerMethods().forEach((method) => {
        chrome.fileSystemProvider[method.name].addListener(method.bind(this));
      });
    }
  }
}
