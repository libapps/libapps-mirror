# Copyright 2020 The ChromiumOS Authors
# Use of this source code is governed by a BSD-style license that can be
# found in the LICENSE file.

.SUFFIXES:

SRCDIR = $(CURDIR)
OUTPUT = $(SRCDIR)

WASI_SDK = $(SRCDIR)/../../ssh_client/output/wasi-sdk
SYSROOT = $(WASI_SDK)/share/wasi-sysroot
CC = $(WASI_SDK)/bin/clang
CXX = $(WASI_SDK)/bin/clang++
CFLAGS ?= -O2 -g
CXXFLAGS ?= -O2 -g
COMMON_FLAGS = --sysroot $(SYSROOT) -Wall -Werror
CFLAGS += $(COMMON_FLAGS) -std=gnu17
CXXFLAGS += $(COMMON_FLAGS) -std=gnu++17
CPPFLAGS += -D_GNU_SOURCE
LDFLAGS += -L$(SYSROOT)/lib

C_SRCS := $(wildcard $(SRCDIR)/*.c)
CXX_SRCS := $(wildcard $(SRCDIR)/*.cc)
PROGS := $(notdir $(C_SRCS:.c=.wasm) $(CXX_SRCS:.cc=.wasm))

all: $(foreach prog,$(PROGS),$(OUTPUT)/$(prog))

$(WASI_SDK):
	../../ssh_client/third_party/wasi-sdk/build
	../../ssh_client/wassh-libc-sup/build

$(CC) $(CXX): $(WASI_SDK)

%.wasm: %.c $(CC)
	$(CC) $(CPPFLAGS) $(CFLAGS) $(LDFLAGS) $< -o $@ $(LDLIBS)

%.wasm: %.cc $(CXX)
	$(CXX) $(CPPFLAGS) $(CXXFLAGS) $(LDFLAGS) $< -o $@ $(LDLIBS)

clean:
	rm -f $(OUTPUT)/*.wasm

.PHONY: all clean
