[TOC]

# hterm Control Sequences

Like every terminal out there, hterm supports a number of standard (and perhaps
not so standard) control/escape sequences.  This doc outlines hterm's position
on everything -- things that are supported, things that will never be supported,
etc...

It's not meant to be a comprehensive guide to a terminal.  For that, please see
the [References](#References) section.

Parsing of these sequences are contained entirely in [hterm_vt.js], and the
character maps are defined in [hterm_vt_character_map.js].

For TBD entries, it means we haven't put in the work to implement the feature
yet, but we generally wouldn't be adverse to adding it.  Or we haven't quite
figured out how best to do so.  Or we just haven't thought about it at all to
say no :).

Similarly for entries marked as *passed thru* -- we might do something with
them in the future, but currently we just print it.

However, for entries marked "won't support", it means we don't consider them
relevant and will probably never be implemented.

If you come across missing features or have other requests, feel free to file
a bug at <https://hterm.org/x/newbug>.

## General Guidelines

We aim to be compliant with:

* [ECMA-35] (*Character Code Structure and Extension Techniques*): covers some
  fundamentals related to character sets, the notions of [C0], [C1], [G0],
  etc... (but not their contents), and how escape sequences work (but not what
  they mean).  This is equivalent to [ISO/IEC 2022].
* [ECMA-43] (*8-bit Coded Character Set Structure and Rules*): Builds on top of
  [ECMA-35] by defining the character sets (e.g. 0x40 == @).  This is equivalent
  to [ISO/IEC 4873].
* [ECMA-48] (*Control Functions for Coded Character Sets*): Builds on top of
  [ECMA-35] by defining many of the common escape sequences.  Supersedes the
  ANSI codes, and is equivalent to [ISO/IEC 6429].
* [ISO/IEC 8613-6] (*Character content architectures*): Builds on top of
  [ECMA-35] by defining fonts and graphic renditions (e.g. [SGR]).
  This is equivalent to [ITU T.416].

Going beyond those basics, we use these sites for guidance:

* [XTerm](http://invisible-island.net/xterm/ctlseqs/ctlseqs.html): Canonical
  terminal emulator in the X world.
* [VT100.net](http://vt100.net/): Spec sheets for VT100 and similar terminals.

## C0 Control Codes {#C0}

These are the basic characters in the 0x00 - 0x1F range.

While DEL (0x7F) isn't actually part of C0, we list it here for convenience.

| Seq | Dec | Hex | Name   | C   | Description                                   | Action |
|:---:|:---:|:---:|:------:|:---:|-----------------------------------------------|--------|
| ^@  |  00 |  00 | NUL    | \0  | Null                                          | Ignored |
| ^A  |  01 |  01 | SOH    |     | Start of Heading                              | *Passed thru* |
| ^B  |  02 |  02 | STX    |     | Start of Text                                 | *Passed thru* |
| ^C  |  03 |  03 | ETX    |     | End of Text                                   | *Passed thru* |
| ^D  |  04 |  04 | EOT    |     | End of Transmission                           | *Passed thru* |
| ^E  |  05 |  05 | ENQ    |     | Enquiry                                       | Ignored |
| ^F  |  06 |  06 | ACK    |     | Acknowledge                                   | *Passed thru* |
| ^G  |  07 |  07 | BEL    | \a  | Bell                                          | Supported |
| ^H  |  08 |  08 | BS     | \b  | Backspace                                     | Supported |
| ^I  |  09 |  09 | HT     | \t  | Character Tabulation (Horizontal Tabulation)  | Supported |
| ^J  |  10 |  0A | LF     | \n  | Line Feed                                     | Supported |
| ^K  |  11 |  0B | VT     | \v  | Line Tabulation (Vertical Tabulation)         | Converted to LF (\n) |
| ^L  |  12 |  0C | FF     | \f  | Form Feed                                     | Converted to LF (\n) |
| ^M  |  13 |  0D | CR     | \r  | Carriage Return                               | Supported |
| ^N  |  14 |  0E | SO/LS1 |     | Shift Out / Locking Shift One                 | Point [GL] to [G1] |
| ^O  |  15 |  0F | SI/LS0 |     | Shift In / Locking Shift Zero                 | Point [GL] to [G0] |
| ^P  |  16 |  10 | DLE    |     | Data Link Escape                              | *Passed thru* |
| ^Q  |  17 |  11 | DC1    |     | Device Control One (XON)                      | Ignored (TBD) |
| ^R  |  18 |  12 | DC2    |     | Device Control Two                            | *Passed thru* |
| ^S  |  19 |  13 | DC3    |     | Device Control Three (XOFF)                   | Ignored (TBD) |
| ^T  |  20 |  14 | DC4    |     | Device Control Four                           | *Passed thru* |
| ^U  |  21 |  15 | NAK    |     | Negative Acknowledge                          | *Passed thru* |
| ^V  |  22 |  16 | SYN    |     | Synchronous Idle                              | *Passed thru* |
| ^W  |  23 |  17 | ETB    |     | End of Transmission Block                     | *Passed thru* |
| ^X  |  24 |  18 | CAN    |     | Cancel                                        | Supported [**(1)**](#C0-footer) |
| ^Y  |  25 |  19 | EM     |     | End of medium                                 | *Passed thru* |
| ^Z  |  26 |  1A | SUB    |     | Substitute                                    | Converted to CAN |
| ^[  |  27 |  1B |[ESC]   | \e  | Escape                                        | Supported [**(2)**](#C0-footer) |
| ^\  |  28 |  1C | FS/IS4 |     | File Separator / Information Separator Four   | *Passed thru* |
| ^]  |  29 |  1D | GS/IS3 |     | Group Separator / Information Separator Three | *Passed thru* |
| ^^  |  30 |  1E | RS/IS2 |     | Record Separator / Information Separator Two  | *Passed thru* |
| ^_  |  31 |  1F | US/IS1 |     | Unit Separator / Information Separator One    | *Passed thru* |
| ^?  | 127 |  7F | DEL    |     | Delete                                        | Supported |

{#C0-footer}
1. Used to cancel escape sequences, and to change [GL] back to [G0].
2. [ESC] is a multiplexed command; see section below for more details.

## C1 Control Codes {#C1}

These are some extended characters in the 0x80 - 0x9F range.

Since these don't play well with UTF-8 encoding, they're typically accessed via
an escape sequence.  e.g. ESC+@ (0x1b 0x40) instead of 0x80.

| ESC | Dec | Hex | Name | Description                                 | Action |
|:---:|:---:|:---:|:----:|---------------------------------------------|--------|
|  @  | 128 |  80 | PAD  | Padding Character                           | *Ignored (TBD)* |
|  A  | 129 |  81 | HOP  | High Octet Preset                           | *Ignored (TBD)* |
|  B  | 130 |  82 | BPH  | Break Permitted Here                        | *Ignored (TBD)* |
|  C  | 131 |  83 | NBH  | No Break Here                               | *Ignored (TBD)* |
|  D  | 132 |  84 | IND  | Index                                       | Like newline, but keep column position |
|  E  | 133 |  85 | NEL  | Next Line                                   | Like newline, but doesn't add a line |
|  F  | 134 |  86 | SSA  | Start of Selected Area                      | Won't support |
|  G  | 135 |  87 | ESA  | End of Selected Area                        | *Ignored (TBD)* |
|  H  | 136 |  88 | HTS  | Character Tabulation Set                    | Sets horizontal tab stop at the column |
|  I  | 137 |  89 | HTJ  | Character Tabulation With Justification     | *Ignored (TBD)* |
|  J  | 138 |  8A | VTS  | Line Tabulation Set                         | *Ignored (TBD)* |
|  K  | 139 |  8B | PLD  | Partial Line Forward                        | *Ignored (TBD)* |
|  L  | 140 |  8C | PLU  | Partial Line Backward                       | *Ignored (TBD)* |
|  M  | 141 |  8D | RI   | Reverse Line Feed                           | Move up one line keeping column position |
|  N  | 142 |  8E | SS2  | Single-Shift Two                            | Ignored |
|  O  | 143 |  8F | SS3  | Single-Shift Three                          | Ignored |
|  P  | 144 |  90 |[DCS] | Device Control String                       | *Ignored (TBD)* [**(1)**](#C1-footer) |
|  Q  | 145 |  91 | PU1  | Private Use One                             | *Ignored (TBD)* |
|  R  | 146 |  92 | PU2  | Private Use Two                             | *Ignored (TBD)* |
|  S  | 147 |  93 | STS  | Set Transmit State                          | *Ignored (TBD)* |
|  T  | 148 |  94 | CCH  | Cancel character                            | *Ignored (TBD)* |
|  U  | 149 |  95 | MW   | Message Waiting                             | *Ignored (TBD)* |
|  V  | 150 |  96 | SPA  | Start of Guarded Area                       | Won't support |
|  W  | 151 |  97 | EPA  | End of Guarded Area                         | Won't support |
|  X  | 152 |  98 | SOS  | Start of String                             | Won't support |
|  Y  | 153 |  99 | SGCI | Single Graphic Character Introducer         | *Ignored (TBD)* |
|  Z  | 154 |  9A | SCI  | Single Character Introducer                 | Sends [?1;2c |
|  [  | 155 |  9B |[CSI] | Control Sequence Introducer                 | Supported [**(2)**](#C1-footer) |
|  \  | 156 |  9C | ST   | String Terminator                           | Used to terminate escape sequences |
|  ]  | 157 |  9D |[OSC] | Operating System Command                    | Supported [**(3)**](#C1-footer) |
|  ^  | 158 |  9E | PM   | Privacy Message                             | Won't support |
|  _  | 159 |  9F | APC  | Application Program Command                 | Won't support |

{#C1-footer}
1. [DCS] is a multiplexed command; see section below for more details.
2. [CSI] is a multiplexed command; see section below for more details.
3. [OSC] is a multiplexed command; see section below for more details.

## G0/G1/G2/G3 Graphic Codesets for GL/GR (SCS) {#SCS}

***note
Support for character maps may be disabled at runtime via [DOCS].
***

With the rise of UTF-8 encoding, graphic codesets have fallen out of favor.
Although we still support a limited number for legacy systems.

Basically, instead of seeing things like "w" or "#", you'll see "&#x252c;" or
"&#xa3;".  These were used to get basic graphics (like border lines), or to
support other 7-bit character sets (like German characters ß and ü).

The terminal has 4 graphic codeset slots (named G0, G1, G2, and G3), and 2
pointers (GL and GR) to those slots.  The active display then uses those
pointers to determine what is shown.  Both the slots and pointers can be
updated at any time.

The GR pointer, while tracked, does not actually get processed.  When running
in a UTF8 environment, it's easy to corrupt codeunits in a codepoint leading
to bad output.

We don't currently differentiate between 94-character sets and 96-character
sets.  Although all of the maps we support are within the 94-char range.

As for the character sets that you can actually load, we support some hard
character sets, but not all of them.  We do not support soft character sets.

Here's the list of national replacement character sets (NRCS) we support:

|  ID | Description |
|:---:|-------------|
|  0  | [Graphics](http://vt100.net/docs/vt220-rm/table2-4.html) |
|  4  | [Dutch](http://vt100.net/docs/vt220-rm/table2-6.html) |
|  5  | [Finnish](http://vt100.net/docs/vt220-rm/table2-7.html) |
|  6  | [Norwegian/Danish](http://vt100.net/docs/vt220-rm/table2-12.html) |
|  7  | [Swedish](http://vt100.net/docs/vt220-rm/table2-14.html) |
|  =  | [Swiss](http://vt100.net/docs/vt220-rm/table2-15.html) |
|  A  | [British](http://vt100.net/docs/vt220-rm/table2-5.html) |
|  B  | [United States (ASCII)](http://vt100.net/docs/vt220-rm/table2-1.html) |
|  C  | Finnish (same as "5" above) |
|  E  | Norwegian/Danish (same as "6" above) |
|  H  | Swedish (same as "7" above) |
|  K  | [German](http://vt100.net/docs/vt220-rm/table2-10.html) |
|  Q  | [French Canadian](http://vt100.net/docs/vt220-rm/table2-9.html) |
|  R  | [French](http://vt100.net/docs/vt220-rm/table2-8.html) |
|  Y  | [Italian](http://vt100.net/docs/vt220-rm/table2-11.html) |
|  Z  | [Spanish](http://vt100.net/docs/vt220-rm/table2-13.html) |

## Designate Other Coding System (DOCS) {#DOCS}

[ECMA-35] supports changing the encoding system of terminal.  Since hterm is
natively UTF-8, we use this to control support for character maps (see [SCS]
for more details).

This escape sequence has a one or two byte form.  If the first byte is `/`,
then it is a one way transition.  i.e. Any further attempts to change the
encoding will simply be ignored.  This is useful for putting the terminal into
UTF-8 mode permanently and not worrying about binary data switching character
maps to graphics mode.

To invoke these, use ESC+%+DOCS.  e.g. ESC+%/G (0x1b 0x25 0x2f 0x47).

Any sequence not documented below is simply ignored.  The only two byte sequence
supported currently is where the first byte is `/`.

| DOCS | Description                                  | Character Maps ([SCS]) |
|:----:|----------------------------------------------|------------------------|
|    @ | Switch to ECMA-35 encoding (default)         | Supported              |
|    G | Switch to UTF-8 encoding                     | Supported              |
|   /G | Permanently switch to UTF-8 encoding Level 1 | Treated as `/I`        |
|   /H | Permanently switch to UTF-8 encoding Level 2 | Treated as `/I`        |
|   /I | Permanently switch to UTF-8 encoding Level 3 | Supported              |

## Escape Sequences {#ESC}

These are other escape sequences we support.  This is similar to the C1 Control
Codes space, but there is only a two byte sequence.  e.g. ESC+# (0x1b 0x23).

Some of these may have subcommands, so it might end up being a three byte
sequence where the 3rd byte is further interpreted.  We refer to that as `arg1`
in the Action column below.

| ESC | Name     | Description                                 | Action |
|:---:|:--------:|---------------------------------------------|--------|
|  ␠  | SP       |                                             | Ignored (TBD) |
|  !  |          |                                             | *Ignored (TBD)* |
|  "  |          |                                             | *Ignored (TBD)* |
|  #  |[DEC]     |                                             | Semi-supported |
|  $  |          |                                             | *Ignored (TBD)* |
|  %  |[DOCS]    | Designate Other Coding System               | Supported |
|  &  |          |                                             | *Ignored (TBD)* |
|  '  |          |                                             | *Ignored (TBD)* |
|  (  |[SCS]     | Set G0 character set (VT100)                | Set [G0] to NRCS `arg1` |
|  )  |[SCS]     | Set G1 character set (VT220)                | Set [G1] to NRCS `arg1` |
|  *  |[SCS]     | Set G2 character set (VT220)                | Set [G2] to NRCS `arg1` |
|  +  |[SCS]     | Set G3 character set (VT220)                | Set [G3] to NRCS `arg1` |
|  ,  |          |                                             | *Ignored (TBD)* |
|  -  |[SCS]     | Set G1 character set (VT300)                | Set [G1] to NRCS `arg1` |
|  .  |[SCS]     | Set G2 character set (VT300)                | Set [G2] to NRCS `arg1` |
|  /  |[SCS]     | Set G3 character set (VT300)                | Set [G3] to NRCS `arg1` |
|  0  |          |                                             | *Ignored (TBD)* |
|  1  |          |                                             | *Ignored (TBD)* |
|  2  |          |                                             | *Ignored (TBD)* |
|  3  |          |                                             | *Ignored (TBD)* |
|  4  |          |                                             | *Ignored (TBD)* |
|  5  |          |                                             | *Ignored (TBD)* |
|  6  | DECBI    | Back Index                                  | *Ignored (TBD)* |
|  7  | DECSC    | Save Cursor                                 | Supported |
|  8  | DECRC    | Restore Cursor                              | Supported |
|  9  | DECFI    | Forward Index                               | *Ignored (TBD)* |
|  :  |          |                                             | *Ignored (TBD)* |
|  ;  |          |                                             | *Ignored (TBD)* |
|  <  |          |                                             | *Ignored (TBD)* |
|  =  | DECKPAM  | Keypad Application Mode                     | Supported |
|  >  | DECKPNM  | Keypad Numeric Mode                         | Supported |
|  ?  |          |                                             | *Ignored (TBD)* |
|  @  || [See C1 Control Codes](#C1) ||
|  A  || [See C1 Control Codes](#C1) ||
|  B  || [See C1 Control Codes](#C1) ||
|  C  || [See C1 Control Codes](#C1) ||
|  D  || [See C1 Control Codes](#C1) ||
|  E  || [See C1 Control Codes](#C1) ||
|  F  || [See C1 Control Codes](#C1) ||
|  G  || [See C1 Control Codes](#C1) ||
|  H  || [See C1 Control Codes](#C1) ||
|  I  || [See C1 Control Codes](#C1) ||
|  J  || [See C1 Control Codes](#C1) ||
|  K  || [See C1 Control Codes](#C1) ||
|  L  || [See C1 Control Codes](#C1) ||
|  M  || [See C1 Control Codes](#C1) ||
|  N  || [See C1 Control Codes](#C1) ||
|  O  || [See C1 Control Codes](#C1) ||
|  P  || [See C1 Control Codes](#C1) ||
|  Q  || [See C1 Control Codes](#C1) ||
|  R  || [See C1 Control Codes](#C1) ||
|  S  || [See C1 Control Codes](#C1) ||
|  T  || [See C1 Control Codes](#C1) ||
|  U  || [See C1 Control Codes](#C1) ||
|  V  || [See C1 Control Codes](#C1) ||
|  W  || [See C1 Control Codes](#C1) ||
|  X  || [See C1 Control Codes](#C1) ||
|  Y  || [See C1 Control Codes](#C1) ||
|  Z  || [See C1 Control Codes](#C1) ||
|  [  || [See C1 Control Codes](#C1) ||
|  \  || [See C1 Control Codes](#C1) ||
|  ]  || [See C1 Control Codes](#C1) ||
|  ^  || [See C1 Control Codes](#C1) ||
|  _  || [See C1 Control Codes](#C1) ||
|  `  | DMI      | Disable Manual Input                        | *Ignored (TBD)* |
|  a  | INT      | Interrupt                                   | *Ignored (TBD)* |
|  b  | EMI      | Enable Manual Input                         | *Ignored (TBD)* |
|  c  | RIS      | Reset to Initial State                      | Resets terminal state |
|  d  | CMD      | Coding Method Delimiter                     | *Ignored (TBD)* |
|  e  |          |                                             | *Ignored (TBD)* |
|  f  |          |                                             | *Ignored (TBD)* |
|  g  |          |                                             | *Ignored (TBD)* |
|  h  |          |                                             | *Ignored (TBD)* |
|  i  |          |                                             | *Ignored (TBD)* |
|  j  |          |                                             | *Ignored (TBD)* |
|  k  |          | Set tmux window name                        | Supported [**(1)**](#ESC-footer) |
|  l  |          | Memory lock/unlock                          | Won't support |
|  m  |          | Memory lock/unlock                          | Won't support |
|  n  | LS2      | Locking Shift Two                           | Point [GL] to [G2] |
|  o  | LS3      | Locking Shift Three                         | Point [GL] to [G3] |
|  p  |          |                                             | *Ignored (TBD)* |
|  q  |          |                                             | *Ignored (TBD)* |
|  r  |          |                                             | *Ignored (TBD)* |
|  s  |          |                                             | *Ignored (TBD)* |
|  t  |          |                                             | *Ignored (TBD)* |
|  u  |          |                                             | *Ignored (TBD)* |
|  v  |          |                                             | *Ignored (TBD)* |
|  w  |          |                                             | *Ignored (TBD)* |
|  x  |          |                                             | *Ignored (TBD)* |
|  y  |          |                                             | *Ignored (TBD)* |
|  z  |          |                                             | *Ignored (TBD)* |
|  {  |          |                                             | *Ignored (TBD)* |
|&#124;|LS3R     | Locking Shift Three Right                   | *Ignored* (Point [GR] to [G3]) |
|  }  | LS2R     | Locking Shift Two Right                     | *Ignored* (Point [GR] to [G2]) |
|  ~  | LS1R     | Locking Shift One Right                     | *Ignored* (Point [GR] to [G1]) |

{#ESC-footer}
1. This is different from window title. See the [tmux
   manual](https://man7.org/linux/man-pages/man1/tmux.1.html#NAMES_AND_TITLES).
   It does nothing by default.

### ESC+&#35; (DEC) {#DEC}

A few random escape sequences.  They are initiated with ESC+#.

| Num | Name   | Description                                    | Action  |
|:---:|:------:|------------------------------------------------|---------|
|   3 | DECDHL | Double-Width, Double-Height Line (Top Half)    | Ignored |
|   4 | DECDHL | Double-Width, Double-Height Line (Bottom Half) | Ignored |
|   5 | DECSWL | Single-Width, Single-Height Line               | Ignored |
|   6 | DECDWL | Double-Width, Single-Height Line               | Ignored |
|   8 | DECALN | Screen Alignment Pattern                       | Fill terminal with E's |

## Device Control String (DCS) {#DCS}

Device Control String is not currently supported which means none of its
subcommands work either (like ReGIS or Sixel).

## Operating System Command (OSC) {#OSC}

This is a grab bag of various escape sequences.  They are initiated with
ESC+].  Arguments to the sequences are typically delimited by `;`, and
terminated with BEL.  e.g. ESC+] 0 ; title BEL (0x1b 0x5d 0x30 0x3b ... 0x07).

For example:

| OSC  | Description                        | Status                  | Format |
|:----:|------------------------------------|-------------------------|--------|
|    0 | Set window title & icon name       | Only window title       | ESC ] 0 ; [title] \a |
|    1 | Change icon name                   | Ignored                 | ESC ] 1 ; [icon] \a |
|    2 | Set window title                   | Converted to 0          | ESC ] 2 ; [title] \a |
|    3 | Set X property                     | Ignored                 | |
|    4 | Set/read color palette             | Supported               | ESC ] 4 ; index1;rgb1;...;indexN;rgbN \a |
|    5 | Change special color number        | Ignored                 | |
|    6 | Enable special color number        | Ignored                 | |
|    6 | Set current file path              | Ignored                 | |
|    7 | Set current directory              | Ignored                 | ESC ] 7 ; directory \a |
|    8 | Set hyperlink                      | Supported               | ESC ] 8 ; id=foo ; uri \a text ESC ] 8 ;; \a |
|    9 | iTerm2 Growl notifications         | Supported               | ESC ] 9 ; [message] \a |
|   10 | Set foreground color               | Supported               | ESC ] 10 ; [X11 color spec] \a |
|   11 | Set background color               | Supported               | ESC ] 11 ; [X11 color spec] \a |
|   12 | Set text cursor color              | Supported               | ESC ] 12 ; [X11 color spec] \a |
|   13 | Set mouse foreground color         | Ignored                 | ESC ] 13 ; [X11 color spec] \a |
|   14 | Set mouse background color         | Ignored                 | ESC ] 14 ; [X11 color spec] \a |
|   15 | Set Tektronix foreground color     | Ignored                 | ESC ] 15 ; [X11 color spec] \a |
|   16 | Set Tektronix background color     | Ignored                 | ESC ] 16 ; [X11 color spec] \a |
|   17 | Set highlight background color     | Ignored                 | ESC ] 17 ; [X11 color spec] \a |
|   18 | Set Tektronix cursor color         | Ignored                 | ESC ] 18 ; [X11 color spec] \a |
|   19 | Set highlight foreground color     | Ignored                 | ESC ] 19 ; [X11 color spec] \a |
|   46 | Set logfile path                   | Ignored                 | ESC ] 46 ; path \a |
|   50 | Change font number/name            | Ignored                 | ESC ] 50 ; [number | name] \a |
|   50 | Set the cursor shape               | Supported               | ESC ] 50 ; CursorShape=[0&#124;1&#124;2] \a |
|   51 | Reserved for Emacs                 | Ignored                 | |
|   52 | Clipboard operations               | Only "c" supported      | ESC ] 52 ; c ; [base64 data] \a |
|  104 | Reset color number                 | Supported               | ESC ] 104 ; index1;...;indexN \a |
|  105 | Reset special color number         | Ignored                 | |
|  106 | Enable special color number        | Ignored                 | |
|  110 | Reset foreground color             | Supported               | ESC ] 110 ; \a |
|  111 | Reset background color             | Supported               | ESC ] 111 ; \a |
|  112 | Reset text cursor color            | Supported               | ESC ] 112 ; \a |
|  113 | Reset mouse foreground color       | Ignored                 | ESC ] 113 ; \a |
|  114 | Reset mouse background color       | Ignored                 | ESC ] 114 ; \a |
|  115 | Reset Tektronix foreground color   | Ignored                 | ESC ] 115 ; \a |
|  116 | Reset Tektronix background color   | Ignored                 | ESC ] 116 ; \a |
|  117 | Reset highlight background color   | Ignored                 | ESC ] 117 ; \a |
|  118 | Reset Tektronix cursor color       | Ignored                 | ESC ] 118 ; \a |
|  119 | Reset highlight foreground color   | Ignored                 | ESC ] 119 ; \a |
|  777 | rxvt-unicode (urxvt) modules       | Only "notify" supported | ESC ] 777 ; notify ; [title] ; [body] \a |
|[1337]| iTerm2 sequences                   | Only "File" supported   | ESC ] 1337 ; File = [args] : [base64 data] \a |

### OSC+1337: iTerm2 sequences {#OSC-1337}

The [iTerm2](https://www.iterm2.com/) terminal for macOS provides a lot of
proprietary options via the OSC 1337 command.  Many of them duplicate other
standard sequences, so most of them aren't supported.

We support media display and file transfers.  This is specified via the `File=`
keyword.  None of the options below are required as a reasonable default will
be selected automatically.

***note
There is a [helper script](../etc/hterm-show-file.sh) you can use to handle
the protocol for you.
***

***note
**Warning:** You should avoid transferring larger files as Chrome performance
will suffer.  If it's under 2 MB, it probably will be fine, but YMMV.
***

The overall form looks like ESC+] 1337 ; File=name=[base64];inline=1 :
[base64 data] BEL.

* `name`: The base64 encoded name of the file or other human readable text.
* `size`: How many bytes in the base64 data (for transfer progress).
* `width`: The display width specification (see below).  Defaults to `auto`.
* `height`: The display height specification (see below).  Defaults to `auto`.
* `preserveAspectRatio`: If `0`, scale/stretch the display to fit the space.
  If `1` (the default), fill the display as much as possible without stretching.
* `inline`: If `0` (the default), download the file instead of displaying it.
  If `1`, display the file in the terminal.
* `align`: Set the display alignment with `left` (the default), `right`, or
  `center`.
* `type`: Set the [MIME type] of the content.  Auto-detected otherwise.

For the base64 encoded fields, make sure to omit whitespace (e.g. newlines) if
using a tool like `base64`.

For the `width` & `height` fields, a number of forms are accepted.  Note that
the terminal will probably restrict the maximum size automatically to the active
terminal dimensions.  e.g. If the terminal is 1000 pixels wide, specifying a
width greater than that will automatically be limited to 1000 pixels.

* `N`: How many cells (e.g. rows or columns) to fill.
* `Npx`: How many pixels to fill.
* `N%`: A percentage of the overall terminal screen.
* `auto`: Use the file's dimension.

For inline display, currently only images in formats Chrome itself understands
are supported.

## Control Sequence Introducer (CSI) {#CSI}

These are various color and cursor related escape sequences.  Also referred to
as ANSI escape sequences.  They are initiated with ESC+[.  Arguments to the
sequences are typically delimited by `;` and precede the command.  e.g. ESC+[
arg1 ; arg2 ; argN m.

The final command is a single character in the range 0x40 (`@`) through 0x7F
(`~`).  That's a limited space, so the command can be further refined with
characters immediately following the ESC+[ bytes.  Those may be in the range
0x20 (`␠`) through 0x3F (`?`), excluding the range 0x30 (`0`) through 0x39
(`9`) and 0x3A (`:`) and 0x3B (`;`).
e.g. The CSI command ?$p command below takes the form ESC+[ ? $ arg1 ; arg2 ;
argN p.

| CSI | Name     | Description                                 | Action |
|:---:|:--------:|---------------------------------------------|--------|
|   @ | ICH      | Insert Blank Characters                     | Add space |
|   A | CUU      | Cursor Up                                   | Move cursor up `arg1` rows |
|   B | CUD      | Cursor Down                                 | Move cursor down `arg1` rows |
|   C | CUF      | Cursor Forward                              | Move cursor forward `arg1` columns |
|   D | CUB      | Cursor Backward                             | Move cursor back `arg1` columns |
|   E | CNL      | Cursor Next Line                            | Move cursor down `arg1` rows and to first column |
|   F | CPL      | Cursor Preceding Line                       | Move cursor up `arg1` rows and to first column |
|   G | CHA      | Cursor Horizontal Absolute                  | Move cursor to `arg1` column |
|   H | CUP      | Cursor Position                             | Move cursor to `arg1` row and `arg2` column |
|   I | CHT      | Cursor Forward Tabulation                   | Move cursor forward `arg1` tabs |
|   J | ED       | Erase in Display                            | `!arg1` or `arg1 == 0`: Clear cursor to end of display<br> `arg1 == 1`: Clear start of display to cursor<br> `arg1 == 2`: Clear display<br> `arg1 == 3`: Clear scrollback |
|  ?J | DECSED   | Selective Erase in Display                  | Same as ED above |
|   K | EL       | Erase in Line                               | `!arg1` or `arg1 == 0`: Clear cursor to end of line<br> `arg1 == 1`: Clear start of line to cursor<br> `arg1 == 2`: Clear line |
|  ?K | DECSEL   | Selective Erase in Line                     | Same as EL above |
|   L | IL       | Insert Lines                                | Insert `arg1` lines |
|   M | DL       | Delete Lines                                | Delete `arg1` lines |
|   N | EF       | Erase in Field                              | *Ignored (TBD)* |
|   O | EA       | Erase in Area                               | *Ignored (TBD)* |
|   P | DCH      | Delete Characters                           | Delete `arg1` characters before cursor |
|   Q | SEE      | Select Editing Extent                       | *Ignored (TBD)* |
|   R | CPR      | Active Position Report                      | *Ignored (TBD)* |
|   S | SU       | Scroll Up                                   | Scroll up `arg1` lines |
|   T | SD       | Scroll Down                                 | Scroll down `arg1` lines |
|  >T |          |                                             | Won't support |
|   U | NP       | Next Page                                   | *Ignored (TBD)* |
|   V | PP       | Previous Page                               | *Ignored (TBD)* |
|   W | CTC      | Cursor Tabulation Control                   | *Ignored (TBD)* |
|   X | ECH      | Erase Characters                            | Delete `arg1` characters after cursor |
|   Y | CVT      | Cursor Line Tabulation                      | *Ignored (TBD)* |
|   Z | CBT      | Cursor Backward Tabulation                  | Move cursor back `arg1` tabs |
|   [ | SRS      | Start Reversed String                       | *Ignored (TBD)* |
|   \ | PTX      | Parallel Texts                              | *Ignored (TBD)*; See [Ruby character](https://en.wikipedia.org/wiki/Ruby_character#Unicode) |
|   ] | SDS      | Start Directed String                       | *Ignored (TBD)* |
|   ^ | SIMD     | Select Implicit Movement Direction          | *Ignored (TBD)* |
|   _ |          |                                             | *Ignored (TBD)* |
|   ` | HPA      | Character Position Absolute                 | Same as CHA above |
|   a | HPR      | Character Position Relative                 | Move cursor forward `arg1` columns |
|   b | REP      | Repeat                                      | *Ignored (TBD)* |
|   c | DA/DA1   | Send Primary Device Attributes              | Currently reports "VT100 with Advanced Video Option" |
|  >c | DA2      | Send Secondary Device Attributes            | Currently reports "VT100" |
|   d | VPA      | Line Position Absolute                      | Move cursor to `arg1` row |
|   e | VPR      | Line Position Forward                       | *Ignored (TBD)* |
|   f | HVP      | Horizontal and Vertical Position            | Same as CUP above |
|   g | TBC      | Tab Clear                                   | `!arg1` or `arg1 == 0`: Clear tab stop at cursor<br> `arg1 == 3`: Clear all tab stops |
|   h |[SM]      | Set Mode                                    | Supported [**(1)**](#CSI-footer) |
|  ?h |[DECSET]  | DEC Set Mode                                | Supported [**(2)**](#CSI-footer) |
|   i | MC       | Media Copy                                  | Won't support |
|  ?i | DECMC    | DEC Media Copy                              | Won't support |
|   j | HPB      | Character Position Backward                 | *Ignored (TBD)* |
|   k | VPB      | Line Position Backward                      | *Ignored (TBD)* |
|   l |[RM]      | Reset Mode                                  | Supported [**(1)**](#CSI-footer) |
|  ?l |[DECRST]  | DEC Mode Reset                              | Supported [**(2)**](#CSI-footer) |
|   m |[SGR]     | Select Graphic Rendition                    | Supported [**(3)**](#CSI-footer) |
|  >m |          | xterm specific keyboard modes               | Won't support |
|   n | DSR      | Device Status Reports                       | Supported |
|  ?n | DECDSR   | DEC Device Status Reports                   | Supported |
|  >n |          | xterm specific modifiers                    | Won't support |
|   o | DAQ      | Define Area Qualification                   | *Ignored (TBD)* |
|   p |          |                                             | *Ignored (TBD)* |
|  >p |          | xterm specific cursor display control       | *Ignored (TBD)* |
|  !p | DECSTR   | Soft Terminal Reset                         | Supported |
|  $p | DECRQM   | Request Mode - Host To Terminal             | *Ignored (TBD)* |
| ?$p | DECRQM   | Request Mode - Host To Terminal             | *Ignored (TBD)* |
|  "p | DECSCL   | Select Conformance Level                    | *Ignored (TBD)* |
|   q | DECLL    | Load LEDs                                   | *Ignored (TBD)* |
|  ␠q | DECSCUSR | Set Cursor Style                            | Supported |
|  "q | DECSCA   | Select Character Protection Attribute       | Won't support |
|   r | DECSTBM  | Set Top and Bottom Margins                  | Supported |
|  ?r |          | Restore DEC Private Mode Values             | Won't support |
|  $r | DECCARA  | Change Attributes in Rectangular Area       | Won't support |
|   s |          | Save cursor (ANSI.SYS)                      | Supported |
|  ?s |          | Save DEC Private Mode Values                | Won't support |
|   t |          | Window manipulation                         | Partial support |
|  $t | DECRARA  | Reverse Attributes in Rectangular Area      | Won't support |
|  >t |          | Set one or more features of the title modes | Won't support |
|  ␠t | DECSWBV  | Set Warning Bell Volume                     | Won't support |
|   u |          | Restore cursor (ANSI.SYS)                   | Supported |
|  ␠u | DECSMBV  | Set Margin Bell Volume                      | Won't support |
|   v |          |                                             | *Ignored (TBD)* |
|  $v | DECCRA   | Copy Rectangular Area                       | Won't support |
|   w |          |                                             | *Ignored (TBD)* |
|  'w | DECEFR   | Enable Filter Rectangle                     | Won't support |
|   x | DECREQTPARM | Request Terminal Parameters              | *Ignored (TBD)* |
|  *x | DECSACE  | Select Attribute Change Extent              | Won't support |
|  $x | DECFRA   | Fill Rectangular Area                       | Won't support |
|   y |          |                                             | *Ignored (TBD)* |
|   z |[vt_tiledata]| Tile data                                | Semi-Supported |
|  'z | DECELR   | Enable Locator Reporting                    | *Ignored (TBD)* |
|  $z | DECERA   | Erase Rectangular Area                      | Won't support |
|   { |          |                                             | *Ignored (TBD)* |
|  '{ | DECSLE   | Select Locator Events                       | *Ignored (TBD)* |
|   &#124; |     |                                             | *Ignored (TBD)* |
|  '&#124; | DECRQLP | Request Locator Position                | *Ignored (TBD)* |
|   } |          |                                             | *Ignored (TBD)* |
|  '} | DECIC    | Insert Column                               | Won't support |
|   ~ |          |                                             | *Ignored (TBD)* |
|  '~ | DECDC    | Delete Column                               | Won't support |

[vt_tiledata]: https://nethackwiki.com/wiki/Vt_tiledata

{#CSI-footer}
1. [SM]/[RM] are multiplexed commands; see section below for more details.
2. [DECSET]/[DECRST] are multiplexed commands; see section below for more details.
3. [SGR] is a multiplexed command; see section below for more details.

## Modes (SM) / (RM) {#SM}

Ignoring the use of the generic word "mode", the Set Mode and Reset Mode
commands are used to control different operating modes.  Historically these
made sense with a wide range of hardware devices that used different binary
protocols, but nowadays we can ignore most as dead code.  That is why hterm
doesn't support most of these.

For [SM], the specified mode is enabled.  For [RM], it's disabled (reset).

| Mode | Name | Description                        | Action |
|:----:|:----:|------------------------------------|--------|
|   1  | GATM | Guarded Area Transfer Mode         | Won't support |
|   2  | KAM  | Keyboard Action Mode               | Won't support |
|   3  | CRM  | Control Representation Mode        | Ignored |
|   4  | IRM  | Insertion Replacement Mode         | Supported |
|   5  | SRTM | Status Report Transfer Mode        | Ignored |
|   6  | ERM  | ERasure mode                       | Ignored |
|   7  | VEM  | Line Editing Mode                  | Ignored |
|   8  | BDSM | Bi-Directional Support Mode        | Ignored |
|   9  | DCSM | Device Component Select Mode       | Ignored |
|  10  | HEM  | Character Editing Mode             | Ignored |
|  11  | PUM  | Positioning Unit Mode              | Ignored |
|  12  | SRM  | Send/Receive Mode                  | Won't support |
|  13  | FEAM | Format Effector Action Mode        | Ignored |
|  14  | FETM | Format Effector Transfer Mode      | Ignored |
|  15  | MATM | Multiple Area Transfer Mode        | Ignored |
|  16  | TTM  | Transfer Termination Mode          | Ignored |
|  17  | SATM | Selected Area Transfer Mode        | Ignored |
|  18  | TSM  | Tabulation Stop Mode               | Ignored |
|  19  |      | Reserved                           | Ignored |
|  20  | LNM  | Automatic Newline                  | Supported |
|  21  | GRCM | Graphic Rendition Combination Mode | Ignored |
|  22  | ZDM  | Zero Default Mode                  | Ignored |

## Private Modes (DECSET) / (DECRST) {#DECSET}

Similar to the [SM] & [RM] commands, these are extensions that DEC added to
their VT's.  Then other people started adding their own.  There are many, and
we support some of them.

| Mode | Name    | Source | Description                                 | Status |
|:----:|:-------:|--------|---------------------------------------------|--------|
|    1 | DECCKM  | DEC    | Application Cursor Keys                     | Supported |
|    2 | DECANM  | DEC    | Designate USASCII for character sets G0-G3, and set VT100 mode | *Ignored (TBD)* |
|    3 | DECCOLM | DEC    | 132 Column Mode                             | Supported |
|    4 | DECSCLM | DEC    | Smooth (Slow) Scroll                        | Won't support |
|    5 | DECSCNM | DEC    | Reverse Video                               | Supported |
|    6 | DECOM   | DEC    | Origin Mode                                 | Supported |
|    7 | DECAWM  | DEC    | Wraparound Mode                             | Supported |
|    8 | DECARM  | DEC    | Auto-repeat Keys                            | Won't support |
|    9 | X10 MOUSE | X    | Send Mouse X & Y on button press            | Supported |
|   10 |         | rxvt   | Show toolbar                                | Won't support |
|   12 |         | att610 | Start blinking cursor                       | Supported |
|   18 | DECPFF  | DEC    | Print form feed                             | *Ignored (TBD)* |
|   19 | DECPEX  | DEC    | Set print extent to full screen             | Won't support |
|   25 | DECTCEM | DEC    | Show Cursor                                 | Supported |
|   30 |         | rxvt   | Show scrollbar                              | Supported |
|   35 |         | rxvt   | Enable font-shifting functions              | Won't support |
|   38 | DECTEK  | DEC    | Enter Tektronix Mode                        | Won't support |
|   40 |         |        | Allow 80 - 132 (DECCOLM) Mode               | Supported |
|   41 |         | curses | more(1) fix                                 | *Ignored (TBD)* |
|   42 | DECNRCM | DEC    | Enable Nation Replacement Character sets    | *Ignored (TBD)* |
|   44 |         |        | Turn On Margin Bell                         | *Ignored (TBD)* |
|   45 |         |        | Reverse-wraparound Mode                     | Supported |
|   46 |         |        | Start Logging                               | *Ignored (TBD)* |
|   47 |         |        | Use Alternate Screen Buffer                 | Supported |
|   66 | DECNKM  | DEC    | Application keypad                          | *Ignored (TBD)* |
|   67 | DECBKM  | DEC    | Backarrow key sends backspace               | Supported |
| 1000 | MOUSE_REPORT_CLICK | X | Send Mouse X & Y on button press and release | Supported |
| 1001 |         |        | Use Hilite Mouse Tracking                   | *Ignored (TBD)* |
| 1002 | MOUSE_REPORT_DRAG | | Use Cell Motion Mouse Tracking           | Supported |
| 1003 |         |        | Use All Motion Mouse Tracking               | *Ignored (TBD)* |
| 1004 |         |        | Send FocusIn/FocusOut events                | Supported |
| 1005 |         |        | Enable Extended Mouse Mode (UTF-8)          | Supported |
| 1006 |         |        | Enable Extended Mouse Mode (SGR)            | Supported |
| 1007 |         | xterm  | Enable Alternate Scroll Mode                | Supported |
| 1010 |         | rxvt   | Scroll to bottom on tty output              | Supported |
| 1011 |         | rxvt   | Scroll to bottom on key press               | Supported |
| 1015 |         | rxvt   | Enable Extended Mouse Mode (urxvt)          | Won't support |
| 1034 |         |        | Interpret "meta" key, sets eighth bit       | Won't support |
| 1035 |         |        | Enable special modifiers for Alt and NumLock keys | Won't support |
| 1036 |         |        | Send ESC when Meta modifies a key           | Supported |
| 1037 |         |        | Send DEL from the editing-keypad Delete key | *Ignored (TBD)* |
| 1039 |         |        | Send ESC when Alt modifies a key            | Supported |
| 1040 |         |        | Keep selection even if not highlighted      | Won't support |
| 1041 |         |        | Use the CLIPBOARD selection                 | Won't support |
| 1042 |         |        | Enable Urgency window manager hint when Ctrl+G is received | *Ignored (TBD)* |
| 1043 |         |        | Enable raising of the window when Ctrl+G is received | *Ignored (TBD)* |
| 1047 |         |        | Use Alternate Screen Buffer                 | Supported |
| 1048 |         |        | Save cursor as in DECSC                     | Supported |
| 1049 |         |        | Combine 1047 and 1048 modes and clear       | Supported |
| 1050 |         |        | Set terminfo/termcap function-key mode      | *Ignored (TBD)* |
| 1051 |         |        | Set Sun function-key mode                   | Won't support |
| 1052 |         |        | Set HP function-key mode                    | Won't support |
| 1053 |         |        | Set SCO function-key mode                   | Won't support |
| 1060 |         |        | Set legacy keyboard emulation (X11R6)       | Won't support |
| 1061 |         |        | Set VT220 keyboard emulation                | *Ignored (TBD)* |
| 2004 |         |        | Set bracketed paste mode                    | Supported |

### Mouse Reporting / Tracking

These are the sequences that the terminal generates based on mouse events the
user themselves create.
The terminal sends them to the remote so the application can handle mouse
inputs.
These could be things as simple as clicking different mouse buttons in different
terminal rows/cols, or more complicated things like click & drag, or wheel
scrolling.

There are a few different mouse reporting modes in the wild.
Here we document all the modes that hterm currently supports.
It's unlikely we'll support more modes unless they offer significant
functionality over the existing modes.

Some of the modes seem to overlap, but they can largely be broken down into
two different aspects: what is reported (presses/drags/etc...) and how is the
message encoded.
The terminal first calculates the values to report (via the reporting mode),
then the values are encoded before being sent to the remote.

By default, no mouse reporting is enabled, so all mouse events are handled
by the native implementation (e.g. for copying content or clicking links).
If mouse reporting is enabled, it by default uses the X10 encoding.

If you want to enable mouse reporting, you should always use the SGR encoding.
For reporting modes, most people want to start with the xterm extensions (so
they get mouse press & release events, wheel scrolls, and keyboard modifiers).

#### Reporting Modes

Only mouse buttons 1 (primary aka left), 2 (secondary aka right), 3 (middle), 4
(wheel up), and 5 (wheel down) can be reported.
All other buttons are ignored.

##### X10

This is the simplest and oldest mode: only mouse button presses are reported;
no releases, and no motion/drags.
It is enabled via DECSET 9.

The mouse button is the button number minus 1.

##### X11 / xterm

Reporting is extended to support mouse button releases and keyboard modifiers.
It is enabled via DECSET 1000.

The mouse button status is in the bottom two bits.
Only SGR supports reporting which mouse button was released
(see the SGR encoding section below for more details).

* `0`: Mouse button 1 is pressed.
* `1`: Mouse button 2 is pressed.
* `2`: Mouse button 3 is pressed.
* `3`: The mouse button was released.

The keyboard modifiers are encoded in bits 2, 3, and 4.
They indicate which keyboard keys were held down.
There is no way to detect keyboard presses/releases directly.

* bit 2: The shift key.
* bit 3: The meta key.
* bit 4: The control key.

##### Cell / Button Event Tracking

Reporting is extended to support motion events while buttons are held down.
It is enabled via DECSET 1002.

##### Motion Event Tracking

Reporting is extended to support motion events regardless of button state.
It is enabled via DECSET 1003.

This is not currently supported as most programs do not use it or care.
It can end up transmitting a lot of data when the mouse is constantly moved.

#### Encoding Modes

If you're unsure which encoding to select, then use SGR.

##### X10

***note
In >=hterm-1.85, we limit to 95 rows and columns due to encoding limitations.
***

There is a limit of 223 rows and columns due to the protocol encoding:
they made sure that each byte of data was printable, so 32 was added
(which is the first printable ASCII character).
There is also an 8-bit encoding limit, so 255 is the largest value.

This is the default encoding if no other selection has been made.
You should really use SGR instead though.

The encoding takes the form of `CSI M Cb Cx Cy` where:

* Each value has 32 added to it.
* `Cb` is the button & keyboard modifiers.
* `Cx` is the column (between 0 and 223).
* `Cy` is the row (between 0 and 223).

##### UTF-8 (Extended)

This is like the X10 form, but since we can assume UTF-8 encoding, the row and
column limit is increased to 2047.
The values still had 32 added to them.
Hence it is often referred to as "UTF-8" or "extended" encoding modes.

It is enabled via DECSET 1005.

The encoding takes the form of `CSI M Cb Cx Cy` where:

* Each field is encoded in UTF-8.
* Each value has 32 added to it.
* `Cb` is the button & keyboard modifiers.
* `Cx` is the column (between 0 and 2047).
* `Cy` is the row (between 0 and 2047).

##### SGR

This is the preferred encoding format as there are no row or column limits.

This can easily be confused with the Select Graphic Rendition (SGR) naming,
but that's no coincidence: they use similar encoding formats with semi-colon
delimited numbers.

Since the value is always printable (by virtue of being a number),
there is no need to add 32 to each value.

It is enabled via DECSET 1006.

The encoding takes the form of `CSI < Cb ; Cx ; Cy M` when a button is pressed,
and `CSI < Cb ; Cx ; Cy m` when a button is released, where:

* Each field is encoded as an ASCII integer.
* `Cb` is the button & keyboard modifiers.
* `Cx` is the column.
* `Cy` is the row.

##### urxvt

The only other notable encoding at this time is urxvt's, but since its encoding
is ambiguous with other CSI sequences, we won't support it.
The SGR encoding supports everything that urxvt tried to do too.

It is enabled via DECSET 1015.

#### Wheel Mice

Since the mouse reporting can only handle 3 buttons normally,
wheel up (button 4) is encoded as mouse button 1 with 64 added to it.
Wheel down (button 5) is mouse button 2 with 64 added to it.

No release events are generated.

Wheel mice events are always enabled when mouse reporting is active.

##### Alternate Scroll Mode

Instead of generating mouse events, the mouse wheel can be configured to
emit up/down/left/right arrow key presses instead.
This is useful when working with applications that don't understand mouse
reporting, but do handle arrow keys fine.

This mode is only active when the alternate screen is enabled.
Otherwise, the mouse wheel is used to control local buffer scrolling.

It is enabled via DECSET 1007.

## Select Graphic Rendition (SGR) {#SGR}

These are various color and cursor related escape sequences.  Also referred to
as ANSI escape sequences.  They are initiated with ESC+[ and finish with the m
command.  Accepts an arbitrary number of args delimited by ; and in any order.

| SGR | Character Attribute                        | Action |
|:---:|--------------------------------------------|--------|
|     | **Enable Attributes**                      | |
|   0 | Normal (default)                           | Supported |
|   1 | Bold (increased intensity)                 | Supported |
|   2 | Faint (decreased intensity)                | Supported |
|   3 | Italic                                     | Supported |
|   4 | Underlined                                 | Supported [**(2)**](#SGR-underline) |
|   5 | Blink (slowly)                             | Supported |
|   6 | Rapid blink                                | *Ignored (TBD)* |
|   7 | Inverse (negative image)                   | Supported |
|   8 | Invisible                                  | Supported |
|   9 | Crossed out                                | Supported |
|  10 | Primary font                               | *Ignored* |
|  11 | First alternative font                     | *Ignored* |
|  12 | Second alternative font                    | *Ignored* |
|  13 | Third alternative font                     | *Ignored* |
|  14 | Fourth alternative font                    | *Ignored* |
|  15 | Fifth alternative font                     | *Ignored* |
|  16 | Sixth alternative font                     | *Ignored* |
|  17 | Seventh alternative font                   | *Ignored* |
|  18 | Eighth alternative font                    | *Ignored* |
|  19 | Ninth alternative font                     | *Ignored* |
|  20 | *Reserved*                                 | *Ignored (TBD)* |
|  21 | Double underlined                          | Supported |
|     | **Disable Attributes**                     | |
|  22 | Normal (decorations)                       | Supported |
|  23 | Not italic                                 | Supported |
|  24 | Not underlined                             | Supported |
|  25 | Steady (not blink)                         | Supported |
|  26 | Variable spacing                           | *Ignored (TBD)* |
|  27 | Positive image (not inverse)               | Supported |
|  28 | Visible (not invisible)                    | Supported |
|  29 | Not crossed out                            | Supported |
|     | **Foreground Color**                       | |
|  30 | Set foreground color to Black              | Supported |
|  31 | Set foreground color to Red                | Supported |
|  32 | Set foreground color to Green              | Supported |
|  33 | Set foreground color to Yellow             | Supported |
|  34 | Set foreground color to Blue               | Supported |
|  35 | Set foreground color to Magenta            | Supported |
|  36 | Set foreground color to Cyan               | Supported |
|  37 | Set foreground color to White              | Supported |
|  38 | Set foreground color to extended color     | Supported [**(1)**](#SGR-extended-color) |
|  39 | Set foreground color to default (original) | Supported |
|     | **Background Color**                       | |
|  40 | Set background color to Black              | Supported |
|  41 | Set background color to Red                | Supported |
|  42 | Set background color to Green              | Supported |
|  43 | Set background color to Yellow             | Supported |
|  44 | Set background color to Blue               | Supported |
|  45 | Set background color to Magenta            | Supported |
|  46 | Set background color to Cyan               | Supported |
|  47 | Set background color to White              | Supported |
|  48 | Set background color to extended color     | Supported [**(1)**](#SGR-extended-color) |
|  49 | Set background color to default (original) | Supported |
|     | **Misc**                                   | |
|  50 | Not variable spacing                       | *Ignored (TBD)* |
|  51 | Framed                                     | *Ignored (TBD)* |
|  52 | Encircled                                  | *Ignored (TBD)* |
|  53 | Overlined                                  | *Ignored (TBD)* |
|  54 | Not framed and not encircled               | *Ignored (TBD)* |
|  55 | Not overlined                              | *Ignored (TBD)* |
|  56 | *Reserved*                                 | *Ignored (TBD)* |
|  57 | *Reserved*                                 | *Ignored (TBD)* |
|  58 | Set underline color to extended color      | Supported [**(1)**](#SGR-extended-color) |
|  59 | Set underline color to default (original)  | Supported |
|  60 | Ideogram underline or right side line      | *Ignored (TBD)* |
|  61 | Ideogram double underline or double right side line | *Ignored (TBD)* |
|  62 | Ideogram overline or left side line        | *Ignored (TBD)* |
|  63 | Ideogram double overline or double left side line   | *Ignored (TBD)* |
|  64 | Ideogram stress marking                    | *Ignored (TBD)* |
|  65 | Cancel SGR 60 through 64                   | *Ignored (TBD)* |
|     | **Bright Foreground Color**                | |
|  90 | Set foreground color to bright Black       | Supported |
|  91 | Set foreground color to bright Red         | Supported |
|  92 | Set foreground color to bright Green       | Supported |
|  93 | Set foreground color to bright Yellow      | Supported |
|  94 | Set foreground color to bright Blue        | Supported |
|  95 | Set foreground color to bright Magenta     | Supported |
|  96 | Set foreground color to bright Cyan        | Supported |
|  97 | Set foreground color to bright White       | Supported |
|     | **Bright Background Color**                | |
| 100 | Set background color to bright Black       | Supported |
| 101 | Set background color to bright Red         | Supported |
| 102 | Set background color to bright Green       | Supported |
| 103 | Set background color to bright Yellow      | Supported |
| 104 | Set background color to bright Blue        | Supported |
| 105 | Set background color to bright Magenta     | Supported |
| 106 | Set background color to bright Cyan        | Supported |
| 107 | Set background color to bright White       | Supported |

Note that most terminals consider "bold" to be "bold and bright".  In some
documents the bold state is even referred to as bright.  We interpret bold
as bold-bright here too, but only when the "bold" setting comes before the
color selection.

### Underlining {#SGR-underline}

In addition to the standard underline sequences, we support some non-standard
sequences to enable more styles and coloring.  We'll cover the non-standard
sequences here only.

* `4:0`: Turn off underlining (same as SGR+24).
* `4:1`: Underline with a single solid line (same as the normal `4`).
* `4:2`: Underline with double lines (same as SGR+21).
* `4:3`: Underline with a single wavy/curvy line.
* `4:4`: Underline with a single dotted line.
* `4:5`: Underline with a single dashed line.

In addition to the style, you can change the color by using SGR+58 (which uses
the same syntax as [SGR+38/SGR+48](#SGR-extended-color), and clear the color
by using SGR+59 (which uses the same syntax as SGR+39/SGR+49).

### SGR+38/SGR+48: Extended Colors {#SGR-extended-color}

These color sequences support both the [ISO/IEC 8613-6] form (i.e. colon
delimited) and, because of wide legacy usage, some xterm specific forms (i.e.
semi-colon delimited).  It's likely that other emulators do not support the
[ISO/IEC 8613-6] forms fully.

There are multiple extended color choices available.

* `0`: Implementation defined.  We ignore it.
* `1`: Transparent color.
* `2`: [RGB] color (a.k.a. true color or 24-bit color).
* `3`: [CMY] color.  We don't support it yet.
* `4`: [CMYK] color.  We don't support it yet.
* `5`: Select color by palette index (a.k.a. 8-bit or 88-color or 256-color).

#### Implementation & Transparent Colors

For `0` and `1`, we require the [ISO/IEC 8613-6] form.

* `38 : 0` -- Do nothing to the foreground!
* `48 : 0` -- Do nothing to the background!
* `38 : 1` -- Make the foreground transparent.
* `48 : 1` -- Make the background transparent.

#### RGB/True/24-bit Colors

For [RGB] colors, the [ISO/IEC 8613-6] forms apply.  The 2nd argument is left
blank as it is the color space identifier which we ignore.  We also ignore
the trailing tolerance and color space arguments.

* `38 : 2 : : R : G : B` -- Set foreground color to rgb(R, G, B).
* `48 : 2 : : R : G : B` -- Set background color to rgb(R, G, B).

We also support the legacy xterm forms for compatibility.

* `38 ; 2 ; R ; G ; B` -- Only RGB is specified, and uses semi-colons.
* `48 ; 2 ; R ; G ; B` -- Same as above.
* `38 : 2 : R : G : B` -- Only RGB is specified using colons.
* `48 : 2 : R : G : B` -- Same as above.

We do *not* support the mixed xterm form as no one else seems to either,
or has actively decided to drop support for it.

* `38 ; 2 : R : G : B` -- Mixes semi-colon & colon arguments.
* `48 ; 2 : R : G : B` -- Same as above.

#### CMY/CMYK Colors

***note
CMY is not yet supported.
***

For [CMY] and [CMYK] colors, we require the [ISO/IEC 8613-6] form.  The 2nd
argument is left blank as it is the color space identifier which we ignore.
We also ignore the trailing tolerance and color space arguments.

* `38 : 3 : : C : M : Y` -- Set foreground color to [CMY] color.
* `48 : 3 : : C : M : Y` -- Set background color to [CMY] color.
* `38 : 4 : : C : M : Y : K` -- Set foreground color to [CMYK] color.
* `48 : 4 : : C : M : Y : K` -- Set background color to [CMYK] color.

#### Palette/8-bit/88/256 Colors

For palette based colors (8-bit/88-colors/256-colors), the [ISO/IEC 8613-6]
forms apply.

* `38 : 5 : P` -- Set foreground color using a palette index.
* `48 : 5 : P` -- Set background color using a palette index.

We also support the legacy xterm forms for compatibility.

* `38 ; 5 ; P` -- Uses semi-colons instead of colons.
* `48 ; 5 ; P` -- Same as above.

We do *not* support the mixed xterm form as no one else seems to either,
or has actively decided to drop support for it.

* `38 ; 5 : P` -- Mixes semi-colon & colon arguments.
* `48 ; 5 : P` -- Same as above.

## References

* [ECMA-35] (*Character Code Structure and Extension Techniques*): covers some
  fundamentals related to character sets, the notions of [C0], [C1], [G0],
  etc... (but not their contents), and how escape sequences work (but not what
  they mean).  This is equivalent to [ISO/IEC 2022].
* [ECMA-43] (*8-bit Coded Character Set Structure and Rules*): Builds on top of
  [ECMA-35] by defining the character sets (e.g. 0x40 == @).  This is equivalent
  to [ISO/IEC 4873].
* [ECMA-48] (*Control Functions for Coded Character Sets*): Builds on top of
  [ECMA-35] by defining many of the common escape sequences.  Supersedes the
  ANSI codes, and is equivalent to [ISO/IEC 6429].
* [ISO/IEC 8613-6] (*Character content architectures*): Builds on top of
  [ECMA-35] by defining fonts and graphic renditions (e.g. [SGR]).
  This is equivalent to [ITU T.416].

* [ECMA-35] & [ISO/IEC 2022]: Character Code Structure and Extension Techniques.
* [ECMA-43] & [ISO/IEC 4873]: 8-bit Coded Character Set Structure and Rules.
* [ECMA-48] & [ISO/IEC 6429]: Control Functions for Coded Character Sets.
* [ISO/IEC 8613-6] & [ITU T.416]: Character content architectures.
* [VT100.net](http://vt100.net/): Everything related to classic VTstandards.
* [VT100 User Guide](http://vt100.net/docs/vt100-ug/contents.html)
* [VT510 Video Terminal Programmer Information](http://vt100.net/docs/vt510-rm/contents)
* [XTerm](http://invisible-island.net/xterm/ctlseqs/ctlseqs.html): The defacto
  standard in the open source world.
* [CTRL/C0/C1](https://en.wikipedia.org/wiki/C0_and_C1_control_codes): Basic
  control sequences.
* [ANSI escape codes](https://en.wikipedia.org/wiki/ANSI_escape_code): Basic
  color related sequences (among others).
* [terminfo(5) man page](http://invisible-island.net/ncurses/man/terminfo.5.html):
  Terminal capability data base.
* [infocmp(1) man page](http://invisible-island.net/ncurses/man/infocmp.1m.html):
  Compare or print out terminfo descriptions.
* [UTF-8 and Unicode FAQ](https://www.cl.cam.ac.uk/~mgk25/unicode.html):
  one-stop information resource on how you can use Unicode/UTF-8 on POSIX systems.


[C0]: #C0
[C1]: #C1
[DECSET]: #DECSET
[DECRST]: #DECRST
[G0]: #SCS
[G1]: #SCS
[G2]: #SCS
[G3]: #SCS
[GL]: #SCS
[GR]: #SCS
[CSI]: #CSI
[DCS]: #DCS
[DEC]: #DEC
[DOCS]: #DOCS
[ESC]: #ESC
[OSC]: #OSC
[RM]: #SM
[SCS]: #SCS
[SGR]: #SGR
[SM]: #SM

[1337]: #OSC-1337

[CMY]: https://en.wikipedia.org/wiki/CMYK_color_model
[CMYK]: https://en.wikipedia.org/wiki/CMYK_color_model
[RGB]: https://en.wikipedia.org/wiki/RGB_color_model
[ECMA-35]: http://www.ecma-international.org/publications/standards/Ecma-035.htm
[ECMA-43]: http://www.ecma-international.org/publications/standards/Ecma-043.htm
[ECMA-48]: http://www.ecma-international.org/publications/standards/Ecma-048.htm
[ISO/IEC 2022]: https://www.iso.org/standard/22747.html
[ISO/IEC 4873]: https://www.iso.org/standard/10859.html
[ISO/IEC 6429]: https://www.iso.org/standard/12782.html
[ISO/IEC 8613-6]: https://www.iso.org/standard/22943.html
[ITU T.416]: https://www.itu.int/rec/T-REC-T.416/
[MIME type]: https://developer.mozilla.org/en-US/docs/Web/HTTP/Basics_of_HTTP/MIME_types

[hterm_vt.js]: ../js/hterm_vt.js
[hterm_vt_character_map.js]: ../js/hterm_vt_character_map.js
