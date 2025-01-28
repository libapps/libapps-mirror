#!/usr/bin/env python3
# Copyright 2012 The ChromiumOS Authors
# Use of this source code is governed by a BSD-style license that can be
# found in the LICENSE file.

"""VT Scope is a debugging aid for developers of terminal emulators.

VT Scope provides an interactive shell which can load a pre-recorded terminal
session and play it back to one or more clients in a controlled manner.

It is possible to play through to a particular offset in the input or play until
a given number of escape sequences have been encountered.

The next escape sequence is displayed in VT Scope before it is sent to the
target terminal(s), so that you know what's going to be printed before it
happens.

You can connect multiple destination terminals to the scope, in order to A/B
test a known-good terminal with one under development.  Clients connect over a
TCP socket to port 8383.  VT Scope only listens on the local 127.0.0.1
interface.

Canned VT sessions can be created by enabling logging in xterm.

Sample usage looks like this:

    # Open a can of data...
    vtscope> open ../test_data/vttest-01.log
    Read 16723 bytes from ../test_data/vttest-01.log.

    # When the next chunk of data is plain text, the offset, byte count,
    # and first 15 bytes are displayed...
    Next up: offset 0, 19 chars: "# 20120103.1540..."

    # Wait for two clients...
    vtscope> accept 2
    Listening on 127.0.0.1:8383
    Waiting for client 1/2...

    # At this point, open an xterm and type 'nc 127.0.0.1 8383', then open
    # hterm and do the same.
    Remote connected by ('127.0.0.1', 49464)
    Waiting for client 2/2...
    Remote connected by ('127.0.0.1', 49465)

    # Single step through the data...
    vtscope> step

    # When the next chunk of data is an escape sequence, it is displayed
    # with added spaces to make it easier to read.
    Next up: offset 19, ESC [ 0 c

    # Press ENTER to repeat the previous command.
    vtscope>
    Next up: offset 23, ESC [ ? 1 l

    # Step through multiple escape sequences at a time
    vtscope> step 10
    Next up: offset 28, ESC [ ? 3 l
    ...
    Next up: offset 73, ESC [ 0 m

    # Start from the beginning of the data...
    vtscope> reset
    Next up: offset 0, 19 chars: "# 20120103.1540..."

    # Seek directly to an offset, reset first if necessary...
    vtscope> seek 73
    Next up: offset 19, ESC [ 0 c
    ...
    Next up: offset 73, ESC [ 0 m

    # Exit vtscope.  Pressing Ctrl+D on a blank line works too.
    vtscope> exit

Check the comments in the "cmd_*" methods below for details about specific
commands.
"""

import argparse
import atexit
import traceback
import json
import os
import re
import readline
import socket
import sys
import time


HISTFILE = os.path.expanduser("~/.vtscope_history")
LISTEN_HOST = "127.0.0.1"
LISTEN_PORT = 8383
PROMPT = "vtscope> "
MAX_TEXT = 15


class VTScope:
    """The VTScope tool."""

    # The list of connected terminals.
    clients = []

    # True if we're running the REPL.
    running = False

    # The canned data.
    data = ""

    # The amount of sleep time between each character, in ms.
    delay_ms = 0

    # The list of header-defined OFFSETs where we might want to stop and view
    # the current state.
    stops = []

    # The current start/end position in the data.  The characters between these
    # two positions are next up to be sent to the clients.
    start_position = 0
    end_position = 0

    # Patterns for escape sequences we expect to see in the data.
    re_escapes = (
        # Control Sequence Introducers.
        ("CSI", re.compile(r"\[.*?[@-~]")),
        # Operating System Commands.
        ("OSC", re.compile(r"\].*?(\x1b\\|\x07)")),
        # Privacy Messages.
        ("PM", re.compile(r"^.*?(\x1b\\|\x07)")),
        # Device Control Strings.
        ("DCS", re.compile(r"P.*?(\x1b\\|\x07)")),
        # Application Program Control.
        ("APC", re.compile(r"_.*?(\x1b\\|\x07)")),
        # DEC private sequences.
        ("DEC", re.compile(r"#[^\x1b]")),
        # Character set control.
        ("CHR", re.compile(r"%[^\x1b]")),
        # Graphic character sets.
        ("SCS", re.compile(r"[()*+-./][^\x1b]")),
        # Other escape sequences.
        ("ESC", re.compile(r"[^\x1b]")),
    )

    def run(self):
        """Start the VTScope REPL."""
        # Pressing ENTER on a blank line re-executes the previous command.
        last_command_line = ""

        self.running = True

        while self.running:
            try:
                command_line = input(PROMPT)
            except KeyboardInterrupt:
                print("^C")
                continue
            except EOFError:
                self.running = False
                print("exit")
                return

            if not command_line:
                command_line = last_command_line
            else:
                command_line = command_line.strip()

            self.dispatch_command(command_line)

            last_command_line = command_line

    def scan_header(self, header):
        """Scan the header for OFFSET blocks where we might want to stop and
        view the current state.
        """
        offset_re = re.compile(
            r"^@@\s+OFFSET:(\d+)\s+LINES:(\d+)\s+CURSOR:(\d+),(\d+)\s*$",
            re.MULTILINE,
        )

        self.stops = []

        m = offset_re.search(header)
        while m:
            self.stops.append(
                {
                    "offset": int(m.group(1)),
                    "lines": int(m.group(2)),
                    "row": int(m.group(3)),
                    "column": int(m.group(4)),
                }
            )
            m = offset_re.search(header, m.end())

    def find_next_chunk(self):
        """Advance start_position and end_position to the next chunk in the
        canned data.
        """
        self.start_position = self.end_position

        if self.start_position >= len(self.data):
            return ""

        if self.data[self.start_position] == "\x1b":
            m = None
            for esc_name, pattern in self.re_escapes:
                m = pattern.match(self.data, self.start_position + 1)
                if m:
                    break

            if m:
                self.end_position = m.end()
            else:
                self.end_position = self.start_position + MAX_TEXT
                print("Unable to find end of escape sequence.")

            sequence = self.data[self.start_position + 1 : self.end_position]
            return json.dumps(esc_name + " " + " ".join(sequence))[1:-1]

        else:
            self.end_position = self.data.find("\x1b", self.start_position)
            if self.end_position == -1:
                self.end_position = len(self.data)

            plaintext = self.data[self.start_position : self.end_position]
            if len(plaintext) > MAX_TEXT:
                plaintext = plaintext[0:MAX_TEXT] + "..."

            return (
                f"{self.end_position - self.start_position} chars: "
                + json.dumps(plaintext)
            )

    def show_next_chunk(self):
        """Find the next chunk of data, and display it to the user."""
        snippet = self.find_next_chunk()

        if snippet:
            print(f"Next up: offset {self.start_position}, {snippet}")
        else:
            print("End of data.")

    def send(self, data):
        """Broadcast a string to all clients.

        This automatically removes any clients that appear to have disconnected.
        """
        for i in range(len(self.clients), 0, -1):
            fd = self.clients[i - 1]
            try:
                fd.send(data)
            except IOError:
                print(f"Client #{i} disconnected.")
                del self.clients[i - 1]

    def broadcast_chunk(self):
        """Broadcast the current chunk of data to the connected clients."""
        if not self.delay_ms:
            self.send(self.data[self.start_position : self.end_position])

        else:
            # If we have a delay, send a character at a time.
            for ch in self.data[self.start_position : self.end_position]:
                self.send(ch)
                time.sleep(self.delay_ms / 1000.0)

    def dispatch_command(self, command_line):
        """Dispatch a command line to an appropriate cmd_* method."""
        command_args = command_line.split(" ")
        command_name = command_args[0]
        command_args = command_args[1:]
        if not command_name:
            return

        command_function = getattr(self, "cmd_" + command_name, None)
        if not command_function:
            print(f'Unknown command: "{command_name}"')
            return

        try:
            command_function(command_args)
        except Exception:  # pylint: disable=broad-except
            traceback.print_exc()
            print(f'Internal error executing "{command_name}"')

    # Commands start here, in alphabetical order.

    def cmd_accept(self, args):
        """Wait for one or more clients to connect.

        Usage: accept <client-count>

        If <client-count> starts with a '+' as in 'accept +1', then this will
        allow additional clients to connect.  Otherwise all existing connections
        are reset before accepting.

        Clients can connect using the the 'nc' (aka netcat) command, with...

            $ nc 127.0.0.1 8383
        """
        if not args:
            print("Missing argument.")
            return

        if args[0][0] == "+":
            count = len(self.clients) + int(args[0][1:])
        else:
            count = int(args[0])
            self.clients = []

        print(f"Listening on {LISTEN_HOST}:{LISTEN_PORT}")
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        sock.bind((LISTEN_HOST, LISTEN_PORT))
        sock.listen(1)

        while len(self.clients) < count:
            print(
                "Waiting for client", len(self.clients) + 1, "/", count, "..."
            )
            (fd, addr) = sock.accept()
            self.clients.append(fd)
            print("Remote connected by", addr)

        sock.close()

    def cmd_bstep(self, args):
        """Step a given number of bytes."""
        if args:
            count = int(args[0])
        else:
            count = 1

        self.end_position = self.start_position + count
        if self.end_position == len(self.data):
            self.end_position = len(self.data)

        self.cmd_step([])

    def cmd_delay(self, args):
        """Set a delay between each character, in milliseconds."""
        if args:
            self.delay_ms = int(args[0])

        print("Delay is now:", self.delay_ms)

    def cmd_exit(self, args):
        """Exit vtscope.

        Usage: exit
        """
        if args:
            print("Command takes no arguments")
            return

        self.running = False

    def cmd_help(self, args):
        """Display help information to the user."""
        if args:
            print("Command takes no arguments")
            return

        first = True
        for method in dir(self):
            if method.startswith("cmd_"):
                if not first:
                    print()
                else:
                    first = False

                print(f"{method[4:]}:")
                for line in getattr(self, method).__doc__.strip().splitlines():
                    if line.startswith("        "):
                        line = line[8:]
                    print(" ", line)

    def cmd_send(self, args):
        r"""Send a string to all clients.

        You can use ESC to signify the ASCII code for escape, and JSON notation
        to specify any other non-printables.

        JSON notation uses '\uXXXX' to specify arbitrary codepoints, as well as
        common shortcuts such as '\n', '\t', and '\b'.

        Whitespace is used only as a separator.  To send a literal space you
        must encode it as \u0020.

            # Send the code to show the cursor (useful if the recorded session
            # previously hid it).
            send ESC [ ? 25 h

            # Same as above.
            send ESC [?25h

            # Broken, would send the literal characters "ESC" followed by
            # "[?25h".
            send ESC[?25h

            # Send a tab followed by a backspace.
            send \t\b

            # Send the text HelloWorld (whitespace is only used as a separator).
            send Hello World

            # Send the text "Hello World".
            send Hello\u0020World
        """
        data = ""

        for arg in args:
            if len(arg) == 1:
                data += arg
            elif arg == "ESC":
                data += "\x1b"
            else:
                data += json.loads(f'"{arg}"')

        print("Sending", json.dumps(data))
        self.send(data)

    def cmd_stops(self, args):
        """Display a list of the stop offsets.

        Usage: stops
        """
        if args:
            print("Command takes no arguments")
            return

        if not self.stops:
            print("No stop offsets found.")
            return

        for i, offset in enumerate(self.stops):
            print(
                f"#{i + 1} offset:",
                offset["offset"],
                "lines:",
                offset["lines"],
                "cursor:",
                f"{offset['row']},{offset['column']}",
            )

    def cmd_open(self, args):
        """Open a local file containing canned data.

        If the log file has header information then the OFFSETs found in the
        header will be available to the 'seek' command.  See 'seek' and 'stops'
        commands for more information.

        Usage: open <local-path>
        """
        if len(args) != 1:
            print("Command only accepts a single filename")
            return

        filename = os.path.expanduser(args[0])

        with open(filename, encoding="utf-8") as f:
            self.data = f.read()

        if re.match(r"(#[^\n]*\n)*@@ HEADER_START", self.data):
            m = re.search(r"@@ HEADER_END\r?\n", self.data, re.MULTILINE)
            if not m:
                print("Unable to locate end of header.")
            else:
                end = m.end()
                print("Read", end, "bytes of header.")
                self.scan_header(self.data[0:end])
                self.data = self.data[end:]

        print("Read", len(self.data), "bytes of playback.")
        self.cmd_reset([])

    def cmd_reset(self, args):
        """Reset the current position in the canned data and display the first
        chunk.

        Usage: reset
        """
        if args:
            print("Command takes no arguments")
            return

        self.start_position = 0
        self.end_position = 0
        self.show_next_chunk()

    def cmd_seek(self, args):
        """Seek to a given position in the canned data.

        Usage: seek <offset>

        If <offset> starts with a pound sign, as in 'seek #1', it will seek to
        the stop offset at the given 1-based index.  Use the 'stops' command to
        list out the stop offsets defined by the log file.

        If the resulting offset comes before the current position input will
        be replayed from the beginning.
        """
        if not args:
            print("Missing argument")
            return

        if not self.data:
            print("No data.")
            return

        if args[0][0] == "#":
            index = int(args[0][1:])
            if index < 1 or index > len(self.stops):
                print("No such stop.")
                return

            pos = self.stops[index - 1]["offset"]

        else:
            pos = int(args[0])

        if pos > len(self.data):
            print("Seek past end.")
            return

        if pos <= self.start_position:
            self.cmd_reset([])

        while self.end_position <= pos:
            self.broadcast_chunk()
            self.show_next_chunk()

    def cmd_step(self, args):
        """Step over a given number of escape sequences, or 1 if not specified.

        Usage: step [<count>]
        """
        if self.start_position >= len(self.data):
            print("Already at end of data.")
            return

        if args:
            count = int(args[0])
        else:
            count = 1

        while count:
            self.broadcast_chunk()
            self.show_next_chunk()

            if self.start_position >= len(self.data):
                return

            count -= 1


def get_parser():
    """Get a command line parser."""
    parser = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawTextHelpFormatter
    )
    return parser


def main(argv):
    """The main func!"""
    parser = get_parser()
    parser.parse_args(argv)

    try:
        readline.read_history_file(HISTFILE)
    except IOError:
        pass

    atexit.register(lambda: readline.write_history_file(HISTFILE))

    vtscope = VTScope()
    vtscope.run()


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
