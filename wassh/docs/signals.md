# WASSH Signal Emulation

POSIX defines an
[asynchronous signal system](https://pubs.opengroup.org/onlinepubs/9699919799/functions/V2_chap02.html#tag_15_04).
This document explains how wassh implements this.

[TOC]

## Background

POSIX delivers signals asynchronously to programs -- code is interrupted at any
point in time, not just when it feels like handling a signal.  This is because
POSIX largely assumes there are multiple programs running (e.g. a kernel and
userland), and that code execution in the process's model can jump around (i.e.
the signal handlers & signal stacks are executed at any point).  Both of these
are fundamentally at odds with the JavaScript & WebAssembly runtime models.

JavaScript is single threaded, and only it controls the execution flow.  It
cannot be halted so a function can run in its context (i.e. a signal handler).
WebAssembly is a straight forward extension of this concept.

The astute reader might exclaim "signal masks!", and while those can mitigate
when a signal is delivered to a degree, not all signals may be masked, and even
if they could, fundamentally it's irrelevant to the difference in runtime models
point.  Signal masks simply say "don't deliver at this time", they don't say
"deliver now".

### signalfd

The astute reader might note that the Linux [signalfd(2)] API handles this well:
there is no asynchronous delivery; signals are manually dequeued by the process
via normal read system calls.  This is certainly true, however this requires
rewriting core OpenSSH logic to utilize signalfd's, and while technically this
could happen, rewriting OpenSSH goes against wassh goals.  We want to minimize
the number of changes made to OpenSSH, upstream as much as possible, and iff we
must make a change, try to minimize its invasiveness.

Since OpenSSH is an OpenBSD project, rewriting core logic to use Linuxisms is
out of the question, and signalfd so far has yet to be adopted by any other
operating system.  There might be alternative APIs that provide equivalent
functionality, but none with as wide portability as POSIX signals currently.

[signalfd(2)]: https://man7.org/linux/man-pages/man2/signalfd.2.html

## Handled Signals

OpenSSH registers many signal handlers, but the vast majority are to catch
signals that would terminate the process (e.g. `SIGINT`, `SIGTERM`, etc...)
so that the process can be (mostly) shut down gracefully.

We don't need to deliver such a signal ourselves, and can destroy the process
whenever we need to, so these signals are of no interest.

That said, the implementation defined below isn't specific to any signal, so
all of these should basically work.

### SIGWINCH

This signal is generated when a terminal resizes.  It allows programs to react
immediately and only when necessary instead of having to constantly poll for
possible updates.  SSH will transmit this information to the remote program
(e.g. the user's login shell or editor) so it knows how big the terminal is
when it wants to e.g. wrap long lines.

## Supported APIs

Currently we only support basic [signal(2)] APIs, i.e. registering a handler on
a per-signal number basis.  These are the only APIs that OpenSSH uses, so we
haven't bothered implementing anything more.

We don't support the newer [sigaction(2)] APIs, nor do we support signal masks.
If OpenSSH ever uses these, it probably wouldn't be too hard to add.  For now,
they're basically stubs.

[signal(2)]: https://man7.org/linux/man-pages/man2/signal.2.html
[sigaction(2)]: https://man7.org/linux/man-pages/man2/sigaction.2.html

## Implementation

We take a page from
[POSIX thread cancellation](https://pubs.opengroup.org/onlinepubs/9699919799/functions/V2_chap02.html#tag_15_09_05).
Fundamentally, instead of delivering signals at any point in time, we process
signals when system call handlers are executing.
This isn't really incompatible with POSIX either -- signals are queued, and then
delivered by the kernel when possible, but there is no guarantee as to when that
actually happens.

In practice, we only do this when handling the select-related syscalls.  Since
OpenSSH spends the majority of its time calling these functions (to move data
around), this limitation isn't a big deal, and it minimizes the number of touch
points we have to add in wassh.

We don't reset the handler (not `SA_RESETHAND`), we defer the same signal (not
`SA_NODEFER`), and we don't restart the signal (not `SA_RESTART`).  OpenSSH will
handle `EINTR` from the relevant calls, so this works out.

### Details

wassh maintains a per-process queue of signals.
See `send_signal()` in [process.js] for details.
If a notification function has been registered, it is called.

When hterm's `onTerminalResize()` callback fires (due to the terminal resizing),
it queues the signal.
See `this.term_.io.onTerminalResize` in [syscall_handler.js].

When executing `handle_poll_oneoff` in [syscall_handler.js], if any signals are
queued, we return a timeout event with the list of pending signals.

When `sys_poll_oneoff` processes the result in [wjb/syscall_entry.js], if any
signals are returned, it calls the WASM program's exported
`__wassh_signal_deliver` symbol with each signal number.  This function in turn
calls the program's registered signal handler, or processes the default signal
disposition (e.g. termination).  See [wassh-libc-sup/signal.c] for details.

### WASI Overlap

The [WASI API] has at times defined signal interfaces.  It's still in flux, and
it's unclear what WASI will ultimately include, if anything at all.  As such, we
don't rely on any of WASI's definitions, and instead use the C library signal
APIs.  Most importantly, we use the C library's signal numbers.


[process.js]: ../js/process.js
[syscall_handler.js]: ../js/syscall_handler.js
[WASI API]: https://github.com/WebAssembly/WASI/blob/HEAD/phases/snapshot/docs.md
[wassh-libc-sup/signal.c]: /ssh_client/wassh-libc-sup/src/signal.c
[wjb/syscall_entry.js]: /wasi-js-bindings/js/syscall_entry.js
