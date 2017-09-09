// Copyright 2017 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

'use strict';

/**
 * @fileoverview nassh command instance tests.
 */

nassh.CommandInstance.Tests = new lib.TestManager.Suite('nassh.CommandInstance.Tests');

/**
 * Verify parsing of command lines.
 */
nassh.CommandInstance.Tests.addTest('splitCommandLine', function(result, cx) {
  const data = [
    // JS API.
    [undefined, [], ''],

    // Various unquoted scenarios.
    ['', [], ''],
    ['    ', [], ''],
    ['--', [], ''],
    [' --', [], ''],
    ['-- ', [], ''],
    [' -- ', [], ''],
    [' -- ls', [], 'ls'],
    ['-- ls  ', [], 'ls'],
    ['--ls', ['--ls'], ''],
    [' -4 ', ['-4'], ''],
    ['-4 -vvv', ['-4', '-vvv'], ''],
    ['-4 -vvv    ls /', ['-4', '-vvv', 'ls', '/'], ''],
    ['-4 -vvv --   ls   /  ', ['-4', '-vvv'], 'ls /'],
    ['-- ls -- /', [], 'ls -- /'],
    ['-4 -- ls -- /', ['-4'], 'ls -- /'],
    ['-- ls -v /', [], 'ls -v /'],

    // Now for some simple quotes.
    ['-o "foo bar" -l', ['-o', 'foo bar', '-l'], ''],
    ['-o "foo bar" ls "a b c"', ['-o', 'foo bar', 'ls', 'a b c'], ''],
    ['-o "foo bar" -- ls "a b c"', ['-o', 'foo bar'], 'ls "a b c"'],

    // Quoting the breaker makes us ignore it.  Not exactly guaranteed API,
    // but it's what we do now, and worth thinking about if we change.
    ['-x "--" ls "a b c"', ['-x', '--', 'ls', 'a b c'], ''],

    // Our parser doesn't handle more complicated quoting (yet?).
    //['-o"foo bar" -o "foo bar"', ['-ofoo bar', '-o', 'foo bar'], ''],
  ];

  var dataSet;
  data.forEach((dataSet) => {
    const opts = nassh.CommandInstance.splitCommandLine(dataSet[0]);
    result.assertEQ(dataSet[1], opts.args);
    result.assertEQ(dataSet[2], opts.command);
  });

  result.pass();
});

/**
 * Check parsing of ssh:// URIs.
 */
nassh.CommandInstance.Tests.addTest('parseURI', function(result, cx) {
  const data = [
    // Strip off the leading URI schema.
    ['ssh://root@localhost', {'user': 'root', 'host': 'localhost'}],

    // Basic forms.
    ['root@localhost', {'user': 'root', 'host': 'localhost'}],
    ['u@h:2222', {'user': 'u', 'host': 'h', 'port': '2222'}],

    // IPv4 forms.
    ['u@192.168.86.1', {'user': 'u', 'host': '192.168.86.1'}],
    ['u@192.168.86.124:55',
     {'user': 'u', 'host': '192.168.86.124', 'port': '55'}],

    // IPv6 forms.
    ['u@[::1]', {'user': 'u', 'host': '::1'}],
    ['u@[::1%eth0]', {'user': 'u', 'host': '::1%eth0'}],
    ['u@[fe80::863a:4bff:feda:8d60]:33',
     {'user': 'u', 'host': 'fe80::863a:4bff:feda:8d60', 'port': '33'}],

    // Relay host extensions.
    ['u@h@relay', {'user': 'u', 'host': 'h', 'relay': 'relay'}],
    ['u@h@relay:2234', {'user': 'u', 'host': 'h', 'relay': 'relay',
                        'relayPort': '2234'}],
  ];

  let dataSet;
  data.forEach((dataSet) => {
    const rv = nassh.CommandInstance.parseURI(dataSet[0]);
    if (rv === false) {
      result.assertEQ(dataSet[1], rv, dataSet[0]);
    } else {
      result.assertEQ(dataSet[1].user, rv.username, dataSet[0]);
      result.assertEQ(dataSet[1].host, rv.hostname, dataSet[0]);
      result.assertEQ(dataSet[1].port, rv.port, dataSet[0]);
      result.assertEQ(dataSet[1].relay, rv.relayHostname, dataSet[0]);
      result.assertEQ(dataSet[1].relayPort, rv.relayPort, dataSet[0]);
    }
  });

  result.pass();
});

/**
 * Check parsing of Secure Shell destinations.
 * Most test logic is in parseURI, so we focus on the little bit that isn't.
 */
nassh.CommandInstance.Tests.addTest('parseDestination', function(result, cx) {
  const data = [
    // Registered protocol handler.
    ['uri:ssh://root@localhost', {'user': 'root', 'host': 'localhost'}],
    ['uri:root@localhost', false],

    // For non-URI handler, we'll preserve the prefix.
    ['ssh://root@localhost', {'user': 'ssh://root', 'host': 'localhost'}],

    // Normal form.
    ['root@localhost', {'user': 'root', 'host': 'localhost'}],

    // Handle relay settings.
    ['u@h@host', {'user': 'u', 'host': 'h',
                  'relayOptions': '--proxy-host=host'}],
    ['u@h@host:1234', {'user': 'u', 'host': 'h',
                       'relayOptions': '--proxy-host=host --proxy-port=1234'}],

    // Reject missing usernames.
    ['localhost', false],
  ];

  let dataSet;
  data.forEach((dataSet) => {
    const rv = nassh.CommandInstance.parseDestination(dataSet[0]);
    if (rv === false) {
      result.assertEQ(dataSet[1], rv, dataSet[0]);
    } else {
      result.assertEQ(dataSet[1].user, rv.username, dataSet[0]);
      result.assertEQ(dataSet[1].host, rv.hostname, dataSet[0]);
      result.assertEQ(dataSet[1].relayOptions, rv.relayOptions, dataSet[0]);
    }
  });

  result.pass();
});
