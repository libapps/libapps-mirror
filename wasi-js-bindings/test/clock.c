// Copyright 2020 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

// Utility to dump clock info.

#include <assert.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>
#include <unistd.h>

#include "test-utils.h"

static void dump_clock(const char* name, clockid_t clk_id) {
  struct timespec ts;
  int ret;

  ret = clock_getres(clk_id, &ts);
  assert(ret == 0);
  // Print the numbers as strings to avoid JSON->JS issues with large values.
  printf("  \"getres\": [\"%lli\", \"%lli\"],\n",
         (long long)ts.tv_sec, (long long)ts.tv_nsec);

  // Sample it a few times to observe its behavior.
  printf("  \"gettime\": [\n");
  const int kIters = 5;
  for (int i = 0; i < kIters; ++i) {
    if (i)
      usleep(1000);

    ret = clock_gettime(clk_id, &ts);
    assert(ret == 0);
    printf("    [\"%lli\", \"%lli\"]%s\n",
           (long long)ts.tv_sec, (long long)ts.tv_nsec,
           i == kIters - 1 ? "" : ",");
  }
  printf("  ]\n");
}

int main(int argc, char *argv[]) {
  if (argc != 2) {
    fprintf(stderr, "Usage: clock <source>\n");
    abort();
  }

  const char* mode = argv[1];

  // Output in JSON format for easier test runner parsing.
  printf("{\n");

  if (streq(mode, "realtime")) {
    dump_clock("realtime", CLOCK_REALTIME);
  } else if (streq(mode, "monotonic")) {
    dump_clock("monotonic", CLOCK_MONOTONIC);
  } else {
    fprintf(stderr, "unknown mode '%s'\n", mode);
    abort();
  }

  printf("}\n");
  return 0;
}
