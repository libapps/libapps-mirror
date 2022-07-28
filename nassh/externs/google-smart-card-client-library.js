// Copyright 2019 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview Externs definitions for GoogleSmartCard used in nassh.
 *
 * @externs
 */

var GoogleSmartCard = {};

/** @const */
GoogleSmartCard.PcscLiteClient = {};

/** @constructor */
GoogleSmartCard.PcscLiteClient.API = function() {};

/** @type {number} */
GoogleSmartCard.PcscLiteClient.API.SCARD_LEAVE_CARD;

/** @type {number} */
GoogleSmartCard.PcscLiteClient.API.SCARD_PCI_T1;

/** @type {number} */
GoogleSmartCard.PcscLiteClient.API.SCARD_PROTOCOL_T1;

/** @type {number} */
GoogleSmartCard.PcscLiteClient.API.SCARD_SCOPE_SYSTEM;

/** @type {number} */
GoogleSmartCard.PcscLiteClient.API.SCARD_SHARE_EXCLUSIVE;

/** @param {number} code */
GoogleSmartCard.PcscLiteClient.API.prototype.pcsc_stringify_error =
    function(code) {};

/** @constructor */
GoogleSmartCard.PcscLiteClient.API.Result = function() {}

/**
 * @param {function(...)} onSuccess
 * @param {function(number)} onFailed
 */
GoogleSmartCard.PcscLiteClient.API.Result.prototype.get =
    function(onSuccess, onFailed) {};

/**
 * @param {!GoogleSmartCard.PcscLiteClient.Context} ctx
 * @param {string} reader
 * @param {number} share
 * @param {number} protocol
 * @return {!Promise<!GoogleSmartCard.PcscLiteClient.API.Result>}
 */
GoogleSmartCard.PcscLiteClient.API.prototype.SCardConnect =
    function(ctx, reader, share, protocol) {};

/**
 * @param {number} cardHandle
 * @param {number} disposition
 * @return {!Promise<!GoogleSmartCard.PcscLiteClient.API.Result>}
 */
GoogleSmartCard.PcscLiteClient.API.prototype.SCardDisconnect =
    function(cardHandle, disposition) {};

/**
 * @param {number} scope
 * @param {?Object} reserved1
 * @param {?Object} reserved2
 * @return {!Promise<!GoogleSmartCard.PcscLiteClient.API.Result>}
 */
GoogleSmartCard.PcscLiteClient.API.prototype.SCardEstablishContext =
    function(scope, reserved1, reserved2) {};

/**
 * @param {!GoogleSmartCard.PcscLiteClient.Context} ctx
 */
GoogleSmartCard.PcscLiteClient.API.prototype.SCardIsValidContext =
    function(ctx) {};

/**
 * @param {!GoogleSmartCard.PcscLiteClient.Context} ctx
 * @param {?Array<string>} readers
 * @return {!Promise<!GoogleSmartCard.PcscLiteClient.API.Result>}
 */
GoogleSmartCard.PcscLiteClient.API.prototype.SCardListReaders =
    function(ctx, readers) {};

/**
 * @param {!GoogleSmartCard.PcscLiteClient.Context} ctx
 * @return {!Promise<!GoogleSmartCard.PcscLiteClient.API.Result>}
 */
GoogleSmartCard.PcscLiteClient.API.prototype.SCardReleaseContext =
    function(ctx) {};

/**
 * @param {number} cardHandle
 * @param {number} pciT1
 * @param {!Array<!Uint8Array>} commands
 * @return {!Promise<!GoogleSmartCard.PcscLiteClient.API.Result>}
 */
GoogleSmartCard.PcscLiteClient.API.prototype.SCardTransmit =
    function(cardHandle, pciT1, commands) {};

/**
 * @param {string} title
 * @param {string} appId
 * @constructor
 */
GoogleSmartCard.PcscLiteClient.Context = function(title, appId) {};

GoogleSmartCard.PcscLiteClient.Context.prototype.initialize = function() {};

/** @param {function()} callback */
GoogleSmartCard.PcscLiteClient.Context.prototype.addOnDisposeCallback =
    function(callback) {};

/** @param {function(!GoogleSmartCard.PcscLiteClient.API)} callback */
GoogleSmartCard.PcscLiteClient.Context.prototype.addOnInitializedCallback =
    function(callback) {};

/** @const */
GoogleSmartCard.PcscLiteCommon = {}

/** @const */
GoogleSmartCard.PcscLiteCommon.Constants = {}

/** @type {string} */
GoogleSmartCard.PcscLiteCommon.Constants.SERVER_OFFICIAL_APP_ID;

/**
 * Glue because closure-compiler is bad at imports.
 */
var GoogleSmartCard$$module$third_party$google_smart_card$google_smart_card_client_library = {};
GoogleSmartCard$$module$third_party$google_smart_card$google_smart_card_client_library.PcscLiteClient = {};
/** @constructor */
GoogleSmartCard$$module$third_party$google_smart_card$google_smart_card_client_library.PcscLiteClient.API = GoogleSmartCard.PcscLiteClient.API;
/** @constructor */
GoogleSmartCard$$module$third_party$google_smart_card$google_smart_card_client_library.PcscLiteClient.Context = GoogleSmartCard.PcscLiteClient.Context;
/** @constructor */
GoogleSmartCard$$module$third_party$google_smart_card$google_smart_card_client_library.PcscLiteClient.API.Result = GoogleSmartCard.PcscLiteClient.API.Result;
