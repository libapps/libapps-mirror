// Copyright (c) 2014 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

'use strict';

/**
 * A binding that represents an open file on a wam.binding.fs.FileSystem.
 *
 * You should only create an OpenContext by calling an instance of
 * wam.binding.fs.FileSystem..createOpenContext().
 *
 * @param {wam.binding.fs.FileSystem} The parent file system.
 */
wam.binding.fs.OpenContext = function(fileSystem) {
  // We're a 'subclass' of wam.binding.Ready.
  wam.binding.Ready.call(this);

  /**
   * Parent file system.
   */
  this.fileSystem = fileSystem;

  // If the parent file system is closed, we close too.
  this.dependsOn(this.fileSystem);

  // When the open context is marked as ready is should include a wam.fs stat
  // result for the target file.
  this.onReady.addListener(function(value) { this.wamStat = value }.bind(this));

  /**
   * Events sourced by this binding in addition to the inherited events from
   * wam.binding.Ready.
   *
   * These are raised after the corresponding method is invoked.  For example,
   * wam.binding.fs.open(...) raises the onOpen event.
   */
  this.onOpen = new wam.Event(function() { this.didOpen_ = true }.bind(this));
  this.onSeek = new wam.Event();
  this.onRead = new wam.Event();
  this.onWrite = new wam.Event();

  // An indication that the open() method was called.
  this.didOpen_ = false;

  /**
   * That path that this OpenContext was opened for.
   */
  this.path = null;
  /**
   * The wam stat result we received when the file was opened.
   */
  this.wamStat = null;

  this.mode = {
    create: false,
    exclusive: false,
    truncate: false,
    read: false,
    write: false
  };
};

wam.binding.fs.OpenContext.prototype = Object.create(
    wam.binding.Ready.prototype);

/**
 * List of acceptable values for the 'dataType' parameter used in stat and read
 * operations.
 */
wam.binding.fs.OpenContext.dataTypes = [
    /**
     * Not used in stat results.
     *
     * When a dataType of 'arraybuffer' is used on read and write requests, the
     * data is expected to be an ArrayBuffer instance.
     *
     * NOTE(rginda): ArrayBuffer objects don't work over wam.transport.
     * ChromePort, due to <https://crbug.com/374454>.
     */
    'arraybuffer',

    /**
     * Not used in stat results.
     *
     * When used in read and write requests, the data will be a base64 encoded
     * string.  Note that decoding this value to a UTF8 string may result in
     * invalid UTF8 sequences or data corruption.
     */
    'base64-string',

    /**
     * In stat results, a dataType of 'blob' means that the file contains a set
     * of random access bytes.
     *
     * When a dataType of 'blob' is used on a read request, the data is expected
     * to be an instance of an opened Blob object.
     *
     * NOTE(rginda): Blobs can't cross origin over wam.transport.ChromePort.
     * Need to test over HTML5 MessageChannels.
     */
    'blob',

    /**
     * Not used in stat results.
     *
     * When used in read and write requests, the data will be a UTF-8
     * string.  Note that if the underlying file contains sequences that cannot
     * be encoded in UTF-8, the result may contain invalid sequences or may
     * not match the actual contents of the file.
     */
    'utf8-string',

    /**
     * In stat results, a dataType of 'value' means that the file contains a
     * single value which can be of any type.
     *
     * When a dataType of 'value' is used on a read request, the results of
     * the read will be the native type stored in the file.  If the file
     * natively stores a blob, the result will be a string.
     */
    'value',
  ];

/**
 * Open a file.
 *
 * This can only be called once per OpenContext instance.
 *
 * This function attempts to open a path.  If the open succeeds, the onReady
 * event of this binding will fire, and will include the wam 'stat' value
 * for the target file.  From there you can call the OpenContext seek, read,
 * and write methods to operate on the target.  When you're finished, call
 * closeOk, closeError, or closeErrorValue to clean up the context.
 *
 * If the open fails, the onClose event of this binding will fire and will
 * include a wam error value.
 *
 * The arg parameter should be an object.  The only recognized property
 * is 'mode', and may contain one or more of the following properties to
 * override the default open mode.
 *
 *   mode {
 *     create: false, True to create the file if it doesn't exist,
 *     exclusive: false, True to fail if create && file exists.
 *     truncate: false, True to empty the file after opening.
 *     read: true, True to enable read operations.
 *     write: false, True to enable write operations.
 *   }
 *
 * @param {string} path The path to open.
 * @param {Object} arg The open arguments.
 */
wam.binding.fs.OpenContext.prototype.open = function(path, arg) {
  this.assertReadyState('WAIT');

  if (this.didOpen_)
    throw new Error('Already opened on this context');

  this.path = path;
  if (arg && arg.mode && typeof arg.mode == 'object') {
    this.mode.create = !!arg.mode.create;
    this.mode.exclusive = !!arg.mode.exclusive;
    this.mode.truncate = !!arg.mode.truncate;
    this.mode.read = !!arg.mode.read;
    this.mode.write = !!arg.mode.write;
  } else {
    this.mode.read = true;
  }

  this.onOpen();
};

/**
 * Sanity check an inbound arguments.
 *
 * @param {Object} arg The arguments object to check.
 * @param {function(wam.Error)} onError the callback to invoke if the
 *   check fails.
 *
 * @return {boolean} True if the arg object is valid, false if it failed.
 */
wam.binding.fs.OpenContext.prototype.checkArg_ = function(arg, onError) {
  // If there's an offset, it must be a number.
  if ('offset' in arg && typeof arg.offset != 'number') {
    wam.async(onError, [null, 'wam.FileSystem.Error.BadOrMissingArgument',
                        ['offset', 'number']]);
    return false;
  }

  // If there's a count, it must be a number.
  if ('count' in arg && typeof arg.count != 'number') {
    wam.async(onError, [null, 'wam.FileSystem.Error.BadOrMissingArgument',
                        ['count', 'number']]);
    return false;
  }

  // If there's a whence, it's got to match this regexp.
  if ('whence' in arg && !/^(begin|current|end)$/.test(arg.whence)) {
    wam.async(onError, [null, 'wam.FileSystem.Error.BadOrMissingArgument',
                        ['whence', '(begin | current | end)']]);
    return false;
  }

  // If there's a whence, there's got to be an offset.
  if (arg.whence && !('offset' in arg)) {
    wam.async(onError, [null, 'wam.FileSystem.Error.BadOrMissingArgument',
                        ['offset', 'number']]);
    return false;
  }

  // If there's an offset, there's got to be a whence.
  if (('offset' in arg) && !arg.whence) {
    wam.async(onError, [null, 'wam.FileSystem.Error.BadOrMissingArgument',
                        ['whence', '(begin | current | end)']]);
    return false;
  }

  // If there's a dataType, it's got to be valid.
  if ('dataType' in arg &&
      wam.binding.fs.OpenContext.dataTypes.indexOf(arg.dataType) == -1) {
    wam.async(onError,
              [null, 'wam.FileSystem.Error.BadOrMissingArgument',
               ['dataType',
                '(' + wam.binding.fs.OpenContext.dataTypes.join(' | ') + ')']]);
    return false;
  }

  return true;
};

/**
 * Seek to a new position in the file.
 *
 * The arg object should be an object with the following properties:
 *
 *  arg {
 *    offset: 0, An integer position to seek to.
 *    whence: ('begin', 'current', 'end'), A string specifying the origin of
 *      the seek.
 *  }
 *
 * @param {Object} arg The seek arg.
 * @param {function()} onSuccess The callback to invoke if the seek succeeds.
 * @param {function(wam.Error)} onError The callback to invoke if the seek
 *   fails.
 */
wam.binding.fs.OpenContext.prototype.seek = function(arg, onSuccess, onError) {
  this.assertReady();

  if (!this.checkArg_(arg, onError))
    return;

  this.onRead(arg, onSuccess, onError);
};

/**
 * Read from the file.
 *
 * The arg object should be an object with the following properties:
 *
 *  arg {
 *    offset: 0, An integer position to seek to before reading.
 *    whence: ('begin', 'current', 'end'), A string specifying the origin of
 *      the seek.
 *    dataType: The data type you would prefer to receive.  Mus be one of
 *      wam.binding.fs.OpenContext.dataTypes.  If the target cannot provide
 *      the requested format it should fail the read.  If you leave this
 *      unspecified the target will choose a dataType.
 *  }
 *
 * @param {Object} arg The read arg.
 * @param {function()} onSuccess The callback to invoke if the read succeeds.
 * @param {function(wam.Error)} onError The callback to invoke if the read
 *   fails.
 */
wam.binding.fs.OpenContext.prototype.read = function(arg, onSuccess, onError) {
  this.assertReady();

  if (!this.mode.read) {
    wam.async(onError, [null, 'wam.FileSystem.Error.OperationNotSupported',
                        []]);
    return;
  }

  if (!this.checkArg_(arg, onError))
    return;

  this.onRead(arg, onSuccess, onError);
};

/**
 * Write to a file.
 *
 * The arg object should be an object with the following properties:
 *
 *  arg {
 *    offset: 0, An integer position to seek to before writing.
 *    whence: ('begin', 'current', 'end'), A string specifying the origin of
 *      the seek.
 *    data: The data you want to write.
 *    dataType: The type of data you're providing.  Must be one of
 *      wam.binding.fs.OpenContext.dataTypes.  If the 'data' argument is an
 *      instance of a Blob or ArrayBuffer instance, this argument has no
 *      effect.
 *  }
 *
 * @param {Object} arg The write arg.
 * @param {function()} onSuccess The callback to invoke if the write succeeds.
 * @param {function(wam.Error)} onError The callback to invoke if the write
 *   fails.
 */
wam.binding.fs.OpenContext.prototype.write = function(arg, onSuccess, onError) {
  this.assertReady();

  if (!this.mode.write) {
    wam.async(onError,
              [null, 'wam.FileSystem.Error.OperationNotSupported', []]);
    return;
  }

  if (!this.checkArg_(arg, onError))
    return;

  this.onWrite(arg, onSuccess, onError);
};
