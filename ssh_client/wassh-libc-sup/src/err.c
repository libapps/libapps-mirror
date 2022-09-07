// Copyright 2022 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

// Implementation for BSD err APIs.

#include <err.h>
#include <stdarg.h>
#include <stdlib.h>
#include <stdio.h>

// No header defines this unfortunately.
extern const char* __progname;

void warn(const char* format, ...) {
  va_list args;

  va_start(args, format);
  vwarn(format, args);
  va_end(args);
}

void warnx(const char* format, ...) {
  va_list args;

  va_start(args, format);
  vwarnx(format, args);
  va_end(args);
}

void err(int status, const char* format, ...) {
  va_list args;

  va_start(args, format);
  verr(status, format, args);
  va_end(args);
}

void errx(int status, const char* format, ...) {
  va_list args;

  va_start(args, format);
  verrx(status, format, args);
  va_end(args);
}

void vwarn(const char* format, va_list args) {
  fprintf(stderr, "%s: ", __progname);
  if (format) {
    vfprintf(stderr, format, args);
    fputs(": ", stderr);
  }
  perror(NULL);
}

void vwarnx(const char* format, va_list args) {
  fprintf(stderr, "%s: ", __progname);
  if (format) {
    vfprintf(stderr, format, args);
  }
  fprintf(stderr, "\n");
}

void verr(int status, const char* format, va_list args) {
  vwarn(format, args);
  exit(status);
}

void verrx(int status, const char* format, va_list args) {
  vwarnx(format, args);
  exit(status);
}
