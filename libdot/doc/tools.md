# Helper Tools

Libdot provides a bunch of helper tools and we try to have consistent behavior.
Lets lay out expectations of them.

## Wrapped Tools

When a tool exists to provide a wrapper for how it's executed, we have to
balance direct execution by a user with a useful API for other scripts.

For example, [libdot/bin/pylint] finds the right installed version of pylint and
makes sure we use our default pylintrc settings.
But we also make it easy for other projects (e.g. [ssh_client/bin/pylint]) to
re-use code with minimal overhead itself.
And we make it easy for other tools (e.g. [libdot/bin/lint]) to build general
drivers for the project & integrate well with the our CI (kokoro).

Users should be able to invoke the script with largely the same default behavior
as if they had executed the tool directly themselves.
The `--` marker can always be used to clearly delineate options too.
Running `./bin/eslint --help` shows our help, but `./bin/eslint -- --help` will
show the underlying tool's help.

### Naming

Use the same name as the tool that's being wrapped, and place it under bin/.
For example, we wrap `pylint` via [libdot/bin/pylint].

Generic names like [libdot/bin/lint] are high-level drivers and not specific
to any underlying tool.

### API Guidelines

For the wrapper script itself:

*   `setup`: Run any tool-specific logic required to initialize it.  This is
    usually downloading+caching+installing the right programs.
    *   If the tool doesn't require any setup, still provide a stub API.
    *   Never return anything; this is a "void" function.
*   `main`: A thin wrapper to initialize the common libdot API & run the tool.
    *   Always accept `argv` as the first argument.
    *   Any additional arguments must be optional, and must only be for setting
        up the runtime settings.  For example, selecting a default config file.
    *   Use local `get_parser` to get the CLI parser.
    *   Use `parser.parse_known_args` to extract our options while retaining any
        underlying arguments for the tool.
    *   Call `perform` and pass parsed CLI options down as makes sense.
    *   Return `0` or `1` to indicate pass/fail (respectively).
*   `get_parser`: Define a command line parser while avoiding conflicts with the
    underlying wrapped tool.
    *   Use `libdot.ArgumentParser` with `short_options=False`.
    *   Do not add any short options itself.
    *   Any long options should not override tool options.
*   `run`: A thin wrapper to run the tool.
    *   Call `setup` to make sure the tool is available.
    *   Always accept `argv=()` as the first argument.
    *   Always accept `**kwargs` as the last argument.
    *   Any additional arguments must be optional, and must only be for setting
        up the runtime settings.  For example, selecting a default config file.
    *   Return the result of `libdot.run` directly for the caller.
*   `perform`: A high level wrapper around the tool.  This is where all our
    custom tool-specific logic lives, and uses `run` to get it done.
    *   Always accept `argv=()` as the first argument.
    *   Always accept `**kwargs` as the last argument.
    *   Any additional optional arguments must be for creating a reasonable
        Python API around the tool.
    *   Return a boolean to indicate whether everything succeeded.

Once that's been implemented, add a shortcut to [libdot.py] using the
`HelperProgram` API.
This allows other programs to access the tool directly without going through a
fork+exec cycle; while this is a minor speed-up, it helps with OS portability,
and provides a more readable API.


[libdot.py]: ../bin/libdot.py
[libdot/bin/lint]: ../bin/lint
[libdot/bin/pylint]: ../bin/pylint
[ssh_client/bin/pylint]: /ssh_client/bin/pylint
