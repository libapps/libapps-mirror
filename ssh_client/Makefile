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
	src/tcp_server_socket.cc \
	src/tcp_socket.cc \
	src/syscalls.cc \
	src/ssh_plugin.cc

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
	src/tcp_socket.h

# Project Build flags
override LDFLAGS+=-lppapi_cpp -lppapi -lutil -lcrypto -lz -lresolv -ldl -lnsl \
	-ljsoncpp -Loutput
override WARNINGS+=-Wno-long-long -Wall -Wswitch-enum -Werror
override CXXFLAGS+=-pthread -std=gnu++0x $(WARNINGS) -Iinclude

OSNAME:=$(shell python $(NACL_SDK_ROOT)/tools/getos.py)
TC_PATH:=$(abspath $(NACL_SDK_ROOT)/toolchain/$(OSNAME)_x86_glibc)
CXX:=$(TC_PATH)/bin/i686-nacl-g++

THIS_MAKEFILE:=$(abspath $(lastword $(MAKEFILE_LIST)))

# Declare the ALL target first, to make the 'all' target the default build
all: $(PROJECT)_x86_32.nexe $(PROJECT)_x86_64.nexe

# Define 32 bit compile and link rules for C++ sources
x86_32_OBJS:=$(patsubst src/%.cc,output/%_32.o,$(CXX_SOURCES))
$(x86_32_OBJS) : output/%_32.o : src/%.cc $(THIS_MAKE) $(CXX_HEADERS)
	$(CXX) -o $@ -c $< -m32 $(CXXFLAGS)

$(PROJECT)_x86_32.nexe : $(x86_32_OBJS)
	$(CXX) -o $@ $^ -m32 -lopenssh32 -lssh32 -lopenbsd-compat32 \
		$(CXXFLAGS) $(LDFLAGS)

# Define 64 bit compile and link rules for C++ sources
x86_64_OBJS:=$(patsubst src/%.cc,output/%_64.o,$(CXX_SOURCES))
$(x86_64_OBJS) : output/%_64.o : src/%.cc $(THIS_MAKE)
	$(CXX) -o $@ -c $< -m64 $(CXXFLAGS)

$(PROJECT)_x86_64.nexe : $(x86_64_OBJS)
	$(CXX) -o $@ $^ -m64 -lopenssh64 -lssh64 -lopenbsd-compat64 \
		$(CXXFLAGS) $(LDFLAGS)

clean:
	rm -rf output/*.o $(PROJECT)*.nexe
