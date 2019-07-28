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
RUN apt-get --assume-yes install \
    libstdc++6:i386 libglib2.0-0:i386 git make cmake \
    python python-dev python3 wget curl zlib1g-dev zip rsync

# Set git config to dummy values for webports patch to work.
# When patches are applied, webports generates local git repos & commits.
RUN git config --system user.email "secureshelldummyemail@google.com"
RUN git config --system user.name "Secure Shell Dummy Name"

CMD /kokoro/build
