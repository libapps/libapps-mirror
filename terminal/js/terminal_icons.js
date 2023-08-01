// Copyright 2022 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview Exports svg icons.
 *
 * @suppress {moduleLoad}
 */

import {html} from './lit.js';

/**
 * Bruschetta svg icon.
 * Currently the same as the Enterprise policy icon.
 * https://chromium.googlesource.com/chromium/src/+/1108a3371b975ac75279816a0c68169c11d0b5e2/ui/webui/resources/cr_elements/icons.html#26
 *
 * @type {!TemplateResult}
 */
export const ICON_BRUSCHETTA = html`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M2,3 L2,17 L11.8267655,17 L13.7904799,17 L18,17 L18,7 L12,7 L12,3 L2,3 Z M8,13 L10,13 L10,15 L8,15 L8,13 Z M4,13 L6,13 L6,15 L4,15 L4,13 Z M8,9 L10,9 L10,11 L8,11 L8,9 Z M4,9 L6,9 L6,11 L4,11 L4,9 Z M12,9 L16,9 L16,15 L12,15 L12,9 Z M12,11 L14,11 L14,13 L12,13 L12,11 Z M8,5 L10,5 L10,7 L8,7 L8,5 Z M4,5 L6,5 L6,7 L4,7 L4,5 Z"/></svg>`;

/**
 * Imported from
 * https://fonts.google.com/icons?selected=Material%20Icons%3Acancel%3A.
 *
 * @type {!TemplateResult}
 */
export const ICON_CANCEL = html`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M0 0h24v24H0z" fill="none"/><path d="M12 2C6.47 2 2 6.47 2 12s4.47 10 10 10 10-4.47 10-10S17.53 2 12 2zm5 13.59L15.59 17 12 13.41 8.41 17 7 15.59 10.59 12 7 8.41 8.41 7 12 10.59 15.59 7 17 8.41 13.41 12 17 15.59z"/></svg>`;

/**
 * From https://fonts.google.com/icons?selected=Material+Icons:close
 *
 * @type {!TemplateResult}
 */
export const ICON_CLOSE = html`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M0 0h24v24H0z" fill="none"/><path d="M19 6.41L17.6 5 12 10.6 6.4 5 5 6.4 10.6 12 5 17.6 6.4 19 12 13.4 17.6 19 19 17.6 13.4 12z"/></svg>`;

/**
 * Code / Developers svg icon.
 *
 * @type {!TemplateResult}
 */
export const ICON_CODE = html`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M8.2 6.2L4.4 10L8.2 13.8L6.8 15.2L1.6 10L6.8 4.8L8.2 6.2Z M11.3 13.8L15.1 10L11.3 6.2L12.7 4.8L17.9 10L12.7 15.2L11.3 13.8Z"/></svg>`;

/**
 * Enterprise policy icon.
 * From https://chromium.googlesource.com/chromium/src/+/1108a3371b975ac75279816a0c68169c11d0b5e2/ui/webui/resources/cr_elements/icons.html#26
 *
 * @type {!TemplateResult}
 */
export const ICON_DOMAIN = html`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M2,3 L2,17 L11.8267655,17 L13.7904799,17 L18,17 L18,7 L12,7 L12,3 L2,3 Z M8,13 L10,13 L10,15 L8,15 L8,13 Z M4,13 L6,13 L6,15 L4,15 L4,13 Z M8,9 L10,9 L10,11 L8,11 L8,9 Z M4,9 L6,9 L6,11 L4,11 L4,9 Z M12,9 L16,9 L16,15 L12,15 L12,9 Z M12,11 L14,11 L14,13 L12,13 L12,11 Z M8,5 L10,5 L10,7 L8,7 L8,5 Z M4,5 L6,5 L6,7 L4,7 L4,5 Z"/></svg>`;

/**
 * From https://fonts.google.com/icons?selected=Material%20Symbols%20Outlined%3Acontent_copy%3AFILL%400%3Bwght%40400%3BGRAD%400%3Bopsz%4048
 *
 * @type {!TemplateResult}
 */
export const ICON_COPY = html`<svg xmlns="http://www.w3.org/2000/svg" height="48" width="48"><path d="M9 43.95q-1.2 0-2.1-.9-.9-.9-.9-2.1V10.8h3v30.15h23.7v3Zm6-6q-1.2 0-2.1-.9-.9-.9-.9-2.1v-28q0-1.2.9-2.1.9-.9 2.1-.9h22q1.2 0 2.1.9.9.9.9 2.1v28q0 1.2-.9 2.1-.9.9-2.1.9Zm0-3h22v-28H15v28Zm0 0v-28 28Z"/></svg>`;

/**
 * Edit svg icon.
 *
 * @type {!TemplateResult}
 */
export const ICON_EDIT = html`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M17.4 3.9L16 2.6C15.3 1.8 14 1.8 13.2 2.6L10.4 5.4L2 13.8V18H6.2L17.4 6.8C18.2 6 18.2 4.7 17.4 3.9ZM4 16V14.6L11.8 6.8L13.2 8.2L5.4 16L4 16Z"/></svg>`;

/**
 * From https://fonts.google.com/icons?selected=Material+Icons:error_outline:
 *
 * @type {!TemplateResult}
 */
export const ICON_ERROR = html`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M0 0h24v24H0V0z" fill="none"/><path d="M11 15h2v2h-2zm0-8h2v6h-2zm.99-5C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8z"/></svg>`;

/**
 * Imported from
 * https://fonts.google.com/icons?selected=Material%20Symbols%20Outlined%3Aexpand_more%3AFILL%400%3Bwght%40400%3BGRAD%400%3Bopsz%4048
 *
 * @type {!TemplateResult}
 */
export const ICON_EXPAND_LESS = html`<svg xmlns="http://www.w3.org/2000/svg" height="18px" viewBox="0 0 24 24" width="18px" fill="#000000"><path d="M0 0h24v24H0z" fill="none"/><path d="M12 8l-6 6 1.41 1.41L12 10.83l4.59 4.58L18 14z"/></svg>`;

/**
 * Imported from
 * https://fonts.google.com/icons?selected=Material%20Symbols%20Outlined%3Aexpand_more%3AFILL%400%3Bwght%40400%3BGRAD%400%3Bopsz%4048
 *
 * @type {!TemplateResult}
 */
export const ICON_EXPAND_MORE = html`<svg xmlns="http://www.w3.org/2000/svg" height="18px" viewBox="0 0 24 24" width="18px" fill="#000000"><path d="M0 0h24v24H0z" fill="none"/><path d="M16.59 8.59L12 13.17 7.41 8.59 6 10l6 6 6-6z"/></svg>`;

/**
 * Linux crostini penguin svg icon.
 *
 * @type {!TemplateResult}
 */
export const ICON_LINUX = html`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M10 2c3.5056 0 5.577 2.592 6.4291 6.1657.3863.1221 1.1212.614 1.3405 1.2813.272.8277.4387 1.756-.303 2.0339-.259.097-.484.0798-.6816-.0231-.039 2.8879-1.2964 4.5267-3.258 5.335.0314.0621.0473.1343.0473.215 0 .548.2595.9922-1.6433.9922-1.3916 0-1.6266-.3033-1.6525-.6327-.0922-.0576-.185-.147-.2785-.147-.0938 0-.187.0969-.2796.1565C9.6922 17.701 9.4507 18 8.069 18c-1.9028 0-1.6433-.4443-1.6433-.9923a.5075.5075 0 0 1 .0483-.2223c-1.9598-.8128-3.216-2.4596-3.2589-5.3276-.1976.1029-.4226.1202-.6817.023-.7417-.2778-.575-1.2061-.303-2.0338.2252-.6854.9945-1.1858 1.3712-1.2905C4.4784 4.7036 6.5356 2 10 2zm0 3.7422c-.7017 0-1.212-1.5733-1.786-1.4287-1.9986.5034-3.1894 3.3091-3.1894 6.0963 0 3.3466 1.3186 5.1488 4.9754 5.1488 3.6568 0 4.9754-1.6023 4.9754-5.1488 0-2.9427-1.1993-5.6451-3.1894-6.0963-.6378-.1446-1.0843 1.4287-1.786 1.4287zm-.1677 3.3802a.3843.3843 0 0 1 .3174-.0006l1.1359.5122c.1967.0887.2854.3226.198.5224a.3965.3965 0 0 1-.0693.1073l-1.1293 1.2477a.3855.3855 0 0 1-.5746-.0008l-1.1256-1.2509a.4002.4002 0 0 1 .0248-.5592.3892.3892 0 0 1 .1036-.069zm-2.315-2.161c.457 0 .8275.3808.8275.8506 0 .4697-.3705.8505-.8276.8505-.457 0-.8275-.3808-.8275-.8505 0-.4698.3705-.8506.8275-.8506zm4.9655 0c.457 0 .8275.3808.8275.8506 0 .4697-.3705.8505-.8275.8505-.4571 0-.8276-.3808-.8276-.8505 0-.4698.3705-.8506.8276-.8506z"/></svg>`;

/**
 * From https://fonts.google.com/icons?selected=Material+Icons:more_vert
 *
 * @type {!TemplateResult}
 */
export const ICON_MORE_VERT = html`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M0 0h24v24H0z" fill="none"/><path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/></svg>`;

/**
 * Open in new window svg icon.
 *
 * @type {!TemplateResult}
 */
export const ICON_OPEN_IN_NEW = html`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M15 15H5V5H9V3H5C4 3 3 4 3 5C3 6 3 15 3 15C3 16 4 17 5 17H15C16 17 17 16 17 15V11H15V15ZM11 3V5H13.5L7 11.5L8.5 13L15 6.5V9H17V3H11Z"/></svg>`;

/**
 * Plus svg icon.
 *
 * @type {!TemplateResult}
 */
export const ICON_PLUS = html`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M0 0h24v24H0V0z" fill="none"/><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>`;

/**
 * Settings svg icon.
 *
 * @type {!TemplateResult}
 */
export const ICON_SETTINGS = html`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M11.5 18.0H8.5C7.9 18.0 7.4 17.6 7.4 17.0L7.1 15.5C6.9 15.4 6.7 15.3 6.5 15.2L5.1 15.7C4.5 15.9 3.9 15.7 3.6 15.2L2.2 12.8C1.9 12.2 2.0 11.6 2.4 11.3L3.7 10.4C3.7 10.2 3.7 10.1 3.7 10.0C3.7 9.9 3.7 9.8 3.7 9.6L2.5 8.7C2.0 8.4 1.9 7.7 2.2 7.2L3.6 4.7C3.9 4.3 4.5 4.0 5.1 4.3L6.5 4.8C6.7 4.7 6.9 4.6 7.1 4.5L7.4 3.0C7.4 2.4 7.9 2.0 8.5 2.0H11.5C12.1 2.0 12.6 2.4 12.6 3.0L12.8 4.5C13.1 4.6 13.3 4.7 13.5 4.8L14.9 4.3C15.5 4.1 16.1 4.3 16.4 4.8L17.8 7.3C18.1 7.8 18.0 8.4 17.6 8.7L16.3 9.7C16.3 9.8 16.4 9.9 16.4 10.0C16.4 10.1 16.3 10.3 16.3 10.4L17.6 11.3C18.0 11.7 18.1 12.3 17.9 12.8L16.4 15.3C16.1 15.8 15.5 16.0 14.9 15.8L13.5 15.2C13.3 15.3 13.1 15.4 12.9 15.6L12.6 17.0C12.6 17.6 12.1 18.0 11.5 18.0ZM8.9 16.0H11.1L11.3 14.1L11.7 14.0C12.1 13.9 12.4 13.7 12.8 13.4L13.1 13.2L14.9 13.9L16.0 12.1L14.4 11.0L14.5 10.6C14.5 10.4 14.5 10.2 14.5 10.0C14.5 9.8 14.5 9.6 14.5 9.4L14.4 9.0L16.0 7.9L14.9 6.1L13.1 6.8L12.8 6.6C12.4 6.3 12.1 6.2 11.7 6.0L11.3 5.9L11.1 4.0H8.9L8.7 5.9L8.3 6.0C7.9 6.1 7.6 6.3 7.2 6.6L6.9 6.8L5.1 6.1L4.0 7.9L5.6 9.0L5.5 9.4C5.5 9.6 5.5 9.8 5.5 10.0C5.5 10.2 5.5 10.4 5.5 10.6L5.6 11.0L4.0 12.1L5.1 13.9L6.9 13.2L7.2 13.4C7.6 13.7 7.9 13.8 8.3 14.0L8.7 14.1L8.9 16.0ZM10.0 12.5C11.4 12.5 12.5 11.4 12.5 10.0C12.5 8.6 11.4 7.5 10.0 7.5C8.6 7.5 7.5 8.6 7.5 10.0C7.5 11.4 8.6 12.5 10.0 12.5Z"/></svg>`;

/**
 * SSH terminal svg icon.
 *
 * @type {!TemplateResult}
 */
export const ICON_SSH = html`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M17.5 3H2.5C1.6 3 1 3.7 1 4.55556V13.5C1 14.3556 1.6 15 2.5 15H7H8V16H6V18H14V16H12V15H13H17.5C18.4 15 19 14.3556 19 13.5V4.5C19 3.64444 18.4 3 17.5 3ZM17 13H3V5H17V13Z"/></svg>`;
