// Copyright 2020 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

// Utility to dump argv state.

#include <inttypes.h>
#include <stdio.h>
#include <stdlib.h>

#include "test-utils.h"

int main(int argc, char* argv[]) {
  // Output in JSON format for easier test runner parsing.
  printf("{\n");

  printf("  \"argc\": %i,\n", argc);
  printf("  \"argv\": [\n");
  for (int i = 0; i < argc; ++i) {
    // We shouldn't really see NULL's here, but better to be safe.
    if (argv[i]) {
      printf("    \"");
      json_prints(argv[i]);
      printf("\"");
    } else {
      printf("    null");
    }
    printf("%s\n", i < argc - 1 ? "," : "");
  }
  printf("  ],\n");

  // We have to use PRIuPTR instead of %p as JSON doesn't support hex notation.
  printf("  \"mem\": {\n");
  printf("    \"argc\": %" PRIuPTR ",\n", (uintptr_t)&argc);
  printf("    \"argv\": %" PRIuPTR ",\n", (uintptr_t)&argv);
  printf("    \"argv[]\": [\n");
  for (int i = 0; i < argc; ++i)
    printf("      %" PRIuPTR "%s\n", (uintptr_t)&argv[i],
           i < argc - 1 ? "," : "");
  printf("    ],\n");
  printf("    \"strings\": [\n");
  for (int i = 0; i < argc; ++i)
    printf("      %" PRIuPTR "%s\n", (uintptr_t)argv[i],
           i < argc - 1 ? "," : "");
  printf("    ]\n");
  printf("  }\n");

  printf("}\n");

  return 0;
}
