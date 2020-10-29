// Copyright 2022 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

'use strict';

/**
 * @fileoverview Manages and reports Google session metrics.
 */

/**
 * Reports Google session metrics.
 */
nassh.GoogMetricsReporter = class {
  constructor() {
    /** @type {!nassh.Distribution} */
    this.distribution = new nassh.Distribution();
  }

  /**
   * Adds value to distribution.
   *
   * @param {number} latency Value to add to distribution.
   */
  reportLatency(latency) {
    this.distribution.addSample_(latency);
    // TODO(eizihirwe): Send distribution with go/monapi every 30s.
  }
};

/**
 * Stores and manages latency data in the form of a distribution.
 * Based on this implementation of a distribution: http://shortn/_apyKoGGwAn.
 */
nassh.Distribution = class {
  constructor() {
    /**
     * Bucket incremented when sample is less than lower bound.
     * It's boundaries are (-inf, 0).
     *
     * @type {number}
     */
    this.underflowBucket = 0;

    /**
     * Bucket incremented when sample is greater than upper bound.
     * It's boundaries are [4379, inf).
     *
     * @type {number}
     */
    this.overflowBucket = 0;

    /**
     * Each index is a bucket (i.e. this.BOUNDARIES[0] is [0, 10)).
     * Values computed here: http://shortn/_OxkhhktSIe.
     *
     * @const {!Array<number>}
     */
    this.BOUNDARIES = [
      0,
      10,
      15,
      23,
      34,
      51,
      76,
      114,
      171,
      256,
      384,
      577,
      865,
      1297,
      1946,
      2919,
    ];

    /**
     * Samples added to this.bucket should be less than this value.
     *
     * @const {number}
     */
    this.UPPER_BOUND = 4379;

    /**
     * Array where this.buckets[i] represents number of samples in bucket i.
     * The number of buckets is 16 and computed here: http://shortn/_OxkhhktSIe.
     *
     * @type {!Array<number>}
     */
    this.buckets = Array(16).fill(0);

    /**
     * Total number of samples in this.underflowBucket, this.overflowBucket, and
     * this.buckets.
     *
     * @type {number}
     */
    this.count = 0;

    /** @type {number} */
    this.mean = 0;

    /** @type {number} */
    this.sumOfSquaredDeviation = 0;

    /**
     * Value of minimum sample.
     *
     * @type {number}
     */
    this.min = Number.MAX_SAFE_INTEGER;

    /**
     * Value of maximum sample.
     *
     * @type {number}
     */
    this.max = Number.MIN_SAFE_INTEGER;
  }

  /**
   * Updates distribution values. Computations based on:
   * http://shortn/_V4NND89Wsr and http://shortn/_EQw6aDMi8T.
   *
   * @param {number} value Value to add to distribution.
   */
  addSample_(value) {
    if (!isFinite(value)) {
      return;
    }

    this.count++;
    const dev = value - this.mean;
    this.mean += dev / this.count;
    this.sumOfSquaredDeviation += dev * (value - this.mean);
    this.max = Math.max(this.max, value);
    this.min = Math.min(this.min, value);
    this.addValueToBucket_(value);
  }

  /**
   * Increments a bucket based on predefined buckets.
   *
   * @param {number} value Value to add to bucket.
   */
  addValueToBucket_(value) {
    if (value < this.BOUNDARIES[0]) {
      this.underflowBucket++;
    } else if (value >= this.UPPER_BOUND) {
      this.overflowBucket++;
    } else {
      this.buckets[this.findInsertionIndex_(value)]++;
    }
  }

  /**
   * Binary search for index at which value would be inserted into array.
   * Assumes value >= this.BOUNDARIES[0] and value < this.UPPER_BOUND, so
   * returned number is always a valid this.buckets index.
   *
   * @param {number} value Value being searched for.
   * @return {number} If array contains value, return its index, else return
   *     low - 1, which is the index of the first element greater than value.
   */
  findInsertionIndex_(value) {
    let low = 0;
    let high = this.BOUNDARIES.length - 1;

    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      const midValue = this.BOUNDARIES[mid];
      if (midValue === value) {
        return mid;
      } else if (midValue > value) {
        high = mid - 1;
      } else if (midValue < value) {
        low = mid + 1;
      }
    }
    return low - 1;
  }
};
