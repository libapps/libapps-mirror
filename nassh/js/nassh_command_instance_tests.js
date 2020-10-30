// Copyright 2017 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview nassh command instance tests.
 */

import {parseDestination, parseURI, postProcessOptions, splitCommandLine,
        tokenizeOptions} from './nassh_command_instance.js';

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
    // ['-o"foo bar" -o "foo bar"', ['-ofoo bar', '-o', 'foo bar'], ''],
  ];

  data.forEach((dataSet) => {
    const opts = splitCommandLine(dataSet[0]);
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
    'schema': undefined,
    'username': undefined,
  };

  // List the fields that each test requires or deviates from the default.
  const data = [
    // Strip off the leading URI schema.
    ['ssh://root@localhost',
     {'username': 'root', 'hostname': 'localhost', 'schema': 'ssh',
      'uri': 'root@localhost'}],
    ['web+ssh://root@localhost',
     {'username': 'root', 'hostname': 'localhost', 'schema': 'ssh',
      'uri': 'root@localhost'}],
    ['sftp://root@localhost',
     {'username': 'root', 'hostname': 'localhost', 'schema': 'sftp',
      'uri': 'root@localhost'}],
    ['web+sftp://root@localhost',
     {'username': 'root', 'hostname': 'localhost', 'schema': 'sftp',
      'uri': 'root@localhost'}],

    // Basic forms.
    ['localhost', {'hostname': 'localhost'}],
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
    ['u@h:20@relay',
     {'username': 'u', 'hostname': 'h', 'port': '20',
      'relayHostname': 'relay'}],
    ['u@h@relay:2234',
     {'username': 'u', 'hostname': 'h', 'relayHostname': 'relay',
      'relayPort': '2234'}],
    ['u@h:20@relay:2234',
     {'username': 'u', 'hostname': 'h', 'port': '20', 'relayHostname': 'relay',
      'relayPort': '2234'}],

    // Relay hosts using IPv6.
    ['u@h@[::1]', {'username': 'u', 'hostname': 'h', 'relayHostname': '::1'}],
    ['u@h:20@[::1]',
     {'username': 'u', 'hostname': 'h', 'port': '20', 'relayHostname': '::1'}],
    ['u@h@[::1%eth0]',
     {'username': 'u', 'hostname': 'h', 'relayHostname': '::1%eth0'}],
    ['u@h:20@[::1]:2234',
     {'username': 'u', 'hostname': 'h', 'port': '20', 'relayHostname': '::1',
      'relayPort': '2234'}],

    // Both using IPv6.
    ['u@[::1]@[::1]',
     {'username': 'u', 'hostname': '::1', 'relayHostname': '::1'}],
    ['u@[::1]:20@[::1]:40',
     {'username': 'u', 'hostname': '::1', 'port': '20', 'relayHostname': '::1',
      'relayPort': '40'}],

    // Accpetable escaped forms.
    ['u%40g@h', {'username': 'u@g', 'hostname': 'h'}],

    // Unaccpetable escaped forms.
    ['u@h%6eg', {'username': 'u', 'hostname': 'h%6eg'}],
    ['u@h:1%302', null],

    // Bad hostnames.
    ['u@>croash', null],
    ['u@[>croash]', null],

    // Various bad forms.
    ['u@-Q', null],
    ['u@h@--foo', null],
    ['u@h@r --foo', null],
    ['u@h@r\t--foo', null],

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
      const rv = parseURI(uri, true, true);
      if (rv === null) {
        assert.isNull(fields);
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
describe('parseDestination', () => {
  const data = [
    // Registered protocol handler.
    ['uri:ssh://root@localhost',
     {'user': 'root', 'host': 'localhost', 'schema': 'ssh'}],
    ['uri:web+ssh://root@localhost',
     {'user': 'root', 'host': 'localhost', 'schema': 'ssh'}],
    ['uri:sftp://root@localhost',
     {'user': 'root', 'host': 'localhost', 'schema': 'sftp'}],
    ['uri:web+sftp://root@localhost',
     {'user': 'root', 'host': 'localhost', 'schema': 'sftp'}],
    ['uri:root@localhost', null],

    // URL escaped values.
    ['uri:ssh%3A//root@localhost',
     {'user': 'root', 'host': 'localhost', 'schema': 'ssh'}],
    ['uri:web+ssh%3A//root@localhost',
     {'user': 'root', 'host': 'localhost', 'schema': 'ssh'}],
    ['uri:sftp%3A//root@localhost',
     {'user': 'root', 'host': 'localhost', 'schema': 'sftp'}],
    ['uri:web+sftp%3A//root@localhost',
     {'user': 'root', 'host': 'localhost', 'schema': 'sftp'}],

    // For non-URI handler, we'll preserve the prefix.
    ['ssh://root@localhost', {'user': 'ssh://root', 'host': 'localhost'}],

    // Blank URIs.
    ['uri:ssh%3A//', {'host': '>connections'}],
    ['uri:ssh%3A', {'host': '>connections'}],
    ['uri:web+ssh%3A//', {'host': '>connections'}],
    ['uri:web+ssh%3A', {'host': '>connections'}],
    ['uri:sftp%3A//', {'host': '>connections'}],
    ['uri:sftp%3A', {'host': '>connections'}],
    ['uri:web+sftp%3A//', {'host': '>connections'}],
    ['uri:web+sftp%3A', {'host': '>connections'}],

    // Normal form.
    ['root@localhost', {'user': 'root', 'host': 'localhost'}],

    // Handle relay settings.
    ['u@h@host', {'user': 'u', 'host': 'h',
                  'nasshOptions': '--proxy-host=host'}],
    ['u@h@host:1234', {'user': 'u', 'host': 'h',
                       'nasshOptions': '--proxy-host=host --proxy-port=1234'}],

    // Missing usernames get prompted.
    ['@localhost', {'user': '', 'host': 'localhost'}],
    ['localhost', {'host': 'localhost'}],
  ];

  data.forEach((dataSet) => {
    it(dataSet[0], () => {
      const rv = parseDestination(dataSet[0]);
      if (rv === null) {
        assert.isNull(dataSet[1], dataSet[0]);
      } else {
        assert.equal(dataSet[1].user, rv.username, dataSet[0]);
        assert.equal(dataSet[1].host, rv.hostname, dataSet[0]);
        assert.equal(dataSet[1].schema, rv.schema, dataSet[0]);
        assert.equal(dataSet[1].nasshOptions, rv.nasshOptions, dataSet[0]);
      }
    });
  });
});

/**
 * Verify parsing of command lines.
 */
it('tokenizeOptions', () => {
  let rv;

  // Check the empty set.  This should not fail.
  rv = tokenizeOptions();
  assert.equal('object', typeof rv);
  rv = tokenizeOptions('');
  assert.equal('object', typeof rv);
  rv = tokenizeOptions(' ');
  assert.equal('object', typeof rv);

  // Check the meaning of the options.
  rv = tokenizeOptions(
      // Check plain options.
      '--report-ack-latency ' +
      // Check options w/values.
      '--config=google ' +
      // Check off options.
      '--no-use-xhr ',
  );
  assert.equal('object', typeof rv);
  assert.isTrue(rv['--report-ack-latency']);
  assert.equal('google', rv['--config']);
  assert.isFalse(rv['--use-xhr']);

  // Check for bad options.
  assert.throws(() => tokenizeOptions('blah'));
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
      // First verify the tokenization phase.
      let rv = tokenizeOptions(`--proxy-host=${host}`);
      assert.equal(rv['--proxy-host'], host);
      // Then verify the post processing phase.
      rv = postProcessOptions(rv, host, '');
      assert.equal(rv['--proxy-host'], expected);
    });
  });
});

/**
 * Verify default proxy-host settings.
 */
describe('default-proxy-host', () => {
  const modeOld = 'corp-relay@google.com';
  const modev4 = 'corp-relay-v4@google.com';
  const tests = [
    // Proxy host unrelated to Google.
    ['--proxy-host=proxy.example.com', 'example.com',
     undefined, 'proxy.example.com', 'root', modeOld, undefined],

    // Default Google settings.
    ['--config=google', 'example.com',
     '443', 'ssh-relay.corp.google.com', 'root', modeOld, false],

    // Default cloudtop Google settings.
    ['--config=google', 'example.c.googlers.com',
     '443', 'sup-ssh-relay.corp.google.com', 'root', modev4, true],

    // Default internal GCE settings.
    ['--config=google', 'example.internal.gcpnode.com',
     '443', 'sup-ssh-relay.corp.google.com', 'root', modev4, true],
    ['--config=google', 'example.proxy.gcpnode.com',
     '443', 'sup-ssh-relay.corp.google.com', 'root', modev4, true],

    // Explicit proxy settings override defaults.
    ['--config=google --proxy-host=example.com', 'example.c.googlers.com',
     '443', 'example.com', 'root', modev4, true],

    // Username settings.
    ['--config=google --proxy-host=example.com --proxy-user=user',
     'example.c.googlers.com', '443', 'example.com', 'user', modev4, true],

    // Mode settings.
    ['--config=google --proxy-mode=foo', 'example.com',
     '443', 'ssh-relay.corp.google.com', 'root', 'foo', false],
    ['--config=google --proxy-mode=foo', 'example.internal.gcpnode.com',
     '443', 'sup-ssh-relay.corp.google.com', 'root', 'foo', false],

    // Resume settings.
    ['--config=google --resume-connection', 'example.com',
     '443', 'ssh-relay.corp.google.com', 'root', modeOld, true],
    ['--config=google --no-resume-connection', 'example.internal.gcpnode.com',
     '443', 'sup-ssh-relay.corp.google.com', 'root', modev4, false],
  ];

  tests.forEach(([options, host, port, relay, user, mode, resume]) => {
    it(`default relay for '${options}' & '${host}'`, () => {
      let rv = tokenizeOptions(options);
      rv = postProcessOptions(rv, host, 'root');
      assert.equal(port, rv['--proxy-port']);
      assert.equal(relay, rv['--proxy-host']);
      assert.equal(user, rv['--proxy-user']);
      assert.equal(mode, rv['--proxy-mode']);
      assert.equal(resume, rv['--resume-connection']);
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
      let rv = tokenizeOptions('--config=google');
      rv = postProcessOptions(rv, host, '');
      assert.equal(rv['auth-agent-forward'], expected);
    });
  });
});

});
