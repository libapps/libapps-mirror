# Creates a Docker image containing necessary dependencies of ssh_client and a
# command to build all of Secure Shell.
#
# For details on rebuilding & publishing the container, see:
# http://g3doc/security/nassh/g3doc/docker.md
#
# Although all changes at this point can be done in the kokoro/build script.

FROM debian:sid

ENV DEBIAN_FRONTEND noninteractive

# Install needed packages for building ssh_client.
RUN dpkg --add-architecture i386
RUN apt-get update && apt-get install -y --no-install-recommends apt-utils

# Keep this in sync with the README.md's Development Tools section.
# We also list packages needed by Chrome itself for headless tests.
RUN apt-get --assume-yes install \
    libstdc++6:i386 libglib2.0-0:i386 git make cmake \
    python python-dev python3 wget curl zlib1g-dev zip rsync \
    libasound2 libatk1.0-0 libatk-bridge2.0-0 libatspi2.0-0 libcairo2 \
    libcups2 libdbus-1-3 libexpat1 libgdk-pixbuf2.0-0 libglib2.0-0 libgtk-3-0 \
    libnspr4 libnss3 libpango-1.0-0 libuuid1 libx11-6 libx11-xcb1 libxcb1 \
    libxcomposite1 libxcursor1 libxdamage1 libxext6 libxfixes3 libxi6 \
    libxrandr2 libxrender1 libxss1 libxtst6

# Set git config to dummy values for webports patch to work.
# When patches are applied, webports generates local git repos & commits.
RUN git config --system user.email "secureshelldummyemail@google.com"
RUN git config --system user.name "Secure Shell Dummy Name"

CMD /libapps/kokoro/build
