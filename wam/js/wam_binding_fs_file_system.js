// Copyright (c) 2014 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

'use strict';

/**
 * A binding that represents a wam file system.
 *
 * This is the idealized interface to all wam file systems.  Specific
 * implementations bind with this by subscribing to events.
 */
wam.binding.fs.FileSystem = function() {
  // We're a subclass of a ready binding.  This file system is not usable
  // until the readyStatus becomes 'ready'.  If the readStatus is closed,
  // the file system is no longer valid.
  wam.binding.Ready.call(this);

  /**
   * A client is trying to stat a file.
   */
  this.onStat = new wam.Event();

  /**
   * A client is trying to unlink a file.
   */
  this.onUnlink = new wam.Event();

  /**
   * A client is trying to list the contents of a directory.
   */
  this.onList = new wam.Event();

  /**
   * A client is trying create an execute context.
   */
  this.onExecuteContextCreated = new wam.Event();

  /**
   * A client is trying to create an open context.
   */
  this.onOpenContextCreated = new wam.Event();
};

wam.binding.fs.FileSystem.prototype = Object.create(
    wam.binding.Ready.prototype);

/**
 * Stat a file.
 */
wam.binding.fs.FileSystem.prototype.stat = function(arg, onSuccess, onError) {
  this.assertReady();
  this.onStat({path: arg.path}, onSuccess, onError);
};

/**
 * Unlink a file.
 */
wam.binding.fs.FileSystem.prototype.unlink = function(arg, onSuccess, onError) {
  this.assertReady();
  this.onUnlink({path: arg.path}, onSuccess, onError);
};

/**
 * List the contents of a directory.
 */
wam.binding.fs.FileSystem.prototype.list = function(arg, onSuccess, onError) {
  this.assertReady();
  this.onList({path: arg.path}, onSuccess, onError);
};

/**
 * Create an execute context associated with this file system.
 */
wam.binding.fs.FileSystem.prototype.createExecuteContext = function() {
  this.assertReady();
  var executeContext = new wam.binding.fs.ExecuteContext(this);
  executeContext.dependsOn(this);
  this.onExecuteContextCreated(executeContext);
  return executeContext;
};

/**
 * Create an open context associated with this file system.
 */
wam.binding.fs.FileSystem.prototype.createOpenContext = function() {
  this.assertReady();
  var openContext = new wam.binding.fs.OpenContext(this);
  openContext.dependsOn(this);
  this.onOpenContextCreated(openContext);
  return openContext;
};

/**
 * Copy a single file using the readFile/writeFile methods of this class.
 *
 *
 */
wam.binding.fs.FileSystem.prototype.copyFile = function(
    sourcePath, targetPath, onSuccess, onError) {
  this.readFile(
      sourcePath, {}, {},
      function(result) {
        this.writeFile(
            targetPath,
            {mode: {create: true, truncate: true}},
            {dataType: result.dataType, data: result.data},
            onSuccess,
            onError);
      }.bind(this),
      onError);
};

/**
 * Read the entire contents of a file.
 *
 * This is a utility method that creates an OpenContext, uses the read
 * method to read in the entire file (by default) and then discards the
 * open context.
 *
 * By default this will return the data in the dataType preferred by the
 * file.  You can request a specific dataType by including it in readArg.
 *
 * @param {string} path The path to read.
 * @param {Object} openArg Additional arguments to pass to the
 *   OpenContext..open() call.
 * @param {Object} readArg Additional arguments to pass to the
 *   OpenContext..read() call.
 * @param {function(Object)} onSuccess The function to invoke with the read
 *   results.  Object will have dataType and data properties as specified
 *   by OpenContext..read().
 * @param {function(Object)} onError The function to invoke if the open
 *   or read fail.  Object will be a wam error value.
 *
 * @return {wam.binding.fs.OpenContext} The new OpenContext instance.  You
 *   can attach your own listeners to this if you need to.
 */
wam.binding.fs.FileSystem.prototype.readFile = function(
    path, openArg, readArg, onSuccess, onError) {
  var ocx = this.createOpenContext();

  ocx.onClose.addListener(function(value) {
      if (!ocx.readyValue)
        onError(ocx.closeValue);
    });

  ocx.onReady.addListener(function() {
      ocx.read(
          readArg,
          function(result) {
            ocx.closeOk(null);
            onSuccess(result);
          },
          function(value) {
            ocx.closeOk(null);
            onError(value);
          });
    });

  ocx.open(path, openArg);
  return ocx;
};

/**
 * Write the entire contents of a file.
 *
 * This is a utility method that creates an OpenContext, uses the write
 * method to write the entire file (by default) and then discards the
 * open context.
 *
 * @param {string} path The path to read.
 * @param {Object} openArg Additional arguments to pass to the
 *   OpenContext..open() call.
 * @param {Object} writeArg Additional arguments to pass to the
 *   OpenContext..write() call.
 * @param {function(Object)} onSuccess The function to invoke if the write
 *   succeeds.  Object will have dataType and data properties as specified
 *   by OpenContext..read().
 * @param {function(Object)} onError The function to invoke if the open
 *   or read fail.  Object will be a wam error value.
 *
 * @return {wam.binding.fs.OpenContext} The new OpenContext instance.  You
 *   can attach your own listeners to this if you need to.
 */
wam.binding.fs.FileSystem.prototype.writeFile = function(
    path, openArg, writeArg, onSuccess, onError) {
  var ocx = this.createOpenContext();

  ocx.onClose.addListener(function(value) {
      if (!ocx.readyValue)
        onError(ocx.closeValue);
    });

  ocx.onReady.addListener(function() {
      ocx.write(
          writeArg,
          function(result) {
            ocx.closeOk(null);
            onSuccess(result);
          },
          function(value) {
            ocx.closeOk(null);
            onError(value);
          });
    });

  if (!openArg)
    openArg = {};

  if (!openArg.mode)
    openArg.mode = {};

  openArg.mode.write = true;

  ocx.open(path, openArg);
  return ocx;
};
