// Copyright 2022 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview Core FS code and related utility logic.
 *
 * @suppress {moduleLoad}
 */

import {createFs} from './deps_indexeddb-fs.rollup.js';

/**
 * Request the persistent indexeddb-fs for this extension.
 *
 * @return {!Promise<!IndexeddbFs>} The filesystem handle.
 */
export async function getIndexeddbFileSystem() {
  return createFs({objectStoreName: 'nassh-rootfs'});
}

/**
 * Import identity files to the file system.
 *
 * @param {!IndexeddbFs} fileSystem The file system to import the files.
 * @param {!FileList} files The identity files.
 * @return {!Promise<void>}
 */
export async function importIdentityFiles(fileSystem, files) {
  for (let i = 0; i < files.length; ++i) {
    const file = files[i];

    // Skip pub key halves as we don't need/use them.
    // Except ssh has a naming convention for certificate files.
    if (file.name.endsWith('.pub') && !file.name.endsWith('-cert.pub')) {
      continue;
    }

    const targetPath = `/.ssh/identity/${file.name}`;
    const blob = new Blob([file], {type: 'text/plain'});
    const contents = await blob.arrayBuffer();
    await fileSystem.writeFile(targetPath, contents);
  }
}

/**
 * Get the names of identity files in the file system, which are suitable for
 * passing to ssh's -i option.
 *
 * @param {!IndexeddbFs} fileSystem The file system to get the identity files.
 * @return {!Promise<!Array<string>>} The names of identity files.
 */
export async function getIdentityFileNames(fileSystem) {
  const identityDir = '/.ssh/identity';
  // Make sure the directory exists.  This makes reading empty dirs easier.
  await fileSystem.createDirectory('/.ssh');
  await fileSystem.createDirectory(identityDir);
  const entries = await fileSystem.readDirectory(identityDir);
  return entries.files.filter((entry) => {
    return entry.type === 'file' && !entry.name.endsWith('-cert.pub');
  }).map((entry) => entry.name);
}

/**
 * Delete identity files.
 *
 * @param {!IndexeddbFs} fileSystem The file system to delete the identity
 *     files.
 * @param {string} identityName The name (not path) of the identity file.
 * @return {!Promise<void>}
 */
export async function deleteIdentityFiles(fileSystem, identityName) {
  await Promise.all([
    `/.ssh/identity/${identityName}`,
    `/.ssh/identity/${identityName}.pub`,
    `/.ssh/identity/${identityName}-cert.pub`,
  ].map(async (file) => {
    // We swallow the rejection because we try to delete paths that are
    // often not there (e.g. missing .pub file).
    try {
      await fileSystem.removeFile(file);
    } catch (e) { /**/ }
  }));
}
