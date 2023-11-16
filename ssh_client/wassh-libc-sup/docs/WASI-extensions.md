# WASSH WASI Extensions

The [WASI API] has a lot of good stuff, but not enough for us.
These are the various extensions we've made to the syscall API.

This document is only meant as a reference for the syscalls.
Please see the [wassh] documentation for higher level designs.

Note: The symbols are using `wassh_experimental` for imports.
We'll change this to `wassh` once things are working.

[TOC]

## Filesystem Syscalls

See the [wassh filesystem design] for higher level details.

### __wassh_fd_dup

`__wasi_errno_t fd_dup(__wasi_fd_t oldfd, __wasi_fd_t* newfd)`

* `oldfd`: The existing file descriptor to duplicate.
* `newfd` (output): Pointer to handle for new file descriptor.

Same semantics as standard Linux/POSIX [dup(2)] function.

[dup(2)]: https://man7.org/linux/man-pages/man2/dup.2.html

### __wassh_fd_dup2

`__wasi_errno_t fd_dup2(__wasi_fd_t oldfd, __wasi_fd_t newfd)`

* `oldfd`: The existing file descriptor to duplicate.
* `newfd`: The new file descriptor.

Same semantics as standard Linux/POSIX [dup2(2)] function.

[dup2(2)]: https://man7.org/linux/man-pages/man2/dup2.2.html

## Network Syscalls

See the [wassh sockets design] for higher level details.

### __wassh_sock_accept

`__wasi_errno_t sock_accept(__wasi_fd_t sock, __wasi_fd_t* newsock)`

* `sock`: The existing open socket to fetch new socket from.
* `newsock` (output): The new socket for the new connection.

Same semantics as standard Linux/POSIX [accept(2)] function.

The `addr` output is not currently supported as it doesn't appear to be used.

[accept(2)]: https://man7.org/linux/man-pages/man2/accept.2.html

### __wassh_sock_bind

`__wasi_errno_t sock_bind(__wasi_fd_t sock, int domain, const uint8_t* addr, uint16_t port)`

* `sock`: The existing open socket to bind.
* `domain`: The communication domain.
  * `AF_INET`: IPv4
  * `AF_INET6`: IPv6
* `addr`: Pointer to a domain-specific address buffer.
  * `AF_INET`: A 32-bit IPv4 address (in network/big endian)
  * `AF_INET6`: A 128-bit IPv6 address (in network/big endian)
* `port`: The port to bind.

Same semantics as standard Linux/POSIX [bind(2)] function.

[bind(2)]: https://man7.org/linux/man-pages/man2/bind.2.html

### __wassh_sock_listen

`__wasi_errno_t sock_listen(__wasi_fd_t sock, int backlog)`

* `sock`: The existing open socket to listen.
* `backlog`: Max pending connections to allow.

Same semantics as standard Linux/POSIX [listen(2)] function.

[listen(2)]: https://man7.org/linux/man-pages/man2/listen.2.html

### __wassh_sock_register_fake_addr

`__wasi_errno_t sock_register_fake_addr(int idx, const char* name, size_t namelen)`

* `idx`: The unique slot to store this fake name.
* `name`: The hostname to register.
* `namelen`: The size of the hostname.

### __wassh_sock_create

`__wasi_errno_t sock_create(__wasi_fd_t* sock, int domain, int type, int protocol)`

* `sock` (output): Pointer to handle for newly created socket.
* `domain`: The communication domain.
  * `AF_INET`: IPv4
  * `AF_INET6`: IPv6
  * `AF_UNIX`: UNIX socket
* `type`: Communication type.
  * `SOCK_STREAM`: TCP
  * `SOCK_DGRAM`: UDP
* `protocol`: Protocol type.
  * `0`: Normal network connection.
  * `-1`: Connection should use previously registered fake addresses.

If the socket is created successfully, `sock` will be updated with the new file
descriptor, and `ESUCCESS` will be returned.

Any other return value is an error.

### __wassh_sock_connect

`__wasi_errno_t sock_connect(__wasi_fd_t sock, int domain, const uint8_t* addr, uint16_t port)`

* `sock`: The existing open socket to connect.
* `domain`: The communication domain.
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

### __wassh_sock_get_name

`__wasi_errno_t sock_get_name(__wasi_fd_t sock, int* family, uint16_t* port, uint8_t* addr, int remote)`

* `sock`: The existing open socket to lookup.
* `family` (output): The network family.
* `port` (output): The network port.
* `addr` (output): The network address.  Buffer must be at least 16 bytes long.
* `remote`: Whether to query the remote peer or local settings.

Same semantics as standard Linux/POSIX [getsockname(2)] function.

[getsockname(2)]: https://man7.org/linux/man-pages/man2/getsockname.2.html

### __wassh_sock_get_opt

`__wasi_errno_t sock_get_opt(__wasi_fd_t sock, int level, int optname, int* optvalue)`

* `sock`: The existing open socket to operate on.
* `level`: The network level of options to operate on.
* `optname`: The option to lookup.
* `optvalue` (output): The option value.

Same semantics as standard Linux/POSIX [getsockopt(2)] function.

[getsockopt(2)]: https://man7.org/linux/man-pages/man2/getsockopt.2.html

### __wassh_sock_set_opt

`__wasi_errno_t sock_set_opt(__wasi_fd_t sock, int level, int optname, int optvalue)`

* `sock`: The existing open socket to operate on.
* `level`: The network level of options to operate on.
* `optname`: The option to set.
* `optvalue`: The new value to set.

Same semantics as standard Linux/POSIX [setsockopt(2)] function.

[setsockopt(2)]: https://man7.org/linux/man-pages/man2/setsockopt.2.html

### __wassh_sock_recvfrom

`__wasi_errno_t sock_recvfrom(__wasi_fd_t sock, void* buf, size_t len, size_t* written, int flags, int* domain, uint8_t* addr, uint16_t* port)`

* `sock`: The existing open socket to operate on.
* `buf` (output): Buffer to store received data.
* `len`: Length (in bytes) of the `buf` buffer.
* `written` (output): How many bytes were actually written to `buf`.
* `flags`: No flags are currently supported.
* `domain` (optional output): The communication domain.
* `addr` (optional output): Pointer to a domain-specific address buffer of the
  remote address.
* `port` (optional output): Pointer to the remote port.

Same semantics as standard Linux/POSIX [recvfrom(2)] function.

[recvfrom(2)]: https://man7.org/linux/man-pages/man2/recvfrom.2.html

### __wassh_sock_sendto

`__wasi_errno_t sock_sendto(__wasi_fd_t sock, const void* buf, size_t len, size_t* written, int flags, int domain, const uint8_t* addr, uint16_t port)`

* `sock`: The existing open socket to operate on.
* `buf`: Data to transmit.
* `len`: Length (in bytes) of the `buf` buffer.
* `written` (output): How many bytes were actually sent from `buf`.
* `flags`: No flags are currently supported.
* `domain`: The communication domain.
* `addr`: Pointer to a domain-specific address buffer of the remote address.
* `port`: The remote port.

Same semantics as standard Linux/POSIX [sendto(2)] function.

[sendto(2)]: https://man7.org/linux/man-pages/man2/sendto.2.html

## Signal Syscalls

See the [wassh signals design] for higher level details.

### __wassh_signal_deliver

`void signal_deliver(int signum)`

* `signum`: The signal to deliver.

This function is an export, not an import.  The JS will call this function when
it wants to deliver a signal.

## Terminal Syscalls

### __wassh_readpassphrase

`__wasi_errno_t readpassphrase(const char* prompt, __wasi_size_t prompt_len, char* buf, __wasi_size_t buf_len, int echo)`

* `prompt`: The message to display to the user.
* `prompt_len`: Length (in bytes) of the `prompt` buffer.
* `buf`: The buffer to store the user's response.
* `buf_len`: Length (in bytes) of the `buf` buffer.
* `echo`: Whether the user's response should be hidden or echoed (i.e. shown).

Implement the secure [readpassphrase(3)] function.  This displays a prompt to
the user, reads their response, and returns it in the supplied buffer.  This
allows for UI that cannot be spoofed.

[readpassphrase(3)]: https://www.freebsd.org/cgi/man.cgi?query=readpassphrase&sektion=3

### __wassh_tty_get_window_size

`__wasi_errno_t tty_get_window_size(__wasi_fd_t fd, struct winsize* winsize)`

* `fd`: The terminal file descriptor (tty).
* `winsize`: The terminal dimensions.  See [include/sys/ioctl.h] for definition.

Helper for implementing the
[`TIOCGWINSZ` ioctl](https://man7.org/linux/man-pages/man4/tty_ioctl.4.html).
Returns the current terminal window size.

### __wassh_tty_set_window_size

`__wasi_errno_t tty_set_window_size(__wasi_fd_t fd, const struct winsize* winsize)`

* `fd`: The terminal file descriptor (tty).
* `winsize`: The terminal dimensions.  See [include/sys/ioctl.h] for definition.

Helper for implementing the
[`TIOCSWINSZ` ioctl](https://man7.org/linux/man-pages/man4/tty_ioctl.4.html).
Sets the current terminal window size.


[include/sys/ioctl.h]: ../include/sys/ioctl.h
[WASI API]: https://github.com/WebAssembly/WASI/blob/HEAD/phases/snapshot/docs.md
[wassh]: /wassh/
[wassh filesystem design]: /wassh/docs/filesystem.md
[wassh signals design]: /wassh/docs/signals.md
[wassh sockets design]: /wassh/docs/sockets.md
