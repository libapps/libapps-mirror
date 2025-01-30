# Chrome Apps Deprecation

Chrome has been deprecating Chrome-specific technologies in favor of standard
web platform features as they become available.
Historically, Secure Shell has built on top of a lot of those features only
available to [Chrome Apps] because there was no other option
[when they were launched][Chrome Apps launch].
As a project that has been in active development for almost a decade, and has
many active users (1 million+ [7DA]'s), we need to make sure things continue to
work for everyone even as the underlying platform shifts.

This document will serve to keep users & developers up-to-date.

[TOC]

## Migrating from App to Extension

First off, you should install the extension:<br>
https://chrome.google.com/webstore/detail/iodihamcpbpeioajjeobimgagajmlibd

The app & extension are completely feature equivalent.
Anything you do in the app today can be done in the extension.

NB: This wasn't the case before the 0.22 releases & Chrome R81, but is now.

### SSH Keys/Identities

Any keys you've imported have never been synced or exported or backed up.
You will need to manually re-import them into the extension.

### Preferences

When the extension is installed the first time, it will automatically sync your
preferences (including saved connections) from the app so you don't have to.

No settings will be synced between them again.
If you make changes in one, you will have to manually make them in the other.
Or just uninstall the old app and not worry about it!

### ~/.ssh/config & ~/.ssh/known_hosts

These files are not synced or preserved anywhere.
Any local customizations you've made will need to be manually migrated.

### Launcher Changes

The app is accessible through the shelf & app launcher.
The extension is accessible through the extension bar (the set of icons to the
right of the omnibox in the upper right of the Chrome window).

The app opens as a tab by default with an option to open as a window.
The extension opens as a window by default with a way to open as a tab.
The trick is to hold Ctrl when clicking the connection.

### Shelf Interaction

It's still possible to pin a shortcut to the shelf on ChromeOS (dock on macOS
or taskbar on Windows).

[See the FAQ for detailed instructions](./FAQ.md#how-do-i-make-a-desktop-icon-or-shelf-shortcut).

### URI & Bookmark Changes

People should be using [`ssh://` URIs](./uri.md) to launch Secure Shell.

If you want to switch the app that handles `ssh://` links, visit the
`chrome://settings/handlers` page.

If you've been using `chrome-extension://pnhechapfaindjhompbnflcldabbghjo`,
switch to `chrome-extension://iodihamcpbpeioajjeobimgagajmlibd` instead.

### Omnibox Handler

If you use `ssh` in the omnibox, the extension should automatically take over
handling it because it's been installed after the app.
See the
[FAQ for more details](./FAQ.md#how-do-multiple-extensions_apps-work-with-the-omnibox).

## EOL Systems (<M80) {#EOL}

The extension requires functionality that will only ever exist in newer versions
of ChromeOS.
Unfortunately EOL devices will never be able to upgrade to these versions.
The Chrome App will continue to be built on top of NaCl & Chrome Apps for now.
So EOL users need not migrate.

See the CrOS device list for the list of affected systems:<br>
https://dev.chromium.org/chromium-os/developer-information-for-chrome-os-devices

## Timeline

*   Aug 2016: Chrome first announces [Chrome Apps deprecation].
    *   Chrome Apps are deprecated on non-ChromeOS platforms.
    *   Chrome Extensions are unaffected.
    *   Chrome Apps on ChromeOS are unaffected.
    *   NaCl & PNaCl are unaffected.
    *   Chrome Apps can still be installed & synced between devices.
*   May 2017: Chrome announces [PNaCl deprecation].
    *   This only applies to using PNaCl on websites.
    *   Chrome Apps & Extensions are unaffected.
*   Dec 2017: The Chrome Web Store (CWS) [stops displaying Chrome Apps] when
    running on non-ChromeOS platforms.
    *   Chrome Apps can still be installed on CrOS.
    *   Installed Chrome Apps are synced between devices.
    *   Chrome Apps still run on all platforms.
*   Aug 2018: Secure Shell as an [extension was launched].
    *   Now available as separate Chrome App & Chrome Extension installs.
    *   All platforms can easily install Secure Shell via the CWS again.
*   Jan 2020: [Chrome Apps EOL] announced.
    *   No immediate changes here.
*   Mar 2020: No new Chrome Apps may be posted to the CWS.
    *   Secure Shell updates will continue to be published.
*   Jun 2020: Chrome Apps support on Windows/macOS/Linux ending for
    non-enterprise users.
    *   The [Secure Shell extension] will work on all platforms.
    *   The Secure Shell app variant will still work on CrOS, but nowhere else.
*   Dec 2020: [Manifest V3 initial support].
    *   No impact on us at this point.
*   Oct 2021: [Chrome Apps extension] announced.
    *   Chrome Apps on CrOS support extended until at least Jan 2025.
*   Apr 2022: Secure Shell 0.46 released with initial WASM port.
    *   It's pre-alpha at this stage with KI.
    *   Used automatically when NaCl is not available.
    *   macOS on arm64 always uses WASM since it never had NaCl support.
*   Sep 2022: WASM (alpha) port reaches MVP.
    *   The dev extension uses WASM by default.
*   Oct 2022: Secure Shell 0.51 released with MVP WASM port.
    *   0.5% of runs automatically use WASM in stable extension.
*   Jun 2023: Secure Shell 0.53 migrates to MV3.
    *   SSH & SFTP still work fine, both for NaCl & WASM.
    *   SFTP mounting breaks due to MV3 changes.
    *   NaCl<->WASM automatic state migration no longer works.
    *   Secure Shell extension now requires Chrome 108 (for MV3 and WASM).
*   Sep 2023: Chrome 117 stable released.
    *   NaCl on Windows & macOS & Linux disabled by default, so WASM used.
    *   Policies/flags can re-enable NaCl, but practically most people don't.
*   Nov 2023: [Manifest V2 EOL resumed].
    *   Doesn't have an immediate impact on app or extension.
    *   Chrome Apps won't work with MV3, so this sets EOL on Secure Shell app.
*   Dec 2023: Chrome 120 stable released.
    *   NaCl on Windows & macOS dropped, so only WASM port works there.
*   Jan 2024: Chrome 121 stable released.
    *   NaCl on Linux dropped, so only WASM port works there.
*   Mar 2024: Secure Shell 0.63 released.
    *   5% of runs automatically use WASM in stable extension.
*   Mar 2024: Secure Shell 0.64 released.
    *   WASM port reaches beta status.
*   May 2024: [Manifest V2 phase-out].
    *   No impact on Secure Shell extension since it's already MV3.
*   Nov 2024: NaCl EOL announced via CWS e-mails.
    *   CrOS 132 (released in Jan 2025) will be the last to support NaCl for
        unmanaged and consumer users, but it will be disabled by default in that
        release.
    *   CrOS 138 (released in Jul 2025) will be the last to support NaCl at all.
    *   CrOS users on newer versions can only use WASM.
*   Jan 2025: CrOS 132 goes stable.
    *   Chrome disabled NaCl on consumer devices by default, so only WASM works.
*   Jul 2025: CrOS 138 goes stable.
    *   The last version with NaCl support, and a LTS release.
*   Apr 2026: CrOS 138 (LTS) last refresh.
    *   The last point where NaCl works for managed devices.

We will keep the Secure Shell App as a Chrome App and using NaCl for
[EOL CrOS devices](#EOL) stuck on <M80 until the CWS forces it to be taken down.


[7DA]: https://support.google.com/analytics/answer/6171863
[Chrome Apps]: https://developer.chrome.com/apps/about_apps
[Chrome Apps launch]: https://blog.chromium.org/2013/02/chrome-app-launcher-developer-preview.html
[Chrome Apps deprecation]: https://blog.chromium.org/2016/08/from-chrome-apps-to-web.html
[Chrome Apps EOL]: https://blog.chromium.org/2020/01/moving-forward-from-chrome-apps.html
[Chrome Apps extension]: https://blog.chromium.org/2021/10/extending-chrome-app-support-on-chrome.html
[chrome.sockets API]: https://developer.chrome.com/apps/manifest/sockets
[extension was launched]: https://groups.google.com/a/chromium.org/d/topic/chromium-hterm/6FdjiDky4uI/discussion
[Manifest V2 EOL resumed]: https://developer.chrome.com/blog/resuming-the-transition-to-mv3
[Manifest V2 phase-out]: https://blog.chromium.org/2024/05/manifest-v2-phase-out-begins.html
[Manifest V3 initial support]: https://blog.chromium.org/2020/12/manifest-v3-now-available-on-m88-beta.html
[PNaCl deprecation]: https://blog.chromium.org/2017/05/goodbye-pnacl-hello-webassembly.html
[Secure Shell extension]: https://chrome.google.com/webstore/detail/iodihamcpbpeioajjeobimgagajmlibd
[stops displaying Chrome Apps]: https://web.archive.org/web/20180224192909/https://plus.google.com/+NobleAckerson/posts/i8uLr9rpGwR
