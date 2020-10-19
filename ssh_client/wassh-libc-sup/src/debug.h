// Copyright 2019 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

// Helpers for debuging our code specifically.

#ifndef _WASSH_TRACE_H
#define _WASSH_TRACE_H

#include <stdio.h>

#ifdef NDEBUG
# define DEBUG_ENABLED 0
#else
# define DEBUG_ENABLED 1
#endif

#define _ENTER(fmt, args...) \
  do { \
    if (!DEBUG_ENABLED) \
      break; \
    fprintf(stderr, "%s:%i:%s(): ENTER " fmt "\r\n", \
            __FILE__, __LINE__, __func__, ##args); \
  } while (0)

#define _MID(fmt, args...) \
  do { \
    if (!DEBUG_ENABLED) \
      break; \
    fprintf(stderr, "  | " fmt "\r\n", ##args); \
  } while (0)

#define _EXIT(fmt, args...) \
  do { \
    if (!DEBUG_ENABLED) \
      break; \
    fprintf(stderr, "  `-> EXIT " fmt "\r\n", ##args); \
  } while (0)

#endif
