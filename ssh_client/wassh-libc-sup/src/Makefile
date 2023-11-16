# Copyright 2019 The ChromiumOS Authors
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
	accept.c \
	bh-syscalls.c \
	bind.c \
	connect.c \
	dup.c \
	dup2.c \
	err.c \
	getaddrinfo.c \
	getsockname.c \
	getsockopt.c \
	ioctl.c \
	listen.c \
	readpassphrase.c \
	recv.c \
	send.c \
	setsockopt.c \
	signal.c \
	socket.c \
	stubs.c \
	termios.c \

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
