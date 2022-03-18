// Copyright 2021 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

// Various test helpers.

#ifndef TEST_UTILS_H
#define TEST_UTILS_H

#include <string.h>

// Assert two strings are equal.
#define streq(s1, s2) !strcmp(s1, s2)

// Return number of elements in array.
#define ARRAY_SIZE(x) (sizeof(x) / sizeof(*(x)))

// Print a string with special JSON chars escaped.
static inline void json_prints(const char* str) {
  for (size_t i = 0; str[i]; ++i) {
    switch (str[i]) {
      case '\n':
        printf("\\n");
        break;
      case '\t':
        printf("\\t");
        break;
      default:
        printf("%c", str[i]);
        break;
    }
  }
}

#endif
