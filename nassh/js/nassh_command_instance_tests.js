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
