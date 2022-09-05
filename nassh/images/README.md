# Images

*** note
**Warning: This document is old & has moved.  Please update any links:**<br>
https://chromium.googlesource.com/apps/libapps/+/HEAD/nassh/images/
***

To quickly convert the SVG's to PNG's, use `inkscape`:
```bash
$ s=64
$ inkscape -h $s -w $s -e icon-$s.png icon-48.svg

$ s=256
$ inkscape -h $s -w $s -e icon-$s.png icon-512.svg
```

When adding new files here, make sure to crush them first.
You can use [libdot/bin/imgcrush](/libdot/bin/imgcrush) to do so losslessly.
