// Copyright (c) 2012 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

'use strict';

/**
 * Storage for canned resources.
 *
 * These are usually non-JavaScript things that are collected during a build
 * step and converted into a series of 'lib.resource.add(...)' calls.  See
 * the "@resource" directive from libdot/bin/concat.sh for the canonical use
 * case.
 *
 * This is global storage, so you should prefix your resource names to avoid
 * collisions.
 */
lib.resource = {
  resources_: {}
};

/**
 * Add a resource.
 *
 * @param {string} name A name for the resource.  You should prefix this to
 *   avoid collisions with resources from a shared library.
 * @param {string} type A mime type for the resource, or "raw" if not
 *   applicable.
 * @param {*} data The value of the resource.
 */
lib.resource.add = function(name, type, data) {
  lib.resource.resources_[name] = {
    type: type,
    name: name,
    data: data
  };
};

/**
 * Retrieve a resource record.
 *
 * The resource data is stored on the "data" property of the returned object.
 *
 * @param {string} name The name of the resource to get.
 * @param {*} opt_defaultValue The optional value to return if the resource is
 *   not defined.
 * @return {object} An object with "type", "name", and "data" properties.
 */
lib.resource.get = function(name, opt_defaultValue) {
  if (!(name in lib.resource.resources_)) {
    if (typeof opt_defaultValue == 'undefined')
      throw 'Unknown resource: ' + name;

    return opt_defaultValue;
  }

  return lib.resource.resources_[name];
};

/**
 * Retrieve resource data.
 *
 * @param {string} name The name of the resource to get.
 * @param {*} opt_defaultValue The optional value to return if the resource is
 *   not defined.
 * @return {*} The resource data.
 */
lib.resource.getData = function(name, opt_defaultValue) {
  if (!(name in lib.resource.resources_)) {
    if (typeof opt_defaultValue == 'undefined')
      throw 'Unknown resource: ' + name;

    return opt_defaultValue;
  }

  return lib.resource.resources_[name].data;
};

/**
 * Retrieve resource as a data: url.
 *
 * @param {string} name The name of the resource to get.
 * @param {*} opt_defaultValue The optional value to return if the resource is
 *   not defined.
 * @return {*} A data: url encoded version of the resource.
 */
lib.resource.getDataUrl = function(name, opt_defaultValue) {
  var resource = lib.resource.get(name, opt_defaultValue);
  return 'data:' + resource.type + ',' + resource.data;
};
