# Copyright (c) 2012 The Chromium OS Authors. All rights reserved.
# Use of this source code is governed by a BSD-style license that can be
# found in the LICENSE file.

PROJECT:=output/ssh_client
CXX_SOURCES:=\
	src/dev_null.cc \
	src/dev_random.cc \
	src/dev_tty.cc \
	src/file_system.cc \
	src/js_file.cc \
	src/pepper_file.cc \
	src/syscalls.cc \
	src/ssh_plugin.cc \
	src/tcp_server_socket.cc \
	src/tcp_socket.cc \
	src/udp_socket.cc

CXX_HEADERS:=\
	src/dev_null.h \
	src/dev_random.h \
	src/dev_tty.h \
	src/file_interfaces.h \
	src/file_system.h \
	src/js_file.h \
	src/pepper_file.h \
	src/proxy_stream.h \
	src/pthread_helpers.h \
	src/ssh_plugin.h \
	src/tcp_server_socket.h \
	src/tcp_socket.h \
	src/udp_socket.h

# Project Build flags
override LDFLAGS+=-lppapi_cpp -lppapi -lutil -lcrypto -lz -lresolv -ldl -lnsl \
	-ljsoncpp -Loutput
override WARNINGS+=-Wno-long-long -Wall -Wswitch-enum -Werror
override CXXFLAGS+=-pthread -std=gnu++0x $(WARNINGS) -Iinclude \
        -I$(NACL_SDK_ROOT)/include
override CFLAGS+=-pthread $(WARNINGS) -Iinclude -I$(NACL_SDK_ROOT)/include

# This monstrous flag is needed to work around an issue with the current
# toolchain.  See http://code.google.com/p/nativeclient/issues/detail?id=3171
# TODO(rginda): Remove this when the bug is fixed.
PNACL_OPT_ARG=--pnacl-driver-append-LD_FLAGS=--pnacl-driver-append-OPT_FLAGS
PNACL_LDFLAGS_HACK:=$(PNACL_OPT_ARG)=--use-new-sroa=false

# These flags are used to create a nexe compatible with Chrome 23 on ARM.
# TODO(rginda): Remove this when Chrome 23 is out of circulation.
PNACL_TRANSLATE_ARM23_FLAGS=--noirtshim \
	--pnacl-driver-append-LLC_FLAGS_ARM=-nacl-use-m23-arm-abi

OSNAME:=$(shell python $(NACL_SDK_ROOT)/tools/getos.py)
TC_PATH:=$(abspath $(NACL_SDK_ROOT)/toolchain/$(OSNAME)_x86_glibc)
CXX:=$(TC_PATH)/bin/i686-nacl-g++
PNACL_TC_ROOT:=$(NACL_SDK_ROOT)/toolchain/$(OSNAME)_x86_pnacl/newlib/
PNACL_CXX:=$(PNACL_TC_ROOT)/bin/pnacl-clang++
PNACL_CC:=$(PNACL_TC_ROOT)/bin/pnacl-clang
PNACL_AR:=$(PNACL_TC_ROOT)/bin/pnacl-ar
PNACL_TRANSLATE=$(PNACL_TC_ROOT)/bin/pnacl-translate
PNACL_TRANSLATE_FLAGS=-fdata-sections -ffunction-sections --gc-sections
PNACL_LDFLAGS:=-lppapi_cpp -lppapi -lcrypto -lz -ljsoncpp -Loutput \
	$(PNACL_LDFLAGS_HACK)

COMPAT_INC:=-I$(PNACL_TC_ROOT)/usr/include/glibc-compat
PNACL_CXXFLAGS:=$(CXXFLAGS) -DUSE_NEWLIB $(COMPAT_INC)
THIS_MAKEFILE:=$(abspath $(lastword $(MAKEFILE_LIST)))

# Declare the ALL target first, to make the 'all' target the default build
all_glibc: $(PROJECT)_x86_32.nexe $(PROJECT)_x86_64.nexe

all_newlib: $(PROJECT)_nl_x86_32.nexe $(PROJECT)_nl_x86_64.nexe \
	$(PROJECT)_nl_arm.nexe $(PROJECT)_nl_arm_chrome23.nexe

# Define 32 bit compile and link rules for C++ sources
x86_32_OBJS:=$(patsubst src/%.cc,output/%_32.o,$(CXX_SOURCES))
$(x86_32_OBJS) : output/%_32.o : src/%.cc $(THIS_MAKE) $(CXX_HEADERS)
	$(CXX) -o $@ -c $< -m32 $(CXXFLAGS)

$(PROJECT)_x86_32.nexe : $(x86_32_OBJS)
	$(CXX) -o $@ $^ -m32 -lopenssh-i686 -lssh-i686 -lopenbsd-compat-i686 \
		$(CXXFLAGS) $(LDFLAGS)

# Define 64 bit compile and link rules for C++ sources
x86_64_OBJS:=$(patsubst src/%.cc,output/%_64.o,$(CXX_SOURCES))
$(x86_64_OBJS) : output/%_64.o : src/%.cc $(THIS_MAKE)
	$(CXX) -o $@ -c $< -m64 $(CXXFLAGS)

$(PROJECT)_x86_64.nexe : $(x86_64_OBJS)
	$(CXX) -o $@ $^ -m64 -lopenssh-x86_64 -lssh-x86_64 \
		-lopenbsd-compat-x86_64 $(CXXFLAGS) $(LDFLAGS)

# Define PNaCl compile and link rules for C++ sources
POBJS:=$(patsubst src/%.cc,output/%_p.o,$(CXX_SOURCES))
$(POBJS) : output/%_p.o : src/%.cc $(THIS_MAKE)
	$(PNACL_CXX) -o $@ -c $< $(PNACL_CXXFLAGS)

$(PROJECT)_nl.pexe : $(POBJS)
	$(PNACL_CXX) -o $@ $^ -lopenssh-pnacl -lssh-pnacl \
		-lopenbsd-compat-pnacl -lglibc-compat \
		$(PNACL_LDFLAGS) $(PNACL_CXXFLAGS)

$(PROJECT)_nl_arm.nexe : $(PROJECT)_nl.pexe
	$(PNACL_TRANSLATE) $(PNACL_TRANSLATE_FLAGS) -o $@ $(PROJECT)_nl.pexe \
		-arch arm

$(PROJECT)_nl_arm_chrome23.nexe : $(PROJECT)_nl.pexe
	$(PNACL_TRANSLATE) $(PNACL_TRANSLATE_FLAGS) -o $@ $(PROJECT)_nl.pexe \
		$(PNACL_TRANSLATE_ARM23_FLAGS) \
		-arch arm

$(PROJECT)_nl_x86_32.nexe : $(PROJECT)_nl.pexe
	$(PNACL_TRANSLATE) $(PNACL_TRANSLATE_FLAGS) -o $@ $(PROJECT)_nl.pexe \
		-arch i686

$(PROJECT)_nl_x86_64.nexe : $(PROJECT)_nl.pexe
	$(PNACL_TRANSLATE) $(PNACL_TRANSLATE_FLAGS) -o $@ $(PROJECT)_nl.pexe \
		-arch x86-64

clean:
	rm -rf output/*.o $(PROJECT)*.nexe $(PROJECT).pexe
