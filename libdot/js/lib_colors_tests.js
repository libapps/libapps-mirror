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
    ['#123', 'rgb(16, 32, 48)'],
    ['#010203', 'rgb(1, 2, 3)'],
    ['#001002003', 'rgb(0, 0, 0)'],
    ['#000100020003', 'rgb(0, 0, 0)'],
    ['#123456', 'rgb(18, 52, 86)'],
    ['#123456789', 'rgb(18, 69, 120)'],
    ['#123456789abc', 'rgb(18, 86, 154)'],
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
    ['rgb:0/0/0',          'rgb(0, 0, 0)'],
    ['rgb:00/00/00',       'rgb(0, 0, 0)'],
    ['rgb:000/000/000',    'rgb(0, 0, 0)'],
    ['rgb:0000/0000/0000', 'rgb(0, 0, 0)'],
    ['rgb:0/000/00',       'rgb(0, 0, 0)'],
    ['rgb:1/1/1',          'rgb(17, 17, 17)'],
    ['rgb:02/02/02',       'rgb(2, 2, 2)'],
    ['rgb:003/003/003',    'rgb(0, 0, 0)'],
    ['rgb:0004/0004/0004', 'rgb(0, 0, 0)'],
    ['rgb:20/20/20',       'rgb(32, 32, 32)'],
    ['rgb:300/300/300',    'rgb(48, 48, 48)'],
    ['rgb:4000/4000/4000', 'rgb(64, 64, 64)'],
    ['rgb:2/02/020',       'rgb(34, 2, 2)'],
    ['rgb:2222/2020/0202', 'rgb(34, 32, 2)'],
    // Only nominally test hex formats as x11HexToCSS above covers more.
    ['#000', 'rgb(0, 0, 0)'],
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
    ['hsl(24, 100%, 70%)', 'rgb(255, 163, 102)'],
    ['hsla(24, 100%, 70%, 0.5)', 'rgba(255, 163, 102, 0.5)'],
  ];

  data.forEach((ele) => {
    assert.strictEqual(lib.colors.normalizeCSS(ele[0]), ele[1], ele[0]);
  });
});

it('normalizeCSSToHSL', () => {
  const data = [
    // Some bad data first.
    ['', null],
    ['blah', null],
    // Then some reasonable data.
    ['#ADE', 'hsl(195, 67%, 80%)'],
    ['#a1d2e3', 'hsl(195, 54%, 76%)'],
    ['white', 'hsl(0, 0%, 100%)'],
    ['rgb(1,2,3)', 'hsl(210, 50%, 1%)'],
    ['rgba(1,2,3, 0.5)', 'hsla(210, 50%, 1%, 0.5)'],
    ['rgb(255, 100, 0)', 'hsl(24, 100%, 50%)'],
    ['hsl(24, 100%, 70%)', 'hsl(24, 100%, 70%)'],
    ['hsl(24, 100%, 70%, 0.5)', 'hsl(24, 100%, 70%, 0.5)'],
  ];

  data.forEach((ele) => {
    assert.strictEqual(lib.colors.normalizeCSSToHSL(ele[0]), ele[1], ele[0]);
  });
});

it('arrayToRGBA', () => {
  var data = [
    [[1, 2, 3], 'rgb(1, 2, 3)'],
    [[10, 200, 3, 0], 'rgba(10, 200, 3, 0)'],
    [['0', '30', '50', '1'], 'rgba(0, 30, 50, 1)'],
  ];

  data.forEach((ele) => {
    assert.strictEqual(lib.colors.arrayToRGBA(ele[0]), ele[1], ele[0]);
  });
});

it('arrayToHSLA', () => {
  const data = [
    [[1, 2, 3], 'hsla(1, 2%, 3%, 1)'],
    [[10, 200, 3, 0], 'hsla(10, 200%, 3%, 0)'],
    [['0', '30', '50', '1'], 'hsla(0, 30%, 50%, 1)'],
  ];

  data.forEach((ele) => {
    assert.strictEqual(lib.colors.arrayToHSLA(ele[0]), ele[1], ele[0]);
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

it('crackHSL', () => {
  var data = [
    // Some bad data first.
    ['', null],
    ['blah', null],
    ['hsl(1, 2)', null],
    // Then some reasonable data.
    ['hsl(1,2%,3%)', ['1', '2', '3', '1']],
    ['hsla(0, 255%, 10%, 0)', ['0', '255', '10', '0']],
  ];

  data.forEach((ele) => {
    assert.deepStrictEqual(lib.colors.crackHSL(ele[0]), ele[1], ele[0]);
  });
});

it('hslToRGB', () => {
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
    ['hsl(0, 0%, 0%)',    'rgb(0, 0, 0)'],
    ['hsl(210, 25%, 73%)',    'rgb(169, 186, 203)'],
    ['hsl(210, 20%, 69%)', 'rgb(160, 176, 192)'],
    ['hsl(0, 0%, 100%)', 'rgb(255, 255, 255)'],
    ['hsla(210, 20%, 69%, 0)', 'rgba(160, 176, 192, 0)'],
    ['hsla(210, 20%, 69%, 0.8)', 'rgba(160, 176, 192, 0.8)'],
    ['hsla(210, 20%, 69%, 1)', 'rgb(160, 176, 192)'],
  ];

  data.forEach((ele) => {
    assert.strictEqual(lib.colors.hslToRGB(ele[0]), ele[1], ele[0]);
  });
});

it('rgbToHsl', () => {
  var data = [
    // Some bad data first.
    ['', null],
    ['foo', null],
    // Then some reasonable data.
    ['rgb(0,0,0)', 'hsl(0, 0%, 0%)'],
    ['rgb(10, 100, 255)', 'hsl(218, 100%, 52%)'],
    ['rgba(10, 100, 255, 0)', 'hsla(218, 100%, 52%, 0)'],
    ['rgba(10, 100, 255, 0.8)', 'hsla(218, 100%, 52%, 0.8)'],
    ['rgba(100, 100, 100, 0.8)', 'hsla(0, 0%, 39%, 0.8)'],
    ['rgba(10, 100, 255, 1)', 'hsl(218, 100%, 52%)'],
  ];

  data.forEach((ele) => {
    assert.deepStrictEqual(lib.colors.rgbToHsl(ele[0]), ele[1], ele[0]);
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

it('luminance', () => {
  const data = [
      [[0, 0, 0], 0],
      [[255, 255, 255], 1],
      [[12, 34, 56], 0.0151],
      [[123, 213, 31], 0.5189],
  ];

  data.forEach((ele) => {
    assert.closeTo(lib.colors.luminance(...ele[0]), ele[1], 0.0001);
  });
});

it('contrastRatio', () => {
  const data = [
      [[[0, 0, 0], [255, 255, 255]], 21],
      [[[12, 34, 56], [123, 213, 31]], 8.74],
  ];

  data.forEach((ele) => {
    const l1 = lib.colors.luminance(...ele[0][0]);
    const l2 = lib.colors.luminance(...ele[0][1]);
    assert.closeTo(lib.colors.contrastRatio(l1, l2), ele[1], 0.01);
    assert.closeTo(lib.colors.contrastRatio(l2, l1), ele[1], 0.01);
  });
});

it('hslxArrayToHsvaArray', () => {
  const data = [
      [[0, 0, 0], [0, 0, 0, 1]],
      [[277, 0, 100], [277, 0, 100, 1]],
      [[95, 53, 36, 0], [95, 69, 55, 0]],
      [[126, 53, 69, 1], [126, 38, 85, 1]],
      [[172, 100, 69, 0.5], [172, 62, 100, 0.5]],
  ];

  data.forEach(([hsl, hsv]) => {
    const result = lib.colors.hslxArrayToHsvaArray(hsl);
    assert.lengthOf(result, hsv.length);
    result.forEach((value, i) => assert.closeTo(value, hsv[i], 1));
  });
});

it('hsvxArrayToHslaArray', () => {
  const data = [
      [[0, 0, 0], [0, 0, 0, 1]],
      [[277, 0, 100], [277, 0, 100, 1]],
      [[95, 69, 55, 0], [95, 53, 36, 0]],
      [[126, 38, 85, 1], [126, 52, 69, 1]],
      [[172, 62, 100, 0.5], [172, 100, 69, 0.5]],
  ];

  data.forEach(([hsv, hsl]) => {
    const result = lib.colors.hsvxArrayToHslaArray(hsv);
    assert.lengthOf(result, hsl.length);
    result.forEach((value, i) => assert.closeTo(value, hsl[i], 1));
  });
});

});
