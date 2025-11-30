// Copyright 2025 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview Verifies JavaScript class implementation of SshPolicy matches
 * its Protocol Buffer definition.
 */

import {SshPolicy} from '../js/ssh_policy.js';

/**
 * Converts a snake_case string to camelCase.
 * @param {string} snakeStr The snake_case string.
 * @return {string} The camelCase version of the string.
 */
const toCamelCase = (snakeStr) => {
  const components = snakeStr.split('_');
  return components[0] + components.slice(1).map(
    (word) => word.charAt(0).toUpperCase() + word.slice(1)).join('');
};

/**
 * Extracts field names from a .proto file's content.
 * @param {string} content The content of the .proto file.
 * @return {!Array<string>} A list of field names.
 */
const parseProtoFields = (content) => {
  const fields = [];
  let inMessage = false;

  for (const line of content.split('\n')) {
    const trimmedLine = line.trim();

    if (!trimmedLine || trimmedLine.startsWith('//') ||
      trimmedLine.startsWith('/*')) {
      continue;
    }

    if (trimmedLine.includes('message') && trimmedLine.includes('{')) {
      inMessage = true;
    } else if (trimmedLine === '}' && inMessage) {
      inMessage = false;
    } else if (inMessage) {
      // Matches lines like: optional string client_id = 1;
      const match = trimmedLine.match(
        /^(?:optional|required|repeated)?\s*\w+\s+(\w+)\s*=\s*\d+;/,
      );
      if (match) {
        fields.push(match[1]);
      }
    }
  }
  return fields;
};

  // Before running the tests, fetch the .proto and .js file contents.
  before(async function() {
    // Set a timeout for the fetch operations.
    this.timeout(5000);

    const protoPromise = fetch('../proto/ssh_policy.proto');
    const jsPromise = fetch('../js/ssh_policy.js');

    const responses = await Promise.all([protoPromise, jsPromise]);

    if (!responses[0].ok) {
      this.skip();
    }
    if (!responses[1].ok) {
      this.skip();
    }

    const [protoContent, jsContent] =
      await Promise.all(responses.map((res) => res.text()));
    this.protoFields = parseProtoFields(protoContent);
    this.jsContent = jsContent;
  });

  it('class SshPolicy should exist', () => {
    assert.isDefined(SshPolicy, 'SshPolicy should be defined');
  });

  it('constructor should exist', () => {
    assert.typeOf(SshPolicy.prototype.constructor, 'function',
      'Constructor should be a function');
  });

  it('static from method should exist', () => {
    assert.typeOf(SshPolicy.from, 'function',
      'Static from method should be a function');
  });

  it('getters and setters for each proto field should exist', function() {
    for (const field of this.protoFields) {
      const camelCaseName = toCamelCase(field);
      const capitalizedName = camelCaseName.charAt(0).toUpperCase() +
        camelCaseName.slice(1);
      const getterName = `get${capitalizedName}`;
      const setterName = `set${capitalizedName}`;

      assert.typeOf(SshPolicy.prototype[getterName], 'function',
        `Getter for ${camelCaseName} should be a function`);
      assert.typeOf(SshPolicy.prototype[setterName], 'function',
        `Setter for ${camelCaseName} should be a function`);
    }
  });

  it('camelCase field names should be used in the JS file', function() {
    for (const field of this.protoFields) {
      const camelCaseName = toCamelCase(field);
      assert.include(this.jsContent, camelCaseName,
        `JS content should include ${camelCaseName}`);
    }
  });
