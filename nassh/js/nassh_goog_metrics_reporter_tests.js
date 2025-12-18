// Copyright 2022 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview `GoogMetricsReporter` unit tests.
 */

import {hterm} from '../../hterm/index.js';

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

describe('GoogMetricsReporter.reportLatency', () => {
  let reporter;

  beforeEach(function() {
    reporter = new GoogMetricsReporter(this.terminalIO, '', this.localPrefs);
    reporter.metadata = {
      start_time_ms: 0,
      host_name: '',
      client_corp_status: '',
      client_os: '',
      connection_phase: '',
      host_zone: '',
      infra_provider: '',
      ssh_client: '',
      l1gfe_cluster: '',
      client_region: '',
    };
    reporter.firstReportIsSent = true;
  });

  it('increments underflow bucket for sample less than lower bound', () => {
    // Lower boundary is 10, inclusive.
    reporter.reportLatency(10);
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
    reporter.reportLatency(9); // out of bounds
    reporter.reportLatency(10); // boundaries[0] = [10, 15)
    reporter.reportLatency(13); // boundaries[0] = [10, 15)
    reporter.reportLatency(114); // boundaries[6] = [114, 171)
    reporter.reportLatency(150); // boundaries[6] = [114, 171)
    reporter.reportLatency(4379); // out of bounds

    assert.equal(2, reporter.distribution.buckets[0]);
    assert.equal(2, reporter.distribution.buckets[6]);
  });

  it('updates count', () => {
    reporter.reportLatency(-1);
    reporter.reportLatency(10);
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

describe('GoogMetricsReporter.sendDistributionOnATimer_', () => {
  it('sets timer id', function() {
    const reporter =
        new GoogMetricsReporter(this.terminalIO, '', this.localPrefs);
    assert.isNull(reporter.distributionTimerId);

    reporter.sendDistributionOnATimer_();
    assert.isNotNull(reporter.distributionTimerId);
  });

  it('throws error if timer already exists', function() {
    const reporter =
        new GoogMetricsReporter(this.terminalIO, '', this.localPrefs);
    reporter.distributionTimerId = 100;

    assert.throws(
      () => reporter.sendDistributionOnATimer_(),
      'Attempt to start a timer when one already exists');
  });
});

describe('GoogMetricsReporter.buildMetricsPayload_', () => {
  it('sets distribution stats correctly', function() {
    const reporter =
        new GoogMetricsReporter(this.terminalIO, '', this.localPrefs);
    // Needed to build payload.
    reporter.metadata = {
      host_name: 'host_name',
      ssh_client: 'ssh_client',
      host_zone: 'host_zone',
      connection_phase: 'connection_phase',
      client_os: 'client_os',
      infra_provider: 'infra_provider',
      client_corp_status: 'client_corp_status',
      start_time_ms: 0,
      l1gfe_cluster: 'l1gfe_cluster',
      client_region: 'client_region',
    };

    // Expected
    reporter.distribution.addSample_(0); // underflow bucket
    reporter.distribution.addSample_(10); // bucket 1
    reporter.distribution.addSample_(5000); // overflow bucket
    const expectedDistributionValue = {
      count: 3,
      mean: 1670,
      sum_of_squared_deviation: 16633400,
      minimum: 0,
      maximum: 5000,
      exponential_buckets: {
        num_finite_buckets: 15,
        growth_factor: 1.5,
        scale: 10,
      },
      bucket_count: [1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
    };

    // Actual
    const payload = JSON.parse(reporter.buildMetricsPayload_());
    const metrics_collection = payload['payload']['metrics_collection'];
    const data = metrics_collection['metrics_data_set']['data'];

    assert.deepEqual(data['distribution_value'], expectedDistributionValue);
  });
});

describe('Distribution.findInsertionIndex', () => {
  let distribution;

  beforeEach(() => {
    distribution = new Distribution();
  });

  it('finds index for value equal to first element', () => {
    assert.equal(0, distribution.findInsertionIndex_(10));
  });

  it('finds index for value equal to last element', () => {
    assert.equal(14, distribution.findInsertionIndex_(2919));
  });

  it('finds index for value equal to middlemost element', () => {
    assert.equal(7, distribution.findInsertionIndex_(171));
  });

  it('finds insertion index for value not equal to a element', () => {
    assert.equal(0, distribution.findInsertionIndex_(11));
    assert.equal(13, distribution.findInsertionIndex_(2918));
    assert.equal(6, distribution.findInsertionIndex_(170));
    assert.equal(7, distribution.findInsertionIndex_(172));
  });
});
