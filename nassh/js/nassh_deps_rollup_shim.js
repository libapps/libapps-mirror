// Copyright 2017 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview A shim for all node dependencies that need to be
 * bundled into a single ES6 module by rollup, created by importing and
 * re-exporting only the classes and functions that are used by nassh.
 *
 * Note: The ES6 requirement of having at least one default export does not
 * apply with rollup.
 *
 * Note: After making changes to this file it is necessary to run
 * ../bin/mkdeps.sh in order for nassh to pick them up.
 */

/**
 * asn1js is used to parse ASN.1-encoded certificates, for example the
 * certificate associated to an authentication key in the PIV applet of a
 * smart card, in their BER representation into an ASN.1 schema.
 */
import {fromBER} from 'asn1js';
const asn1js = {fromBER};
export {asn1js};

/**
 * pkijs is used to extract information, in particular about the associated
 * RSA/ECC public keys, from the certificates stored in the PIV applet of smart
 * cards.
 */
import {Certificate, ECPublicKey, RSAPublicKey} from 'pkijs';
const pkijs = {
  Certificate,
  ECPublicKey,
  RSAPublicKey,
};
export {pkijs};

/**
 * punycode is used to connect to internationalized (UTF-8) domain names.
 */
import {toASCII} from 'punycode';
const punycode = {toASCII};
export {punycode};

/**
 * lit-element is used for the terminal's settings page.
 * TODO(juwa@google.com): I know this isn't the correct place for this import,
 * and that it should be in the terminal directory. I am not sure how best to
 * accomplish this though, as the terminal app currently does not manage its
 * own dependencies, but instead includes nassh's.
 */
import {LitElement, html, css, unsafeCSS} from 'lit';
import {classMap} from 'lit/directives/class-map.js';
import {ifDefined} from 'lit/directives/if-defined.js';
import {live} from 'lit/directives/live.js';
import {createRef, ref} from 'lit/directives/ref.js';
import {when} from 'lit/directives/when.js';
const lit = {LitElement, classMap, css, createRef, html, ifDefined, live, ref,
  unsafeCSS, when};
export {lit};

import '@material/mwc-icon-button';

import {Terminal} from 'xterm';
import {Unicode11Addon} from 'xterm-addon-unicode11';
import {WebglAddon} from 'xterm-addon-webgl';
import {WebLinksAddon} from 'xterm-addon-web-links';
export const xterm = {Terminal, Unicode11Addon, WebLinksAddon,
  WebglAddon};

/**
 * indexeddb-fs is used to provide persistance filesystem (e.g. /.ssh/).
 */
import {createFs} from 'indexeddb-fs';
export {createFs};
