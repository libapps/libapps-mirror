[TOC]

# OpenSSH NaCl port

*** note
**Warning: This document is old & has moved.  Please update any links:**<br>
https://chromium.googlesource.com/apps/libapps/+/HEAD/ssh_client/
***

This is the port of [OpenSSH] to [NaCl] (which is then integrated into [nassh]).

Most people who want to hack on the Secure Shell app do not need to make changes
here.  Typically this will be built once and copied into the [nassh] tree.  You
can even just download an existing Secure Shell extension and copy the NaCl
binaries out of that.

# Contact

The [chromium-hterm mailing list](https://groups.google.com/a/chromium.org/forum/?fromgroups#!forum/chromium-hterm)
can be used to contact other users and developers for questions.

# Native Client

We currently use Chrome's Native Client [NaCl] project to compile C/C++ code
in a way that the browser can execute directly.  This is a restricted/secure
runtime so that the native code can't break out and attack other processes.
More details can be found in the NaCl documentation.

We plan on migrating to [WebAssembly (WASM)](http://webassembly.org/) at some
point, but requires more planning.

## glibc (NaCl) vs newlib (PNaCl)

The build only supports building against newlib which means it only supports
building using the PNaCl toolchain.  Previously, the focus was on glibc & NaCl
(because PNaCl didn't exist or wasn't stable), but now the focus is on newlib
& PNaCl.  Since the glibc build wasn't used anywhere, we dropped support for it
entirely.

Also, even though we build using PNaCl, we still translate the pexe (the PNaCl
executable) into nexe's (NaCl executables) for release.  There might be room
for improvement here, but it's a low priority atm as we haven't had any requests
to support any arch other than x86/x86_64/arm.

# Building

## Development Tools

You'll need some extra packages to compile.  Adjust these for your distro.
```
$ sudo apt-get install \
    gcc g++ libstdc++6:i386 libglib2.0-0:i386 git make cmake lbzip2 \
    python python2.7 python3 pylint3 python3-requests python3-wcwidth \
    wget curl zlib1g-dev zip unzip rsync pkg-config xz-utils patch
```

## Build Script

To compile, you just have to run `./build.sh`.  It should take care of
downloading the NaCl SDK and building all the required dependencies.

When it's finished, the `output/` directory will hold all the compiled objects,
and the `output/plugin/` directory can be copied over to [nassh].

# Source Layout

If you're hacking on the source, here are the files you most likely care about:

* [bin/]: Tools for building/testing ssh_client.
  * [pylint]: Helper tool for linting various Python code.
  * [ssh_client.py]: Utility library for Python build code.
* [build.sh]: The main compile script.  Takes care of downloading & compiling
  NaCl, OpenSSH, and any other software.  Run it and forget!
* `output/`: All download & compiled objects are saved here.
  * `bin/`: Various helper tools used at build time.
  * `build/`: All subprojects get an individual build directory.
  * `distfiles/`: All downloaded archives are cached here.
  * `home/`: Scratch dir used as $HOME when building projects.
  * `plugin/`: The final output of the build process for [nassh].
  * `sysroot/`: Headers & libs for building the plugin & ssh code.
* [src/]: The NaCl plugin code that glues the JavaScript and OpenSSH worlds.
  See the next section for more in-depth coverage.
  * [Makefile][src/Makefile]: Used only to compile the plugin code.
* [third_party/]: All third party projects have a unique subdir.
  Do not try to run these directly as they rely on settings in [build.sh].
  * [glibc-compat/]: Various C library shims (mostly network/resolver).
  * [ldns/]: DNS library supporting DNSSEC and such.
  * [mandoc/]: Tools to generate html from man pages.
  * [naclsdk/]: NaCl SDK/toolchain for cross-compiling to Native Client.
  * `openssh-*/`: Code to download & build [OpenSSH].
  * [openssl/]: Code to download & build [OpenSSL] (the crypto lib).
  * [zlib/]: Standard compression library.

Here are the rest of the files, but most likely you don't need to touch these:

* [include/]: Some shim headers for gluing our plugin code to the NaCl runtime.
* [ssh_client.nmf]: Chrome manifest file for loading NaCl files.
  Used by PNaCl builds which use newlib.

## NaCl Plugin Layout

The [src/] layout contains all the glue layers that make OpenSSH work.  This
boils down to routing messages between the JS & NaCl worlds, and emulating the
filesystem and network layers.

Here's the main module code:

* [ssh_plugin.cc] [ssh_plugin.h]: Main entry point to the module.  Handles
  incoming messages from JS and takes care of sending responses back.
* [syscalls.cc]: Low level syscall entry points.  When OpenSSH/etc... needs to
  make a call like `open` or `close`, they hit here first.

Here's the core filesystem related logic:

* [file_interfaces.h]: Interface API for file handlers to implement.  The
  `FileSystem` module expects this from all its handlers.
* [file_system.cc] [file_system.h]: Main entry point for all file and network
  logic.  Takes care of routing to the right handler modules (see below).

Here's the path-specific modules:

* [dev_null.cc] [dev_null.h]: Emulates `/dev/null`.
* [dev_random.cc] [dev_random.h]: Emulates `/dev/random`.
* [js_file.cc] [js_file.h] [proxy_stream.h]: Handles TTY and I/O paths
  `/dev/stdin`, `/dev/stdout`, `/dev/stderr`, and `/dev/tty`.
  Also handles JS sockets (which are used with web relays).
* [pepper_file.cc] [pepper_file.h]: Handles all regular file accesses that are
  backed by local storage.  Largely for `/.ssh/` paths.

Here's the networking related logic:

* [tcp_server_socket.cc] [tcp_server_socket.h]: Handles all `SOCK_STREAM` (TCP)
  sockets used to listen for inbound connections.
* [tcp_socket.cc] [tcp_socket.h]: Handles all `SOCK_STREAM` (TCP) sockets
  for outbound connections.
* [udp_socket.cc] [udp_socket.h]: Handles all `SOCK_DGRAM` (UDP) sockets.
  UDP tends to only be used to make DNS requests.

Some utility code:

* [pthread_helpers.h]: C++ objects around standard pthread concepts like
  mutexes, locks, and conditional variables.

## NaCl/JS Life Cycle

The [nassh] code takes care of creating a new NaCl object.  It waits for the JS
side to tell to run, at which point it spawns a thread and to run OpenSSH.  When
OpenSSH needs data from the JS world (like reading from stdin), it blocks until
the JS world posts data back to it (like when the user types something).

The [ssh_plugin.cc] `SshPluginModule` class is the initial entry point when the
NaCl process starts up.  It creates a `SshPluginInstance` object which routes
incoming JS messages (`HandleMessage` and `Invoke`) and sends responses back
from the NaCl code (`InvokeJS`).  The exact JS<->NaCl API is documented in the
[nassh] project, so consult those documents.

The [file_system.cc] `FileSystem` class is used to pass some high level info
(like terminal sizes) from the JS side.  Further, when OpenSSH needs to work
with files or network, it goes through the entry points in `syscalls.cc` which
routes through the `FileSystem` object which looks up the right object/path.

# GDB Debugging

Sometimes the NaCl process needs some debugging work beyond printf-style logs.
Here's an example of how to get it to work.

If you're seeing a lot of "optimized out" and missing symbols, make sure you
built the extension using `./build.sh --debug`.

## Chrome Setup

First, you'll want to launch Chrome by hand so you can point it to a unique
profile so it doesn't interfere with your main profile, and so we can enable
command line flags that otherwise are dangerous to security.  You'll also need
to see stdout/stderr because debug builds of the plugin send their output there
(instead of via JS messages).

```
$ /opt/google/chrome/google-chrome \
  --user-data-dir="${HOME}/.config/google-chrome-ssh-client-debug" \
  --enable-nacl \
  --enable-nacl-debug \
  --no-sandbox \
  --disable-hang-monitor
```

Turn on NaCl debugging in `chrome://flags/#enable-nacl-debug`.

Make sure Secure Shell isn't listed in `chrome://flags/#nacl-debug-mask`.
Set it to "Debug everything" to be safe.

Go into `chrome://extensions` and make sure you've loaded this extension
in this local build.

Restart Chrome.

Connect to a server like normal.  It should halt at "Loading NaCl plugin...".
Now you want to connect gdb.

## GDB Setup

```
$ ./output/naclsdk/toolchain/linux_x86_glibc/bin/x86_64-nacl-gdb -q
(gdb) file output/ssh_client_nl_x86_64.dbg.nexe
(gdb) target remote localhost:4014
Remote debugging using localhost:4014
0x000000000fddbc60 in ?? ()
(gdb) nacl-manifest ssh_client.dbg.nmf
(gdb) remote get irt output/irt
(gdb) nacl-irt output/irt
(gdb) b PepperFile::Open
Breakpoint 1 at 0x2e780: file src/pepper_file.cc, line 221.
(gdb) c
Continuing.
[New Thread 2]
[New Thread 3]
[New Thread 4]
[New Thread 5]
[New Thread 6]

Breakpoint 1, PepperFile::Open (this=<optimized out>, result=<optimized out>, pathname=<optimized out>, pres=<optimized out>) at src/pepper_file.cc:221
221       FileSystem* sys = FileSystem::GetFileSystem();
(gdb)
```

# References

Here's a random list of documents which would be useful to people.

* [OpenSSH]: The ssh client we use
* [NaCl]: Chrome's Native Client that we build using (including the PPAPI plugin)
* [RFC 4251 - The Secure Shell (SSH) Protocol Architecture](https://tools.ietf.org/html/rfc4251)
* [RFC 4252 - The Secure Shell (SSH) Authentication Protocol](https://tools.ietf.org/html/rfc4252)
* [RFC 4253 - The Secure Shell (SSH) Transport Layer Protocol](https://tools.ietf.org/html/rfc4253)
* [RFC 4254 - The Secure Shell (SSH) Connection Protocol](https://tools.ietf.org/html/rfc4254)
* [RFC 4716 - The Secure Shell (SSH) Public Key File Format](https://tools.ietf.org/html/rfc4716)


[NaCl]: https://developer.chrome.com/native-client
[nassh]: ../nassh/
[OpenSSH]: https://www.openssh.com/
[OpenSSL]: https://www.openssl.com/

[bin/]: ./bin
[build.sh]: ./build.sh
[include/]: ./include/
[Makefile]: ./Makefile
[src/]: ./src/
[ssh_client.nmf]: ./ssh_client.nmf
[third_party/]: ./third_party/

[pylint]: ./bin/pylint
[ssh_client.py]: ./bin/ssh_client.py

[glibc-compat/]: ./third_party/glibc-compat/
[ldns/]: ./third_party/ldns/
[mandoc/]: ./third_party/mandoc/
[naclsdk/]: ./third_party/naclsdk/
[openssl/]: ./third_party/openssl/
[zlib/]: ./third_party/zlib/

[dev_null.cc]: ./src/dev_null.cc
[dev_null.h]: ./src/dev_null.h
[dev_random.cc]: ./src/dev_random.cc
[dev_random.h]: ./src/dev_random.h
[file_interfaces.h]: ./src/file_interfaces.h
[file_system.cc]: ./src/file_system.cc
[file_system.h]: ./src/file_system.h
[js_file.cc]: ./src/js_file.cc
[js_file.h]: ./src/js_file.h
[pepper_file.cc]: ./src/pepper_file.cc
[pepper_file.h]: ./src/pepper_file.h
[proxy_stream.h]: ./src/proxy_stream.h
[pthread_helpers.h]: ./src/pthread_helpers.h
[ssh_plugin.cc]: ./src/ssh_plugin.cc
[ssh_plugin.h]: ./src/ssh_plugin.h
[syscalls.cc]: ./src/syscalls.cc
[tcp_server_socket.cc]: ./src/tcp_server_socket.cc
[tcp_server_socket.h]: ./src/tcp_server_socket.h
[tcp_socket.cc]: ./src/tcp_socket.cc
[tcp_socket.h]: ./src/tcp_socket.h
[udp_socket.cc]: ./src/udp_socket.cc
[udp_socket.h]: ./src/udp_socket.h
[src/Makefile]: ./src/Makefile
