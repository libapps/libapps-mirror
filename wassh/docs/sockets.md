# WASSH Network (Sockets) Support

The Web Platform only provides HTTP-based networking connections.
This is fine if you want to speak HTTP, but SSH doesn't, and the whole point of
wassh is to connect to SSH servers.

[TOC]

## Big Picture

Connecting wassh to an SSH server relies on multiple stacks implemented in a
couple of different places.

The WASM side ([POSIX socket APIs]) is implemented in [wassh-libc-sup].
It provides standard POSIX sockets headers & functions, and connects to
[custom WASI syscalls](/ssh_client/wassh-libc-sup/docs/WASI-extensions.md).

Those connect to [wassh's syscall handlers](../js/syscall_handler.js).
Those take care of converting WASI types to JavaScript types before calling
wassh's sockets layer.

[wassh's sockets layer](../js/sockets.js) abstracts the various Web APIs to use
the best available option at runtime.

## Web & Chrome APIs {#web-apis}

We utilize different APIs depending on their availability.

*   [WebSockets](https://developer.mozilla.org/en-US/docs/Web/API/WebSocket)
    *   Should work on the open web in all browsers.
    *   Only used with [relay servers].
    *   Does not support port forwarding.
*   Chrome Sockets (
    [TCP](https://developer.chrome.com/docs/apps/reference/sockets/tcp) &
    [TCP server](https://developer.chrome.com/docs/apps/reference/sockets/tcpServer) &
    [UDP](https://developer.chrome.com/docs/apps/reference/sockets/udp)
    )
    *   Only works in Chrome.
    *   Supports connecting to standard SSH servers.
    *   Supports port forwarding.
*   [Direct Sockets]
    *   Limited browser support.
    *   Supports connecting to standard SSH servers.
    *   Supports port forwarding.

## Relays

We support [relay servers] by hijacking the first socket connection.
There's no way for us to determine, from the socket connect syscall itself,
whether it's meant for the relay server, or a different system (e.g. port
forwarding).  For now, we assume that the first TCP/IP connect call is for
the relay, and all others are for local systems.  From reading the OpenSSH
code, this is how it works in practice, so it's probably fine for now.  If
OpenSSH changes, we can patch it to send us a clearer signal (like unique
settings when creating the socket).

## DNS Support

The [Web APIs] runtime are fundamentally mismatched with the [POSIX socket APIs]
runtime.

The [POSIX socket APIs] work by:

*   Resolve a hostname to an address (using [getaddrinfo])
    *   This tells the caller how to create the socket & where to connect
*   Create a [socket](https://man7.org/linux/man-pages/man2/socket.2.html) using
    the settings obtained earlier
*   [Connect](https://man7.org/linux/man-pages/man2/connect.2.html) the socket
    to the address resolved earlier

The [Web APIs] work by:

*   Create a [socket](https://developer.chrome.com/docs/apps/reference/sockets/tcp#method-create)
*   [Connect](https://developer.chrome.com/docs/apps/reference/sockets/tcp#method-connect)
    the socket using the hostname
    *   Chrome will take care of address resolution for us

To make matters worse, there are no [Web APIs] to translate hostnames, so we
wouldn't be able to do this ourselves.  We could utilize [DoH], but that would
require internet access, and wouldn't be able to resolve any local hostnames.
The [Web APIs] don't expose local resolver information either, and even if it
did, we'd have to implement a resolver stack (DNS parser & UDP connections) in
order to use it.

Instead, we fake it all.  When the [getaddrinfo] call is made, we always return
"success", and never an error (like "NXDOMAIN" or "hostname not found").  The
address we return is a fake one from a reserved namespace.  We register the
hostname with the fake address internally.

For IPv4 addresses, we use [0.0.0.0/8] which is reserved for "this network" and
is not usable or routable.  [0.0.0.0/32] is technically "this host", but people
generally don't connect to it.  For IPv6 addresses, we use [100::/64] which is
reserved for discarding, and is thus never routable.

Then, when the connect call is made, wassh looks to see if the requested address
is one of the fake ones previously registered.  If so, we swap in that hostname
when calling the [Web APIs].

### Side Channels

It's possible to abuse some [Web APIs] to indirectly translate names, but it's
unreliable and doesn't provide a clear signal as to the records returned or
control over timeouts.  Ideally we'd want to query specific records beyond the
standard `A` (IPv4) & `AAAA` (IPv6) like `SSHFP` for SSH fingerprints, and be
able to see any [DNSSEC] results in order to trust them.

For example, [Direct Sockets] can create a `UDPSocket` with a hostname in the
`remoteAddress` field and `dnsQueryType` (for `A` vs `AAAA`), and once the
socket is created, read `UDPSocketOpenInfo` from the `opened` property to see
what `remoteAddress` resolved to.

## Socket Options

When possible, we try to implement socket options.  Unfortunately, most of them
we can't currently handle, so we have to ignore them.  If we don't, some tools
(e.g. OpenSSH & mosh) will abort in many cases -- they assume if the option is
defined by the headers (provided by WASI-SDK), then it must be supported by the
runtime (wassh).  We'll probably add more as we find more usage.

*   `SOL_SOCKET`: [Socket-level options](https://man7.org/linux/man-pages/man7/socket.7.html)
    *   `SO_ERROR`:
    *   `SO_KEEPALIVE`: Mostly supported.
    *   `SO_REUSEADDR`: Ignored.
*   `IPPROTO_IP`: [IP-level options](https://man7.org/linux/man-pages/man7/ip.7.html)
    *   `IP_MTU_DISCOVER`: Ignored.
    *   `IP_TOS`: Ignored.
*   `IPPROTO_IPV6`: [IPv6-level options](https://man7.org/linux/man-pages/man7/ipv6.7.html)
    *   `IPV6_TCLASS`: Ignored.
    *   `IPV6_V6ONLY`: Mostly supported.
*   `IPPROTO_TCP`: [TCP-level options](https://man7.org/linux/man-pages/man7/tcp.7.html)
    *   `TCP_NODELAY`: Mostly supported.


[0.0.0.0/8]: https://www.rfc-editor.org/rfc/rfc791.html#section-3.2
[0.0.0.0/32]: https://www.rfc-editor.org/rfc/rfc791.html#section-3.2
[100::/64]: https://www.rfc-editor.org/rfc/rfc6666.html
[Direct Sockets]: https://wicg.github.io/direct-sockets/
[DNSSEC]: https://en.wikipedia.org/wiki/Domain_Name_System_Security_Extensions
[DoH]: https://en.wikipedia.org/wiki/DNS_over_HTTPS
[getaddrinfo]: https://pubs.opengroup.org/onlinepubs/9799919799/functions/freeaddrinfo.html
[POSIX socket APIs]: https://en.wikipedia.org/wiki/Berkeley_sockets
[relay servers]: /nassh/docs/relay-protocol.md
[wassh-libc-sup]: /ssh_client/wassh-libc-sup/
[Web APIs]: #web-apis
