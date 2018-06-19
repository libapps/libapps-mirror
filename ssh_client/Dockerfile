# Creates a Docker image containing necessary dependencies of ssh_client and a
# command to run the ssh_client build script.
# Usage from ssh_client folder: "docker build -t ssh_client .".

FROM debian:sid

ENV DEBIAN_FRONTEND noninteractive

# Copy ssh_client directory contents into the container at /.
ADD . /

# Install needed packages for building ssh_client.
RUN dpkg --add-architecture i386
RUN apt-get update && apt-get install -y --no-install-recommends apt-utils

# Keep this in sync with the README.md's Development Tools section.
RUN apt-get --assume-yes install \
    libstdc++6:i386 libglib2.0-0:i386 git make cmake \
    python python-dev wget curl zlib1g-dev

# Set git config to dummy values for webports patch to work.
# When patches are applied, webports generates local git repos & commits.
RUN git config --global user.email "secureshelldummyemail@google.com"
RUN git config --global user.name "Secure Shell Dummy Name"

CMD /build.sh
