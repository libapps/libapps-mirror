# Secure Shell Relay Server Protocols

Some servers are accessible only behind a different secure server, and over a
web protocol like [XHR] or [WebSockets].
To support those use cases, Secure Shell supports connecting to machines through
relay servers.

Here we document the relay server protocol in case people want to create their
own relay servers for their own networks.
Google does not offer any public relay servers for you to access.
See the [FAQ] for details on open source relay server implementations.

This does not document the Secure Shell options it uses itself to connect
through relays.
See the [Options] document for those details.

[TOC]

## Corp Relay {#corp-relay}

This uses the id `corp-relay@google.com` (e.g. when using `--proxy-mode=`).

The main implementation for this can be found in [nassh_relay_corp.js] with
supporting stream logic in [nassh_stream_relay_corp.js].

### Protocol Overview

```
 +--------+      Phase I         +---------------+
 |  USER  |  ---(1 /cookie)--->  | COOKIE SERVER |
 +--------+                      +---------------+
 | | |    |
 | | |    |
 | | |  Phase II
 | | |    |
 | | |    `---(3 /proxy)--->  +--------------+
 | | |                        |              |
Phase III                     |              |  ----->  +------------+
 | | |                        | RELAY SERVER |          | SSH SERVER |
 | | `------(4 /read)------>  |              |  <-----  +------------+
 | `--------(5 /write)----->  |              |
 `----------(6 /connect)--->  +--------------+
```

You can think of this as a three phase process:

*   (I) Client talks to a cookie server in order to authenticate the user, and
    for the cookie server to tell the user which relay server to use.
*   (II) Client talks to the relay server to establish a new session to the ssh
    server (and allow the relay server to authenticate the user).
*   (III) Client talks to the ssh server through the relay server using the
    established session.

Across those phases are some major steps:

1.  Connect to the cookie server using [/cookie].

    This system may initiate a single-sign-on (SSO) flow if necessary, as well
    as verify client certificates.

2.  When the cookie server is done with authenticating the user, it responds
    with details for which relay server to talk to in order to connect to the
    actual ssh server.
    Its response format is described below in [/cookie].

    The relay host is expected to respond to requests for [/proxy] and either
    [/connect] (for [WebSockets]) or [/read] & [/write] (for [XHR]).

3.  Send a request to [/proxy] which establishes the ssh session with the remote
    ssh server.

4.  When using [XHR], use [/read] to read binary data from the ssh server via
    the established relay server session.  Every read requires a new connection
    to be created.

5.  When using [XHR], use [/write] to send binary data to the ssh server via the
    established relay server session.  Every write requires a new connection to
    be created.

6.  When using [WebSockets], use [/connect] to create a long lived bidirectional
    socket for reading and writing binary data to the ssh sever via the
    established relay server session.

### /cookie Protocol {#corp-relay-cookie}

Make a `GET` request to `PROTOCOL://COOKIE_HOST:COOKIE_PORT/cookie` to find the
relay server to talk to.
This allows the server to select from pools to help load balance internally.

`PROTOCOL` may be `http` or `https`.  Secure Shell defaults to `http`.

`COOKIE_HOST` is the user-specified hostname for the cookie server.
This system could offer other services too which is why the port is not fixed.

`COOKIE_PORT` is the port on the server to connect to which defaults to 8022.

The [query string] settings:

*   `ext=EXT_ID` (required): The Chrome extension id that the cookie server
    should redirect to when it is finished.
*   `path=PATH` (required): The path under the extension that the cookie server
    should redirect to when it is finished.
*   `version=VERSION`: The version of the cookie protocol.  Only `2` is
    supported.  If `version=` is omitted, then the older version 1 is used
    (note: `version=1` is not supported!).
*   `method=METHOD`: The redirection method in the response (only used by
    `version=2`.  See the [method field section](#corp-relay-method) below for
    more details.

It responds with an eventual redirect to `chrome://EXT_ID/PATH`.
The server might trigger intermediate redirects for its own purposes.
The exact redirect method might be [HTTP 302], or an [HTML meta refresh], or a
JavaScript redirect using a `<script>` tag.
The client only cares about the eventual redirect to `chrome://EXT_ID/PATH`.

The response format is determined by the `version` and `method` settings.

Version `1` will set the [URI fragment] (the part after the `#`) to
`USER@RELAY_HOST:RELAY_PORT` where each component is [URI encoded] as needed.
The `RELAY_PORT` part is optional.
The `USER` field is the username used to authenticate with the cookie server.
Secure Shell itself ignores this field though, so you can too.

Version `2` will send a JSON object; the response depends on the `METHOD`
specified earlier (see the [method field] for more details).
That object will have the fields:

*   `endpoint` (string): The `RELAY_HOST:RELAY_PORT` (where `RELAY_PORT` is
    optional).
*   `error` (string): In case the cookie server rejects the request (e.g. bad
    credentials), a human readable string can be placed here for display.

If `RELAY_PORT` is not specified, the default will be based on the protocol used
later when connecting to `RELAY_HOST`.
Typically `http` and `ws` use port 80 while `https` and `wss` use port 443.
It is up to the client to select the `RELAY_PROTOCOL` themselves.

#### method field {#corp-relay-method}

The `method` field is used with version `2` only.
It may be `direct` or `js-redirect`.

The `direct` method will return a JSON response with an [XSSI header].
The client is responsible for parsing that response and operating on it (e.g.
redirecting itself to `chrome://EXT_ID/PATH`).

The `js-redirect` method will generate a HTML document with a `<script>` tag to
redirect to the `chrome://EXT_ID/PATH` path.
The JSON response is [base64url] encoded in the [URI fragment].

Secure Shell only supports `js-redirect` currently.

### /proxy Protocol {#corp-relay-proxy}

This establishes a new session with the actual ssh server.
The `RELAY_HOST:RELAY_PORT` settings were passed back from the [/cookie]
connection made previously.

Make a `GET` request to `PROTOCOL://RELAY_HOST:RELAY_PORT/proxy` with the
[query string]:

*   `host=HOST`: The ssh server to connect to.  It may be an IP address or a
    hostname, and does not need to be resolvable or accessible by the client.
*   `port=PORT`: The port the ssh server is listening on.

This will return a session id (and optionally more [query string] fields) as
plain text.
The client should then paste this directly into the next phase -- either with
[/connect] (for [WebSockets]) or [/read] & [/write] (for [XHR]).

For example, it might be `4b2fbe8f4eff640b&host=foovpn-1.system.example.com`.
The session id allows the remote relay server to associate the connection with
an existing one, and the additional [query string] fields allow for things like
load distribution.
The extra fields are left unspecified to allow the relay server implementation
the freedom to pass through whatever they want.

### /connect Protocol (WebSocket) {#corp-relay-connect}

*** aside
If possible, you should use [WebSockets] as the protocol is much more efficient.
***

For [WebSockets], you need to only make one connection to `/connect` to the
`RELAY_PROTOCOL://RELAY_HOST:RELAY_PORT` host to create a bidirectional socket.
Use `arraybuffer` for the `binaryType` field.

The fields specified in the [query string]:

*   `sid=SESSION_ID`: The session id given returned from the [/proxy] call.
*   `ack=READ_ACK`: For relays that support support reconnects, this will be the
    last read ack the client received.  New connections start at `0`.
*   `pos=WRITE_ACK`: For relays that support support reconnects, this will be
    the last write ack the client received.  New connections start at `0`.
*   `try=TRY`: For relays that support connection attempt reporting, the number
    of times we've tried to connect.  New connections start at `1`.

The `SESSION_ID` allows the relay server to validate the connection.
This is why you should always use `wss` instead of `ws` to avoid spoofing.

#### Reads

Incoming data starts with a 4 byte WRITE_ACK ([big endian]).
If the value is larger than 24-bits, it indicates a connection error, and the
connection is shut down.
Otherwise, the server specifies how many bytes it has successfully read, and
the client updates its write queue accordingly.

The rest of the data is binary data from the ssh server.

#### Writes

Outgoing data is broken up into 32KiB chunks (which includes 4 byte ACKs).

The first 4 bytes are a 24-bit READ_ACK ([big endian]) that tells the server
how much data the client has successfully read so far.
Once more than 24-bits worth of data have been read, the value is wrapped.
i.e. The client only cares about the low 24-bits of the count.

The rest of the write is all the data to be sent to the ssh server in binary
form.

The client keeps track of how much data it has written so it can check the
WRITE_ACK sent from the server during reads.

#### Latency Reporting

If the optional ack latency reporting extension is enabled, the client keeps
track of how long it takes for READ_ACKs and WRITE_ACKs to be synchronized,
and then it reports the average inline using the textual form `A:integer`.
Secure Shell maintains a running average over 10 samples, but there is no
requirement as to how often the client reports this information.

There is also reply latency tracking in the form `R:integer`, although Secure
Shell doesn't currently report it.

This is entirely optional and is purely for servers that want to keep track of
performance of client connections.

### /read Protocol (XHR) {#corp-relay-read}

*** aside
Since every read requires setting up a new HTTP connection, and only one read
request may be pending at a time, it's highly recommended you use the
[WebSocket] [/connect] instead.
***

For [XHR] connections, you make a `GET` request to
`RELAY_PROTOCOL://RELAY_HOST:RELAY_PORT/read` to read data from the ssh server.

The [query string] settings:

*   `sid=SESSION_ID`: The session id given returned from the [/proxy] call.
*   `rcnt=READ_COUNT`: The number of bytes the client has successfully read.
    New connections start at `0`.

The `SESSION_ID` allows the relay server to validate the connection.
This is why you should always use `https` instead of `http` to avoid spoofing.

The relay server will send [HTTP 200] with [base64url] encoded data in the
response when there is new data available from the ssh server.
Data might not be available immediately in which case the relay server might
not respond immediately.

It may send [HTTP 410] when the ssh server is no longer reachable.

All other HTTP errors are ignored, and a new `/read` is created for all errors
except for [HTTP 410].

### /write Protocol (XHR) {#corp-relay-write}

*** aside
Since every write requires setting up a new HTTP connection, and only one write
request may be pending at a time, and write chunks are small (typically 1KiB),
it's highly recommended you use the [WebSocket] [/connect] instead.
***

For [XHR] connections, you make a `GET` request to
`RELAY_PROTOCOL://RELAY_HOST:RELAY_PORT/write` to write data to the ssh server.

The fields specified in the [query string]:

*   `sid=SESSION_ID`: The session id given returned from the [/proxy] call.
*   `wcnt=WRITE_COUNT`: The number of bytes the client has successfully written.
    New connections start at `0`.
*   `data=DATA`: The data to write to the ssh server.  It is [base64url]
    encoded.  This field is typically limited to 1KiB.

The `SESSION_ID` allows the relay server to validate the connection.
This is why you should always use `https` instead of `http` to avoid spoofing.

The relay server will send [HTTP 200] once the relay server has passed the data
through to the ssh server.

It may send [HTTP 410] when the ssh server is no longer reachable.

All other HTTP errors are ignored.
Data will continue to be sent via new `/write` requests until [HTTP 410] is
returned.

## SSH Relay v4 {#corp-relay-v4}

This uses the id `corp-relay-v4@google.com` (e.g. when using `--proxy-mode=`).

The main implementation for this can be found in [nassh_relay_corpv4.js] with
supporting stream logic in [nassh_stream_relay_corpv4.js].

Googlers can access the internal design doc at [go/ssh-relay-protocol-4].

### Elevator Pitch

The selling points for this protocol over the older [Corp Relay]:

*   Support for resuming connections even when your IP changes.
*   Support for passing error messages back to the client.
*   Extensible protocol for adding more in-band commands.

### Protocol Overview

The initial cookie server lookup and `/cookie` API is the same as [Corp Relay].
What's different is the relay server protocol.

The API endpoints have been chosen such that they can be implemented by the same
service as the older [Corp Relay].

*  `/v4/connect?host=HOST&port=PORT`
*  `/v4/reconnect?sid=SID&ack=ACK`

### /v4/connect Protocol

Using [WebSockets], make one connection to `/connect` to the
`RELAY_PROTOCOL://RELAY_HOST:RELAY_PORT` host to create a bidirectional socket.
Use `arraybuffer` for the `binaryType` field and `['ssh']` for the `protocols`
field.

The fields specified in the [query string]:

*   `host=HOST`: The ssh server to connect to.  It may be an IP address or a
    hostname, and does not need to be resolvable or accessible by the client.
*   `port=PORT`: The port the ssh server is listening on.

### /v4/reconnect Protocol

This is used to re-establish an existing session.
Once connected, the protocol is the same as `/v4/connect`.

The fields specified in the [query string]:

*   `sid=SESSION_ID`: The session id returned from the [/proxy] call.
*   `ack=READ_ACK`: The last read ack the client received.

The `SESSION_ID` allows the relay server to validate the connection.
This is why you should always use `wss` instead of `ws` to avoid spoofing.

### Commands

Every [WebSocket] message has a tag to determine the type of the command.
Clients MUST ignore all unknown tags so that servers MAY add more in the future.

All numbers are [big endian] on the wire.
All arrays are prefixed by a 32-bit number for its length.
The max length of an array SHOULD not exceed 16KiB
(servers MAY reject larger requests).

The basic structure looks like:

```C
struct Command {
  uint16_t tag;
  ...
};
```

The current defined set of tags:

| Tag | Name                | Meaning |
|:---:|---------------------|---------|
| `1` | `CONNECT_SUCCESS`   | First command after `/v4/connect` |
| `2` | `RECONNECT_SUCCESS` | First command after `/v4/reconnect` |
| `4` | `DATA`              | New data for the client |
| `7` | `ACK`               | Server acking client data |

#### CONNECT_SUCCESS

This will be the first message after establishing a `/v4/connect` connection.

This informs the client of its session id (which will be printable ASCII).
The SID will not be NUL terminated, so use the length exactly.
The client will use this with the `/v4/reconnect` API as the `SESSION_ID`.

```C
struct {
  uint16_t tag;  // 0x0001
  uint32_t sid_length;
  char sid[];
};
```

#### RECONNECT_SUCCESS

This will be the first message after establishing a `/v4/reconnect` connection.

This allows the client to resync its write buffer in case an ack was missed.

```C
struct {
  uint16_t tag;  // 0x0002
  uint64_t ack;
};
```

#### DATA

Transferring arbitrary data.

The receiving end should update its local ack counter and send back an ack
packet with its new position.
The ack command need not be sent immediately in case it wants to coalesce
multiple acks into a single command.

```C
struct {
  uint16_t tag;  // 0x0004
  uint32_t data_length;
  uint8_t data[];
};
```

#### ACK

Acknowledging received data.

The receiving end should update its buffer to discard all acknowledged data.

The ack field is the absolute position in the stream since the initial
connection which is why it's a 64-bit number.
The receiving end should keep track of the last ack that it saw so that it can
compute the delta of how many bytes it may now discard.

```C
struct {
  uint16_t tag;  // 0x0007
  uint64_t ack;
};
```

## SSH-FE

This uses the id `ssh-fe@google.com` (e.g. when using `--proxy-mode=`).

The main implementation for this can be found in [nassh_relay_sshfe.js] with
supporting stream logic in [nassh_stream_relay_sshfe.js].

TODO


[Corp Relay]: #corp-relay
[method field]: #corp-relay-method
[/connect]: #corp-relay-connect
[/cookie]: #corp-relay-cookie
[/proxy]: #corp-relay-proxy
[/read]: #corp-relay-read
[/write]: #corp-relay-write

[base64url]: https://en.wikipedia.org/wiki/Base64#URL_applications
[big endian]: https://en.wikipedia.org/wiki/Endianness
[HTML meta refresh]: https://en.wikipedia.org/wiki/Meta_refresh
[HTTP 200]: https://en.wikipedia.org/wiki/HTTP_200
[HTTP 302]: https://en.wikipedia.org/wiki/HTTP_302
[HTTP 410]: https://en.wikipedia.org/wiki/HTTP_410
[query string]: https://en.wikipedia.org/wiki/Query_string
[URI encoded]: https://en.wikipedia.org/wiki/Percent-encoding
[URI fragment]: https://en.wikipedia.org/wiki/Fragment_identifier
[WebSocket]: https://en.wikipedia.org/wiki/WebSocket
[WebSockets]: https://en.wikipedia.org/wiki/WebSocket
[XHR]: https://en.wikipedia.org/wiki/XMLHttpRequest
[XSSI header]: https://security.stackexchange.com/questions/110539/

[go/ssh-relay-protocol-4]: https://goto.google.com/ssh-relay-protocol-4

[FAQ]: ./FAQ.md
[nassh_relay_corp.js]: ../js/nassh_relay_corp.js
[nassh_relay_corpv4.js]: ../js/nassh_relay_corpv4.js
[nassh_relay_sshfe.js]: ../js/nassh_relay_sshfe.js
[nassh_stream_relay_corp.js]: ../js/nassh_stream_relay_corp.js
[nassh_stream_relay_corpv4.js]: ../js/nassh_stream_relay_corpv4.js
[nassh_stream_relay_sshfe.js]: ../js/nassh_stream_relay_sshfe.js
[Options]: ./options.md
