# WASSH C Library Supplement

*** note
**Warning: This document is old & has moved.  Please update any links:**<br>
https://chromium.googlesource.com/apps/libapps/+/HEAD/ssh_client/wassh-libc-sup/
***

The [WASI Libc] that comes with the [WASI SDK] is fairly complete for our needs,
as is the [WASI Core API] (syscall layer).
But we have some additional needs, both at the C library & syscall layers, hence
this mini project: it implements those extra pieces.

This project exists only to serve the needs of WASSH (and related).
It is not meant to be integrated into other WASM projects, so please don't ask.

## File organization

*   build: The Python script to build & install the project.
*   docs/: Additional documentation.
*   include/: Exported header files for programs.  Basically C library headers.
*   src/: Our C library implementations.  Header files in here are not installed
    and are only for local src/ use.

## Source conventions

Everything is written in C.
We avoid C++ only because we have no code in the WASM world that uses it.
If that ever changes, we can reconsider.

We generally follow the [Chromium C++ style guide] for the code.

Files in include/ use multiple inclusion defines like `WASSH_<FILENAME>_H`.
Header files in src/ use defines like `_WASSH_<FILENAME>_H`.

Extended headers under include/ should first include the existing C library
header if it exists, and then our additional features come after.


[Chromium C++ style guide]: https://chromium.googlesource.com/chromium/src/+/HEAD/styleguide/c++/c++.md
[WASI Core API]: https://github.com/CraneStation/wasmtime/blob/HEAD/docs/WASI-api.md
[WASI Libc]: https://github.com/CraneStation/wasi-libc
[WASI SDK]: https://github.com/CraneStation/wasi-sdk
