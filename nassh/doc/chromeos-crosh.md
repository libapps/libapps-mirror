```
                            .--~~~~~~~~~~~~~------.
                           /--===============------\
                           | |```````````````|     |
                           | |               |     |
                           | |      >_<      |     |
                           | |               |     |
                           | |_______________|     |
                           |                   ::::|
                           '======================='
                           //-"-"-"-"-"-"-"-"-"-"-\\
                          //_"_"_"_"_"_"_"_"_"_"_"_\\
                          [-------------------------]
                          \_________________________/

                            hterm and Secure Shell
                          Additional information  for
                         Chrom(e|ium) OS 'crosh' Users
```

This document explains in a little more detail how hterm relates to and
interacts with the "crosh" command on Chrome OS and Chromium OS.

From here on, this document will only mention Chrome OS.  You can assume
that it applies to Chromium OS as well.


## The "crosh" shell

   Chrome OS comes with a small set of command line commands accessible from
   the "crosh" shell.  You can open a new crosh instance with the Ctrl-Alt-T
   key sequence.

   The crosh commands are intended to be used for troubleshooting Chrome OS.
   Because it is not intended for frequent use, the crosh shell does not have
   an associated icon in the app launcher.  The only way to get to it is via
   the Ctrl-Alt-T sequence.

   You do not need to install any additional applications to access crosh.
   This is critical for debugging network connectivity issues.  It also means
   we can avoid a "go install this tool" step from diagnostic procedures.


## SSH command

   The crosh shell used to include an "ssh" command.  For security and
   stability reasons, you must use the "Secure Shell" application instead.
   See below.


## The "Secure Shell" application.

   The Secure Shell application is a dedicated ssh client that works on Chrome
   OS as well as Chrome on other platforms.

   Unlike the crosh shell, the Secure Shell application does NOT ship with
   Chrome OS.  You've got to manually install it from the Chrome Web Store
   from this link:

   https://chrome.google.com/webstore/detail/pnhechapfaindjhompbnflcldabbghjo

   Once installed you should see a new "Secure Shell" icon in your application
   launcher.

   You can get to crosh from Secure Shell by typing `>crosh` as the host name.
   (This won't work on non-Chrome OS systems, of course.)

   If Chrome OS notices that you have installed Secure Shell, it'll launch that
   instead of the built-in crosh command.  This allows you to upgrade the
   terminal emulator portion of the crosh shell without waiting for the next
   Chrome OS release.

   If you would like to revert to the built-in crosh terminal emulator,
   uninstall or disable the Secure Shell application.
