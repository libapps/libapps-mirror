// Copyright 2019 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

'use strict';

/**
 * @fileoverview HTML5 FileSystem related utility functions test suite.
 */

lib.fs.Tests = new lib.TestManager.Suite('lib.fs.Tests');

/**
 * Verify the various readAs helpers work.
 */
lib.fs.Tests.addTest('FileReader.readAs', function(result, cx) {
  const blob = new Blob(['ab12']);
  const reader = new lib.fs.FileReader();

  reader.readAsArrayBuffer(blob).then((abdata) => {
    result.assertEQ(new Uint8Array([97, 98, 49, 50]), new Uint8Array(abdata));

    reader.readAsBinaryString(blob).then((string) => {
      result.assertEQ('ab12', string);

      reader.readAsDataURL(blob).then((url) => {
        result.assertEQ('data:application/octet-stream;base64,YWIxMg==', url);

        reader.readAsText(blob).then((data) => {
          result.assertEQ('ab12', data);
          result.pass();
        });
      });
    });
  });

  result.requestTime(1000);
});

/**
 * Verify partial reads work as expected.
 */
lib.fs.Tests.addTest('FileReader.slices', function(result, cx) {
  const blob = new Blob(['ab12']);
  const reader = new lib.fs.FileReader();

  let slice = blob.slice(0, 0);
  reader.readAsText(slice).then((empty) => {
    result.assertEQ('', empty);

    slice = blob.slice(0, 2);
    reader.readAsText(slice).then((str1) => {
      result.assertEQ('ab', str1);

      slice = blob.slice(2, 3);
      reader.readAsText(slice).then((str2) => {
        result.assertEQ('1', str2);

        slice = blob.slice(3);
        reader.readAsText(slice).then((str3) => {
          result.assertEQ('2', str3);
          result.pass();
        });
      });
    });
  });

  result.requestTime(1000);
});
