// Copyright 2019 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

'use strict';

/**
 * @fileoverview FileSystemProvider tests.
 */

/**
 * A mock SFTP client.
 *
 * @constructor
 */
const MockSftpClient = function() {
  this.protocolClientVersion = 3;
  this.protocolServerVersion = null;
  this.protocolServerExtensions = {};
  this.openedFiles = {};

  // Methods in nassh.sftp.Client that we mock.
  const methods = [
    'closeFile', 'fileStatus', 'linkStatus', 'makeDirectory', 'openDirectory',
    'openFile', 'readDirectory', 'readLink', 'realPath', 'removeDirectory',
    'removeFile', 'renameFile', 'scanDirectory', 'symLink',
  ];
  methods.forEach((method) => {
    this[method] = (...args) => this.automock_(method, ...args);
  });
};

/**
 * Mock helper for stubbing out calls.
 *
 * @param {string} method
 * @param {!Array} args
 * @return {!Promise}
 */
MockSftpClient.prototype.automock_ = function(method, ...args) {
  return new Promise((resolve) => {
    if ('return' in this[method]) {
      let ret = this[method].return;
      if (typeof ret == 'function') {
        ret = ret(...args);
      }
      return resolve(ret);
    }

    throw new nassh.sftp.StatusError({
      'code': nassh.sftp.packets.StatusCodes.NO_SUCH_FILE,
      'message': 'no mock data',
    }, method);
  });
};

describe('nassh_sftp_fsp_tests.js', () => {

/**
 * Reset any FSP state.
 */
beforeEach(function() {
  this.client = new MockSftpClient();
  nassh.sftp.fsp.sftpInstances = {
    'id': {
      'sftpClient': this.client,
    },
  };

  const packet = new nassh.sftp.Packet([
      // 32-bit request id.
      0x01, 0x02, 0x03, 0x04,
      // 32-bit code.
      0x00, 0x00, 0x00, 0x01,
      // Message string.
      0x00, 0x00, 0x00, 0x00,
      // Language string.
      0x00, 0x00, 0x00, 0x00,
  ]);
  this.eofPacket = new nassh.sftp.packets.StatusPacket(packet);
});

/**
 * Verify all FSP methods are properly registered.
 */
it('fsp-known-methods', function() {
  // Sanity check that we have some methods.
  assert.isAbove(nassh.sftp.fsp.providerMethods.length, 10);

  // Make sure every method is registered.
  nassh.sftp.fsp.providerMethods.forEach((method) => {
    assert.equal('function', typeof nassh.sftp.fsp[method]);
  });
});

/**
 * Check all calls w/invalid or unknown filesystem ids fail.
 *
 * This shows up when the Files app state is out of sync with us.
 */
it('fsp-invalid-fsid', function() {
  let count = 0;
  nassh.sftp.fsp.providerMethods.forEach((method) => {
    // onMountRequested doesn't make callbacks.
    if (method == 'onMountRequested') {
      ++count;
      return;
    }

    nassh.sftp.fsp[method]({}, assert.fail, (error) => {
      assert.equal('FAILED', error);
      ++count;
    });
  });

  // Make sure every error callback was actually called.
  assert.equal(count, nassh.sftp.fsp.providerMethods.length);
});

/**
 * Verify the checkInstanceExists utility function.
 */
it('fsp-instance-check', function() {
  let called;
  let ret;

  // Unknown ids should error.
  called = false;
  ret = nassh.sftp.fsp.checkInstanceExists('1234', (error) => {
    assert.equal('FAILED', error);
    called = true;
  });
  assert.isTrue(called);
  assert.isFalse(ret);

  // Valid ids should pass.
  nassh.sftp.fsp.sftpInstances['1234'] = {};
  ret = nassh.sftp.fsp.checkInstanceExists('1234', assert.fail);
  assert.isTrue(ret);
});

/**
 * Verify the sanitizeMetadata utility function.
 */
it('fsp-sanitize-metadata', function() {
  // Reduced mock for nassh.sftp.packets.getFileAttrs like fileStatus returns.
  const fileStat = {
    size: 1024,
    isDirectory: false,
    lastModified: 100,
  };
  const dirStat = {
    size: 0,
    isDirectory: true,
    lastModified: 200,
  };
  // Mock for directory entry like readDirectory returns.
  const fileEntry = Object.assign({filename: 'foo.txt'}, fileStat);
  const dirEntry = Object.assign({filename: 'dir'}, dirStat);

  let ret;

  // Nothing is requested so nothing is returned or even checked.
  ret = nassh.sftp.fsp.sanitizeMetadata({}, {});
  assert.deepStrictEqual([], Object.keys(ret));

  // Check each field by itself.
  ret = nassh.sftp.fsp.sanitizeMetadata(fileEntry, {name: true});
  assert.deepStrictEqual(['name'], Object.keys(ret));
  assert.equal('foo.txt', ret.name);
  ret = nassh.sftp.fsp.sanitizeMetadata(fileEntry, {isDirectory: true});
  assert.deepStrictEqual(['isDirectory'], Object.keys(ret));
  assert.isFalse(ret.isDirectory);
  ret = nassh.sftp.fsp.sanitizeMetadata(fileEntry, {size: true});
  assert.deepStrictEqual(['size'], Object.keys(ret));
  assert.equal(1024, ret.size);
  ret = nassh.sftp.fsp.sanitizeMetadata(fileEntry, {modificationTime: true});
  assert.deepStrictEqual(['modificationTime'], Object.keys(ret));
  assert.equal(100000, ret.modificationTime.getTime());

  // Check requesting multiple things at once.
  ret = nassh.sftp.fsp.sanitizeMetadata(dirEntry, {
    name: true,
    isDirectory: true,
    size: true,
    modificationTime: true,
  });
  assert.deepStrictEqual(['isDirectory', 'modificationTime', 'name', 'size'],
                         Object.keys(ret).sort());
  assert.equal('dir', ret.name);
  assert.isTrue(ret.isDirectory);
  assert.equal(0, ret.size);
  assert.equal(200000, ret.modificationTime.getTime());

  // Check filtering of attrs.
  ret = nassh.sftp.fsp.sanitizeMetadata(dirStat, {
    name: true,
    directoryPath: '/a/b/c',
  });
  assert.deepStrictEqual(['name'], Object.keys(ret));
  assert.equal('c', ret.name);

  ret = nassh.sftp.fsp.sanitizeMetadata(fileStat, {
    name: true,
    entryPath: '/a/b/c.txt',
  });
  assert.deepStrictEqual(['name'], Object.keys(ret));
  assert.equal('c.txt', ret.name);
});

/**
 * Verify onGetMetadataRequested with missing paths.
 */
it('fsp-onGetMetadata-missing', function(done) {
  const options = {fileSystemId: 'id', entryPath: '/foo'};

  nassh.sftp.fsp.onGetMetadataRequested(
      options,
      (metadata) => assert.fail(),
      (error) => {
        assert.equal('NOT_FOUND', error);
        done();
      });
});

/**
 * Verify onGetMetadataRequested with existing path.
 */
it('fsp-onGetMetadata-found', function(done) {
  const options = {
    fileSystemId: 'id',
    entryPath: '/foo',
    isDirectory: true,
    size: true,
  };

  this.client.fileStatus.return = (path) => {
    assert.equal('./foo', path);
    return {
      isDirectory: false,
      size: 100,
    };
  };
  nassh.sftp.fsp.onGetMetadataRequested(
      options,
      (metadata) => {
        assert.isFalse(metadata.isDirectory);
        assert.equal(100, metadata.size);
        done();
      },
      assert.fail);
});

/**
 * Verify onReadDirectoryRequested with missing path.
 */
it('fsp-onReadDirectory-missing', function(done) {
  const options = {fileSystemId: 'id', directoryPath: '/dir'};

  nassh.sftp.fsp.onReadDirectoryRequested(
      options,
      (entries, hasMore) => assert.fail(),
      (error) => {
        assert.equal('FAILED', error);
        done();
      });
});

/**
 * Verify onReadDirectoryRequested with empty dir.
 */
it('fsp-onReadDirectory-empty', function(done) {
  const options = {fileSystemId: 'id', directoryPath: '/dir'};

  this.client.openDirectory.return = (path) => {
    assert.equal('./dir', path);
    return 'handle';
  };
  this.client.scanDirectory.return = (handle, filter) => {
    assert.equal('handle', handle);
    return [];
  };
  this.client.closeFile.return = (handle) => {
    assert.equal('handle', handle);
    done();
  };
  nassh.sftp.fsp.onReadDirectoryRequested(
      options,
      (entries, hasMore) => {
        assert.deepStrictEqual([], entries);
        assert.isFalse(hasMore);
      },
      assert.fail);
});

/**
 * Verify onReadDirectoryRequested with real results.
 */
it('fsp-onReadDirectory-found', function(done) {
  const options = {
    fileSystemId: 'id',
    directoryPath: '/dir',
    isDirectory: true,
    name: true,
  };

  this.client.openDirectory.return = (path) => {
    assert.equal('./dir', path);
    return 'handle';
  };
  let entries = [
    {filename: '.', isDirectory: true},
    {filename: '..', isDirectory: true},
    {filename: 'foo.txt', isDirectory: false},
    {filename: 'dir', isDirectory: true},
  ];
  this.client.scanDirectory.return = (handle, filter) => {
    let filtered = [];
    assert.equal('handle', handle);
    entries.forEach((entry) => {
      let ret = filter(entry);
      if (ret === false) {
        return;
      } else if (ret !== true) {
        entry = ret;
      }
      filtered.push(ret);
    });
    return filtered;
  };
  this.client.closeFile.return = (handle) => {
    assert.equal('handle', handle);
    done();
  };
  nassh.sftp.fsp.onReadDirectoryRequested(
      options,
      (entries, hasMore) => {
        assert.equal(2, entries.length);
        assert.equal('foo.txt', entries[0].name);
        assert.isFalse(entries[0].isDirectory);
        assert.equal('dir', entries[1].name);
        assert.isTrue(entries[1].isDirectory);
        assert.isFalse(hasMore);
      },
      assert.fail);
});

/**
 * Verify onReadDirectoryRequested with symlinks.
 */
it('fsp-onReadDirectory-symlinks', function(done) {
  const options = {
    fileSystemId: 'id',
    directoryPath: '/dir',
    isDirectory: true,
    name: true,
  };

  this.client.openDirectory.return = (path) => {
    assert.equal('./dir', path);
    return 'handle';
  };
  const entries = [
    {filename: '.', isDirectory: true},
    {filename: '..', isDirectory: true},
    {filename: 'dir', isDirectory: true, isLink: true},
    {filename: 'file', isDirectory: false, isLink: true},
    {filename: 'brok', isDirectory: false, isLink: true},
  ];
  this.client.scanDirectory.return = (handle, filter) => {
    const filtered = [];
    const promises = [];
    assert.equal('handle', handle);
    entries.forEach((entry) => {
      let ret = filter(entry);
      if (ret === false) {
        return;
      } else if (ret instanceof Promise) {
        promises.push(ret);
        return;
      } else if (ret !== true) {
        entry = ret;
      }
      filtered.push(ret);
    });
    return Promise.all(promises).then((results) => {
      return filtered.concat(results.filter((result) => !!result));
    });
  };
  this.client.fileStatus.return = (path) => {
    switch (path) {
      case './dir/dir':
        return {isDirectory: true, isLink: false};
      case './dir/file':
        return {isDirectory: false, isLink: false};
      case './dir/brok':
        return Promise.reject();
      default:
        assert.fail();
        return Promise.reject();
    }
  };
  this.client.closeFile.return = (handle) => {
    assert.equal('handle', handle);
    done();
  };
  nassh.sftp.fsp.onReadDirectoryRequested(
      options,
      (entries, hasMore) => {
        assert.equal(2, entries.length);
        assert.equal('dir', entries[0].name);
        assert.isTrue(entries[0].isDirectory);
        assert.equal('file', entries[1].name);
        assert.isFalse(entries[1].isDirectory);
        assert.isFalse(hasMore);
      },
      assert.fail);
});

/**
 * Verify onWriteFileRequested with missing path.
 */
it('fsp-onWriteFile-missing', function(done) {
  const options = {fileSystemId: 'id', openRequestId: 1};

  nassh.sftp.fsp.onWriteFileRequested(
      options,
      assert.fail,
      (error) => {
        assert.equal('INVALID_OPERATION', error);
        done();
      });
});

/**
 * Verify onOpenFileRequested with missing path.
 */
it('fsp-onOpenFile-missing', function(done) {
  const options = {fileSystemId: 'id', filePath: '/foo'};

  nassh.sftp.fsp.onOpenFileRequested(
      options,
      assert.fail,
      (error) => {
        assert.equal('FAILED', error);
        done();
      });
});

/**
 * Verify onOpenFileRequested open file for reading.
 */
it('fsp-onOpenFile-read', function(done) {
  const options = {
    fileSystemId: 'id',
    filePath: '/foo',
    requestId: 1,
    mode: 'READ',
  };

  this.client.openFile.return = (path, pflags) => {
    assert.equal('./foo', path);
    assert.equal(nassh.sftp.packets.OpenFlags.READ, pflags);
    return 'handle';
  };
  nassh.sftp.fsp.onOpenFileRequested(
      options,
      () => {
        assert.equal('handle', this.client.openedFiles[1]);
        done();
      },
      assert.fail);
});

/**
 * Verify onOpenFileRequested open file for writing.
 */
it('fsp-onOpenFile-write', function(done) {
  const options = {
    fileSystemId: 'id',
    filePath: '/foo',
    requestId: 1,
    mode: 'WRITE',
  };

  this.client.openFile.return = (path, pflags) => {
    assert.equal('./foo', path);
    assert.equal(nassh.sftp.packets.OpenFlags.WRITE, pflags);
    return 'handle';
  };
  nassh.sftp.fsp.onOpenFileRequested(
      options,
      () => {
        assert.equal('handle', this.client.openedFiles[1]);
        done();
      },
      assert.fail);
});

/**
 * Verify onCreateFileRequested with missing path.
 */
it('fsp-onCreateFile-missing', function(done) {
  const options = {fileSystemId: 'id', filePath: '/foo'};

  nassh.sftp.fsp.onCreateFileRequested(
      options,
      assert.fail,
      (error) => {
        assert.equal('FAILED', error);
        done();
      });
});

/**
 * Verify onCreateFileRequested works.
 */
it('fsp-onCreateFile-found', function(done) {
  const options = {
    fileSystemId: 'id',
    filePath: '/foo',
    requestId: 1,
  };

  this.client.openFile.return = (path, pflags) => {
    assert.equal('./foo', path);
    assert.equal(nassh.sftp.packets.OpenFlags.CREAT |
                 nassh.sftp.packets.OpenFlags.EXCL, pflags);
    return 'handle';
  };
  nassh.sftp.fsp.onCreateFileRequested(
      options,
      () => {
        assert.equal('handle', this.client.openedFiles[1]);
        done();
      },
      assert.fail);
});

/**
 * Verify onDeleteEntryRequested with missing dirs.
 */
it('fsp-onDeleteEntry-missing-dir', function(done) {
  const options = {
    fileSystemId: 'id',
    entryPath: '/path',
    recursive: true,
  };

  nassh.sftp.fsp.onDeleteEntryRequested(
      options,
      assert.fail,
      (error) => {
        assert.equal('NOT_FOUND', error);
        done();
      });
});

/**
 * Verify onDeleteEntryRequested with dirs.
 */
it('fsp-onDeleteEntry-dir', function(done) {
  const options = {
    fileSystemId: 'id',
    entryPath: '/dir',
    recursive: true,
  };

  this.client.linkStatus.return = (path) => {
    assert.equal('./dir', path);
    return {isDirectory: true, isLink: false};
  };
  this.client.removeDirectory.return = (path, recursive) => {
    assert.equal('./dir', path);
    assert.isTrue(recursive);
  };
  nassh.sftp.fsp.onDeleteEntryRequested(
      options,
      done,
      assert.fail);
});

/**
 * Verify onDeleteEntryRequested with missing files.
 */
it('fsp-onDeleteEntry-missing-file', function(done) {
  const options = {
    fileSystemId: 'id',
    entryPath: '/path',
    recursive: false,
  };

  nassh.sftp.fsp.onDeleteEntryRequested(
      options,
      assert.fail,
      (error) => {
        assert.equal('NOT_FOUND', error);
        done();
      });
});

/**
 * Verify onDeleteEntryRequested with files.
 */
it('fsp-onDeleteEntry-file', function(done) {
  const options = {
    fileSystemId: 'id',
    entryPath: '/path',
    recursive: false,
  };

  this.client.removeFile.return = (path) => {
    assert.equal('./path', path);
  };
  nassh.sftp.fsp.onDeleteEntryRequested(
      options,
      done,
      assert.fail);
});

/**
 * Verify onDeleteEntryRequested with symlinks.
 */
it('fsp-onDeleteEntry-symlink', function(done) {
  const options = {
    fileSystemId: 'id',
    entryPath: '/sym',
    recursive: true,
  };

  this.client.linkStatus.return = (path) => {
    assert.equal('./sym', path);
    return {isDirectory: false, isLink: true};
  };
  this.client.removeFile.return = (path) => {
    assert.equal('./sym', path);
  };
  nassh.sftp.fsp.onDeleteEntryRequested(
      options,
      done,
      assert.fail);
});

/**
 * Verify onTruncateRequested with missing path.
 */
it('fsp-onTruncate-missing', function(done) {
  const options = {fileSystemId: 'id', filePath: '/foo'};

  nassh.sftp.fsp.onTruncateRequested(
      options,
      assert.fail,
      (error) => {
        assert.equal('FAILED', error);
        done();
      });
});

/**
 * Verify onTruncateRequested works.
 */
it('fsp-onTruncate-found', function(done) {
  const options = {
    fileSystemId: 'id',
    filePath: '/foo',
    requestId: 1,
  };

  this.client.openFile.return = (path, pflags) => {
    assert.equal('./foo', path);
    assert.equal(nassh.sftp.packets.OpenFlags.CREAT |
                 nassh.sftp.packets.OpenFlags.TRUNC, pflags);
    return 'handle';
  };
  this.client.closeFile.return = (handle) => {
    assert.equal('handle', handle);
  };
  nassh.sftp.fsp.onTruncateRequested(
      options,
      () => {
        assert.deepStrictEqual([], Object.keys(this.client.openedFiles));
        done();
      },
      assert.fail);
});

/**
 * Verify onCloseFileRequested with missing path.
 */
it('fsp-onCloseFile-missing', function(done) {
  const options = {fileSystemId: 'id', openRequestId: 1};

  nassh.sftp.fsp.onCloseFileRequested(
      options,
      assert.fail,
      (error) => {
        assert.equal('INVALID_OPERATION', error);
        done();
      });
});

/**
 * Verify onCloseFileRequested works.
 */
it('fsp-onCloseFile-found', function(done) {
  const options = {fileSystemId: 'id', openRequestId: 1};

  this.client.openedFiles[1] = 'handle';
  this.client.closeFile.return = (handle) => {
    assert.equal('handle', handle);
  };
  nassh.sftp.fsp.onCloseFileRequested(
      options,
      () => {
        assert.deepStrictEqual([], Object.keys(this.client.openedFiles));
        done();
      },
      assert.fail);
});

/**
 * Verify onCreateDirectoryRequested with missing path.
 */
it('fsp-onCreateDirectory-missing', function(done) {
  const options = {fileSystemId: 'id', directoryPath: '/foo'};

  nassh.sftp.fsp.onCreateDirectoryRequested(
      options,
      assert.fail,
      (error) => {
        assert.equal('FAILED', error);
        done();
      });
});

/**
 * Verify onCreateDirectoryRequested fails for recursive requests.
 */
it('fsp-onCreateDirectory-recursive', function(done) {
  const options = {
    fileSystemId: 'id',
    directoryPath: '/foo',
    recursive: true,
  };

  nassh.sftp.fsp.onCreateDirectoryRequested(
      options,
      assert.fail,
      (error) => {
        assert.equal('INVALID_OPERATION', error);
        done();
      });
});

/**
 * Verify onCreateDirectoryRequested works.
 */
it('fsp-onCreateDirectory-found', function(done) {
  const options = {fileSystemId: 'id', directoryPath: '/foo'};

  this.client.makeDirectory.return = (path) => {
    assert.equal('./foo', path);
  };
  nassh.sftp.fsp.onCreateDirectoryRequested(
      options,
      done,
      assert.fail);
});

/**
 * Verify onMoveEntryRequested with missing path.
 */
it('fsp-onMoveEntry-missing', function(done) {
  const options = {fileSystemId: 'id', sourcePath: '/src', targetPath: '/dst'};

  nassh.sftp.fsp.onMoveEntryRequested(
      options,
      assert.fail,
      (error) => {
        assert.equal('FAILED', error);
        done();
      });
});

/**
 * Verify onMoveEntryRequested works.
 */
it('fsp-onMoveEntry-found', function(done) {
  const options = {fileSystemId: 'id', sourcePath: '/src', targetPath: '/dst'};

  this.client.renameFile.return = (sourcePath, targetPath) => {
    assert.equal('./src', sourcePath);
    assert.equal('./dst', targetPath);
  };
  nassh.sftp.fsp.onMoveEntryRequested(
      options,
      done,
      assert.fail);
});

/**
 * Verify onReadFileRequested with missing path.
 */
it('fsp-onReadFile-missing', function(done) {
  const options = {fileSystemId: 'id', openRequestId: 1};

  nassh.sftp.fsp.onReadFileRequested(
      options,
      (chunk, hasMore) => assert.fail(),
      (error) => {
        assert.equal('INVALID_OPERATION', error);
        done();
      });
});

/**
 * Verify onCopyEntryRequested with missing path.
 */
it('fsp-onCopyEntry-missing', function(done) {
  const options = {fileSystemId: 'id', sourcePath: '/src', targetPath: '/dst'};

  nassh.sftp.fsp.onCopyEntryRequested(
      options,
      assert.fail,
      (error) => {
        assert.equal('FAILED', error);
        done();
      });
});

/**
 * Verify onCopyEntryRequested with a symlink.
 */
it('fsp-onCopyEntry-symlink', function(done) {
  const options = {fileSystemId: 'id', sourcePath: '/src', targetPath: '/dst'};

  this.client.linkStatus.return = (path) => {
    assert.equal('./src', path);
    return {isDirectory: false, isLink: true};
  };
  this.client.readLink.return = (path) => {
    assert.equal('./src', path);
    return {
      files: [{filename: '/sym'}],
    };
  };
  this.client.symLink.return = (target, path) => {
    assert.equal('/sym', target);
    assert.equal('./dst', path);
  };
  nassh.sftp.fsp.onCopyEntryRequested(
      options,
      done,
      assert.fail);
});

/**
 * Verify onUnmount works normally.
 */
it('fsp-onUnmount-exit', function() {
  // Create a dummy instance mock that has an exit method.
  let exitStatus;
  nassh.sftp.fsp.sftpInstances['id'] = {
    exit: (status) => exitStatus = status,
  };

  // The tests don't have access to chrome.fileSystemProvider, so stub out the
  // success & error callbacks since they won't be used currently.
  nassh.sftp.fsp.onUnmountRequested(
      {fileSystemId: 'id'},
      assert.fail,
      assert.fail);
  assert.equal(0, exitStatus);
});

});
