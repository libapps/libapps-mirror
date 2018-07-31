# Web Application Messaging (wam)

This is a JavaScript implementation of the [Web Application Messaging protocol]
described in [this design doc](https://docs.google.com/a/chromium.org/document/d/1n_n2nGLMUXeKTrb48vRgfge5DGZ7hOs-Cosbj4IIPAQ).

Wam is a convention for exchanging messages built on top of existing postMessage
based APIs.

Wam adds the ability to request one-or-more replies to a message, even if that
message is itself a reply.  These nested reply chains are a fundamental tool in
wam.  They are used to establish sub-channels under which the set of expected
messages may redefined, and simultaneously as a way to express handles across a
messaging boundary.

Wam also specifies a handshake, in which both endpoints agree on the messaging
dialect to be used within the context of the handshake.

## Status

At the moment (2014-04-05) it's a bit fresher than the document.  The wam
core and wam.FileSystem implementations are in decent shape, but wam.API work
hasn't started.

The ../wash/ directory contains a Chrome V2 app that builds a bash-like command
line shell out of wam.FileSystem.

[Web Application Messaging Protocol]: https://en.wikipedia.org/wiki/Web_Application_Messaging_Protocol
