# Copyright 2023 The ChromiumOS Authors
# Use of this source code is governed by a BSD-style license that can be
# found in the LICENSE file.

.SUFFIXES:

SRCDIR := $(CURDIR)
OUTPUT ?= $(SRCDIR)/out

CC ?= clang
CFLAGS ?= -O3 -ffast-math
CFLAGS += -g
CPPFLAGS += \
	-DHAVE_CRYPT_H \
	-DHAVE_LINUX_CRYPT_GENSALT \
	-DHAVE_GETADDRINFO \
	-I$(SRCDIR)

C_SOURCES := utils.c whois.c

vpath %.c $(SRCDIR)

all: $(OUTPUT)/whois.wasm

$(OUTPUT)/whois.wasm: $(C_SOURCES)
	$(CC) -o $@ $^ $(CFLAGS) $(CPPFLAGS) $(LDFLAGS)

.PHONY: all
