// Copyright 2022 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview Test for <terminal-file-editor>
 * @suppress {moduleLoad}
 */

import {createFs} from './deps_indexeddb-fs.rollup.js';

import './terminal_file_editor.js';

  beforeEach(async function() {
    // The store name has 20 char limit.
    const fsId = `test-${Date.now() % 1e7}-${Math.floor(Math.random() * 1e7)}`;
    this.fileSystem = createFs({databaseName: fsId});
    await this.fileSystem.createDirectory('/fake');
    await this.fileSystem.writeFile('/fake/path', 'hello world');

    this.el = document.createElement('terminal-file-editor');
    this.el.fileSystemPromise = Promise.resolve(this.fileSystem);
    this.el.setAttribute('path', '/fake/path');

    document.body.appendChild(this.el);
    await this.el.updateComplete;
  });

  afterEach(function() {
    document.body.removeChild(this.el);
  });

  it('default empty', function() {
    // This is to make sure that there is nothing between the open and close tag
    // of <textarea>. Otherwise, they become the default value.
    assert.equal(this.el.textareaRef_.value.value, '');
  });

  it('loads from fs', async function() {
    this.el.load();
    await new Promise((resolve) => setTimeout(resolve));
    assert.deepEqual(await this.fileSystem.readFile('/fake/path'),
                     'hello world');
    assert.equal(this.el.textareaRef_.value.value, 'hello world');
  });

  it('save to fs on change event', async function() {
    this.el.textareaRef_.value.value = 'hello world again';
    this.el.textareaRef_.value.dispatchEvent(new Event('change'));

    let data;
    while (true) {
      data = await this.fileSystem.readFile('/fake/path');
      if (data !== 'hello world') {
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    assert.deepEqual(data, 'hello world again');
  });
