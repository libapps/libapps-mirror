# Secure Shell (nassh)

Secure Shell (nassh) is a Chrome App that combines [hterm](/hterm/) with a NaCl
build of OpenSSH to provide a PuTTY-like app for Chrome users.

# Install

You can install via the Chrome Web Store (CWS):

https://chrome.google.com/webstore/detail/pnhechapfaindjhompbnflcldabbghjo

# Contact

The [chromium-hterm mailing list] can be used to contact other users and
developers for questions.

Our existing set of bugs/feature requests can be found at
<https://goo.gl/VkasRC>.

To file an actual report, you can use <https://goo.gl/vb94JY>.  This will route
to the right people.

# Documentation

* [Authors](./doc/AUTHORS.md) -- List of people who have contributed
* [ChangeLog](./doc/ChangeLog.md) -- List of interesting changes in each release
* [FAQ](./doc/FAQ.md) -- Frequently Asked Questions
* [Hacking](./doc/hack.md) -- Developing the Secure Shell source
* [Options](./doc/options.md) -- Secure Shell command line options
* [Processes](./doc/processes.md) -- Release processes and other mundane topics

# Requirements

This has only been tested with Chrome.  We know the following is needed:

* Native Client (NaCl)
* Pepper Plugin API (PPAPI)
* ECMAScript 6 (ES6)

[chromium-hterm mailing list]: https://groups.google.com/a/chromium.org/forum/?fromgroups#!forum/chromium-hterm
