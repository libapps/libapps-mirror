# kokoro build

*** note
**Warning: This document is old & has moved.  Please update any links:**<br>
https://chromium.googlesource.com/apps/libapps/+/HEAD/kokoro/
***

This directory contains all the logic for building Secure Shell releases in the
kokoro continuous integration platform.
It runs inside of the docker container (see [/Dockerfile]).
This allows us to be isolated from the kokoro runtime and be nice & stable.

The [./container] script uses docker to set up a runtime env that matches the
kokoro environment.
