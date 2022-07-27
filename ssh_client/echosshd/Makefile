# Copyright 2018 The Chromium OS Authors. All rights reserved.
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
CXXFLAGS += $(WFLAGS) -std=gnu++17

CPPFLAGS += $(PC_CFLAGS)
LDLIBS += $(PC_LIBS)

all: echosshd host_key.rsa host_key.ecdsa

host_key.%:
	ssh-keygen -q -N '' -C '' -t $(@:host_key.%=%) -f $@

clean:
	rm -f echosshd

.PHONY: all clean
