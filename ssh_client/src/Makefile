# Copyright (c) 2012 The Chromium OS Authors. All rights reserved.
# Use of this source code is governed by a BSD-style license that can be
# found in the LICENSE file.

TOPDIR = $(CURDIR)/..
OUTPUT ?= $(TOPDIR)/output
BUILD_NAME = pnacl
D = $(OUTPUT)/plugin/$(BUILD_NAME)

$(shell mkdir -p $(D))
NACL_SDK_ROOT ?= $(OUTPUT)/naclsdk

PROJECT := ssh_client
CXX_SOURCES := \
	dev_null.cc \
	dev_random.cc \
	file_system.cc \
	js_file.cc \
	pepper_file.cc \
	syscalls.cc \
	ssh_plugin.cc \
	tcp_server_socket.cc \
	tcp_socket.cc \
	udp_socket.cc

CXX_HEADERS := \
	dev_null.h \
	dev_random.h \
	file_interfaces.h \
	file_system.h \
	js_file.h \
	pepper_file.h \
	proxy_stream.h \
	pthread_helpers.h \
	ssh_plugin.h \
	tcp_server_socket.h \
	tcp_socket.h \
	udp_socket.h

# Project Build flags
ifeq ($(DEBUG),1)
CXXFLAGS ?= -g -O0 -DDEBUG
else
CXXFLAGS ?= -g -O2 -DNDEBUG
endif
override WARNINGS+=-Wno-long-long -Wall -Wswitch-enum -Werror
override CXXFLAGS+=-pthread -std=gnu++0x $(WARNINGS) -I$(TOPDIR)/include \
        -I$(NACL_SDK_ROOT)/include -I$(NACL_SDK_ROOT)/le32-nacl/include
override CFLAGS+=-pthread $(WARNINGS) -I$(TOPDIR)/include -I$(NACL_SDK_ROOT)/include

OSNAME:=$(shell python $(NACL_SDK_ROOT)/tools/getos.py)
PNACL_TC_ROOT:=$(NACL_SDK_ROOT)/toolchain/$(OSNAME)_pnacl
PNACL_CXX:=$(PNACL_TC_ROOT)/bin/pnacl-clang++
PNACL_CC:=$(PNACL_TC_ROOT)/bin/pnacl-clang
PNACL_AR:=$(PNACL_TC_ROOT)/bin/pnacl-ar
PNACL_STRIP:=$(PNACL_TC_ROOT)/bin/pnacl-strip
PNACL_FINALIZE:=$(PNACL_TC_ROOT)/bin/pnacl-finalize
PNACL_TRANSLATE:=$(PNACL_TC_ROOT)/bin/pnacl-translate
# --pnacl-disable-abi-check/--allow-llvm-bitcode-input were added to workaround
# https://code.google.com/p/nativeclient/issues/detail?id=3714
PNACL_TRANSLATE_FLAGS=-fdata-sections -ffunction-sections --gc-sections \
        --allow-llvm-bitcode-input
PNACL_LDFLAGS:=-lppapi_cpp -lppapi -lcrypto -lppapi_cpp_private -lnacl_io \
        -lz -ljsoncpp \
        -L$(OUTPUT) -L$(NACL_SDK_ROOT)/lib/pnacl/Release --pnacl-disable-abi-check

COMPAT_INC:=-I$(PNACL_TC_ROOT)/le32-nacl/usr/include/glibc-compat
PNACL_CXXFLAGS:=$(CXXFLAGS) $(COMPAT_INC)

# Declare the ALL target first, to make the 'all' target the default build
all: all_newlib

newlib_pexe = $(PROJECT)_nl.pexe
newlib_x86_32 = $(PROJECT)_nl_x86_32.nexe
newlib_x86_64 = $(PROJECT)_nl_x86_64.nexe
newlib_arm = $(PROJECT)_nl_arm.nexe
all_newlib: \
	$(D)/$(newlib_x86_32) \
	$(D)/$(newlib_x86_64) \
	$(D)/$(newlib_arm) \
	$(D)/ssh_client.nmf
$(D)/ssh_client.nmf: $(TOPDIR)/ssh_client.nmf
	cp $< $@
$(D)/%: $(OUTPUT)/%
	cp $< $@
newlib_pexe: $(OUTPUT)/$(newlib_pexe)
newlib_x86_32: $(OUTPUT)/$(newlib_x86_32)
newlib_x86_64: $(OUTPUT)/$(newlib_x86_64)
newlib_arm: $(OUTPUT)/$(newlib_arm)

# Define PNaCl compile and link rules for C++ sources
POBJS := $(patsubst %.cc,$(OUTPUT)/%_p.o,$(CXX_SOURCES))
$(POBJS): $(OUTPUT)/%_p.o : $(CURDIR)/%.cc
	$(PNACL_CXX) -o $@ -c $< $(PNACL_CXXFLAGS)

$(OUTPUT)/$(newlib_pexe): $(POBJS)
	$(PNACL_CXX) -o $@ $^ -lopenssh -lssh \
		-lopenbsd-compat -lglibc-compat \
		$(PNACL_LDFLAGS) $(PNACL_CXXFLAGS)

$(OUTPUT)/$(PROJECT)_nl_arm.dbg.nexe: $(OUTPUT)/$(newlib_pexe)
	$(PNACL_TRANSLATE) $(PNACL_TRANSLATE_FLAGS) -o $@ $< -arch arm

$(OUTPUT)/$(PROJECT)_nl_x86_32.dbg.nexe: $(OUTPUT)/$(newlib_pexe)
	$(PNACL_TRANSLATE) $(PNACL_TRANSLATE_FLAGS) -o $@ $< -arch i686

$(OUTPUT)/$(PROJECT)_nl_x86_64.dbg.nexe: $(OUTPUT)/$(newlib_pexe)
	$(PNACL_TRANSLATE) $(PNACL_TRANSLATE_FLAGS) -o $@ $< -arch x86-64

%.nexe: %.dbg.nexe
	$(PNACL_STRIP) $^ -o $@

%.pexe: %.dbg.pexe
	$(PNACL_FINALIZE) $^ -o $@

clean:
	rm -rf $(OUTPUT)/*.o $(OUTPUT)/*.[np]exe
