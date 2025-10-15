[TOC]

# OpenSSH WASM port

This is the port of [OpenSSH] to [WASM]+[WASI] (which is then integrated into
[nassh]).

Most people who want to hack on the Secure Shell app do not need to make changes
here.  Typically this will be built once and copied into the [nassh] tree.  If
you don't have binaries already, run `./nassh/bin/plugin` to install recent
versions.

# Contact

The [chromium-hterm mailing list](https://groups.google.com/a/chromium.org/forum/?fromgroups#!forum/chromium-hterm)
can be used to contact other users and developers for questions.

# Building

## Development Tools

You'll need some extra packages to compile.  Adjust these for your distro.
```
$ sudo apt-get install \
    gcc g++ libstdc++6:i386 libglib2.0-0:i386 git make cmake lbzip2 \
    python-is-python3 python3 pylint3 python3-requests \
    curl zlib1g-dev zip unzip rsync pkg-config xz-utils patch
```

## Build Script

To compile, you just have to run `./build.sh`.  It should take care of
downloading the SDK and building all the required dependencies.

When it's finished, the `output/` directory will hold all the compiled objects,
and the `output/plugin/` directory can be copied over to [nassh].

# Source Layout

If you're hacking on the source, here are the files you most likely care about:

* [bin/]: Tools for building/testing ssh_client.
  * [pylint]: Helper tool for linting various Python code.
  * [ssh_client.py]: Utility library for Python build code.
* [build.sh]: The main compile script.  Takes care of downloading & compiling
  OpenSSH, and any other software.  Run it and forget!
* `output/`: All download & compiled objects are saved here.
  * `bin/`: Various helper tools used at build time.
  * `build/`: All subprojects get an individual build directory.
  * `distfiles/`: All downloaded archives are cached here.
  * `home/`: Scratch dir used as $HOME when building projects.
  * `plugin/`: The final output of the build process for [nassh].
  * `sysroot/`: Headers & libs for building the plugin & ssh code.
* [third_party/]: All third party projects have a unique subdir.
  Do not try to run these directly as they rely on settings in [build.sh].
  * [glibc-compat/]: Various C library shims (mostly network/resolver).
  * [ldns/]: DNS library supporting DNSSEC and such.
  * [mandoc/]: Tools to generate html from man pages.
  * `openssh-*/`: Code to download & build [OpenSSH].
  * [openssl/]: Code to download & build [OpenSSL] (the crypto lib).
  * [zlib/]: Standard compression library.
* [wassh-libc-sup/]: Supplemental WASI C library code.

# References

Here's a random list of documents which would be useful to people.

* [OpenSSH]: The ssh client we use
* [RFC 4251 - The Secure Shell (SSH) Protocol Architecture](https://tools.ietf.org/html/rfc4251)
* [RFC 4252 - The Secure Shell (SSH) Authentication Protocol](https://tools.ietf.org/html/rfc4252)
* [RFC 4253 - The Secure Shell (SSH) Transport Layer Protocol](https://tools.ietf.org/html/rfc4253)
* [RFC 4254 - The Secure Shell (SSH) Connection Protocol](https://tools.ietf.org/html/rfc4254)
* [RFC 4716 - The Secure Shell (SSH) Public Key File Format](https://tools.ietf.org/html/rfc4716)


[nassh]: ../nassh/
[OpenSSH]: https://www.openssh.com/
[OpenSSL]: https://www.openssl.com/
[WASI]: https://wasi.dev/
[WASM]: https://webassembly.org/

[bin/]: ./bin
[build.sh]: ./build.sh
[Makefile]: ./Makefile
[third_party/]: ./third_party/

[pylint]: ./bin/pylint
[ssh_client.py]: ./bin/ssh_client.py

[glibc-compat/]: ./third_party/glibc-compat/
[ldns/]: ./third_party/ldns/
[mandoc/]: ./third_party/mandoc/
[openssl/]: ./third_party/openssl/
[zlib/]: ./third_party/zlib/
[wassh-libc-sup/]: ./wassh-libc-sup/
