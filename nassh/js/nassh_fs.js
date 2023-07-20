// Copyright 2022 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview Core FS code and related utility logic.
 *
 * @suppress {moduleLoad}
 */

import {createFs} from './deps_indexeddb-fs.rollup.js';

import {
  getOrCreateDirectory, overwriteFile, readDirectory, readFile,
} from './lib_fs.js';

/**
 * Request the persistent HTML5 filesystem for this extension.
 *
 * This will also create the /.ssh/ directory if it does not exist.
 *
 * @return {!Promise<!FileSystem|undefined>} The root filesystem handle.
 */
export async function getDomFileSystem() {
  const requestFS =
      globalThis.requestFileSystem || globalThis.webkitRequestFileSystem;
  const size = 16 * 1024 * 1024;

  if (!requestFS) {
    console.warn('requestFileSystem API does not exist');
    return Promise.resolve(undefined);
  }

  const quotaInfo = await new Promise((resolve, reject) => {
    navigator.webkitPersistentStorage.queryUsageAndQuota(
        (usage, quota) => resolve({usage, quota}), reject);
  });

  // Requests quota only when needed.
  if (quotaInfo.quota === 0) {
    await new Promise((resolve, reject) => {
      navigator.webkitPersistentStorage.requestQuota(size, resolve, reject);
    });
  }

  return new Promise((resolve, reject) => {
    function onFileSystem(fileSystem) {
      // We create /.ssh/identity/ subdir for storing keys.  We need a dedicated
      // subdir for users to import files to avoid collisions with standard ssh
      // config files.
      getOrCreateDirectory(fileSystem.root, '/.ssh/identity')
        .then(() => resolve(fileSystem))
        .catch(reject);
    }

    requestFS(globalThis.PERSISTENT,
              size,
              onFileSystem,
              (e) => {
                console.error(`Error initializing filesystem: ${e}`);
                reject(e);
              });
  });
}

/**
 * Request the persistent indexeddb-fs for this extension.
 *
 * @return {!Promise<!IndexeddbFs>} The filesystem handle.
 */
export async function getIndexeddbFileSystem() {
  return createFs({objectStoreName: 'nassh-rootfs'});
}

/**
 * Migrate files from the old DOM FS to the new indexeddb-fs.
 *
 * We should only have files under /.ssh.  Don't bother migrating anything else.
 *
 * @param {!FileSystem=} domfs The old DOM file system to import from.
 * @param {!IndexeddbFs=} fs The new indexeddb-fs filesystem to export to.
 * @return {!Promise<void>} Returns on completion.
 */
export async function migrateFilesystemFromDomToIndexeddb(
    domfs = undefined, fs = undefined) {
  const migrateFile = async (file) => {
    const data = await readFile(domfs.root, file);
    return fs.writeFile(file, data);
  };

  const migrateDir = async (basedir) => {
    console.log(`fs: Migrating ${basedir} from DOM to indexeddb-fs`);
    await fs.createDirectory(basedir);

    const paths = await readDirectory(domfs.root, basedir);
    for (const path of paths) {
      if (path.isFile) {
        await migrateFile(path.fullPath);
      } else {
        await migrateDir(path.fullPath);
      }
    }
  };

  if (!fs) {
    fs = await getIndexeddbFileSystem();
  }
  if (!domfs) {
    domfs = await getDomFileSystem();
    if (!domfs) {
      return;
    }
  }

  // If we already migrated, don't do it again.  If the path doesn't exist, the
  // API throws an exception instead of returning false.
  try {
    if (await fs.isDirectory('/.ssh')) {
      return;
    }
  } catch (e) { /**/ }

  return migrateDir('/.ssh');
}

/**
 * Manually sync indexeddb-fs state to DOM filesystem.
 *
 * Keep this until the NaCl plugin is removed.  JS & WASM only use indexeddb-fs,
 * but NaCl reads the DOM filesystem directly.
 *
 * @param {!IndexeddbFs=} fs The new indexeddb-fs filesystem to export to.
 * @param {!FileSystem=} domfs The old DOM file system to import from.
 * @return {!Promise<void>} Returns on completion.
 */
export async function syncFilesystemFromIndexeddbToDom(
    fs = undefined, domfs = undefined) {
  const syncFile = async (file) => {
    const data = await fs.readFile(file);
    return overwriteFile(domfs.root, file, data);
  };

  const syncDir = async (basedir) => {
    console.log(`fs: Migrating ${basedir} from indexeddb-fs to DOM`);
    return fs.readDirectory(basedir).then(async (entries) => {
      for (const file of entries.files) {
        await syncFile(`${basedir}/${file.name}`);
      }
      for (const dir of entries.directories) {
        await syncDir(`${basedir}/${dir.name}`);
      }
    });
  };

  if (!fs) {
    fs = await getIndexeddbFileSystem();
  }
  if (!domfs) {
    domfs = await getDomFileSystem();
    if (!domfs) {
      return;
    }
  }
  return syncDir('/.ssh');
}

/**
 * Sync a little DOM state to indexeddb-fs.
 *
 * Keep this until the NaCl plugin is removed.  JS & WASM only use indexeddb-fs,
 * but NaCl wries the DOM filesystem directly.
 *
 * @param {!FileSystem=} domfs The old DOM file system to import from.
 * @param {!IndexeddbFs=} fs The new indexeddb-fs filesystem to export to.
 * @return {!Promise<void>} Returns on completion.
 */
export async function syncFilesystemFromDomToIndexeddb(
    domfs = undefined, fs = undefined) {
  if (!fs) {
    fs = await getIndexeddbFileSystem();
  }
  if (!domfs) {
    domfs = await getDomFileSystem();
    if (!domfs) {
      return;
    }
  }

  // NaCl doesn't seem to write to that much.
  const file = '/.ssh/known_hosts';
  const data = await readFile(domfs.root, file);
  await fs.writeFile(file, data);
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
