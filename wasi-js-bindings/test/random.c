// Copyright 2020 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

// Utility to dump random output.

#include <assert.h>
#include <fcntl.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/random.h>
#include <unistd.h>

#include "test-utils.h"

int main(int argc, char* argv[]) {
  if (argc != 2) {
    fprintf(stderr, "Usage: random <mode>\n");
    return 1;
  }

  const char* mode = argv[1];
  uint8_t buf[256];

  // Output in JSON format for easier test runner parsing.
  printf("[");

  if (streq(mode, "getentropy")) {
    // There is a max length of 256 with the API.
    assert(sizeof(buf) <= 256);
    int ret = getentropy(buf, sizeof(buf));
    assert(ret == 0);
  } else if (streq(mode, "arc4random")) {
    for (size_t i = 0; i < 12; ++i) {
      if (i)
        printf(", ");
      printf("%u", arc4random());
    }
    printf("]\n");
    return 0;
  } else if (streq(mode, "arc4random_buf")) {
    arc4random_buf(buf, sizeof(buf));
  } else {
    fprintf(stderr, "unknown mode '%s'\n", mode);
    abort();
  }

  for (size_t i = 0; i < sizeof(buf); ++i) {
    if (i)
      printf(", ");
    printf("%u", buf[i]);
  }
  printf("]\n");

  return 0;
}
