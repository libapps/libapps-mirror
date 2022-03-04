# Copyright 2019 The Chromium OS Authors. All rights reserved.
# Use of this source code is governed by a BSD-style license that can be
# found in the LICENSE file.

.SUFFIXES:

SRCDIR := $(CURDIR)
OUTPUT ?= $(SRCDIR)/out

CC ?= clang
CFLAGS ?= -Ofast
CFLAGS += -Wall -Werror -fvisibility=hidden -std=gnu17
CFLAGS += -fdebug-prefix-map=$(SRCDIR)=wassh-libc-sup
CPPFLAGS += -I$(SRCDIR)/../include

# This turns off all the internal debugging output.
CPPFLAGS += -DNDEBUG

C_SOURCES := \
	bh-syscalls.c \
	connect.c \
	dup.c \
	dup2.c \
	getsockopt.c \
	setsockopt.c \
	signal.c \
	socket.c \
	stubs.c \

C_OBJECTS := $(patsubst %.c,$(OUTPUT)/%.o,$(C_SOURCES))
OBJECTS = $(C_OBJECTS)

vpath %.c $(SRCDIR)

all: $(OUTPUT)/libwassh.a

$(C_OBJECTS): $(OUTPUT)/%.o: %.c
	$(CC) -o $@ -c $< $(CFLAGS) $(CPPFLAGS)

$(OUTPUT)/libwassh.a: $(OBJECTS)
	$(AR) rc $@ $^
	$(RANLIB) $@

.PHONY: all
