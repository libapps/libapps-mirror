# Chrome Apps Deprecation

*** note
**Warning: This document is old & has moved.  Please update any links:**<br>
https://chromium.googlesource.com/apps/libapps/+/HEAD/nassh/docs/app-to-ext-migration.md
***

Chrome has been deprecating Chrome-specific technologies in favor of standard
web platform features as they become available.
Historically, Secure Shell has built on top of a lot of those Chrome-only
features because there was no other option.
As a project that has been in active development for almost a decade, and has
many active users (1 million+ [7DA]'s), we need to make sure things continue to
work for everyone even as the underlying platform shifts.

This document will serve to keep users & developers up-to-date.

[TOC]

## tl;dr

If you install the extension variant, then you're all set!

https://chrome.google.com/webstore/detail/iodihamcpbpeioajjeobimgagajmlibd

## Timeline

*   Aug 2016: Chrome first announces [Chrome Apps deprecation].
    *   Chrome Apps are deprecated on non-Chrome OS platforms.
    *   Chrome Extensions are unaffected.
    *   Chrome Apps on Chrome OS are unaffected.
    *   NaCl & PNaCl are unaffected.
    *   Chrome Apps can still be installed & synced between devices.
*   May 2017: Chrome announces [PNaCl deprecation].
    *   This only applies to using PNaCl on websites.
    *   Chrome Apps & Extensions are unaffected.
*   Dec 2017: The Chrome Web Store (CWS) [stops displaying Chrome Apps] when
    running on non-Chrome OS platforms.
    *   Chrome Apps can still be installed on CrOS.
    *   Installed Chrome Apps are synced between devices.
    *   Chrome Apps still run on all platforms.
*   Aug 2018: Secure Shell as an [extension was launched].
    *   Now available as separate Chrome App & Chrome Extension installs.
    *   All platforms can easily install Secure Shell via the CWS again.
*   Jan 2020: [Chrome Apps EOL] announced.
    *   No immediate changes here.

Now for things we're planning for but have not yet happened.
These plans are subject to change of course.

*   Mar 2020: No new Chrome Apps may be posted to the CWS.
    *   Secure Shell updates will continue to be published.
*   Jun 2020: Chrome Apps support on Windows/macOS/Linux ending for
    non-enterprise users.
    *   The [Secure Shell extension] will work on all platforms.
    *   The Secure Shell app variant will still work on CrOS, but nowhere else.
*   *ETA 2020Q3*: Secure Shell extension supports WASM.
    *   Direct connections use [chrome.sockets API].
    *   Secure Shell App still uses NaCl (and direct access through it).
*   Dec 2020: Chrome Apps support on Windows/macOS/Linux ending for everyone.
    *   The [Secure Shell extension] will work on all platforms.
    *   The Secure Shell app variant will still work on CrOS, but nowhere else.
*   Jun 2021: End of support for NaCl, PNaCl, and PPAPI APIs.
    *   The [Secure Shell extension] should be migrated to WASM by this point
        and so it won't be using NaCl, PNaCl, or PPAPI anymore.
    *   *TBD*: Whether the Secure Shell app will support both.
*   Jun 2021: Chrome Apps no longer working on CrOS for non-enterprise users.
    *   The [Secure Shell extension] will work on all platforms.
    *   The Secure Shell app will no longer work.
    *   *TBD*: Whether the Secure Shell app will change in situ to an extension.
*   Jun 2022: Chrome Apps no longer working on CrOS for everyone.
    *   The [Secure Shell extension] will work on all platforms.
    *   The Secure Shell app will no longer work.

We will probably keep the Secure Shell App as a Chrome App and using NaCl for
[EOL CrOS devices](#EOL) stuck on <M80.

## Migrating from App to Extension

First off, you should install the extension:<br>
https://chrome.google.com/webstore/detail/iodihamcpbpeioajjeobimgagajmlibd

The app & extension are completely feature equivalent.
Anything you do in the app today can be done in the extension.
NB: This wasn't the case before the 0.22 releases & Chrome R81, but is now.

### Preferences

When the extension is installed the first time, it will automatically sync your
preferences (including saved connections) from the app so you don't have to.

### Launcher Changes

The app is accessible through the shelf & app launcher.
The extension is accessible through the extension bar (the set of icons to the
right of the omnibox in the upper right of the Chrome window).

The app opens as a tab by default with an option to open as a window.
The extension opens as a window by default with a way to open as a tab.
The trick is to hold Ctrl when clicking the connection.

### Shelf Interaction

If you want to pin the extension to the shelf, you can create a shortcut for it.
Unfortunately, Chrome does not provide a great flow for this.

1.  Click the extension icon in the upper right of Chrome.
1.  Hold Ctrl while clicking "Connection Dialog" to open it in a tab.
1.  Open Chrome's ⋮ menu in the upper right (Alt+F shortcut).
1.  Expand the "More tools" submenu.
1.  Select the "Create shortcut..." option.
1.  Check the "Open as window" option to automatically open it as a window.
1.  Click the "Create" button.

This will create a shortcut in the app launcher menu and automatically pin to
the shelf.
You can move it around on the shelf, or remove it entirely if you want (this
will leave it in the app launcher).

If you right click the shortcut and select the "Remove from Chrome" option, this
will only delete the shortcut, it *won't* uninstall the extension itself.

### URI Changes

People should be using [`ssh://` URIs](./uri.md) to launch Secure Shell.

If you want to switch the app that handles `ssh://` links, visit the
chrome://settings/handlers page.

If you've been using `chrome-extension://pnhechapfaindjhompbnflcldabbghjo`,
switch to `chrome-extension://iodihamcpbpeioajjeobimgagajmlibd` instead.

### Omnibox Handler

If you use `ssh` in the omnibox, the extension will should automatically take
over handling it because it's been installed after the app.
See the
[FAQ for more details](./FAQ.md#how-do-multiple-extensions_apps-work-with-the-omnibox).

## EOL Systems (<M80) {#EOL}

The extension requires functionality that will only ever exist in newer versions
of Chrome OS.
Unfortunately EOL devices will never be able to upgrade to these versions.
The Chrome App will continue to be built on top of NaCl & Chrome Apps for now.
So EOL users need not migrate.

See the CrOS device list for the list of affected systems:<br>
https://dev.chromium.org/chromium-os/developer-information-for-chrome-os-devices


[7DA]: https://support.google.com/analytics/answer/6171863
[Chrome Apps deprecation]: https://blog.chromium.org/2016/08/from-chrome-apps-to-web.html
[Chrome Apps EOL]: https://blog.chromium.org/2020/01/moving-forward-from-chrome-apps.html
[chrome.sockets API]: https://developer.chrome.com/apps/manifest/sockets
[extension was launched]: https://groups.google.com/a/chromium.org/d/topic/chromium-hterm/6FdjiDky4uI/discussion
[PNaCl deprecation]: https://blog.chromium.org/2017/05/goodbye-pnacl-hello-webassembly.html
[Secure Shell extension]: https://chrome.google.com/webstore/detail/iodihamcpbpeioajjeobimgagajmlibd
[stops displaying Chrome Apps]: https://web.archive.org/web/20180224192909/https://plus.google.com/+NobleAckerson/posts/i8uLr9rpGwR
