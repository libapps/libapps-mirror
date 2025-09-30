# WASI JavaScript Bindings

This project aims to provide a generic framework for [WASM] programs built using
[WASI] and run on the Web platform using JavaScript.
It is meant to be portable across projects and avoids encoding project-specific
logic in its runtime.

While the framework builds off of itself, it is not all-or-nothing.
You're free to use some components if parts of the overall runtime model don't
align with your particular use case.

> Table of Contents
> * [Background]
> * [Requirements]
> * [Framework Overview]
> * [Examples]
> * [Syscall Lifecycles]
> * [API Reference]
> * [Contact]

[Background]: #background
[Requirements]: #requirements
[Framework Overview]: #framework-overview
[Examples]: #examples
[Syscall Lifecycles]: #syscall-lifecycles
[API Reference]: #api-reference
[Contact]: #contact

## Background

[wassh] is the project for building OpenSSH for [WASM] & [WASI].
As part of the development, we found that the [WASI] project lacked any real
JS binding support.
There is [generated emscripten code](https://wasi.dev/polyfill/polyfill.js),
but that was built once a while ago, and hasn’t been updated since.
Which means wassh will need to develop its own JS runtime.

As we fleshed things out, we recognized that a lot of the framework is not
specific to wassh and could be reused by other WASM applications that want to
run on the web.
The market here is probably not significant (compared to e.g. [emscripten]),
but it’s also probably not nothing, and we already need to do the majority of
the work regardless.
Most notably, the fact that [WASM]/[WASI] require all syscalls be handled
synchronously while the JS world (and many of its APIs) can only be satisfied
asynchronously.

Writing JS support code is basically writing an OS.
The [WASM] code uses the [WASI C library] which makes syscalls to the JS world,
and the JS world manages all the standard OS state (open files, etc...) while
servicing the syscall requests.

## Requirements

As [WASI] is still under development, we often require current browser runtimes.
No attempt is made to provide backwards compatibility or transpiling.

* [WASI SDK] 25.0
* [ECMAScript] 2024
* [Module workers](https://web.dev/module-workers/)
  * Chrome 80+
* [WebAssembly BigInt Integration](https://www.chromestatus.com/feature/5648655109324800)
  * Chrome 85+
* [JavaScript Promise Integration (JSPI)](https://chromestatus.com/feature/5674874568704000)
  * Chrome 137+
* Non-blocking message behavior between main thread & web workers

Note that the supported [WASI API] version matches the aforementioned [WASI SDK]
version only.

## Framework Overview

These framework APIs are generally the ones we expect people to use.
There are some more utility/internal APIs available if desired;
see the [API Reference] for more details.

*   Process: Encapsulation of Programs & SyscallEntry's & SyscallHandlers.
    *   Foreground: Programs that run synchronously in the current thread.
        All syscall handlers must be synchronous as well.
    *   Background: Programs that run in dedicated background web workers.
        Syscall handlers may be synchronous or asynchronous.
*   Program: Encapsulation for the WASM instantiation & execution.
*   SyscallEntry: The initial entry point from the WASM world into JS.
    Takes care of reading/writing content to the WASM side and handing off
    to syscall handlers to implement things (using normal JS APIs).
    *   WasiPreview1: Implementation of the (snapshot preview1) [WASI API].
*   SyscallHandler: The code that handles syscall requests using JS APIs.
    Does not speak to the WASM side at all -- everything is via standard JS.
    *   DirectWasiPreview1: Handlers [WASI API] calls directly when possible
        (i.e. there is a general web platform implementation).
    *   ProxyWasiPreview1: Dispatches [WASI API] calls via message passing and
        shared memory to a different thread so calls may be implemented
        asynchronously; does not provide any implementations itself.
*   Worker: Framework for implementing background web worker as
    Process.Background expects.
    **Name bike-shedding TBD**
*   WASI: Constants that match the [WASI C library].

The SyscallHandler API is really how you bind your JS world to the WASM world.
It is responsible for actually handling the syscalls via whatever unique state
or paradigms used in your JS application.

For simple programs, it is expected that people will use Process.Foreground and
SyscallEntry.WasiPreview1 and SyscallHandler.DirectWasiPreview1 APIs unmodified,
perhaps with their own additional SyscallHandler class for things
DirectWasiPreview1 does not support.

For complicated programs, it is expected that people will use Process.Background
SyscallEntry.WasiPreview1 and SyscallHandler.ProxyWasiPreview1 and
SyscallHandler.DirectWasiPreview1 APIs unmodified, and provide their own Worker
and SyscallHandler implementations to round things out.

### Networking

While the [WASI API] includes some basic networking support (`sock_recv`,
`sock_send`, and `sock_shutdown`), they haven't really been fleshed out upstream
as of yet, so they are currently stubs here too.

See the [wassh] docs for details on how it implements networking support.

## Examples

Check out [html/example.html].

## Syscall Lifecycles

At a very high level:

WASM -> SyscallEntry -> SyscallHandler -> <user JS code>
-> SyscallHandler -> SyscallEntry -> WASM

### SyscallEntry

*** note
Most people will not need to implement their own SyscallEntry APIs at all.
This framework provides complete coverage for the [WASI API]'s.
***

SyscallEntry classes provide the initial entry points from the WASM world by
implementing the [WASI API].
The function arguments are tightly coupled to that WASM world: constants reflect
the [WASI C library], pointers are absolute offsets into the program's memory to
structures (which are also defined by the [WASI C library]).
Their job is to unpack & translate the arguments to more natural JavaScript APIs
before handing off execution to the SyscallHandler APIs.

They use a consistent naming convention like `sys_<WASI syscall name>`, so the
`fd_write` [WASI API] syscall will be implemented here as `sys_fd_write`.

Once the [WASI] arguments have been unpacked, `handle_<WASI syscall name>` will
be called in the SyscallHandler implementation.
The APIs will often be simpler than the [WASI API], so consult the
[API Reference] section below.

In cases of errors, the errno value will always be returned directly.
If cases of success, the handler will either return ESUCCESS (for simpler
syscalls, or when outputs are via arguments), or return an object for more
complicated outputs in which case ESUCCESS is always assumed.

### SyscallHandler

SyscallHandler classes provide the actual implementation of syscalls.
They use a consistent naming convention like `handle_<WASI syscall name>`, so
the `fd_write` [WASI API] syscall will be implemented as `handle_fd_write`,
although the function signature will be different.
Consult the [API Reference] section below for the exact arguments.

There are two major variants: direct & proxied.
Direct handlers must be synchronous as the WASM runtime does not support
asynchronous calls.
Proxied handlers may be asynchronous as they run in a different thread --
they may be marked async and/or return Promises that resolve to the right
value (NB: in case of errors, return appropriate errno values instead of
rejecting the promise).

## API Reference

*Replace with generated docs?*

*   WasiView: [DataView] class with extensions for [WASI C library] structures.
*   SyscallLock: Utility class for managing shared memory/IPC between
    SyscallHandler.ProxyWasiPreview1 and your syscall handler in another thread.
    Takes care of locking, passing return/error codes, and serializing objects.

## Contact

See the common [libapps HACK.md](../HACK.md) for details.


[DataView]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/DataView
[ECMAScript]: https://tc39.es/ecma262/
[emscripten]: https://emscripten.org/
[WASI]: https://wasi.dev/
[WASI API]: https://github.com/WebAssembly/WASI/blob/a206794fea66118945a520f6e0af3754cc51860b/phases/snapshot/docs.md
[WASI C library]: https://github.com/WebAssembly/wasi-libc
[WASI SDK]: https://github.com/WebAssembly/wasi-sdk
[WASM]: https://webassembly.org/
[wassh]: ../wassh/
