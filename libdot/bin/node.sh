# Copyright 2018 The Chromium OS Authors. All rights reserved.
# Use of this source code is governed by a BSD-style license that can be
# found in the LICENSE file.

# Code related to running node/npm related helpers.

# The hash of the node_modules that we maintain.
NODE_MODULES_HASH='15fa35331d956ff954e6500c5080c2322912d90df182d08cbced24a3e19ce6cc'

# In sync with Chromium's DEPS file because it's easier to use something that
# already exists than maintain our own.  Look for 'node_linux64' here:
# https://chromium.googlesource.com/chromium/src/+/master/DEPS
NODE_VER='8.9.1'

# To update these hashes:
# curl -s https://chromium.googlesource.com/chromium/src/+/master/third_party/node/linux/node-linux-x64.tar.gz.sha1?format=TEXT | base64 -d
# curl -s https://chromium.googlesource.com/chromium/src/+/master/third_party/node/mac/node-darwin-x64.tar.gz.sha1?format=TEXT | base64 -d
NODE_LINUX_HASH='1bdce2f7303ac1db18166035a0c4035134d46bbc'
NODE_MAC_HASH='c52ee3605efb50ae391bdbe547fb385f39c5a7a9'

# Bucket maintained by Chromium.
# gsutil ls gs://chromium-nodejs/
NODE_BASE_URI='https://storage.googleapis.com/chromium-nodejs'

# Bucket maintained by us.
NODE_MODULES_GS_FRAGMENT='chromeos-localmirror/secureshell/distfiles'
NODE_MODULES_GS_URI="gs://${NODE_MODULES_GS_FRAGMENT}"
NODE_MODULES_BASE_URI="https://storage.googleapis.com/${NODE_MODULES_GS_FRAGMENT}"

# The node_modules & node/npm paths.
NODE_MODULES_DIR="${LIBAPPS_DIR}/node_modules"
NODE_BIN_DIR="${NODE_MODULES_DIR}/.bin"
NODE="${NODE_BIN_DIR}/node"
NPM="${NODE_BIN_DIR}/npm"
# Use a dotdir as npm expects to manage everything under node_modules/.
NODE_DIR="${NODE_MODULES_DIR}/.node"

update_node_modules() {
  local hash_file="${NODE_MODULES_DIR}/.hash"
  local hash="$(cat "${hash_file}" 2>/dev/null)"

  # In case of an upgrade, nuke existing dir.
  if [[ "${hash}" != "${NODE_MODULES_HASH}" ]]; then
    rm -rf "${NODE_MODULES_DIR}"
  fi

  if [[ ! -e "${hash_file}" ]]; then
    local tar="node_modules-${NODE_MODULES_HASH}.tar.xz"
    echo_err "Downloading ${tar}"
    pushd "${LIBAPPS_DIR}" >/dev/null
    rm -rf "${NODE_MODULES_DIR}"
    fetch "${NODE_MODULES_BASE_URI}/${tar}" || exit
    tar xf "${tar}" || exit
    rm -rf "${tar}"
    echo "${NODE_MODULES_HASH}" >"${hash_file}"
    popd >/dev/null
  fi
}

update_node() {
  local hash
  case $(uname) in
  Linux) hash="${NODE_LINUX_HASH}";;
  *)     hash="${NODE_MAC_HASH}";;
  esac

  # In case of an upgrade, nuke existing node dir.
  if [[ ! -e "${NODE_DIR}/${hash}" ]]; then
    rm -rf "${NODE_DIR}"
  fi

  if [[ ! -e "${NODE}" ]]; then
    mkdir -p "${NODE_BIN_DIR}" "${NODE_DIR}"
    pushd "${NODE_DIR}" >/dev/null
    echo_err "Downloading npm/node"
    fetch "${NODE_BASE_URI}/${NODE_VER}/${hash}" || exit
    tar xf "${hash}" || exit
    rm "${hash}"
    local node=$(echo */bin/node)
    ln -sf "../.node/${node}" "${NODE}" || exit
    local npm=$(find */ -name npm-cli.js -type f)
    ln -sf "../.node/${npm}" "${NPM}" || exit
    touch "${NODE_DIR}/${hash}"
    popd >/dev/null
  fi
}

# Have to do node_modules first.
update_node_modules
update_node
PATH="${NODE_BIN_DIR}:${PATH}"
