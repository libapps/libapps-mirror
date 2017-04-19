
# Hello

This repository contains the libdot JavaScript library and some web applications
that make use of it.

The official copy of this repository is hosted at
https://chromium.googlesource.com/apps/libapps.

There is also a mirror on github at https://github.com/libapps/libapps-mirror.
Keep in mind that this mirror may occasionally be behind the official
repository.

All changes must go through the Gerrit code review server on
https://chromium-review.googlesource.com.  Github pull requests cannot be
accepted.  Please see the [HACK.md](./HACK.md) document in this directory for
the details.

# Top level directories

* [libdot/](./libdot/) is a small set of JS libraries initially developed as
part of hterm, now available as shared code.  It provides a base layer for web
applications.  The code is intended to work in any modern browser, in either a
plain web page or a "privileged" environment such as a Chrome platform
application or Firefox extension.  In practice, it's only been put to use in
Chrome platform applications so far.

* [hterm/](./hterm/) is a JS library that provides a terminal emulator.  It is
reasonably fast, reasonably correct, and reasonably portable across browsers.

* [nassh/](./nassh/) is the Secure Shell Chrome App (currently a "v1.5" app,
soon to become a "v2" or platform app) that combines hterm with a NaCl build
of OpenSSH to provide a PuTTY-like app for Chrome users.

* [ssh_client/](./ssh_client/) is the NaCl port of OpenSSH.  It is used by
[nassh](./nassh/) to create the Secure Shell App.

* [wash/](./wash/) is a library for cross-origin virtual filesystems, similar to
the Plan 9 filesystem.  This directory also contains a simple bash-like shell
environment for exploring these filesystems.  The code in this directory is a
work-in-progress.
