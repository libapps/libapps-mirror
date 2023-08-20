// Copyright 2022 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview Manages and reports Google session metrics. The reporter will
 * only ever be used for internal Google users accessing remote machines through
 * Corp SSH relays. It will never be used for non-Googlers.
 */

import {hterm} from '../../hterm/index.js';

import {LocalPreferenceManager} from './nassh_preference_manager.js';

/**
 * Host and client metadata attached to latency values.
 *
 * @typedef {{
 *     host_name: string,
 *     ssh_client: string,
 *     host_zone: string,
 *     connection_phase: string,
 *     client_os: string,
 *     infra_provider: string,
 *     client_corp_status: string,
 *     start_time_ms: number,
 * }}
 */
let Metadata;

/**
 * Endpoint used to get Cloudtop instances and their details.
 *
 * @const {string}
 */
const CLOUDTOP_API_LIST_INSTANCES =
    'https://us-cloudtoplifecycle-googleapis.corp.google.com/v1/instances:list';

/**
 * API key for CLOUDTOP_API_LIST_INSTANCES.
 *
 * @const {string}
 */
const CLOUDTOP_API_KEY = 'AIzaSyAKXdFoyDqSPCGlbQiHz1LHrMFDYVZ0TTU';

/**
 * Payload sent with requests to CLOUDTOP_API_LIST_INSTANCES.
 * Indicates that the instances received in the response should be owned by the
 * current user.
 *
 * @const {string}
 */
const CLOUDTOP_PAYLOAD =
    JSON.stringify({instance_filter: {owner: {myself: true}}});

/**
 * Endpoint used to determine if user is on a Corp network.
 *
 * @const {string}
 */
const UBERPROXY_DEBUG = 'https://uberproxy-debug.corp.google.com/oncorp';

/**
 * Origin used to get permmision for CLOUDTOP_API_LIST_INSTANCES.
 *
 * @const {string}
 */
const CLOUDTOP_API_ORIGIN =
    'https://us-cloudtoplifecycle-googleapis.corp.google.com/*';

/**
 * Origin used to get permission for UBERPROXY_DEBUG.
 *
 * @const {string}
 */
const UBERPROXY_DEBUG_ORIGIN = 'https://uberproxy-debug.corp.google.com/*';

/**
 * Endpoint used to get metrics into storage.
 *
 * @const {string}
 */
const MON_API_INSERT = 'https://prodxmon-wbl.corp.googleapis.com/v1:insert';

/**
 * API key for MON_API_INSERT.
 *
 * @const {string}
 */
const MON_API_KEY = 'AIzaSyDolxpAuGd-B4aiNmQVQ9XHeXc1lMEYsTs';

/**
 * Frequency at which to send data. It is ideal for this value to be greater
 * than or equal to the value here: http://shortn/_uGVlD5zjpS.
 *
 * @const {number}
 */
const INSERT_FREQUENCY_MS = 30000;

/**
 * Reports Google session metrics.
 */
export class GoogMetricsReporter {
  /**
   * @param {!hterm.Terminal.IO} io Interface to display prompts to users.
   * @param {string} hostname Name of remote host.
   * @param {!LocalPreferenceManager} localPrefs Manager of nassh preferences
   *     that are not synced between systems.
   */
  constructor(io, hostname, localPrefs) {
    /**
     * Contains metadata to attach to each report sent via go/monapi.
     *
     * @type {?Metadata}
     */
    this.metadata = null;

    /** @type {!Distribution} */
    this.distribution = new Distribution();

    // True if at least 1 report has been sent to go/monapi successfuly.
    this.firstReportIsSent = false;

    this.io = io;

    /**
     * Name of remote host.
     *
     * @type {string}
     */
    this.hostname = hostname;

    this.localPrefs = localPrefs;

    /**
     * Id of timer used to send distributions periodically.
     *
     * @type {number|null}
     */
     this.distributionTimerId = null;
  }

  /**
   * Check whether all permissions required for the reporter exist.
   *
   * @return {!Promise<boolean>}
   */
  async checkChromePermissions() {
    const permissions = {
      permissions: [],
      origins: [CLOUDTOP_API_ORIGIN, UBERPROXY_DEBUG_ORIGIN],
    };
    return new Promise((resolve) => {
      if (globalThis.chrome?.permissions !== undefined) {
        chrome.permissions.contains(permissions, resolve);
      } else {
        resolve(false);
      }
    });
  }

  /**
   * Gets permissions to access API endpoints, unless the user has opted out of
   * metrics collection.
   *
   * @return {!Promise<void>}
   */
  async requestChromePermissions() {
    if (globalThis.chrome?.permissions === undefined
        || await this.checkChromePermissions()
        || this.localPrefs.get('goog-metrics-reporter-permission') === false) {
      // Don't request permissions if:
      // 1. Environment doesn't have chrome.permissions API, or
      // 2. Permissions already exist, or
      // 3. 'goog-metrics-reporter-permission' is false (meaning user has
      // already opted-out).
      return;
    }

    // Construct prompt.
    const io = this.io.push();

    const container = document.createElement('div');
    const prompt = document.createElement('p');
    prompt.style.fontWeight = 'bold';
    prompt.style.textAlign = 'center';
    prompt.textContent = this.PERMISSIONS_PROMPT;
    container.appendChild(prompt);

    const yesButton = document.createElement('button');
    yesButton.style.marginRight = '10px';
    yesButton.textContent = 'Yes';

    const noButton = document.createElement('button');
    noButton.style.marginLeft = '10px';
    noButton.textContent = 'No';

    const buttonContainer = document.createElement('div');
    buttonContainer.style.width = 'fit-content';
    buttonContainer.style.margin = '0 auto';
    buttonContainer.appendChild(yesButton);
    buttonContainer.appendChild(noButton);
    container.append(buttonContainer);

    // Request permissions.
    io.showOverlay(container, null);
    return new Promise((resolve) => {
      yesButton.addEventListener('click', () => {
        io.hideOverlay();
        io.pop();
        const permissions = {
          permissions: [],
          origins: [CLOUDTOP_API_ORIGIN, UBERPROXY_DEBUG_ORIGIN],
        };
        if (globalThis.chrome?.permissions !== undefined) {
          chrome.permissions.request(permissions, (granted) => {
            this.localPrefs.set('goog-metrics-reporter-permission', granted);
            resolve();
          });
        } else {
          resolve();
        }
      });

      noButton.addEventListener('click', () => {
        this.localPrefs.set('goog-metrics-reporter-permission', false);
        io.hideOverlay();
        io.pop();
        resolve();
      });
    });
  }

  /**
   * Gathers all metadata associated with the host and client.
   *
   * Note: Append timestamp to host_name to maximize uniqueness when multiple
   * connections to the same host exist simultaneouly.
   */
  async initClientMetadata() {
    if (!await this.checkChromePermissions()) {
      throw new Error(`Permission to access ${CLOUDTOP_API_ORIGIN} and ` +
                      `${UBERPROXY_DEBUG_ORIGIN} is missing.`);
    }

    if (this.getInfraProvider_() === 'cloud') {
      const timestamp = Date.now();
      this.metadata = {
        start_time_ms: timestamp,
        host_name: `${this.hostname}_${timestamp}`,
        host_zone: await this.getHostZone_(),
        client_corp_status: await this.getClientCorpStatus_(),
        client_os: this.getOs_(),
        infra_provider: 'cloud',
        ssh_client: this.getSshClient_(),
        connection_phase: this.getConnectionPhase_(),
      };
    }
    // TODO(eizihirwe): Include physical workstations in metric reports.
  }

  /**
   * Adds value to distribution, and sends distribution to Monarch every 30s.
   * If metadata is not ready, incoming latency values will not be reported.
   *
   * @param {number} latency Value to add to distribution.
   */
  async reportLatency(latency) {
    if (this.metadata === null) {
      return;
    }

    if (this.firstReportIsSent) {
      this.distribution.addSample_(latency);
    } else {
      // First report has not been sent. Add sample and send immediately.
      this.distribution.addSample_(latency);
      const distritutionInserted = await this.sendDistribution_();
      if (distritutionInserted) {
        this.firstReportIsSent = true;
        this.metadata.connection_phase = this.getConnectionPhase_();
        try {
          this.sendDistributionOnATimer_();
        } catch (error) {
          console.error(`Sending report failed: ${error}`);
        }
      }
    }
  }

  /**
   * Sends payload to metric storage.
   *
   * @return {!Promise<boolean>} True if request was successful.
   */
  async sendDistribution_() {
    try {
      const response = await fetch(MON_API_INSERT, {
        method: 'POST',
        body: this.buildMetricsPayload_(),
        headers: {
          'X-Goog-Api-Key': MON_API_KEY,
        },
      });
      const message = (await response.json())?.['responseStatus']?.['message'];
      if (response.status === 200 && message === 'OK') {
        return true;
      }
    } catch (error) {
      console.error(`Sending report failed: ${error}`);
    }
    return false;
  }

  /**
   * Calls this.sendDistribution_() based on this.INSERT_FREQUENCY_MS.
   */
  sendDistributionOnATimer_() {
    if (!this.distributionTimerId) {
      this.distributionTimerId = setInterval(() => {
        this.sendDistribution_();
      }, INSERT_FREQUENCY_MS);
    } else {
      throw new Error('Attempt to start a timer when one already exists.');
    }
  }

  /**
   * Build payload Object to send via go/monapi.
   *
   * @return {string} JSON string containing info from this.metadata and
   *     this.distribution.
   */
  buildMetricsPayload_() {
    return JSON.stringify({payload: {metrics_collection: {metrics_data_set: {
      metric_name: '/corp/ssh/relay_latency',
      stream_kind: 'CUMULATIVE',
      value_type: 'DISTRIBUTION',
      data: {
        start_timestamp: this.getTimestampFromMs(this.metadata.start_time_ms),
        end_timestamp: this.getTimestampFromMs(Date.now()),
        distribution_value : {
          count: this.distribution.count,
          mean: this.distribution.mean,
          sum_of_squared_deviation: this.distribution.sumOfSquaredDeviation,
          minimum: this.distribution.min,
          maximum: this.distribution.max,
          exponential_buckets: {
            num_finite_buckets: this.distribution.BOUNDARIES.length,
            growth_factor: this.distribution.GROWTH_FACTOR,
            scale: this.distribution.SCALE,
          },
          bucket_count : this.distribution.getBucketCounts_(),
        },
        field: [
          {
            name: 'ssh_client',
            string_value: this.metadata.ssh_client,
          },
          {
            name: 'host_zone',
            string_value: this.metadata.host_zone,
          },
          {
            name: 'client_os',
            string_value: this.metadata.client_os,
          },
          {
            name: 'connection_phase',
            string_value: this.metadata.connection_phase,
          },
          {
            name: 'infra_provider',
            string_value: this.metadata.infra_provider,
          },
          {
            name: 'client_corp_status',
            string_value: this.metadata.client_corp_status,
          },
          {
            name: 'l1gfe_cluster',
            string_value: '__unknown__',
          },
          {
            name: 'client_region',
            string_value: 'unknown',
          },
        ],
      },
    },
    root_labels: [
      {
        key: 'service_name',
        string_value: 'nassh',
      },
      {
        key: 'host_name',
        string_value: this.metadata.host_name,
      },
      {
        key: 'proxy_zone',
        string_value: 'atl',
      },
      {
        key: 'corp_site',
        string_value: '',
      },
      {
        key: 'job_name',
        string_value: '',
      },
    ]}}});
  }

  /**
   * Converts milliseconds into a timestamp object.
   *
   * @param {number} timeMs Time in milliseconds.
   * @return {{seconds: number, nanos: number}} Timestamp.
   */
  getTimestampFromMs(timeMs) {
    const seconds = Math.trunc(timeMs / 1e3);
    const nanos = (timeMs * 1e6) - (seconds * 1e9);
    // Using 'seconds' and 'nanos' to match Timestamp proto and keep
    // buildMetricsPayload_ as clean as possible. See http://shortn/_SmAbIQqKNM.
    return {seconds, nanos};
  }

  /**
   * Gets GCE zone where host is located.
   *
   * @return {!Promise<string>} GCE zone.
   */
  async getHostZone_() {
    try {
      const response = await fetch(CLOUDTOP_API_LIST_INSTANCES, {
        method: 'POST',
        body: CLOUDTOP_PAYLOAD,
        headers: {
          'X-Goog-Api-Key': CLOUDTOP_API_KEY,
        },
      });
      const data = await response.json();
      return this.findHostInstanceZone_(data['instances']);
    } catch (error) {
      console.error(`Looking up host GCE zone failed: ${error}`);
      return 'unknown';
    }
  }

  /**
   * Gets client OS.
   *
   * @return {string} Name of OS.
   */
  getOs_() {
    switch (hterm.os) {
      case 'mac':
      case 'linux':
      case 'windows':
        return `g${hterm.os}`;
      default:
        return hterm.os;
    }
  }

  /**
   * Finds the GCE zone of the instance with the given hostname.
   *
   * @param {!Array<!Object>|undefined} instances Array of instances assigned to
   *     the user.
   * @return {string} GCE zone of the instance, 'unknown' if the instance is not
   *     found.
   */
  findHostInstanceZone_(instances) {
    if (!instances) {
      return 'unknown';
    }
    const hostInstance = instances.filter((instance) => {
      return instance['primaryFqdn'] === this.hostname;
    });

    return hostInstance[0]?.['location']?.['zone']?.['gceZone'] ?? 'unknown';
  }

  /**
   * Identifies whether the client is on a Corp network.
   *
   * @return {!Promise<string>} 'on-corp' if client is on a corp network,
   *     'off-corp' if not, 'unknown if request is not successful.
   */
  async getClientCorpStatus_() {
    try {
      const response = await fetch(UBERPROXY_DEBUG, {
        method: 'GET',
        credentials: 'include',
      });
      // Requests to uberproxy-debug/oncorp redirect to /yes or /no, which both
      // return a 502. See b/67662002.
      if (response.status === 502) {
        return response.url.endsWith('/yes') ? 'on-corp' : 'off-corp';
      }
    } catch (error) {
      console.error(`Looking up client corp status failed: ${error}`);
    }
    return 'unknown';
  }

  /**
   * Identifies whether host is a physical workstation or a remote workstation.
   *
   * @return {string} 'cloud' if host is a remote workstation, 'corp' if not.
   */
  getInfraProvider_() {
    return this.hostname.endsWith('c.googlers.com') ? 'cloud' : 'corp';
  }

  /**
   * Identifies which client is currently utilizing nassh.
   *
   * @return {string} Client name.
   */
  getSshClient_() {
    const secureShell = 'iodihamcpbpeioajjeobimgagajmlibd';
    const secureShellDev = 'algkcnfjnajfhgimadimbjhmpaeohhln';
    const terminal = 'terminal';

    switch (chrome.runtime.id) {
      case secureShell:
        return 'secureshell';
      case secureShellDev:
        return 'secureshell-dev';
      case terminal:
        return 'terminal';
      default:
        return 'unknown';
    }
  }

  /**
   * Identifies whether the connection recently started.
   *
   * @return {string} 'established' if at least one report has been sent via
   *     go/monapi, 'setup' if not.
   */
  getConnectionPhase_() {
    return this.firstReportIsSent ? 'established' : 'setup';
  }
}

/**
 * Text for prompt.
 *
 * @const {string}
 */
GoogMetricsReporter.prototype.PERMISSIONS_PROMPT =
    '[GOOGLE EMPLOYEES ONLY] Help improve your SSH experience to your ' +
    'Cloudtop/workstation by sharing latency data with developers. Collected ' +
    'data will include the name of your host device. If yes, you will ' +
    'receive a prompt for additional permissions to ' +
    'us-cloudtoplifecycle-googleapis.corp.google.com and ' +
    'uberproxy-debug.corp.google.com';

/**
 * Stores and manages latency data in the form of a distribution.
 * Based on this implementation of a distribution: http://shortn/_apyKoGGwAn.
 * See http://shortn/_PfmqgQc0qq for more details on how underflow and overflow
 * buckets are calculated.
 *
 * This implementation has a growth factor of 1.5 and scale of 10. See
 * http://shortn/_OxkhhktSIe for how buckets are computed based on these values.
 */
export class Distribution {
  constructor() {
    /** @type {number} */
    this.GROWTH_FACTOR = 1.5;

    /** @type {number} */
    this.SCALE = 10;

    /**
     * Bucket incremented when sample is less than lower bound.
     * It's boundaries are (-inf, 10).
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
     * Each index is a bucket (i.e. this.BOUNDARIES[0] is [10, 15)).
     * Values computed here: http://shortn/_OxkhhktSIe.
     *
     * @const {!Array<number>}
     */
    this.BOUNDARIES = [
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
     * The number of buckets is 15 and computed here: http://shortn/_OxkhhktSIe.
     *
     * @type {!Array<number>}
     */
    this.buckets = Array(this.BOUNDARIES.length).fill(0);

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
   * Gets counts associated with each bucket.
   *
   * @return {!Array<number>} Array of all bucket counts including underflow and
   *     overflow.
   */
  getBucketCounts_() {
    return [this.underflowBucket].concat(this.buckets, [this.overflowBucket]);
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
}
