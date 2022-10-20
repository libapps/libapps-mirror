// Copyright 2022 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview Shim to export package/build information.
 */

import IMG_VISIBILITY_URI from '../images/visibility.svg';
import IMG_VISIBILITY_OFF_URI from '../images/visibility_off.svg';

import {notes, last_version} from '../release-highlights.yaml';

export {
  IMG_VISIBILITY_URI,
  IMG_VISIBILITY_OFF_URI,
  notes as RELEASE_NOTES,
  last_version as RELEASE_LAST_VERSION,
};
