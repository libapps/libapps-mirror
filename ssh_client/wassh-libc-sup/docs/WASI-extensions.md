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
