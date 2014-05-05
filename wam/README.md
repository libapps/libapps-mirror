# Hello

This is a JavaScript implementation of the Web Application Messaging protocol
described in https://docs.google.com/a/chromium.org/document/d/1n_n2nGLMUXeKTrb48vRgfge5DGZ7hOs-Cosbj4IIPAQ.

At the moment (2014-04-05) it's a bit fresher than the document.  The wam
core and wam.FileSystem implementations are in decent shape, but wam.API work
hasn't started.

The ../wash/ directory contains a Chrome V2 app that builds a bash-like command
line shell out of wam.FileSystem.
