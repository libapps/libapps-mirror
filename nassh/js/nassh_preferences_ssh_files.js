// Copyright 2020 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

'use strict';

/**
 * @fileoverview SSH file editing helper.
 */

/**
 * Container for all the dialog settings.
 */
nassh.SshFiles = {};

/**
 * A cached handle to the filesystem.
 */
nassh.SshFiles.filesystem = null;

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
    return lib.fs.readFile(nassh.SshFiles.filesystem.root, this.path)
      .then((contents) => this.element.value = contents)
      .catch(() => {});
  }

  /**
   * Save the file.
   *
   * @return {!Promise<void>} Promise that resolves when the save finishes.
   */
  save() {
    return lib.fs.overwriteFile(nassh.SshFiles.filesystem.root, this.path,
                                this.element.value);
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
    return lib.fs.readDirectory(nassh.SshFiles.filesystem.root, this.path)
      .then((contents) => contents.forEach((path) => this.addFile_(path)));
  }

  /**
   * Add a UI element for this path.
   *
   * @param {!Entry} path The filesystem path to work with.
   */
  addFile_(path) {
    const li = document.createElement('li');
    const id = `ssh-files-identities:${path.name}`;
    li.id = id;

    const button = document.createElement('button');
    button.textContent = '🗑';
    button.onclick = this.deleteFile_.bind(this, li, path.fullPath);

    const span = document.createElement('span');
    span.textContent = path.name;
    span.style.paddingLeft = '1em';
    span.style.paddingRight = '1em';

    li.appendChild(button);
    li.appendChild(span);
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
    lib.fs.removeFile(nassh.SshFiles.filesystem.root, path)
      .then(() => elementTree.remove());
  }
}

/**
 * Event when the window finishes loading.
 */
window.addEventListener('DOMContentLoaded', (event) => {
  // Load all the ~/.ssh files into the UI.
  nassh.getFileSystem().then((fs) => {
    nassh.SshFiles.filesystem = fs;
    nassh.SshFiles.knowHosts = new FileWatcher(
        'ssh-files-known-hosts', '/.ssh/known_hosts');
    nassh.SshFiles.sshConfig = new FileWatcher(
        'ssh-files-config', '/.ssh/config');
    nassh.SshFiles.identities = new DirWatcher(
        'ssh-files-identities', '/.ssh/identity/');
  });
});
