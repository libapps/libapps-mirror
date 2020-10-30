// Copyright 2022 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview `GoogMetricsReporter` unit tests.
 */

import {Distribution, GoogMetricsReporter}
    from './nassh_goog_metrics_reporter.js';
import {LocalPreferenceManager} from './nassh_preference_manager.js';

/*
 * Create a new hterm.Terminal instance for testing.
 *
 * Called before each test case in this suite.
 */
beforeEach(function() {
  this.terminalIO = new hterm.Terminal.IO(this);
  this.localPrefs = new LocalPreferenceManager();
});

describe('nassh_goog_metrics_reporter_tests.js', () => {
  describe('GoogMetricsReporter.reportLatency', () => {
    let reporter;

    beforeEach(function() {
      reporter = new GoogMetricsReporter(this.terminalIO, '', this.localPrefs);
      reporter.metadata = {
        client_corp_status: '',
        client_os: '',
        connection_phase: '',
        host_zone: '',
        infra_provider: '',
        ssh_client: '',
      };
    });

    it('increments underflow bucket for sample less than lower bound', () => {
      // Lower boundary is 0, inclusive.
      reporter.reportLatency(0);
      reporter.reportLatency(-0.1);
      reporter.reportLatency(-1);
      reporter.reportLatency(-100);

      assert.equal(3, reporter.distribution.underflowBucket);
    });

    it('increments overflow bucket for sample greater than upper bound', () => {
      // Upper boundary is 4379, non-inclusive.
      reporter.reportLatency(4378);
      reporter.reportLatency(4379);
      reporter.reportLatency(5000);

      assert.equal(2, reporter.distribution.overflowBucket);
    });

    it('increments bucket array for sample within bounds', () => {
      reporter.reportLatency(-1); // out of bounds
      reporter.reportLatency(10); // boundaries[1] = [10, 15)
      reporter.reportLatency(13); // boundaries[1] = [10, 15)
      reporter.reportLatency(114); // boundaries[7] = [114, 171)
      reporter.reportLatency(150); // boundaries[7] = [114, 171)
      reporter.reportLatency(4379); // out of bounds

      assert.equal(2, reporter.distribution.buckets[1]);
      assert.equal(2, reporter.distribution.buckets[7]);
    });

    it('updates count', () => {
      reporter.reportLatency(-1);
      reporter.reportLatency(0);
      reporter.reportLatency(4379);
      reporter.reportLatency(5000);

      assert.equal(4, reporter.distribution.count);
    });

    it('updates mean', () => {
      reporter.reportLatency(10);
      reporter.reportLatency(50);

      assert.equal(30, reporter.distribution.mean);
    });

    it('updates ssd', () => {
      reporter.reportLatency(10);
      reporter.reportLatency(50);

      assert.equal(800, reporter.distribution.sumOfSquaredDeviation);
    });

    it('updates min and max', () => {
      reporter.reportLatency(10);
      reporter.reportLatency(50);

      assert.equal(10, reporter.distribution.min);
      assert.equal(50, reporter.distribution.max);
    });

    it('does not update distribution for non-finite sample', () => {
      reporter.reportLatency(NaN);
      reporter.reportLatency(Number.POSITIVE_INFINITY);
      reporter.reportLatency(Number.NEGATIVE_INFINITY);

      assert.equal(0, reporter.distribution.count);
    });

    it('does not update distribution when metadata is not ready', () => {
      reporter.metadata = null;

      reporter.reportLatency(10);

      assert.equal(0, reporter.distribution.count);
    });
  });

  describe('GoogMetricsReporter.findHostInstanceZone_', () => {
    let reporter;

    beforeEach(function() {
      reporter =
          new GoogMetricsReporter(this.terminalIO, 'host', this.localPrefs);
    });

    it('returns "unknown" when instances array is undefined', () => {
      assert.equal(reporter.findHostInstanceZone_(undefined), 'unknown');
    });

    it('returns "unknown" when instances array is empty', () => {
      assert.equal(reporter.findHostInstanceZone_([]), 'unknown');
    });

    it('returns "unknown" when matching instance is not found', () => {
      const instances = [{primaryFqdn: 'otherHost'}];

      assert.equal(reporter.findHostInstanceZone_(instances), 'unknown');
    });

    it('returns zone when matching instance is found', () => {
      const instances = [
        {primaryFqdn: 'host', location: {zone: {gceZone: 'zone'}}},
        {primaryFqdn: 'otherHost', location: {zone: {gceZone: 'otherZone'}}},
      ];

      assert.equal(reporter.findHostInstanceZone_(instances), 'zone');
    });
  });

  describe('Distribution.findInsertionIndex', () => {
    let distribution;

    beforeEach(() => {
      distribution = new Distribution();
    });

    it('finds index for value equal to first element', () => {
      assert.equal(0, distribution.findInsertionIndex_(0));
    });

    it('finds index for value equal to last element', () => {
      assert.equal(15, distribution.findInsertionIndex_(2919));
    });

    it('finds index for value equal to middlemost element', () => {
      assert.equal(8, distribution.findInsertionIndex_(171));
    });

    it('finds insertion index for value not equal to a element', () => {
      assert.equal(0, distribution.findInsertionIndex_(1));
      assert.equal(14, distribution.findInsertionIndex_(2918));
      assert.equal(7, distribution.findInsertionIndex_(170));
      assert.equal(8, distribution.findInsertionIndex_(172));
    });
  });
});
