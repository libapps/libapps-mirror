// Copyright (c) 2012 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

'use strict';

/**
 * Storage for canned resources.
 *
 * These are usually non-JavaScript things that are collected during a build
 * step and converted into a series of 'lib.resource.add(...)' calls.  See
 * the "@resource" directive from libdot/bin/concat for the canonical use
 * case.
 *
 * This is global storage, so you should prefix your resource names to avoid
 * collisions.
 */
lib.resource = {
  resources_: {},
};

/** @typedef {{type: string, name: string, data: *}} */
lib.resource.ResourceRecord;

/**
 * Add a resource.
 *
 * @param {string} name A name for the resource.  You should prefix this to
 *     avoid collisions with resources from a shared library.
 * @param {string} type A mime type for the resource, or "raw" if not
 *     applicable.
 * @param {*} data The value of the resource.
 */
lib.resource.add = function(name, type, data) {
  lib.resource.resources_[name] = {
    type: type,
    name: name,
    data: data,
  };
};

/**
 * Retrieve a resource record.
 *
 * The resource data is stored on the "data" property of the returned object.
 *
 * @param {string} name The name of the resource to get.
 * @param {!lib.resource.ResourceRecord=} defaultValue The value to return if
 *     the resource is not defined.
 * @return {!lib.resource.ResourceRecord} The matching resource if it exists.
 */
lib.resource.get = function(name, defaultValue) {
  if (!(name in lib.resource.resources_)) {
    lib.assert(defaultValue !== undefined);
    return defaultValue;
  }

  return lib.resource.resources_[name];
};

/**
 * Retrieve resource data.
 *
 * @param {string} name The name of the resource to get.
 * @param {*=} defaultValue The value to return if the resource is not defined.
 * @return {*} The resource data.
 */
lib.resource.getData = function(name, defaultValue) {
  if (!(name in lib.resource.resources_)) {
    return defaultValue;
  }

  return lib.resource.resources_[name].data;
};

/**
 * Retrieve resource as a data: url.
 *
 * @param {string} name The name of the resource to get.
 * @param {!lib.resource.ResourceRecord=} defaultValue The value to return if
 *     the resource is not defined.
 * @return {string} A data: url encoded version of the resource.
 */
lib.resource.getDataUrl = function(name, defaultValue) {
  var resource = lib.resource.get(name, defaultValue);
  return 'data:' + resource.type + ',' + resource.data;
};
