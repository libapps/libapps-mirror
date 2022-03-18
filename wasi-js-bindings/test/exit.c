// Copyright 2020 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

// Utility to exit in different ways.

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>

#include "test-utils.h"

int main(int argc, char *argv[]) {
  if (argc < 2) {
    fprintf(stderr, "Usage: exit <mode> [value]\n");
    abort();
  }

  const char* mode = argv[1];

  if (streq(mode, "ret")) {
    int value = atoi(argv[2]);
    return value;
  } else if (streq(mode, "exit")) {
    int value = atoi(argv[2]);
    exit(value);
  } else if (streq(mode, "abort")) {
    abort();
  } else {
    fprintf(stderr, "unknown mode '%s'\n", mode);
    abort();
  }
}
