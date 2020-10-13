// Copyright 2020 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview Tests for the WasiView API.
 */

import {WasiView} from '../js/dataview.js';

describe('dataview.js', () => {

/**
 * Run tests against the specified structure.
 *
 * This will verify the get & set APIs work, and the underlying memory matches.
 *
 * @suppress {checkTypes} Closure doesn't like the this[] lookup.
 * @param {string} name The get/set API to check.
 * @param {!Object} expectedValue The object to compare against.
 * @param {!Array<number>} expectedMemory The serialized memory after a set().
 */
function checkStruct(name, expectedValue, expectedMemory) {
  const size = expectedMemory.length;

  /**
   * Verify get API works.
   */
  it(`get${name}`, () => {
    const u8 = new Uint8Array(size);
    u8.set(Array.from(u8.keys()));
    const view = new WasiView(u8.buffer);
    const value = view[`get${name}`](0, true);
    assert.deepStrictEqual(value, {
      struct_size: size,
      ...expectedValue,
    });
  });

  /**
   * Verify set API works.
   */
  it(`set${name}`, () => {
    const u8 = new Uint8Array(size);
    u8.fill(0xee);
    const view = new WasiView(u8.buffer);
    view[`set${name}`](0, expectedValue, true);
    // Convert to an Array as the test framework can show diffs better.
    assert.deepStrictEqual(Array.from(u8), expectedMemory);
  });
}

checkStruct(
    'Dirent', {
      d_next: 0x0706050403020100n,
      d_ino: 0x0f0e0d0c0b0a0908n,
      d_namlen: 0x13121110,
      d_type: /** @type {!WASI_t.filetype} */ (0x14),
    }, [
      0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07,
      0x08, 0x09, 0x0a, 0x0b, 0x0c, 0x0d, 0x0e, 0x0f,
      0x10, 0x11, 0x12, 0x13,
      0x14,
      0xee, 0xee, 0xee,
    ]);

checkStruct(
    'Event', {
      userdata: 0x0706050403020100n,
      error: 0x0908,
      type: 0x0a,
      fd_readwrite: {
        nbytes: 0x1716151413121110n,
        flags: 0x1918,
        struct_size: 16,
      },
    }, [
      0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07,
      0x08, 0x09,
      0x0a,
      0xee, 0xee, 0xee, 0xee, 0xee,
      0x10, 0x11, 0x12, 0x13, 0x14, 0x15, 0x16, 0x17,
      0x18, 0x19,
      0xee, 0xee, 0xee, 0xee, 0xee, 0xee,
    ]);

checkStruct(
    'EventFdReadWrite', {
      nbytes: 0x0706050403020100n,
      flags: 0x0908,
    }, [
      0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07,
      0x08, 0x09,
      0xee, 0xee, 0xee, 0xee, 0xee, 0xee,
    ]);

checkStruct(
    'Fdstat', {
      fs_filetype: 0x00,
      fs_flags: 0x0302,
      fs_rights_base: 0x0f0e0d0c0b0a0908n,
      fs_rights_inheriting: 0x1716151413121110n,
    }, [
      0x00,
      0xee,
      0x02, 0x03,
      0xee, 0xee, 0xee, 0xee,
      0x08, 0x09, 0x0a, 0x0b, 0x0c, 0x0d, 0x0e, 0x0f,
      0x10, 0x11, 0x12, 0x13, 0x14, 0x15, 0x16, 0x17,
    ]);

checkStruct(
    'Filestat', {
      dev: 0x0706050403020100n,
      ino: 0x0f0e0d0c0b0a0908n,
      filetype: 0x10,
      nlink: 0x1f1e1d1c1b1a1918n,
      size: 0x2726252423222120n,
      atim: 0x2f2e2d2c2b2a2928n,
      mtim: 0x3736353433323130n,
      ctim: 0x3f3e3d3c3b3a3938n,
    }, [
      0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07,
      0x08, 0x09, 0x0a, 0x0b, 0x0c, 0x0d, 0x0e, 0x0f,
      0x10,
      0xee, 0xee, 0xee, 0xee, 0xee, 0xee, 0xee,
      0x18, 0x19, 0x1a, 0x1b, 0x1c, 0x1d, 0x1e, 0x1f,
      0x20, 0x21, 0x22, 0x23, 0x24, 0x25, 0x26, 0x27,
      0x28, 0x29, 0x2a, 0x2b, 0x2c, 0x2d, 0x2e, 0x2f,
      0x30, 0x31, 0x32, 0x33, 0x34, 0x35, 0x36, 0x37,
      0x38, 0x39, 0x3a, 0x3b, 0x3c, 0x3d, 0x3e, 0x3f,
    ]);

checkStruct(
    'Iovec', {
      buf: 0x03020100,
      buf_len: 0x07060504,
    }, [
      0x00, 0x01, 0x02, 0x03,
      0x04, 0x05, 0x06, 0x07,
    ]);

checkStruct(
    'SubscriptionClock', {
      id: 0x03020100,
      timeout: 0x0f0e0d0c0b0a0908n,
      precision: 0x1716151413121110n,
      flags: 0x1918,
    }, [
      0x00, 0x01, 0x02, 0x03,
      0xee, 0xee, 0xee, 0xee,
      0x08, 0x09, 0x0a, 0x0b, 0x0c, 0x0d, 0x0e, 0x0f,
      0x10, 0x11, 0x12, 0x13, 0x14, 0x15, 0x16, 0x17,
      0x18, 0x19,
      0xee, 0xee, 0xee, 0xee, 0xee, 0xee,
    ]);

checkStruct(
    'SubscriptionFdReadWrite', {
      file_descriptor: 0x03020100,
    }, [
      0x00, 0x01, 0x02, 0x03,
    ]);

/**
 * Verify getSubscription API works.
 */
describe('getSubscription', () => {
  const struct_size = 48;
  const u8 = new Uint8Array(struct_size);
  u8.set(Array.from(u8.keys()));
  const view = new WasiView(u8.buffer);

  /**
   * Unknown tags should throw an error.
   */
  it('bad tag', () => {
    u8[8] = 3;
    assert.throws(
        () => view.getSubscription(0, true),
        'Unknown tag');
  });

  /**
   * Check CLOCK subscriptions.
   */
  it('clock', () => {
    u8[8] = 0;
    const value = view.getSubscription(0, true);
    assert.deepStrictEqual(value, {
      userdata: 0x0706050403020100n,
      tag: 0,
      clock: {
        id: 0x13121110,
        timeout: 0x1f1e1d1c1b1a1918n,
        precision: 0x2726252423222120n,
        flags: 0x2928,
        struct_size: 32,
      },
      struct_size: struct_size,
    });
  });

  /**
   * Check FD_READ subscriptions.
   */
  it('fd_read', () => {
    u8[8] = 1;
    const value = view.getSubscription(0, true);
    assert.deepStrictEqual(value, {
      userdata: 0x0706050403020100n,
      tag: 1,
      fd_read: {
        file_descriptor: 0x13121110,
        struct_size: 4,
      },
      struct_size: struct_size,
    });
  });

  /**
   * Check FD_WRITE subscriptions.
   */
  it('fd_write', () => {
    u8[8] = 2;
    const value = view.getSubscription(0, true);
    assert.deepStrictEqual(value, {
      userdata: 0x0706050403020100n,
      tag: 2,
      fd_write: {
        file_descriptor: 0x13121110,
        struct_size: 4,
      },
      struct_size: struct_size,
    });
  });
});

/**
 * Run tests against the specified primitive.
 *
 * This will verify the get & set APIs work, and the underlying memory matches.
 *
 * @suppress {checkTypes} Closure doesn't like the this[] lookup.
 * @param {string} name The get/set API to check.
 * @param {number|bigint} expectedValue The value to compare against.
 * @param {!Array<number>} expectedMemory The serialized memory after a set().
 */
function checkPrimitive(name, expectedValue, expectedMemory) {
  const size = expectedMemory.length;

  /**
   * Verify get API works.
   */
  it(`get${name}`, () => {
    const u8 = new Uint8Array(size);
    u8.set(Array.from(u8.keys()));
    const view = new WasiView(u8.buffer);
    const value = view[`get${name}`](0, true);
    assert.equal(value, expectedValue);
  });

  /**
   * Verify set API works.
   */
  it(`set${name}`, () => {
    const u8 = new Uint8Array(size);
    u8.fill(0xee);
    const view = new WasiView(u8.buffer);
    view[`set${name}`](0, expectedValue, true);
    // Convert to an Array as the test framework can show diffs better.
    assert.deepStrictEqual(Array.from(u8), expectedMemory);
  });
}

describe('uint8', () => {
  const args = [0x00, [0x00]];
  checkPrimitive('Advice', ...args);
  checkPrimitive('Eventtype', ...args);
  checkPrimitive('Filetype', ...args);
  checkPrimitive('Preopentype', ...args);
  checkPrimitive('Sdflags', ...args);
  checkPrimitive('Signal', ...args);
  checkPrimitive('Whence', ...args);
});

describe('uint16', () => {
  const args = [0x0100, [0x00, 0x01]];
  checkPrimitive('Errno', ...args);
  checkPrimitive('Eventrwflags', ...args);
  checkPrimitive('Fdflags', ...args);
  checkPrimitive('Fstflags', ...args);
  checkPrimitive('Oflags', ...args);
  checkPrimitive('Riflags', ...args);
  checkPrimitive('Roflags', ...args);
  checkPrimitive('Siflags', ...args);
  checkPrimitive('Subclockflags', ...args);
});

describe('uint32', () => {
  const args = [0x03020100, [0x00, 0x01, 0x02, 0x03]];
  checkPrimitive('Clockid', ...args);
  checkPrimitive('Dirnamlen', ...args);
  checkPrimitive('Exitcode', ...args);
  checkPrimitive('Fd', ...args);
  checkPrimitive('Lookupflags', ...args);
  checkPrimitive('Pointer', ...args);
  checkPrimitive('Size', ...args);
});

describe('uint64', () => {
  const args = [
    0x0706050403020100n, [0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07]];
  checkPrimitive('Device', ...args);
  checkPrimitive('Dircookie', ...args);
  checkPrimitive('Filesize', ...args);
  checkPrimitive('Inode', ...args);
  checkPrimitive('Linkcount', ...args);
  checkPrimitive('Rights', ...args);
  checkPrimitive('Timestamp', ...args);
  checkPrimitive('Userdata', ...args);
});

});
