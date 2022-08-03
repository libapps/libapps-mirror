/**
 * @fileoverview Re-export xterm from nassh_deps.rollup.js. This file together
 * with ../extern/xterm.js help us to make the closure compiler happy.
 *
 * @suppress {moduleLoad}
 */
import {xterm} from './nassh_deps.rollup.js';

/** @suppress {undefinedVars} */
export const {Terminal, FitAddon, WebglAddon} = xterm;
