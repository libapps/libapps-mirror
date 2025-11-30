// Copyright 2017 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview Test framework setup when run inside the browser.
 */

import * as libTest from '../../libdot/js/lib_test_util.js';

libTest.main({
  base: '../../nassh/js',
  files: [
    // go/keep-sorted start
    'lib_array_tests.js',
    'lib_credential_cache_tests.js',
    'nasftp_cli_tests.js',
    'nassh_agent_message_tests.js',
    'nassh_agent_message_types_tests.js',
    'nassh_agent_tests.js',
    'nassh_buffer_concat_tests.js',
    'nassh_buffer_scatgat_tests.js',
    'nassh_buffer_tests.js',
    'nassh_command_instance_tests.js',
    'nassh_goog_metrics_reporter_tests.js',
    'nassh_google_tests.js',
    'nassh_omnibox_tests.js',
    'nassh_preference_manager_tests.js',
    'nassh_sftp_fsp_tests.js',
    'nassh_sftp_packet_tests.js',
    'nassh_sftp_packet_types_tests.js',
    'nassh_stream_relay_corpv4_tests.js',
    'nassh_tests.js',
    'ssh_policy_tests.js',
    // go/keep-sorted end
  ],
});
