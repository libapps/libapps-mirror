# Copyright 2019 The ChromiumOS Authors
# Use of this source code is governed by a BSD-style license that can be
# found in the LICENSE file.

# Creates a Docker image containing necessary dependencies of ssh_client and a
# command to build all of Secure Shell.
#
# For details on rebuilding & publishing the container, see:
# http://g3doc/security/nassh/g3doc/docker.md
#
# Although all changes at this point can be done in the kokoro/build script.

FROM debian:bookworm

ENV DEBIAN_FRONTEND noninteractive

# Since the container runs as root, don't muck with the cache files as the user
# won't be root outside of the container.  Shouldn't be a performance hit.
ENV PYTHONDONTWRITEBYTECODE 1

# Install needed packages for building ssh_client.
RUN dpkg --add-architecture i386
# apt-utils is used to autoprocess config files during install below.
RUN apt-get update && apt-get install -y --no-install-recommends apt-utils

# Keep this in sync with the README.md's Development Tools section.
# We also list packages needed by Chrome itself for headless tests.
RUN apt-get --assume-yes install --no-install-recommends \
    gcc g++ libstdc++6:i386 libglib2.0-0:i386 git make cmake lbzip2 \
    python-is-python3 python3 python3-requests \
    curl zlib1g-dev zip unzip rsync pkg-config xz-utils patch \
    libasound2 libatk1.0-0 libatk-bridge2.0-0 libatspi2.0-0 libcairo2 \
    libcups2 libdbus-1-3 libexpat1 libgdk-pixbuf2.0-0 libglib2.0-0 libgtk-3-0 \
    libnspr4 libnss3 libpango-1.0-0 libuuid1 libx11-6 libx11-xcb1 libxcb1 \
    libxcomposite1 libxcursor1 libxdamage1 libxext6 libxfixes3 libxi6 \
    libxrandr2 libxrender1 libxss1 libxtst6 default-jre-headless libxcb-dri3-0 \
    libdrm2 libgbm1 gettext

# Purge some packages to keep the container a little smaller.  Do it after the
# install above in case this removes stuff we actually need.  We want it to be
# a failure rather than wasting time re-installing.
RUN apt-get --assume-yes --allow-remove-essential purge --auto-remove \
    apt-utils sysvinit-utils
RUN rm -rf /usr/share/doc /usr/share/info /usr/share/man

# Clean out any caches.  We won't need them anymore.
RUN apt-get clean

# Set git config to stub values for webports patch to work.
# When patches are applied, webports generates local git repos & commits.
RUN git config --system user.email "noreply@google.com"
RUN git config --system user.name "Secure Shell Builder"

# We control the git content, so we don't need these checks.
RUN git config --global --add safe.directory "*"

CMD /libapps/kokoro/build
