// Copyright 2022 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview Core FS code and related utility logic.
 */

/**
 * Request the persistent HTML5 filesystem for this extension.
 *
 * This will also create the /.ssh/ directory if it does not exist.
 *
 * @return {!Promise<!FileSystem>} The root filesystem handle.
 */
export function getFileSystem() {
  const requestFS = window.requestFileSystem || window.webkitRequestFileSystem;

  return new Promise((resolve, reject) => {
    function onFileSystem(fileSystem) {
      // We create /.ssh/identity/ subdir for storing keys.  We need a dedicated
      // subdir for users to import files to avoid collisions with standard ssh
      // config files.
      lib.fs.getOrCreateDirectory(fileSystem.root, '/.ssh/identity')
        .then(() => resolve(fileSystem))
        .catch(reject);
    }

    requestFS(window.PERSISTENT,
              16 * 1024 * 1024,
              onFileSystem,
              (e) => {
                console.error(`Error initializing filesystem: ${e}`);
                reject(e);
              });
  });
}

/**
 * Import identity files to the file system.
 *
 * @param {!FileSystem} fileSystem The file system to import the files.
 * @param {!FileList} files The identity files.
 * @return {!Promise<void>}
 */
export async function importIdentityFiles(fileSystem, files) {
  const promises = [];
  for (let i = 0; i < files.length; ++i) {
    const file = files[i];

    // Skip pub key halves as we don't need/use them.
    // Except ssh has a naming convention for certificate files.
    if (file.name.endsWith('.pub') && !file.name.endsWith('-cert.pub')) {
      continue;
    }

    const targetPath = `/.ssh/identity/${file.name}`;
    promises.push(lib.fs.overwriteFile(
        fileSystem.root, targetPath, file));
  }

  await Promise.all(promises);
}

/**
 * Get the names of identity files in the file system, which are suitable for
 * passing to ssh's -i option.
 *
 * @param {!FileSystem} fileSystem The file system to get the identity files.
 * @return {!Promise<!Array<string>>} The names of identity files.
 */
export async function getIdentityFileNames(fileSystem) {
  return (await lib.fs.readDirectory(fileSystem.root, '/.ssh/identity/'))
      .filter((entry) => entry.isFile && !entry.name.endsWith('-cert.pub'))
      .map((entry) => entry.name);
}

/**
 * Delete identity files.
 *
 * @param {!FileSystem} fileSystem The file system to delete the identity files.
 * @param {string} identityName The name (not path) of the identity file.
 * @return {!Promise<void>}
 */
export async function deleteIdentityFiles(fileSystem, identityName) {
  await Promise.all([
    `/.ssh/identity/${identityName}`,
    `/.ssh/identity/${identityName}.pub`,
    `/.ssh/identity/${identityName}-cert.pub`,
  ].map((file) => {
    // We swallow the rejection because we try to delete paths that are
    // often not there (e.g. missing .pub file).
    return lib.fs.removeFile(fileSystem.root, file).catch(() => {});
  }));
}
