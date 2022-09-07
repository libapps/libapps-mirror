// Copyright 2020 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

// Utility to dump environ state.

#include <inttypes.h>
#include <stdio.h>
#include <stdlib.h>
#include <unistd.h>

#include "test-utils.h"

int main(int argc, char* argv[]) {
  // Output in JSON format for easier test runner parsing.
  printf("{\n");

  int envc = 0;
  char **envp = environ;
  while (envp[envc++])
    continue;
  printf("  \"envc\": %i,\n", envc);

  printf("  \"environ\": [\n");
  for (int i = 0; i < envc; ++i) {
    if (environ[i]) {
      printf("    \"");
      json_prints(environ[i]);
      printf("\"");
    } else {
      printf("    null");
    }
    printf("%s\n", i < envc - 1 ? "," : "");
  }
  printf("  ],\n");

  // We have to use PRIuPTR instead of %p as JSON doesn't support hex notation.
  printf("  \"mem\": {\n");
  // Where the environ variable itself lives.
  printf("    \"storage\": %" PRIuPTR ",\n", (uintptr_t)&environ);
  // The environ pointers.
  printf("    \"base\": %" PRIuPTR ",\n", (uintptr_t)environ);
  printf("    \"pointers\": [\n");
  for (int i = 0; i < envc; ++i)
    printf("      %" PRIuPTR "%s\n", (uintptr_t)&environ[i],
           i < envc - 1 ? "," : "");
  printf("    ],\n");
  // The environ strings.
  printf("    \"strings\": [\n");
  for (int i = 0; i < envc; ++i)
    printf("      %" PRIuPTR "%s\n", (uintptr_t)environ[i],
           i < envc - 1 ? "," : "");
  printf("    ]\n");
  printf("  }\n");

  printf("}\n");

  return 0;
}
