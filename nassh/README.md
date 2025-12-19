# Secure Shell (nassh)

Secure Shell (nassh) is a Chrome App that combines [hterm](/hterm/) with a WASM
build of OpenSSH to provide a PuTTY-like app for Chrome users.

# Install

You can install via the Chrome Web Store (CWS):
<https://chrome.google.com/webstore/detail/iodihamcpbpeioajjeobimgagajmlibd>

# Contact

The [chromium-hterm mailing list] can be used to contact other users and
developers for questions.

Our existing set of bugs/feature requests can be found at
<https://hterm.org/x/bugs>.

To file an actual report, you can use <https://hterm.org/x/ssh/newbug>.
This will route to the right people.

# Documentation

* [Authors](./docs/AUTHORS.md) -- List of people who have contributed
* [ChangeLog](./docs/ChangeLog.md) -- List of interesting changes in each release
* [Crosh (ChromeOS shell)](./docs/chromeos-crosh.md) -- Interactions with the crosh command on ChromeOS
* [FAQ](./docs/FAQ.md) -- Frequently Asked Questions
* [Fonts](./docs/fonts.md) -- Fonts including Powerline symbols bundled with Secure Shell
* [Hacking](./docs/hack.md) -- Developing the Secure Shell source
* [Hardware keys](./docs/hardware-keys.md) -- Using smart cards and hardware tokens with Secure Shell
* [Options](./docs/options.md) -- Secure Shell command line options
* [Processes](./docs/processes.md) -- Release processes and other mundane topics

# Requirements

This has only been tested with Chrome.  We know the following is needed:

* WebAssembly (WASM)
* ECMAScript 2021

[chromium-hterm mailing list]: https://groups.google.com/a/chromium.org/forum/?fromgroups#!forum/chromium-hterm
