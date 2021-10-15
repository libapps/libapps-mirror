// Copyright 2021 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview Unit tests for tmux.js.
 */

import {LayoutType, parseWindowLayout} from './tmux.js';

// TODO(crbug.com/1252271): add all the missing tests.

const parseWindowLayoutTestData = [{
  str: '190x79,0,0,9',
  layout: {
    xSize: 190,
    ySize: 79,
    xOffset: 0,
    yOffset: 0,
    paneId: '%9',
  },
}, {
  // Complex layouts with multi-level of splits.
  str: '190x79,0,0{95x79,0,0[95x39,0,0,0,95x39,0,40,8],47x79,96,0,2,' +
    '46x79,144,0[46x39,144,0,3,46x39,144,40,4]}',
  layout: {
    xSize: 190,
    ySize: 79,
    xOffset: 0,
    yOffset: 0,
    childrenLayout: LayoutType.LEFT_RIGHT,
    children: [{
      xSize: 95,
      ySize: 79,
      xOffset: 0,
      yOffset: 0,
      childrenLayout: LayoutType.TOP_BOTTOM,
      children: [{
        xSize: 95,
        ySize: 39,
        xOffset: 0,
        yOffset: 0,
        paneId: '%0',
      }, {
        xSize: 95,
        ySize: 39,
        xOffset: 0,
        yOffset: 40,
        paneId: '%8',
      }],
    }, {
      xSize: 47,
      ySize: 79,
      xOffset: 96,
      yOffset: 0,
      paneId: '%2',
    }, {
      xSize: 46,
      ySize: 79,
      xOffset: 144,
      yOffset: 0,
      childrenLayout: LayoutType.TOP_BOTTOM,
      children: [{
        xSize: 46,
        ySize: 39,
        xOffset: 144,
        yOffset: 0,
        paneId: '%3',
      }, {
        xSize: 46,
        ySize: 39,
        xOffset: 144,
        yOffset: 40,
        paneId: '%4',
      }],
    }],
  },
}];


describe('tmux.js', () => {
  parseWindowLayoutTestData.forEach(({str, layout}, i) => it(
      `parseWindowLayout${i}`,
      async function() {
        assert.deepEqual(parseWindowLayout(str), layout,
            `failed parsing ${str}`);
      },
  ));
});
