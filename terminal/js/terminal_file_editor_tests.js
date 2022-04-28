// Copyright 2022 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview Test for <terminal-file-editor>
 */

import './terminal_file_editor.js';
import {MockObject} from './terminal_test_mocks.js';

describe('terminal_file_editor.js', () => {
  beforeEach(async function() {

    this.el = document.createElement('terminal-file-editor');
    this.el.fileSystemPromise = Promise.resolve({root: '/fake/root'});
    this.el.setAttribute('path', '/fake/path');

    this.libFsMock = new MockObject({
      readFile: (...args) => {
        this.libFsMock.methodCalled('readFile', ...args);
        return Promise.resolve('hello world');
      },
    });
    this.el.libFs_ = this.libFsMock.proxy;

    document.body.appendChild(this.el);
    await this.el.updateComplete;
  });

  it('default empty', function() {
    // This is to make sure that there is nothing between the open and close tag
    // of <textarea>. Otherwise, they become the default value.
    assert.equal(this.el.textareaRef_.value.value, '');
  });

  it('loads from fs', async function() {
    this.el.load();
    await new Promise((resolve) => setTimeout(resolve));
    assert.deepEqual(this.libFsMock.getMethodHistory('readFile'),
        [['/fake/root', '/fake/path']]);
    assert.equal(this.el.textareaRef_.value.value, 'hello world');
    assert.deepEqual(this.libFsMock.getMethodHistory('overwriteFile'), []);
  });

  it('save to fs on change event', async function() {
    this.el.textareaRef_.value.value = 'hello world again';
    this.el.textareaRef_.value.dispatchEvent(new Event('change'));
    await new Promise((resolve) => setTimeout(resolve));
    assert.deepEqual(this.libFsMock.getMethodHistory('overwriteFile'),
        [['/fake/root', '/fake/path', 'hello world again']]);
    assert.deepEqual(this.libFsMock.getMethodHistory('readFile'), []);
  });
});
