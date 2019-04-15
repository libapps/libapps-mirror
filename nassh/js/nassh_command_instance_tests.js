// Copyright 2017 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

'use strict';

/**
 * @fileoverview nassh command instance tests.
 */

describe('nassh_command_instance_tests.js', () => {

/**
 * Verify parsing of command lines.
 */
it('splitCommandLine', () => {
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
    assert.deepStrictEqual(dataSet[1], opts.args);
    assert.deepStrictEqual(dataSet[2], opts.command);
  });
});

/**
 * Check parsing of ssh:// URIs.
 */
describe('parseURI', () => {
  // A bunch of fields are undefined by default.
  const defaultFields = {
    'port': undefined,
    'relayHostname': undefined,
    'relayPort': undefined,
  };

  // List the fields that each test requires or deviates from the default.
  const data = [
    // Strip off the leading URI schema.
    ['ssh://root@localhost',
     {'username': 'root', 'hostname': 'localhost', 'uri': 'root@localhost'}],

    // Basic forms.
    ['root@localhost', {'username': 'root', 'hostname': 'localhost'}],
    ['u@h:2222', {'username': 'u', 'hostname': 'h', 'port': '2222'}],

    // IPv4 forms.
    ['u@192.168.86.1', {'username': 'u', 'hostname': '192.168.86.1'}],
    ['u@192.168.86.124:55',
     {'username': 'u', 'hostname': '192.168.86.124', 'port': '55'}],

    // IPv6 forms.
    ['u@[::1]', {'username': 'u', 'hostname': '::1'}],
    ['u@[::1%eth0]', {'username': 'u', 'hostname': '::1%eth0'}],
    ['u@[fe80::863a:4bff:feda:8d60]:33',
     {'username': 'u', 'hostname': 'fe80::863a:4bff:feda:8d60', 'port': '33'}],

    // Relay host extensions.
    ['u@h@relay', {'username': 'u', 'hostname': 'h', 'relayHostname': 'relay'}],
    ['u@h@relay:2234',
     {'username': 'u', 'hostname': 'h', 'relayHostname': 'relay',
      'relayPort': '2234'}],

    // Accpetable escaped forms.
    ['u%40g@h', {'username': 'u@g', 'hostname': 'h'}],

    // Unaccpetable escaped forms.
    ['u@h%6eg', {'username': 'u', 'hostname': 'h%6eg'}],
    ['u@h:1%302', false],

    // Fingerprints.
    ['u;fingerprint=foo@h',
     {'username': 'u', 'hostname': 'h', 'fingerprint': 'foo'}],

    // ssh params.
    ['u;-nassh-ssh-args=-vv%20-4@h',
     {'username': 'u', 'hostname': 'h',
      'nassh-ssh-args': '-vv -4'}],

    // nassh params.
    ['u;-nassh-args=--proxy-mode=some-mode@h',
     {'username': 'u', 'hostname': 'h',
      'nassh-args': '--proxy-mode=some-mode'}],

    // Empty args.
    ['u;-nassh-ssh-args=@h', {'username': 'u', 'hostname': 'h'}],

    // Valid incomplete param.
    ['u;-nassh-args=--proxy-mode=@h',
     {'username': 'u', 'hostname': 'h', 'nassh-args': '--proxy-mode='}],

    // Params combined.
    ['u;-nassh-args=--proxy-mode=some-mode;fingerprint=foo#;' +
     '-nassh-ssh-args="usingQuotMarks"@h',
     {'username': 'u', 'hostname': 'h',
      'nassh-args': '--proxy-mode=some-mode',
      'fingerprint': 'foo#', 'nassh-ssh-args': '"usingQuotMarks"'}],

    // Params combined with encoded chars.
    ['u;-nassh-args=--proxy-mode=ssh-fe%40google.com;fingerprint=foo#;' +
     '-nassh-ssh-args="using%3dEqual%3bAndSemicolon"@h',
     {'username': 'u', 'hostname': 'h',
      'nassh-args': '--proxy-mode=ssh-fe@google.com',
      'fingerprint': 'foo#', 'nassh-ssh-args': '"using=Equal;AndSemicolon"'}],

    // Different order.
    ['u;fingerprint=foo#;-nassh-ssh-args="usingQuotMarks";' +
     '-nassh-args=--proxy-mode=some-mode@h',
     {'username': 'u', 'hostname': 'h',
      'nassh-args': '--proxy-mode=some-mode',
      'fingerprint': 'foo#', 'nassh-ssh-args': '"usingQuotMarks"'}],

    // Unknown param is not added to the returning object.
    ['u;-unknown-param="dropTable"@h',
     {'username': 'u', 'hostname': 'h'}],
  ];

  data.forEach(([uri, fields]) => {
    it(uri, () => {
      const rv = nassh.CommandInstance.parseURI(uri, true, true);
      if (rv === false) {
        assert.isFalse(rv);
      } else {
        const expected = Object.assign({'uri': uri}, defaultFields, fields);
        assert.deepStrictEqual(rv, expected);
      }
    });
  });
});

/**
 * Check parsing of Secure Shell destinations.
 * Most test logic is in parseURI, so we focus on the little bit that isn't.
 */
it('parseDestination', () => {
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
                  'nasshOptions': '--proxy-host=host'}],
    ['u@h@host:1234', {'user': 'u', 'host': 'h',
                       'nasshOptions': '--proxy-host=host --proxy-port=1234'}],

    // Reject missing usernames.
    ['localhost', false],
  ];

  let dataSet;
  data.forEach((dataSet) => {
    const rv = nassh.CommandInstance.parseDestination(dataSet[0]);
    if (rv === false) {
      assert.isFalse(dataSet[1], dataSet[0]);
    } else {
      assert.equal(dataSet[1].user, rv.username, dataSet[0]);
      assert.equal(dataSet[1].host, rv.hostname, dataSet[0]);
      assert.equal(dataSet[1].nasshOptions, rv.nasshOptions, dataSet[0]);
    }
  });
});

/**
 * Verify parsing of command lines.
 */
it('tokenizeOptions', () => {
  let rv;

  // Check the empty set.  This should not fail.
  rv = nassh.CommandInstance.tokenizeOptions();
  assert.equal('object', typeof rv);
  rv = nassh.CommandInstance.tokenizeOptions('');
  assert.equal('object', typeof rv);
  rv = nassh.CommandInstance.tokenizeOptions(' ');
  assert.equal('object', typeof rv);

  // Check the meaning of the options.
  rv = nassh.CommandInstance.tokenizeOptions(
      // Check plain options.
      '--report-ack-latency ' +
      // Check options w/values.
      '--config=google ' +
      // Check off options.
      '--no-use-xhr '
  );
  assert.equal('object', typeof rv);
  assert.isTrue(rv['--report-ack-latency']);
  assert.equal('google', rv['--config']);
  assert.isFalse(rv['--use-xhr']);

  // Check for bad options.
  assert.throws(() => nassh.CommandInstance.tokenizeOptions('blah'));
});

/**
 * Check address/hostname proxy-host handling.
 */
describe('proxy-host-addresses', () => {
  const data = [
    // Hostnames.
    ['example.com', 'example.com'],
    // IPv4.
    ['127.0.0.1', '127.0.0.1'],
    // IPv6.
    ['::1', '[::1]'],
    ['[::1]', '[::1]'],
    ['2607:f8b0:4007:80e::200e', '[2607:f8b0:4007:80e::200e]'],
    ['[2607:f8b0:4007:80e::200e]', '[2607:f8b0:4007:80e::200e]'],
  ];

  data.forEach(([host, expected]) => {
    it(`--proxy-host=${host}`, () => {
      const rv = nassh.CommandInstance.tokenizeOptions(`--proxy-host=${host}`);
      assert.equal(rv['--proxy-host'], expected);
    });
  });
});

/**
 * Verify default proxy-host settings.
 */
describe('default-proxy-host', () => {
  const tests = [
    // Proxy host unrelated to Google.
    ['--proxy-host=proxy.example.com', 'example.com',
     undefined, 'proxy.example.com'],

    // Default Google settings.
    ['--config=google', 'example.com',
     '443', 'ssh-relay.corp.google.com'],

    // Default cloudtop Google settings.
    ['--config=google', 'example.c.googlers.com',
     '443', 'sup-ssh-relay.corp.google.com'],

    // Default internal GCE settings.
    ['--config=google', 'example.internal.gcpnode.com',
     '443', 'sup-ssh-relay.corp.google.com'],
    ['--config=google', 'example.proxy.gcpnode.com',
     '443', 'sup-ssh-relay.corp.google.com'],

    // Explicit proxy settings override defaults.
    ['--config=google --proxy-host=example.com', 'example.c.googlers.com',
     '443', 'example.com'],
  ];

  tests.forEach(([options, host, port, relay]) => {
    it(`default relay for '${options}' & '${host}'`, () => {
      const rv = nassh.CommandInstance.tokenizeOptions(options, host);
      assert.equal(port, rv['--proxy-port']);
      assert.equal(relay, rv['--proxy-host']);
    });
  });
});

/**
 * Verify default ssh-agent forwarding settings.
 */
describe('default-ssh-agent', () => {
  const tests = [
    // Host unrelated to Google.
    ['example.com', false],
    // Google host, but not one we should forward to.
    ['google.com', false],
    // Hosts we should forward by default.
    ['xxx.yyy.corp.google.com', true],
    ['xxx.yyy.corp', true],
    ['xxx.cloud.googlecorp.com', true],
    ['xxx.c.googlers.com', true],
  ];

  tests.forEach(([host, expected]) => {
    it(`forwarding for ${host}`, () => {
      const rv = nassh.CommandInstance.tokenizeOptions('--config=google', host);
      assert.equal(rv['auth-agent-forward'], expected);
    });
  });
});

});
