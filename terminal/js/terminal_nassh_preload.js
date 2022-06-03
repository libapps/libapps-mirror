/**
 * @fileoverview Code to be run before loading nassh js files.
 *
 * @suppress {lintChecks}
 */

// Polyfill `getBackgroundPage()` and `getManifest()` so that nassh is happy.
if (chrome?.runtime) {
  if (!chrome.runtime.getBackgroundPage) {
    chrome.runtime.getBackgroundPage = (callback) => {
      setTimeout(callback, 0, window);
    };
  }

  if (!chrome.runtime.getManifest) {
    chrome.runtime.getManifest = () => {
      return /** @type {!chrome.runtime.Manifest} */ ({
        'name': 'SSH',
        'version': lib.f.getChromeMilestone(),
        'icons': {'192': '/images/dev/crostini-192.png'},
      });
    };
  }
}
