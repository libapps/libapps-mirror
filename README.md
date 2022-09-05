# Hello

*** note
**Warning: This document is old & has moved.  Please update any links:**<br>
https://chromium.googlesource.com/apps/libapps/
***

This repository contains the libdot JavaScript library and some web applications
that make use of it.

The official copy of this repository is hosted at
https://chromium.googlesource.com/apps/libapps.

There is also a mirror on github at https://github.com/libapps/libapps-mirror.
A few subprojects are also extracted out into their own git repo and mirrored.
Keep in mind that these mirrors may occasionally be behind the official
repository.

All changes must go through the Gerrit code review server on
https://chromium-review.googlesource.com.  Github pull requests cannot be
accepted.  Please see the [HACK.md](./HACK.md) document in this directory for
the details.

# Top level directories

* [libdot/](./libdot/) is a small set of JS libraries initially developed as
part of hterm, now available as shared code.

* [hterm/](./hterm/) is a JS library that provides a terminal emulator.  It is
reasonably fast, reasonably correct, and reasonably portable across browsers.

* [nassh/](./nassh/) is the Secure Shell Chrome extension that combines hterm
with a NaCl build of OpenSSH to provide a PuTTY-like app for Chrome users.

* [ssh_client/](./ssh_client/) is the NaCl port of OpenSSH.  It is used by
[nassh](./nassh/) to create the Secure Shell App.
