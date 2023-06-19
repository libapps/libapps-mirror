/**
 * @fileoverview Re-export xterm from rollup output. This file together
 * with ../extern/xterm.js help us to make the closure compiler happy.
 *
 * @suppress {moduleLoad}
 */

import {xterm} from './deps_xterm.rollup.js';

/** @suppress {undefinedVars} */
export const {Terminal, CanvasAddon, SearchAddon, Unicode11Addon, WebLinksAddon,
  WebglAddon} = xterm;
