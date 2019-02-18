// Copyright 2019 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

'use strict';

/**
 * @fileoverview HTML5 FileSystem related utility functions test suite.
 */

describe('lib_fs_tests.js', () => {

/**
 * Verify the various readAs helpers work.
 */
describe('FileReader.readAs', () => {
  const blob = new Blob(['ab12']);
  const reader = new lib.fs.FileReader();

  it('readAsArrayBuffer', () => {
    return reader.readAsArrayBuffer(blob).then((abdata) => {
      assert.deepStrictEqual(new Uint8Array([97, 98, 49, 50]),
                             new Uint8Array(abdata));
    });
  });

  it('readAsBinaryString', () => {
    return reader.readAsBinaryString(blob).then((string) => {
      assert.equal('ab12', string);
    });
  });

  it('readAsDataURL', () => {
    return reader.readAsDataURL(blob).then((url) => {
      assert.equal('data:application/octet-stream;base64,YWIxMg==', url);
    });
  });

  it('readAsText', () => {
    return reader.readAsText(blob).then((data) => {
      assert.equal('ab12', data);
    });
  });
});

/**
 * Verify partial reads work as expected.
 */
describe('FileReader.slices', () => {
  const blob = new Blob(['ab12']);
  const reader = new lib.fs.FileReader();

  it('0,0', () => {
    const slice = blob.slice(0, 0);
    return reader.readAsText(slice).then((str) => {
      assert.equal('', str);
    });
  });

  it('0,2', () => {
    const slice = blob.slice(0, 2);
    return reader.readAsText(slice).then((str) => {
      assert.equal('ab', str);
    });
  });

  it('2,3', () => {
    const slice = blob.slice(2, 3);
    return reader.readAsText(slice).then((str) => {
      assert.equal('1', str);
    });
  });

  it('3', () => {
    const slice = blob.slice(3);
    return reader.readAsText(slice).then((str) => {
      assert.equal('2', str);
    });
  });
});

});
