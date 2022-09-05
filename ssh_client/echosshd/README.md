# echosshd testing server

*** note
**Warning: This document is old & has moved.  Please update any links:**<br>
https://chromium.googlesource.com/apps/libapps/+/HEAD/ssh_client/echosshd/
***

This is a simple server built on [libssh] for testing Secure Shell locally.
It provides a simple shell interface so content can be sent back & forth.

## Requirements

We require GCC 5+ for the `codecvt` header and the [libssh] development package.
On Debian systems, you can run:

```sh
sudo apt-get install gcc libssh-dev
```

## Build

You can run `make` to build `echosshd` and generate local keys as needed.

## Running

Just run `./echosshd` to spawn the server.

By default it listens on `localhost:22222`.
You can log in with the `anon` account (no password required).

Once you log in, use the `help` command to see available tests.

[libssh]: https://www.libssh.org/
