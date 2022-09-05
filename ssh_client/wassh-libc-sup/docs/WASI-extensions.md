# WASSH WASI Extensions

*** note
**Warning: This document is old & has moved.  Please update any links:**<br>
https://chromium.googlesource.com/apps/libapps/+/HEAD/ssh_client/wassh-libc-sup/docs/WASI-extensions.md
***

The [WASI Core API] has a lot of good stuff, but not enough for us.
These are the various extensions we've made.

Note: The symbols are using `wassh_experimental` for imports.
We'll change this to `wassh` once things are working.

[TOC]

## Network Syscalls

### __wassh_sock_create

`__wasi_errno_t sock_create(__wasi_fd_t* sock, int domain, int type);`

* `sock` (output): Pointer to handle for newly created socket.
* `domain`: The communication domain:
  * `AF_INET`: IPv4
  * `AF_INET6`: IPv6
  * `AF_UNIX`: UNIX socket
* `type`: Communication type.
  * `SOCK_STREAM`: TCP
  * `SOCK_DGRAM`: UDP

If the socket is created successfully, `sock` will be updated with the new file
descriptor, and `ESUCCESS` will be returned.

Any other return value is an error.

### __wassh_sock_connect

`__wasi_errno_t sock_connect(__wasi_fd_t sock, int domain, const uint8_t* addr, uint16_t port);`

* `sock`: The existing open socket to connect.
* `domain`: The communication domain:
  * `AF_INET`: IPv4
  * `AF_INET6`: IPv6
  * `AF_UNIX`: UNIX socket
* `addr`: Pointer to a domain-specific address buffer.
  * `AF_INET`: A 32-bit IPv4 address (in network/big endian)
  * `AF_INET6`: A 128-bit IPv6 address (in network/big endian)
  * `AF_UNIX`: The socket name (`port` will indicate max buffer size)
* `port`: The port to connect to.

If the connection is successful, `ESUCCESS` will be returned.

Any other return value is an error.


[WASI Core API]: https://github.com/CraneStation/wasmtime/blob/HEAD/docs/WASI-api.md
