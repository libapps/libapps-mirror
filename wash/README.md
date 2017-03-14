# Hello

This is wash.  It is yet-another shell environment for the web.  Wash's special
trick is that it can "mount" virtual file systems using postMessage based IPC.

It is accidentally similar to Plan 9's file system, in that each origin comes
with it's own virtual filesystem that can contain data and executables.

The actual IPC messages are JSON, and can be serialized over any transport.

The work consists of two parts.  Objects in the `lib.wam.*` namespace are part
of shared library code, which all participating origins should use.  This code
comes from `../lib_wam`.

The `wash.*` namespace is a Chrome V2 app that combines the hterm terminal
emulator with a bash-like read-eval-print interface that supports lots of
readline commands and keybindings.
