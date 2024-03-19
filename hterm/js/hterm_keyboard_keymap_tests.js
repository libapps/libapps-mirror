// Copyright 2020 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview KeyMap test suite.
 *
 * Tests that key events are dispatched correctly.
 */

import {hterm} from '../index.js';

describe('hterm_keyboard_keymap_tests.js', () => {

  /**
   * Mock window.open, set up keyMap.
   */
  beforeEach(function() {
    this.originalOpen = globalThis.open;
    globalThis.open = function() { return null; };
    this.terminal = {
      onOpenNewSession: () => {},
      passCtrlN: false,
      passCtrlT: false,
      passCtrlW: false,
      passCtrlTab: false,
    };
    this.keyboard = /** @type {!hterm.Keyboard} */ ({terminal: this.terminal});
    this.keyMap = new hterm.Keyboard.KeyMap(this.keyboard);
  });

  /**
   * Restore window.open.
   */
  afterEach(function() {
    globalThis.open = this.originalOpen;
  });

  /** Verify tab shortcuts. */
  it('handles-tab-shortcuts', function() {
    const map = this.keyMap;

    /**
     * @param {string} ch character
     * @return {string} ctrl-ch
     */
    function ctl(ch) { return String.fromCharCode(ch.charCodeAt(0) - 64); }

    /**
     * Get the action for the given type and KeyDef.
     *
     * @param {string} type 'normal' or 'control'.
     * @param {!hterm.Keyboard.KeyDef} def
     * @param {boolean} shiftKey
     * @return {!hterm.Keyboard.KeyDefAction}
     */
    function action(type, def, shiftKey) {
      let control = def[type];
      while (typeof control == 'function') {
        control = control.call(
            map, new KeyboardEvent('keydown', {shiftKey}), def);
      }
      return control;
    }

    const DEFAULT = hterm.Keyboard.KeyActions.DEFAULT;
    const CANCEL = hterm.Keyboard.KeyActions.CANCEL;
    const PASS = hterm.Keyboard.KeyActions.PASS;
    const STRIP = hterm.Keyboard.KeyActions.STRIP;

    const T = true;
    const F = false;

    const tests = [
      // key, passCtrlN, passCtrlT, passCtrlW, passCtrlTab,
      // expected for normal,
      // expected for control,
      // expected for shift,
      // expected for control + shift.
      /* eslint-disable no-multi-spaces */
      ['N',  F, F, F, F, DEFAULT, ctl('N'),  DEFAULT,  CANCEL],
      ['N',  T, F, F, F, DEFAULT, PASS,      DEFAULT,  PASS],
      ['T',  F, F, F, F, DEFAULT, ctl('T'),  DEFAULT,  ctl('T')],
      ['T',  F, T, F, F, DEFAULT, PASS,      DEFAULT,  PASS],
      ['W',  F, F, F, F, DEFAULT, ctl('W'),  DEFAULT,  ctl('W')],
      ['W',  F, F, T, F, DEFAULT, PASS,      DEFAULT,  PASS],
      ['\t', F, F, F, F, '\t',    STRIP,     '\x1b[Z', STRIP],
      ['\t', F, F, F, T, '\t',    PASS,      '\x1b[Z', PASS],
      /* eslint-enable no-multi-spaces */
    ];

    for (const t of tests) {
      const def = this.keyMap.keyDefs[t[0].charCodeAt(0)];
      const desc = `key=${t[0]}, passCtrlN=${t[1]}, passCtrlT=${t[2]}, ` +
                   `passCtrlW=${t[3]}, passCtrlTab=${t[4]}, type=`;
      this.terminal.passCtrlN = t[1];
      this.terminal.passCtrlT = t[2];
      this.terminal.passCtrlW = t[3];
      this.terminal.passCtrlTab = t[4];
      assert.equal(action('normal', def, false), t[5], `${desc}normal`);
      assert.equal(action('control', def, false), t[6], `${desc}ctrl`);
      assert.equal(action('normal', def, true), t[7], `${desc}shift`);
      assert.equal(action('control', def, true), t[8], `${desc}ctrl+shift`);
    }
  });
});
