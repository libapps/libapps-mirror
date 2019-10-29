// Copyright 2017 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

'use strict';

/**
 * @fileoverview Colors test suite.
 *
 * Verify color parsing logic.
 */

describe('lib_color_tests.js', () => {

it('rgbToX11', () => {
  var data = [
    // Some bad data first.
    ['', null],
    ['foo', null],
    ['rgb()', null],
    ['rgb(1,2,hi)', null],
    // Then some reasonable data.
    ['rgb(1,2,3)',         'rgb:0101/0202/0303'],
    [' rgb ( 1 , 2 , 3 )', 'rgb:0101/0202/0303'],
    ['rgb (50, 100, 200)', 'rgb:3232/6464/c8c8'],
    ['rgb(0, 0, 0)',       'rgb:0000/0000/0000'],
    ['rgb(255, 0, 0)',     'rgb:ffff/0000/0000'],
    ['rgb(255, 255, 255)', 'rgb:ffff/ffff/ffff'],
  ];

  data.forEach((ele) => {
    assert.strictEqual(lib.colors.rgbToX11(ele[0]), ele[1], ele[0]);
  });
});

it('x11HexToCSS', () => {
  var data = [
    // Some bad data first.
    ['', null],
    ['foo', null],
    ['#', null],
    ['#12', null],
    // Then some reasonable data.
    ['#123', 'rgba(16, 32, 48, 1)'],
    ['#010203', 'rgba(1, 2, 3, 1)'],
    ['#001002003', 'rgba(0, 0, 0, 1)'],
    ['#000100020003', 'rgba(0, 0, 0, 1)'],
    ['#123456', 'rgba(18, 52, 86, 1)'],
    ['#123456789', 'rgba(18, 69, 120, 1)'],
    ['#123456789abc', 'rgba(18, 86, 154, 1)'],
  ];

  data.forEach((ele) => {
    assert.strictEqual(lib.colors.x11HexToCSS(ele[0]), ele[1], ele[0]);
  });
});

it('x11ToCSS', () => {
  var data = [
    // Some bad data first.
    ['', null],
    ['foo', null],
    // Then some reasonable data.
    ['black',              'rgb(0, 0, 0)'],
    ['rgb:0/0/0',          'rgba(0, 0, 0, 1)'],
    ['rgb:00/00/00',       'rgba(0, 0, 0, 1)'],
    ['rgb:000/000/000',    'rgba(0, 0, 0, 1)'],
    ['rgb:0000/0000/0000', 'rgba(0, 0, 0, 1)'],
    ['rgb:0/000/00',       'rgba(0, 0, 0, 1)'],
    ['rgb:1/1/1',          'rgba(17, 17, 17, 1)'],
    ['rgb:02/02/02',       'rgba(2, 2, 2, 1)'],
    ['rgb:003/003/003',    'rgba(0, 0, 0, 1)'],
    ['rgb:0004/0004/0004', 'rgba(0, 0, 0, 1)'],
    ['rgb:20/20/20',       'rgba(32, 32, 32, 1)'],
    ['rgb:300/300/300',    'rgba(48, 48, 48, 1)'],
    ['rgb:4000/4000/4000', 'rgba(64, 64, 64, 1)'],
    ['rgb:2/02/020',       'rgba(34, 2, 2, 1)'],
    ['rgb:2222/2020/0202', 'rgba(34, 32, 2, 1)'],
    // Only nominally test hex formats as x11HexToCSS above covers more.
    ['#000', 'rgba(0, 0, 0, 1)'],
  ];

  data.forEach((ele) => {
    assert.deepStrictEqual(lib.colors.x11ToCSS(ele[0]), ele[1], ele[0]);
  });
});

it('hexToRGB', () => {
  var data = [
    // Some bad data first.
    ['', null],
    ['foo', null],
    ['#hi', null],
    ['#', null],
    ['#0', null],
    ['#00', null],
    [' #345', null],
    // Then some reasonable data.
    ['#000',    'rgb(0, 0, 0)'],
    ['#abc',    'rgb(170, 187, 204)'],
    ['#abcc',   'rgba(170, 187, 204, 0.8)'],
    ['#a0b0c0', 'rgb(160, 176, 192)'],
    ['#fFfFFf', 'rgb(255, 255, 255)'],
    ['#a0b0c000', 'rgba(160, 176, 192, 0)'],
    ['#a0b0c0cc', 'rgba(160, 176, 192, 0.8)'],
    ['#a0b0c0Ff', 'rgb(160, 176, 192)'],
  ];

  data.forEach((ele) => {
    assert.strictEqual(lib.colors.hexToRGB(ele[0]), ele[1], ele[0]);
  });
});

it('rgbToHex', () => {
  var data = [
    // Some bad data first.
    ['', null],
    ['foo', null],
    // Then some reasonable data.
    ['rgb(0,0,0)', '#000000'],
    ['rgb(10, 100, 255)', '#0a64ff'],
    ['rgba(10, 100, 255, 0)', '#0a64ff00'],
    ['rgba(10, 100, 255, 0.799)', '#0a64ffcc'],
    ['rgba(10, 100, 255, 0.8)', '#0a64ffcc'],
    ['rgba(10, 100, 255, 1)', '#0a64ff'],
  ];

  data.forEach((ele) => {
    assert.deepStrictEqual(lib.colors.rgbToHex(ele[0]), ele[1], ele[0]);
  });
});

it('normalizeCSS', () => {
  var data = [
    // Some bad data first.
    ['', null],
    ['blah', null],
    // Then some reasonable data.
    ['#ADE', 'rgb(170, 221, 238)'],
    ['#a1d2e3', 'rgb(161, 210, 227)'],
    ['white', 'rgb(255, 255, 255)'],
    ['rgb(1,2,3)', 'rgb(1,2,3)'],
    ['rgba(1,2,3, 0)', 'rgba(1,2,3, 0)'],
    ['rgb(255, 100, 0)', 'rgb(255, 100, 0)'],
  ];

  data.forEach((ele) => {
    assert.strictEqual(lib.colors.normalizeCSS(ele[0]), ele[1], ele[0]);
  });
});

it('arrayToRGBA', () => {
  var data = [
    [[1, 2, 3], 'rgba(1, 2, 3, 1)'],
    [[10, 200, 3, 0], 'rgba(10, 200, 3, 0)'],
    [['0', '30', '50', '1'], 'rgba(0, 30, 50, 1)'],
  ];

  data.forEach((ele) => {
    assert.strictEqual(lib.colors.arrayToRGBA(ele[0]), ele[1], ele[0]);
  });
});

it('setAlpha', () => {
  var data = [
    [['rgb(2,3,4)', 0], 'rgba(2, 3, 4, 0)'],
    [['rgb(2,3,4)', 1], 'rgba(2, 3, 4, 1)'],
    [['rgba(2,3,4, 0)', 0], 'rgba(2, 3, 4, 0)'],
    [['rgba(2,3,4, 0)', 1], 'rgba(2, 3, 4, 1)'],
    [['rgba(2, 3, 4, 1)', 0], 'rgba(2, 3, 4, 0)'],
    [['rgba(2, 3, 4, 1)', 1], 'rgba(2, 3, 4, 1)'],
  ];

  data.forEach((ele) => {
    assert.strictEqual(lib.colors.setAlpha.apply(null, ele[0]), ele[1], ele[0]);
  });
});

it('crackRGB', () => {
  var data = [
    // Some bad data first.
    ['', null],
    ['blah', null],
    ['rgb(1, 2)', null],
    // Then some reasonable data.
    ['rgb(1,2,3)', ['1', '2', '3', '1']],
    ['rgba(0, 255, 10, 0)', ['0', '255', '10', '0']],
  ];

  data.forEach((ele) => {
    assert.deepStrictEqual(lib.colors.crackRGB(ele[0]), ele[1], ele[0]);
  });
});

it('nameToRGB', () => {
  var data = [
    // Some bad data first.
    ['', null],
    ['unknown!', null],
    // Then some reasonable data.
    ['white', 'rgb(255, 255, 255)'],
    ['  black', 'rgb(0, 0, 0)'],
    ['black  ', 'rgb(0, 0, 0)'],
    ['wHITe', 'rgb(255, 255, 255)'],
    ['WHITE', 'rgb(255, 255, 255)'],
  ];

  data.forEach((ele) => {
    assert.strictEqual(lib.colors.nameToRGB(ele[0]), ele[1], ele[0]);
  });
});

});
