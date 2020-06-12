# Bundled fonts

The following fonts are loaded automatically as web fonts with Secure Shell.
* [Cousine]
* [Inconsolata]
* [Roboto Mono]
* [Source Code Pro]

In addition, [Powerline] symbol fonts are bundled and loaded as web fonts for:
* Powerline For Cousine
* Powerline For Inconsolata
* Powerline For Noto Sans Mono
* Powerline For Roboto Mono
* Powerline For Source Code Pro

The fonts are stored in the gs://chromeos-localmirror/secureshell/distfiles/
bucket and downloaded as part of the `mkdeps` build script. See
[nassh/bin/fonts] and [nassh/bin/fonts_create_bundle].

[TOC]

## Powerline fonts

Powerline glyphs are included for the fonts listed above. The fonts were created
using [Nerd Fonts] which uses [FontForge] python scripting.

Powerline uses 6 or so symbol glyphs such as anchor, pencil, arrows, and 7
glyphs in the unicode Private Use Area starting at U+E0A0. Another 30 or so
'Powerline Extra Smbols' have been defined in the same PUA block which have been
included.

The typical way of using Powerline fonts, is to patch glyphs into an existing
font file (e.g. `NotoSansMono-Regular.ttf`). This seems to also be the common
way they are used for the web. Our approach is different, to only generate the
Powerline glyphs in a separate `*.woff2` web font, and then list both fonts
in the css font list.

```css
@font-face {
  font-family: 'Noto Sans Mono';
  src: url('../fonts/NotoSansMono-Regular.woff2') format('woff2');
}

@font-face {
  font-family: 'Powerline For Noto Sans Mono';
  src: url('../fonts/PowerlineForNotoSansMono.woff2') format('woff2');
  unicode-range: U+2693,U+270E,U+2714,U+273C,U+2B06-2B07,U+E0A0-E0D4;
}

body {
  font-family: 'Noto Sans Mono', 'Powerline for Noto Sans Mono';
}
```

While the same Powerline glyphs are used for each web font, they must be
sized to match the height and width of the corresponding monospaced font they
are being used with.

## Steps to create font

1. Download the font to match - e.g. `NotoSansMono-Regular.ttf` from
   https://github.com/googlefonts/noto-fonts/blob/master/hinted/NotoSansMono.
2. Install FontForge - `sudo apt install fontforge`.
3. Get Nerd Fonts - `git clone https://github.com/ryanoasis/nerd-fonts.git`.
4. Apply Nerd Fonts patch -
   `git apply 0001-Generate-Powerline-fonts-for-nassh.patch`.
5. Get `woff2_compress` - `git clone https://github.com/google/woff2.git`.
   Follow instructions to build. It may also require
   `https://github.com/google/brotli.git`.
6. Using FontForge, create a new empty font file, e.g.
   `PowerlineForNotoSansMono.sfd`. Values for width and height must be copied
   from the actual font into this file before we use nerd fonts to patch it.
   Set font name fields in `Element > Font Info > PS Names`.
7. Open the full font to match in FontForge and find the following information.
   The values for NotoSansMono-Regular.ttf are shown below for example.
   * `Element > Font Info > General` Copy values across.
   * `Element > Font Info > OS/2 > Metrics` Copy values across.  You might need
     to experiment with the different values to get Powerline glyphs which match
     the correct height.
   * Open one of the glyphs in the full font file and find its width (e.g. 600).
     Create a single glyph in the empty file at position 0 by clicking on it to
     select it, then choosing `Metrics > Set Width` and enter the width. This
     glyph is empty, which is fine. The nerd-fonts patching script will use this
     information to patch the empty font file and produce glyphs of the correct
     width and height.
   * The files created in this way for the current set of fonts used by terminal
     are checked into terminal/fonts.
8. Run `for f in PowerlineFor*.sfd; do fontforge -script ~/work/nerd-fonts/font-patcher --powerline --powerlineextra -ext ttf $f; done`.
9. This will generate a file such as `PowerlineForNotoSansMono.ttf`.
10. Compress to woff2 - `for f in PowerlineFor*.ttf; do ~/work/woff2/out/woff2_compress $f; done`.
11. This final `PowerlineForNotoSansMono.woff2` file is used.

[Cousine]: https://github.com/google/fonts/tree/1831e5b6933f19eb000e1a8615503c313afc394f/apache/cousine
[Inconsolata]: https://github.com/googlefonts/Inconsolata/tree/e0c6cfb8df929029c123fa01d036a81b3146d0e7/fonts/ttf
[Noto Sans Mono]: https://github.com/googlefonts/noto-fonts/tree/012fbeb01b80f862b2167ac8fe36aaed11ce5573/hinted/NotoSansMono
[Source Code Pro]: https://github.com/adobe-fonts/source-code-pro/tree/235b72fc43a46cacf36e7c9b45d8d4fc0d121099/TTF
[Powerline]: https://github.com/powerline/powerline
[nassh/bin/fonts]: ../bin/fonts
[nassh/bin/fonts_create_bundle]: ../bin/fonts_create_bundle
[Nerd Fonts]: https://github.com/ryanoasis/nerd-fonts/tree/5f748cdb104a241ec8ac229f24518f3f867e8eb2
[FontForge]: https://fontforge.org/
