// Copyright 2019 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

'use strict';

/**
 * @fileoverview FileSystemProvider tests.
 */

nassh.sftp.fsp.Tests = new lib.TestManager.Suite('nassh.sftp.fsp.Tests');

/**
 * A mock SFTP client.
 */
const MockSftpClient = function() {
  this.openedFiles = {};

  // Methods in nassh.sftp.Client that we mock.
  const methods = [
    'closeFile', 'fileStatus', 'makeDirectory', 'openDirectory', 'openFile',
    'readDirectory', 'removeDirectory', 'removeFile', 'renameFile',
    'scanDirectory',
  ];
  methods.forEach((method) => {
    this[method] = (...args) => this.automock_(method, ...args);
  });
};

/**
 * Mock helper for stubbing out calls.
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

/**
 * Reset any FSP state.
 */
nassh.sftp.fsp.Tests.prototype.preamble = function(result, cx) {
  this.client = new MockSftpClient();
  nassh.sftp.fsp.sftpInstances = {
    'id': {
      'sftpClient': this.client,
    },
  };

  const packet = new nassh.sftp.Packet(
      // 32-bit request id.
      '\x01\x02\x03\x04' +
      // 32-bit code.
      '\x00\x00\x00\x01' +
      // Message string.
      '\x00\x00\x00\x00' +
      // Language string.
      '\x00\x00\x00\x00'
  );
  this.eofPacket = new nassh.sftp.packets.StatusPacket(packet);
};

/**
 * Verify all FSP methods are properly registered.
 */
nassh.sftp.fsp.Tests.addTest('fsp-known-methods', function(result, cx) {
  // Sanity check that we have some methods.
  result.assert(nassh.sftp.fsp.providerMethods.length > 10);

  // Make sure every method is registered.
  nassh.sftp.fsp.providerMethods.forEach((method) => {
    result.assertEQ('function', typeof nassh.sftp.fsp[method]);
  });

  result.pass();
});

/**
 * Check all calls w/invalid or unknown filesystem ids fail.
 *
 * This shows up when the Files app state is out of sync with us.
 */
nassh.sftp.fsp.Tests.addTest('fsp-invalid-fsid', function(result, cx) {
  let count = 0;
  nassh.sftp.fsp.providerMethods.forEach((method) => {
    // onMountRequested doesn't make callbacks.
    if (method == 'onMountRequested') {
      ++count;
      return;
    }

    nassh.sftp.fsp[method]({}, () => result.fail(), (error) => {
      result.assertEQ('FAILED', error);
      ++count;
    });
  });

  // Make sure every error callback was actually called.
  result.assertEQ(count, nassh.sftp.fsp.providerMethods.length);

  result.pass();
});

/**
 * Verify the checkInstanceExists utility function.
 */
nassh.sftp.fsp.Tests.addTest('fsp-instance-check', function(result, cx) {
  let called;
  let ret;

  // Undefined ids should error.
  called = false;
  ret = nassh.sftp.fsp.checkInstanceExists(undefined, (error) => {
    result.assertEQ('FAILED', error);
    called = true;
  });
  result.assertEQ(true, called);
  result.assertEQ(false, ret);

  // Unknown ids should error.
  called = false;
  ret = nassh.sftp.fsp.checkInstanceExists('1234', (error) => {
    result.assertEQ('FAILED', error);
    called = true;
  });
  result.assertEQ(true, called);
  result.assertEQ(false, ret);

  // Valid ids should pass.
  nassh.sftp.fsp.sftpInstances['1234'] = {};
  ret = nassh.sftp.fsp.checkInstanceExists('1234', (error) => result.fail());
  result.assertEQ(true, ret);

  result.pass();
});

/**
 * Verify the sanitizeMetadata utility function.
 */
nassh.sftp.fsp.Tests.addTest('fsp-sanitize-metadata', function(result, cx) {
  // Reduced mock for nassh.sftp.packets.getFileAttrs like fileStatus returns.
  const fileStat = {
    size: 1024,
    isDirectory: false,
    last_modified: 100,
  };
  const dirStat = {
    size: 0,
    isDirectory: true,
    last_modified: 200,
  };
  // Mock for directory entry like readDirectory returns.
  const fileEntry = Object.assign({filename: 'foo.txt'}, fileStat);
  const dirEntry = Object.assign({filename: 'dir'}, dirStat);

  let ret;

  // Nothing is requested so nothing is returned or even checked.
  ret = nassh.sftp.fsp.sanitizeMetadata(undefined, {});
  result.assertEQ([], Object.keys(ret));
  ret = nassh.sftp.fsp.sanitizeMetadata({}, {});
  result.assertEQ([], Object.keys(ret));

  // Check each field by itself.
  ret = nassh.sftp.fsp.sanitizeMetadata(fileEntry, {name: true});
  result.assertEQ(['name'], Object.keys(ret));
  result.assertEQ('foo.txt', ret.name);
  ret = nassh.sftp.fsp.sanitizeMetadata(fileEntry, {isDirectory: true});
  result.assertEQ(['isDirectory'], Object.keys(ret));
  result.assertEQ(false, ret.isDirectory);
  ret = nassh.sftp.fsp.sanitizeMetadata(fileEntry, {size: true});
  result.assertEQ(['size'], Object.keys(ret));
  result.assertEQ(1024, ret.size);
  ret = nassh.sftp.fsp.sanitizeMetadata(fileEntry, {modificationTime: true});
  result.assertEQ(['modificationTime'], Object.keys(ret));
  result.assertEQ(100000, ret.modificationTime.getTime());

  // Check requesting multiple things at once.
  ret = nassh.sftp.fsp.sanitizeMetadata(dirEntry, {
    name: true,
    isDirectory: true,
    size: true,
    modificationTime: true,
  });
  result.assertEQ(['isDirectory', 'modificationTime', 'name', 'size'],
                  Object.keys(ret).sort());
  result.assertEQ('dir', ret.name);
  result.assertEQ(true, ret.isDirectory);
  result.assertEQ(0, ret.size);
  result.assertEQ(200000, ret.modificationTime.getTime());

  // Check filtering of attrs.
  ret = nassh.sftp.fsp.sanitizeMetadata(dirStat, {
    name: true,
    directoryPath: '/a/b/c',
  });
  result.assertEQ(['name'], Object.keys(ret));
  result.assertEQ('c', ret.name);

  ret = nassh.sftp.fsp.sanitizeMetadata(fileStat, {
    name: true,
    entryPath: '/a/b/c.txt',
  });
  result.assertEQ(['name'], Object.keys(ret));
  result.assertEQ('c.txt', ret.name);

  result.pass();
});

/**
 * Verify onGetMetadataRequested with missing paths.
 */
nassh.sftp.fsp.Tests.addTest('fsp-onGetMetadata-missing', function(result, cx) {
  const options = {fileSystemId: 'id', entryPath: '/foo'};

  nassh.sftp.fsp.onGetMetadataRequested(
      options,
      (metadata) => result.fail(),
      (error) => {
        result.assertEQ('NOT_FOUND', error);
        result.pass(false);
      });

  result.requestTime(2000);
});

/**
 * Verify onGetMetadataRequested with existing path.
 */
nassh.sftp.fsp.Tests.addTest('fsp-onGetMetadata-found', function(result, cx) {
  const options = {
    fileSystemId: 'id',
    entryPath: '/foo',
    isDirectory: true,
    size: true,
  };

  this.client.fileStatus.return = (path) => {
    result.assertEQ('./foo', path);
    return {
      isDirectory: false,
      size: 100,
    };
  };
  nassh.sftp.fsp.onGetMetadataRequested(
      options,
      (metadata) => {
        result.assertEQ(false, metadata.isDirectory);
        result.assertEQ(100, metadata.size);
        result.pass(false);
      },
      (error) => result.fail());

  result.requestTime(2000);
});

/**
 * Verify onReadDirectoryRequested with missing path.
 */
nassh.sftp.fsp.Tests.addTest('fsp-onReadDirectory-missing', function(result, cx) {
  const options = {fileSystemId: 'id', directoryPath: '/dir'};

  nassh.sftp.fsp.onReadDirectoryRequested(
      options,
      (entries, hasMore) => result.fail(),
      (error) => {
        result.assertEQ('FAILED', error);
        result.pass(false);
      });

  result.requestTime(2000);
});

/**
 * Verify onReadDirectoryRequested with empty dir.
 */
nassh.sftp.fsp.Tests.addTest('fsp-onReadDirectory-empty', function(result, cx) {
  const options = {fileSystemId: 'id', directoryPath: '/dir'};

  this.client.openDirectory.return = (path) => {
    result.assertEQ('./dir', path);
    return 'handle';
  };
  this.client.scanDirectory.return = (handle, filter) => {
    result.assertEQ('handle', handle);
    return [];
  };
  this.client.closeFile.return = (handle) => {
    result.assertEQ('handle', handle);
    result.pass(false);
  };
  nassh.sftp.fsp.onReadDirectoryRequested(
      options,
      (entries, hasMore) => {
        result.assertEQ([], entries);
        result.assertEQ(false, hasMore);
      },
      (error) => result.fail());

  result.requestTime(2000);
});

/**
 * Verify onReadDirectoryRequested with real results.
 */
nassh.sftp.fsp.Tests.addTest('fsp-onReadDirectory-found', function(result, cx) {
  const options = {
    fileSystemId: 'id',
    directoryPath: '/dir',
    isDirectory: true,
    name: true,
  };

  this.client.openDirectory.return = (path) => {
    result.assertEQ('./dir', path);
    return 'handle';
  };
  let entries = [
    {filename: '.', isDirectory: true},
    {filename: '..', isDirectory: true},
    {filename: 'foo.txt', isDirectory: false},
    {filename: 'dir', isDirectory: true},
    {filename: 'sym', isDirectory: false, isLink: true},
  ];
  this.client.scanDirectory.return = (handle, filter) => {
    let filtered = [];
    result.assertEQ('handle', handle);
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
    result.assertEQ('handle', handle);
    result.pass(false);
  };
  nassh.sftp.fsp.onReadDirectoryRequested(
      options,
      (entries, hasMore) => {
        result.assertEQ(2, entries.length);
        result.assertEQ('foo.txt', entries[0].name);
        result.assertEQ(false, entries[0].isDirectory);
        result.assertEQ('dir', entries[1].name);
        result.assertEQ(true, entries[1].isDirectory);
        result.assertEQ(false, hasMore);
      },
      (error) => result.fail());

  result.requestTime(2000);
});

/**
 * Verify onWriteFileRequested with missing path.
 */
nassh.sftp.fsp.Tests.addTest('fsp-onWriteFile-missing', function(result, cx) {
  const options = {fileSystemId: 'id', openRequestId: 1};

  nassh.sftp.fsp.onWriteFileRequested(
      options,
      () => result.fail(),
      (error) => {
        result.assertEQ('INVALID_OPERATION', error);
        result.pass(false);
      });

  result.requestTime(2000);
});

/**
 * Verify onOpenFileRequested with missing path.
 */
nassh.sftp.fsp.Tests.addTest('fsp-onOpenFile-missing', function(result, cx) {
  const options = {fileSystemId: 'id', filePath: '/foo'};

  nassh.sftp.fsp.onOpenFileRequested(
      options,
      () => result.fail(),
      (error) => {
        result.assertEQ('FAILED', error);
        result.pass(false);
      });

  result.requestTime(2000);
});

/**
 * Verify onOpenFileRequested open file for reading.
 */
nassh.sftp.fsp.Tests.addTest('fsp-onOpenFile-read', function(result, cx) {
  const options = {
    fileSystemId: 'id',
    filePath: '/foo',
    requestId: 1,
    mode: 'READ',
  };

  this.client.openFile.return = (path, pflags) => {
    result.assertEQ('./foo', path);
    result.assertEQ(nassh.sftp.packets.OpenFlags.READ, pflags);
    return 'handle';
  };
  nassh.sftp.fsp.onOpenFileRequested(
      options,
      () => {
        result.assertEQ('handle', this.client.openedFiles[1]);
        result.pass(false);
      },
      (error) => result.fail());

  result.requestTime(2000);
});

/**
 * Verify onOpenFileRequested open file for writing.
 */
nassh.sftp.fsp.Tests.addTest('fsp-onOpenFile-write', function(result, cx) {
  const options = {
    fileSystemId: 'id',
    filePath: '/foo',
    requestId: 1,
    mode: 'WRITE',
  };

  this.client.openFile.return = (path, pflags) => {
    result.assertEQ('./foo', path);
    result.assertEQ(nassh.sftp.packets.OpenFlags.WRITE, pflags);
    return 'handle';
  };
  nassh.sftp.fsp.onOpenFileRequested(
      options,
      () => {
        result.assertEQ('handle', this.client.openedFiles[1]);
        result.pass(false);
      },
      (error) => result.fail());

  result.requestTime(2000);
});

/**
 * Verify onCreateFileRequested with missing path.
 */
nassh.sftp.fsp.Tests.addTest('fsp-onCreateFile-missing', function(result, cx) {
  const options = {fileSystemId: 'id', filePath: '/foo'};

  nassh.sftp.fsp.onCreateFileRequested(
      options,
      () => result.fail(),
      (error) => {
        result.assertEQ('FAILED', error);
        result.pass(false);
      });

  result.requestTime(2000);
});

/**
 * Verify onCreateFileRequested works.
 */
nassh.sftp.fsp.Tests.addTest('fsp-onCreateFile-found', function(result, cx) {
  const options = {
    fileSystemId: 'id',
    filePath: '/foo',
    requestId: 1,
  };

  this.client.openFile.return = (path, pflags) => {
    result.assertEQ('./foo', path);
    result.assertEQ(nassh.sftp.packets.OpenFlags.CREAT |
                    nassh.sftp.packets.OpenFlags.EXCL, pflags);
    return 'handle';
  };
  nassh.sftp.fsp.onCreateFileRequested(
      options,
      () => {
        result.assertEQ('handle', this.client.openedFiles[1]);
        result.pass(false);
      },
      (error) => result.fail());

  result.requestTime(2000);
});

/**
 * Verify onDeleteEntryRequested with missing dirs.
 */
nassh.sftp.fsp.Tests.addTest('fsp-onDeleteEntry-missing-dir', function(result, cx) {
  const options = {
    fileSystemId: 'id',
    entryPath: '/path',
    recursive: true,
  };

  nassh.sftp.fsp.onDeleteEntryRequested(
      options,
      () => result.fail(),
      (error) => {
        result.assertEQ('NOT_FOUND', error);
        result.pass(false);
      });

  result.requestTime(2000);
});

/**
 * Verify onDeleteEntryRequested with dirs.
 */
nassh.sftp.fsp.Tests.addTest('fsp-onDeleteEntry-dir', function(result, cx) {
  const options = {
    fileSystemId: 'id',
    entryPath: '/dir',
    recursive: true,
  };

  this.client.removeDirectory.return = (path, recursive) => {
    result.assertEQ('./dir', path);
    result.assertEQ(true, recursive);
  };
  nassh.sftp.fsp.onDeleteEntryRequested(
      options,
      () => result.pass(false),
      (error) => result.fail());

  result.requestTime(2000);
});

/**
 * Verify onDeleteEntryRequested with missing files.
 */
nassh.sftp.fsp.Tests.addTest('fsp-onDeleteEntry-missing-file', function(result, cx) {
  const options = {
    fileSystemId: 'id',
    entryPath: '/path',
    recursive: false,
  };

  nassh.sftp.fsp.onDeleteEntryRequested(
      options,
      () => result.fail(),
      (error) => {
        result.assertEQ('NOT_FOUND', error);
        result.pass(false);
      });

  result.requestTime(2000);
});

/**
 * Verify onDeleteEntryRequested with files.
 */
nassh.sftp.fsp.Tests.addTest('fsp-onDeleteEntry-file', function(result, cx) {
  const options = {
    fileSystemId: 'id',
    entryPath: '/path',
    recursive: false,
  };

  this.client.removeFile.return = (path) => {
    result.assertEQ('./path', path);
  };
  nassh.sftp.fsp.onDeleteEntryRequested(
      options,
      () => result.pass(false),
      (error) => result.fail());

  result.requestTime(2000);
});

/**
 * Verify onTruncateRequested with missing path.
 */
nassh.sftp.fsp.Tests.addTest('fsp-onTruncate-missing', function(result, cx) {
  const options = {fileSystemId: 'id', filePath: '/foo'};

  nassh.sftp.fsp.onTruncateRequested(
      options,
      () => result.fail(),
      (error) => {
        result.assertEQ('FAILED', error);
        result.pass(false);
      });

  result.requestTime(2000);
});

/**
 * Verify onTruncateRequested works.
 */
nassh.sftp.fsp.Tests.addTest('fsp-onTruncate-found', function(result, cx) {
  const options = {
    fileSystemId: 'id',
    filePath: '/foo',
    requestId: 1,
  };

  this.client.openFile.return = (path, pflags) => {
    result.assertEQ('./foo', path);
    result.assertEQ(nassh.sftp.packets.OpenFlags.CREAT |
                    nassh.sftp.packets.OpenFlags.TRUNC, pflags);
    return 'handle';
  };
  this.client.closeFile.return = (handle) => {
    result.assertEQ('handle', handle);
  };
  nassh.sftp.fsp.onTruncateRequested(
      options,
      () => {
        result.assertEQ([], Object.keys(this.client.openedFiles));
        result.pass(false);
      },
      (error) => result.fail());

  result.requestTime(2000);
});

/**
 * Verify onCloseFileRequested with missing path.
 */
nassh.sftp.fsp.Tests.addTest('fsp-onCloseFile-missing', function(result, cx) {
  const options = {fileSystemId: 'id', openRequestId: 1};

  nassh.sftp.fsp.onCloseFileRequested(
      options,
      () => result.fail(),
      (error) => {
        result.assertEQ('INVALID_OPERATION', error);
        result.pass(false);
      });

  result.requestTime(2000);
});

/**
 * Verify onCloseFileRequested works.
 */
nassh.sftp.fsp.Tests.addTest('fsp-onCloseFile-found', function(result, cx) {
  const options = {fileSystemId: 'id', openRequestId: 1};

  this.client.openedFiles[1] = 'handle';
  this.client.closeFile.return = (handle) => {
    result.assertEQ('handle', handle);
  };
  nassh.sftp.fsp.onCloseFileRequested(
      options,
      () => {
        result.assertEQ([], Object.keys(this.client.openedFiles));
        result.pass(false);
      },
      (error) => result.fail());

  result.requestTime(2000);
});

/**
 * Verify onCreateDirectoryRequested with missing path.
 */
nassh.sftp.fsp.Tests.addTest('fsp-onCreateDirectory-missing', function(result, cx) {
  const options = {fileSystemId: 'id', directoryPath: '/foo'};

  nassh.sftp.fsp.onCreateDirectoryRequested(
      options,
      () => result.fail(),
      (error) => {
        result.assertEQ('FAILED', error);
        result.pass(false);
      });

  result.requestTime(2000);
});

/**
 * Verify onCreateDirectoryRequested fails for recursive requests.
 */
nassh.sftp.fsp.Tests.addTest('fsp-onCreateDirectory-recursive', function(result, cx) {
  const options = {
    fileSystemId: 'id',
    directoryPath: '/foo',
    recursive: true,
  };

  nassh.sftp.fsp.onCreateDirectoryRequested(
      options,
      () => result.fail(),
      (error) => {
        result.assertEQ('INVALID_OPERATION', error);
        result.pass(false);
      });

  result.requestTime(2000);
});

/**
 * Verify onCreateDirectoryRequested works.
 */
nassh.sftp.fsp.Tests.addTest('fsp-onCreateDirectory-found', function(result, cx) {
  const options = {fileSystemId: 'id', directoryPath: '/foo'};

  this.client.makeDirectory.return = (path) => {
    result.assertEQ('./foo', path);
  };
  nassh.sftp.fsp.onCreateDirectoryRequested(
      options,
      () => result.pass(false),
      (error) => result.fail());

  result.requestTime(2000);
});

/**
 * Verify onMoveEntryRequested with missing path.
 */
nassh.sftp.fsp.Tests.addTest('fsp-onMoveEntry-missing', function(result, cx) {
  const options = {fileSystemId: 'id', sourcePath: '/src', targetPath: '/dst'};

  nassh.sftp.fsp.onMoveEntryRequested(
      options,
      () => result.fail(),
      (error) => {
        result.assertEQ('FAILED', error);
        result.pass(false);
      });

  result.requestTime(2000);
});

/**
 * Verify onMoveEntryRequested works.
 */
nassh.sftp.fsp.Tests.addTest('fsp-onMoveEntry-found', function(result, cx) {
  const options = {fileSystemId: 'id', sourcePath: '/src', targetPath: '/dst'};

  this.client.renameFile.return = (sourcePath, targetPath) => {
    result.assertEQ('./src', sourcePath);
    result.assertEQ('./dst', targetPath);
  };
  nassh.sftp.fsp.onMoveEntryRequested(
      options,
      () => result.pass(false),
      (error) => result.fail());

  result.requestTime(2000);
});

/**
 * Verify onReadFileRequested with missing path.
 */
nassh.sftp.fsp.Tests.addTest('fsp-onReadFile-missing', function(result, cx) {
  const options = {fileSystemId: 'id', openRequestId: 1};

  nassh.sftp.fsp.onReadFileRequested(
      options,
      () => result.fail(),
      (error) => {
        result.assertEQ('INVALID_OPERATION', error);
        result.pass(false);
      });

  result.requestTime(2000);
});

/**
 * Verify onCopyEntryRequested with missing path.
 */
nassh.sftp.fsp.Tests.addTest('fsp-onCopyEntry-missing', function(result, cx) {
  const options = {fileSystemId: 'id', sourcePath: '/src', targetPath: '/dst'};

  nassh.sftp.fsp.onCopyEntryRequested(
      options,
      () => result.fail(),
      (error) => {
        result.assertEQ('FAILED', error);
        result.pass(false);
      });

  result.requestTime(2000);
});

/**
 * Verify onUnmount works normally.
 */
nassh.sftp.fsp.Tests.addTest('fsp-onUnmount-exit', function(result, cx) {
  // Create a dummy instance mock that has an exit method.
  let exitStatus;
  nassh.sftp.fsp.sftpInstances['id'] = {
    exit: (status) => exitStatus = status,
  };

  // The tests don't have access to chrome.fileSystemProvider, so stub out the
  // success & error callbacks since they won't be used currently.
  nassh.sftp.fsp.onUnmountRequested(
      {fileSystemId: 'id'},
      () => result.fail(),
      (error) => result.fail());
  result.assertEQ(0, exitStatus);

  result.pass();
});
