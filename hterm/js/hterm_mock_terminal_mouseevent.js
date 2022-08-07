// Copyright 2022 The ChromiumOS Authors.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * Create a MouseEvent/WheelEvent that the VT layer expects.
 *
 * The Terminal layer adds some extra fields to it.  We can't create an object
 * in the same way as the runtime doesn't allow it (for no real good reason).
 * i.e. these methods fail:
 * (1) MouseEvent.apply(this, [...]) -> DOM object constructor cannot be called
 * (2) https://developers.google.com/web/updates/2015/04/DOM-attributes-now-on-the-prototype-chain
 *     m = new MouseEvent(...); Object.assign(this, m); -> attrs omitted
 *
 * @param {string} type The name of the new DOM event type (e.g. 'mouseup').
 * @param {!Object=} options Fields to set in the new event.
 * @return {!MouseEvent|!WheelEvent} The new fully initialized event.
 */
export function MockTerminalMouseEvent(type, options = {}) {
  let ret;
  if (type == 'wheel') {
    ret = new WheelEvent(type, options);
  } else {
    ret = new MouseEvent(type, options);
  }
  ret.terminalRow = options.terminalRow || 0;
  ret.terminalColumn = options.terminalColumn || 0;
  return ret;
}
