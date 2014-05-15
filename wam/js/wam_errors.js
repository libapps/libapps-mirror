// Copyright (c) 2013 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

'use strict';

wam.errorManager.defineErrors
(
 ['wam.Error.ChannelDisconnect', ['diagnostic']],
 ['wam.Error.CloseTimeout', []],
 ['wam.Error.HandshakeDeclined', ['diagnostic']],
 ['wam.Error.InvalidChannelProtocol', ['channelProtocol']],
 ['wam.Error.InvalidChannelVersion', ['channelVersion']],
 ['wam.Error.ReadyAbort', ['abortErrorArg']],
 ['wam.Error.ParentClosed', ['name', 'arg']],
 ['wam.Error.TransportDisconnect', ['diagnostic']],
 ['wam.Error.UnknownMessage', ['name']],
 ['wam.Error.UnexpectedMessage', ['name', 'arg']],
 ['wam.Error.UnknownPayload', []],
 ['wam.Error.UnknownSubject', ['subject']]
);
