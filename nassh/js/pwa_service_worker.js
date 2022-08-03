// Copyright 2022 The ChromiumOS Authors.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview  No-op service worker that is needed to make Secure Shell
 *     installable as a PWA.
 *
 * TODO(https://crbug.com/3763671): Remove when the service worker restriction
 * is lifted for Isolated Web Apps.
 */

self.addEventListener('fetch', (e) => e.respondWith(fetch(e.request)));
