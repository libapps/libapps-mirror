// Copyright 2019 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview FileSystemProvider test helpers.
 */

import {Client as sftpClient} from './nassh_sftp_client.js';
import {StatusCodes} from './nassh_sftp_packet_types.js';
import {StatusError} from './nassh_sftp_status.js';

/**
 * A mock SFTP client.
 *
 * @suppress {checkTypes}
 */
export class MockSftpClient extends sftpClient {
  constructor() {
    super();

    // Methods in sftp client that we mock.
    const methods = [
      'closeFile', 'fileStatus', 'linkStatus', 'makeDirectory', 'openDirectory',
      'openFile', 'readDirectory', 'readLink', 'realPath', 'removeDirectory',
      'removeFile', 'renameFile', 'scanDirectory', 'symLink',
    ];
    methods.forEach((method) => {
      this[method] = (...args) => this.automock_(method, ...args);
    });
  }

  /**
   * Mock helper for stubbing out calls.
   *
   * @param {string} method
   * @param {...*} args
   * @return {!Promise}
   */
  automock_(method, ...args) {
    return new Promise((resolve) => {
      if ('return' in this[method]) {
        let ret = this[method].return;
        if (typeof ret == 'function') {
          ret = ret(...args);
        }
        return resolve(ret);
      }

      throw new StatusError({
        'code': StatusCodes.NO_SUCH_FILE,
        'message': 'no mock data',
       }, method);
    });
  }
}
