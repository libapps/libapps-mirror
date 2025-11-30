// Copyright 2017 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview Test suite for the generic SSH agent in Agent.
 */

import {lib} from '../../libdot/index.js';

import {keyBlobToAuthorizedKeysFormat} from './nassh_agent.js';

it('keyBlobToAuthorizedKeysFormat', () => {
  const asciiToBinary = (str) => {
    return lib.codec.stringToCodeUnitArray(atob(str));
  };

  // eslint-disable-next-line
  const keyTypeRsa = 'AAAAB3NzaC1yc2EAAAADAQABAAABAQC3sp7nkdZlKZwNlbtotfGexMf8UJO+Z/s5DCHCc34iOx6ffQgnBpcQEv+WHU8e2Ha+l3FxgBRIi9uaAT8hLNY+BrG8UsGhBDxJPmazL2yovkBI3m8LpOdlCM25DJBybMEM8A91DqPe34bGZk3UHad61IPt9TD/WR863IlwhCLHxZuxTBwhfm3U435EbO4k8XRUbL75P9O00nBsaPy0O7mxZVH3VcKd2RxX58v8l/BhfgKq5PkRDS3I4uMafxObjTPSe/HuZxlBH4EMJvrXZE31hgcv2Cp2QKGyvH3yDW0nIRwBnbGyyaErbiPEq9gxv0urTowo5JdWI67I4LQsmWLr';
  const keyTypeEd25519 =
      'AAAAC3NzaC1lZDI1NTE5AAAAIKsEa2RL2X0d3L3CA9uwTbqQvJfVjIEEJzH/i8lpWkNq';

  assert.equal(keyBlobToAuthorizedKeysFormat(asciiToBinary(keyTypeRsa)),
               'ssh-rsa ' + keyTypeRsa);
  assert.equal(keyBlobToAuthorizedKeysFormat(asciiToBinary(keyTypeEd25519)),
               'ssh-ed25519 ' + keyTypeEd25519);
});
