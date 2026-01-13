# Copyright 2018 The ChromiumOS Authors
# Use of this source code is governed by a BSD-style license that can be
# found in the LICENSE file.

PKG_CONFIG ?= pkg-config
PC_MODULES = libssh
PC_CFLAGS := $(shell $(PKG_CONFIG) --cflags $(PC_MODULES))
PC_LIBS := $(shell $(PKG_CONFIG) --libs $(PC_MODULES))

# We don't bother enabling optimization as perf here isn't important.
DEFAULT_FLAGS = -g
WFLAGS = -Wall -Wextra -Wno-unused-parameter -Wno-missing-field-initializers

CFLAGS ?= $(DEFAULT_FLAGS)
CFLAGS += $(WFLAGS)

CXXFLAGS ?= $(DEFAULT_FLAGS)
CXXFLAGS += $(WFLAGS) -std=gnu++23

CPPFLAGS += $(PC_CFLAGS)
LDLIBS += $(PC_LIBS)

.SUFFIXES:

SRCDIR := $(CURDIR)
OUTPUT ?= $(SRCDIR)

CXX_SOURCES = echosshd.cc
CXX_OBJECTS := $(patsubst %.cc,$(OUTPUT)/%.o,$(CXX_SOURCES))
OBJECTS = $(CXX_OBJECTS)

#vpath %.c $(SRCDIR)
vpath %.cc $(SRCDIR)

all: $(OUTPUT)/echosshd $(OUTPUT)/host_key.rsa $(OUTPUT)/host_key.ecdsa

host_key.%:
	ssh-keygen -q -N '' -C '' -t $(@F:host_key.%=%) -f $@

$(OUTPUT)/echosshd: $(OBJECTS)
	$(CXX) -o $@ $< $(CXXFLAGS) $(LDFLAGS) $(LDLIBS)

$(CXX_OBJECTS): $(OUTPUT)/%.o: %.cc
	$(CXX) -o $@ -c $< $(CXXFLAGS) $(CPPFLAGS)

clean:
	rm -f echosshd *.wasm *.o

.PHONY: all clean
