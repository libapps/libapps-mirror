#!/bin/bash
set -x

if [[ ($NACL_SDK_ROOT == "") || !(-d $NACL_SDK_ROOT) ]]; then
  echo "NACL_SDK_ROOT is not set or doesn't exists!"
  exit 1
fi

if [[ ($NACL_PORTS == "") || !(-d $NACL_PORTS) ]]; then
  echo "NACL_PORTS is not set or doesn't exists!"
  exit 1
fi

pushd $NACL_PORTS/src
export NACL_GLIBC=1
NACL_PACKAGES_BITSIZE=32 make openssl zlib jsoncpp || exit 1
NACL_PACKAGES_BITSIZE=64 make openssl zlib jsoncpp || exit 1
popd

mkdir output
pushd output
if [[ ! -f libopenssh32.a ]]; then
  NACL_PACKAGES_BITSIZE=32 ../nacl-openssh-5.9p1.sh || exit 1
fi

if [[ ! -f libopenssh64.a ]]; then
  NACL_PACKAGES_BITSIZE=64 ../nacl-openssh-5.9p1.sh || exit 1
fi
popd

if [[ $1 == "--debug" ]]; then
  BUILD_ARGS="--build_type=debug"
  BUILD_SUFFIX="_dbg"
else
  BUILD_ARGS="--build_type=release"
  BUILD_SUFFIX=""
fi
./scons $BUILD_ARGS || exit 1

cd output
mkdir -p hterm/plugin
cp ../ssh_client.nmf hterm/plugin
cp -R -f ../../hterm/{js,css,html,_locales,manifest.json} ./hterm
mkdir hterm/plugin/lib32
mkdir hterm/plugin/lib64

export GLIBC_VERSION=`ls $NACL_SDK_ROOT/toolchain/linux_x86/x86_64-nacl/lib32/libc.so.* | sed s/.*libc.so.//`
sed -i s/xxxxxxxx/$GLIBC_VERSION/ hterm/plugin/ssh_client.nmf || exit 1

cp -f ssh_client_x86_32${BUILD_SUFFIX}.nexe hterm/plugin/ssh_client_x86_32.nexe || exit 1
cp -f ssh_client_x86_64${BUILD_SUFFIX}.nexe hterm/plugin/ssh_client_x86_64.nexe || exit 1

LIBS="runnable-ld.so libppapi_cpp.so libppapi_cpp.so libstdc++.so.6 \
      libgcc_s.so.1 libpthread.so.* libresolv.so.* libdl.so.* libnsl.so.* \
      libm.so.* libc.so.*"
for i in $LIBS; do
  cp -f $NACL_SDK_ROOT/toolchain/linux_x86/x86_64-nacl/lib32/$i hterm/plugin/lib32/
  cp -f $NACL_SDK_ROOT/toolchain/linux_x86/x86_64-nacl/lib64/$i hterm/plugin/lib64/
done

if [[ -f ../ssh_client.pem ]]; then
  /opt/google/chrome/chrome --pack-extension=hterm --pack-extension-key=../ssh_client.pem
fi
