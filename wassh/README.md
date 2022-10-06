# WASSH: WebAssembly SSH Client

This is the JS code for running an SSH client via WASM.
It is largely a standalone module and does not include other critical parts.
Consult the other projects in the stack:

* [wasi-js-bindings]: WASI JavaScript Bindings
* [nassh]: The connection UI & overall runtime
* [ssh_client]: Port of OpenSSH to WASM

For details on how wassh implements various subsystems:

* [signals](./docs/signals.md): Signal emulation.
* [sockets](./docs/sockets.md): Network support.

A presentation is also available:
[WASI: A WASM Journey](https://docs.google.com/presentation/d/1IwykneyXqDqyJHOs0zKvHQw9_WlWVmkDg2CuFSoUCUE/preview).


[nassh]: ../nassh/
[ssh_client]: ../ssh_client/
[wasi-js-bindings]: ../wasi-js-bindings/
