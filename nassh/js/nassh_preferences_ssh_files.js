// Copyright 2020 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview SSH file editing helper.
 */

import {lib} from '../../libdot/index.js';

import {getSyncStorage} from './nassh.js';
import {getIndexeddbFileSystem} from './nassh_fs.js';

/**
 * A cached handle to the filesystem.
 *
 * @type {?IndexeddbFs}
 */
let filesystem = null;

/**
 * Utility class to bind a file to some basic UI tools.
 */
class FileWatcher {
  /**
   * @param {string} id The HTML id used to find UI elements.
   * @param {string} path The filesystem path to work with.
   */
  constructor(id, path) {
    this.element = document.getElementById(id);
    this.path = path;
    this.bindUi_(id);
    this.load();
  }

  /**
   * Bind this class to the UI elements.
   *
   * @param {string} id The HTML id used to find UI elements.
   */
  bindUi_(id) {
    const clear = document.getElementById(`${id}-clear`);
    if (clear) {
      clear.onclick = this.clear.bind(this);
    }

    const save = document.getElementById(`${id}-save`);
    save.onclick = this.save.bind(this);

    this.element.onkeyup = this.keyup.bind(this);
  }

  /**
   * Load the file.
   *
   * @return {!Promise<void>} Promise that resolves when the load finishes.
   */
  load() {
    return filesystem.readFile(this.path)
      .then((contents) => this.element.value = contents)
      .catch(() => {});
  }

  /**
   * Save the file.
   *
   * @return {!Promise<void>} Promise that resolves when the save finishes.
   */
  save() {
    return filesystem.writeFile(this.path, this.element.value).then(() => {});
  }

  /**
   * Clear the UI.
   */
  clear() {
    this.element.value = '';
  }

  /**
   * Handle keypresses in the UI.
   *
   * @param {?Event} e The keyboard event.
   */
  keyup(e) {
    switch (e.key) {
      // Escape should discard changes & reload content.
      case 'Escape':
        this.load();
        break;

      // Ctrl+Enter saves changes.
      case 'Enter':
        if (e.ctrlKey) {
          this.save();
        }
        break;
    }
  }
}

/**
 * Utility class to bind a directory to some basic UI tools.
 */
class DirWatcher {
  /**
   * @param {string} id The HTML id used to find UI elements.
   * @param {string} path The filesystem path to work with.
   */
  constructor(id, path) {
    this.element = document.getElementById(id);
    this.path = path;
    this.load();
  }

  /**
   * Load the file.
   *
   * @return {!Promise<void>} Promise that resolves when the load finishes.
   */
  load() {
    return filesystem.readDirectory(this.path).then((entries) => {
      entries.files.forEach((file) => this.addFile_(file));
    });
  }

  /**
   * Add a UI element for this path.
   *
   * @param {!IndexeddbFsFileEntry} path The filesystem path to work with.
   */
  addFile_(path) {
    const li = document.createElement('li');
    const id = `ssh-files-identities:${path.name}`;
    li.id = id;

    const button = document.createElement('button');
    button.textContent = '🗑';
    button.onclick = this.deleteFile_.bind(this, li, path.fullPath);

    const a = document.createElement('a');
    a.download = path.name;
    a.textContent = path.name;
    filesystem.readFile(path.fullPath).then((data) => {
      const blob = new Blob([data], {type: 'text/plain'});
      a.href = URL.createObjectURL(blob);
    });
    a.style.paddingLeft = '1em';
    a.style.paddingRight = '1em';

    li.appendChild(button);
    li.appendChild(a);
    this.element.appendChild(li);
  }

  /**
   * Delete a path.
   *
   * @param {!Element} elementTree The elements associated with this path.
   * @param {string} path The file to delete.
   */
  deleteFile_(elementTree, path) {
    // Delete the file, and then remove the UI element.
    filesystem.removeFile(path).then(() => elementTree.remove());
  }
}

/**
 * Utility class to bind a directory to some basic UI tools.
 */
class StorageFileWatcher {
  /**
   * @param {string} id The HTML id used to find UI elements.
   * @param {!lib.Storage} storage The backing storage for file content.
   * @param {string} key The storage item name.
   */
  constructor(id, storage, key) {
    this.element = document.getElementById(id);
    this.storage = storage;
    this.key = key;
    this.bindUi_(id);
    this.load();
  }

  /**
   * Bind this class to the UI elements.
   *
   * @param {string} id The HTML id used to find UI elements.
   */
  bindUi_(id) {
    const save = document.getElementById(`${id}-save`);
    save.onclick = this.save.bind(this);

    this.element.onkeyup = this.keyup.bind(this);
  }

  /**
   * Load the file.
   *
   * @return {!Promise<void>} Promise that resolves when the load finishes.
   */
  async load() {
    const data = await this.storage.getItem(this.key) ?? '';
    this.element.value = data;
  }

  /**
   * Save the file.
   *
   * @return {!Promise<void>} Promise that resolves when the save finishes.
   */
  async save() {
    if (this.element.value.length === 0) {
      await this.storage.removeItem(this.key);
    } else {
      await this.storage.setItem(this.key, this.element.value);
    }
  }

  /**
   * Handle keypresses in the UI.
   *
   * @param {?Event} e The keyboard event.
   */
  keyup(e) {
    switch (e.key) {
      // Escape should discard changes & reload content.
      case 'Escape':
        this.load();
        break;

      // Ctrl+Enter saves changes.
      case 'Enter':
        if (e.ctrlKey) {
          this.save();
        }
        break;
    }
  }
}

/**
 * Name to help with debugging in the terminal.
 */
const watched = {};

/**
 * Event when the window finishes loading.
 */
globalThis.addEventListener('DOMContentLoaded', async (event) => {
  const storage = await getSyncStorage();
  watched.etcSshConfig = new StorageFileWatcher(
      'ssh-files-etc-ssh-config', storage, '/nassh/etc/ssh/ssh_config');
  watched.etcSshKnownHosts = new StorageFileWatcher(
      'ssh-files-etc-ssh-known-hosts', storage,
      '/nassh/etc/ssh/ssh_known_hosts');

  // Load all the ~/.ssh files into the UI.
  getIndexeddbFileSystem().then((fs) => {
    filesystem = fs;
    watched.knownHosts = new FileWatcher(
        'ssh-files-known-hosts', '/.ssh/known_hosts');
    watched.sshConfig = new FileWatcher(
        'ssh-files-config', '/.ssh/config');
    watched.identities = new DirWatcher(
        'ssh-files-identities', '/.ssh/identity');
  });
});
