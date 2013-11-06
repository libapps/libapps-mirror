
# Hello

This repository holds web applications that make use of libdot/.

The official copy of this repository is located on chromium.googlesource.com.
You can `git clone https://chromium.googlesource.com/apps/libapps` to create a
local copy.

There is also a mirror on github at https://github.com/rginda/libapps-mirror.
Keep in mind that this mirror may occasionally be behind the official
repository.

All changes must go through the Gerrit code review server on
http://googlesource.com.  Github pull requests cannot be accepted.  Please see
the [HACK.md](/HACK.md) document in this directory for the details.

# Top level directories

libdot/ is a small set of JS libraries initially developed as part of hterm,
now available as shared code.  It provides a base layer for web applications.
The code is intended to work in any modern browser, in either a plain web page
or a "privileged" environment such as a Chrome platform application or Firefox
extension.  In practice, it's only been put to use in Chrome platform
applications so far.

hterm/ is a JS based terminal emulator that is reasonably fast, reasonably
correct, and reasonably portable across browsers.

nassh/ is a Chrome App (currently a "v1.5" app, soon to become a "v2" or
platform app) that combines hterm with a NaCl build of OpenSSH to provide
a PuTTY-like app for Chrome users.

wash/ is a library for cross-origin virtual filsystems, similar to the Plan 9
filesystem.  This directory also contains a simple bash-like shell environment
for exploring these filesystems.  The code in this directory is a
work-in-progress.
