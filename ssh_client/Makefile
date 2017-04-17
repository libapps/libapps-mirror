# Copyright (c) 2012 The Chromium OS Authors. All rights reserved.
# Use of this source code is governed by a BSD-style license that can be
# found in the LICENSE file.

NACL_SDK_ROOT ?= $(wildcard $(CURDIR)/output/naclsdk/pepper_*)

PROJECT:=output/ssh_client
CXX_SOURCES:=\
	src/dev_null.cc \
	src/dev_random.cc \
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
ifeq ($(DEBUG),1)
CXXFLAGS ?= -g -O0 -DDEBUG
else
CXXFLAGS ?= -g -O2 -DNDEBUG
endif
override LDFLAGS+=-lppapi_cpp -lppapi -lppapi_cpp_private -lnacl_io -lutil \
        -lcrypto -lz -lresolv -ldl -lnsl -ljsoncpp -Loutput
override WARNINGS+=-Wno-long-long -Wall -Wswitch-enum -Werror
override CXXFLAGS+=-pthread -std=gnu++0x $(WARNINGS) -Iinclude \
        -I$(NACL_SDK_ROOT)/include -I$(NACL_SDK_ROOT)/le32-nacl/include
override CFLAGS+=-pthread $(WARNINGS) -Iinclude -I$(NACL_SDK_ROOT)/include

OSNAME:=$(shell python $(NACL_SDK_ROOT)/tools/getos.py)
TC_PATH:=$(abspath $(NACL_SDK_ROOT)/toolchain/$(OSNAME)_x86_glibc)
CXX:=$(TC_PATH)/bin/i686-nacl-g++
PNACL_TC_ROOT:=$(NACL_SDK_ROOT)/toolchain/$(OSNAME)_pnacl
PNACL_CXX:=$(PNACL_TC_ROOT)/bin/pnacl-clang++
PNACL_CC:=$(PNACL_TC_ROOT)/bin/pnacl-clang
PNACL_AR:=$(PNACL_TC_ROOT)/bin/pnacl-ar
PNACL_STRIP:=$(PNACL_TC_ROOT)/bin/pnacl-strip
PNACL_TRANSLATE=$(PNACL_TC_ROOT)/bin/pnacl-translate
# --pnacl-disable-abi-check/--allow-llvm-bitcode-input were added to workaround
# https://code.google.com/p/nativeclient/issues/detail?id=3714
PNACL_TRANSLATE_FLAGS=-fdata-sections -ffunction-sections --gc-sections \
        --allow-llvm-bitcode-input
PNACL_LDFLAGS:=-lppapi_cpp -lppapi -lcrypto -lppapi_cpp_private -lnacl_io \
        -lz -ljsoncpp \
        -Loutput -L$(NACL_SDK_ROOT)/lib/pnacl/Release --pnacl-disable-abi-check

COMPAT_INC:=-I$(PNACL_TC_ROOT)/le32-nacl/usr/include/glibc-compat
PNACL_CXXFLAGS:=$(CXXFLAGS) -DUSE_NEWLIB $(COMPAT_INC)
THIS_MAKEFILE:=$(abspath $(lastword $(MAKEFILE_LIST)))

# Declare the ALL target first, to make the 'all' target the default build
all: all_newlib

all_glibc: glibc_x86_32 glibc_x86_64
glibc_x86_32: $(PROJECT)_x86_32.nexe
glibc_x86_64: $(PROJECT)_x86_64.nexe

all_newlib: newlib_x86_32 newlib_x86_64 newlib_arm
newlib_x86_32: $(PROJECT)_nl_x86_32.nexe
newlib_x86_64: $(PROJECT)_nl_x86_64.nexe
newlib_arm: $(PROJECT)_nl_arm.nexe

# Define 32 bit compile and link rules for C++ sources
x86_32_OBJS:=$(patsubst src/%.cc,output/%_32.o,$(CXX_SOURCES))
$(x86_32_OBJS) : output/%_32.o : src/%.cc $(THIS_MAKE) $(CXX_HEADERS)
	$(CXX) -o $@ -c $< -m32 $(CXXFLAGS)

$(PROJECT)_x86_32.nexe : $(x86_32_OBJS)
	$(CXX) -o $@ $^ -m32 -lopenssh-i686 -lssh-i686 -lopenbsd-compat-i686 \
		-L$(NACL_SDK_ROOT)/lib/glibc_x86_32/Release \
		$(CXXFLAGS) $(LDFLAGS)

# Define 64 bit compile and link rules for C++ sources
x86_64_OBJS:=$(patsubst src/%.cc,output/%_64.o,$(CXX_SOURCES))
$(x86_64_OBJS) : output/%_64.o : src/%.cc $(THIS_MAKE)
	$(CXX) -o $@ -c $< -m64 $(CXXFLAGS)

$(PROJECT)_x86_64.nexe : $(x86_64_OBJS)
	$(CXX) -o $@ $^ -m64 -lopenssh-x86_64 -lssh-x86_64 \
		-L$(NACL_SDK_ROOT)/lib/glibc_x86_64/Release \
		-lopenbsd-compat-x86_64 $(CXXFLAGS) $(LDFLAGS)

# Define PNaCl compile and link rules for C++ sources
POBJS:=$(patsubst src/%.cc,output/%_p.o,$(CXX_SOURCES))
$(POBJS) : output/%_p.o : src/%.cc $(THIS_MAKE)
	$(PNACL_CXX) -o $@ -c $< $(PNACL_CXXFLAGS)

$(PROJECT)_nl.pexe : $(POBJS)
	$(PNACL_CXX) -o $@ $^ -lopenssh-pnacl -lssh-pnacl \
		-lopenbsd-compat-pnacl -lglibc-compat \
		$(PNACL_LDFLAGS) $(PNACL_CXXFLAGS)

$(PROJECT)_nl_arm.dbg.nexe : $(PROJECT)_nl.pexe
	$(PNACL_TRANSLATE) $(PNACL_TRANSLATE_FLAGS) -o $@ $(PROJECT)_nl.pexe \
		-arch arm

$(PROJECT)_nl_x86_32.dbg.nexe : $(PROJECT)_nl.pexe
	$(PNACL_TRANSLATE) $(PNACL_TRANSLATE_FLAGS) -o $@ $(PROJECT)_nl.pexe \
		-arch i686

$(PROJECT)_nl_x86_64.dbg.nexe : $(PROJECT)_nl.pexe
	$(PNACL_TRANSLATE) $(PNACL_TRANSLATE_FLAGS) -o $@ $(PROJECT)_nl.pexe \
		-arch x86-64

%.nexe: %.dbg.nexe
	$(PNACL_STRIP) $^ -o $@

clean:
	rm -rf output/*.o $(PROJECT)*.[np]exe
