// Copyright 2022 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

// Implementation for readpassphrase().
// https://man.openbsd.org/readpassphrase.3

#include <errno.h>
#include <readpassphrase.h>
#include <stdint.h>
#include <string.h>
#include <termios.h>
#include <unistd.h>

#include "bh-syscalls.h"

char* readpassphrase(const char* prompt, char* buf, size_t buf_len, int flags) {
  // Not sure if we should handle this write here or on the JS side.

  // Handle termios ONLCR.  We know the underlying fd doesn't, so do it here.
  struct termios termios = {};
  tcgetattr(2, &termios);
  size_t old_len = strlen(prompt);
  // This lint is normally reasonable.  We don't worry about security issues:
  // * OpenSSH is the only thing that calls this function.
  // * WASM handles stack overflows (kills us).
  // * WASM doesn't allow arbitrary code exec.
  // Using a VLA simplifies resource management.
  char new_prompt[old_len * 2];  // NOLINT(runtime/arrays)
  if ((termios.c_oflag & OPOST) && (termios.c_oflag & ONLCR)) {
    size_t new_len = old_len;
    size_t old_i = 0;
    size_t new_i = 0;
    while (old_i < old_len) {
      char c = prompt[old_i++];
      new_prompt[new_i++] = c;
      if (c == '\n') {
        new_prompt[new_i - 1] = '\r';
        new_prompt[new_i++] = c;
        ++new_len;
      }
    }
    write(2, new_prompt, new_len);
    new_prompt[new_len] = '\0';
    prompt = new_prompt;
  }

  char* ret = wassh_readpassphrase(prompt, buf, buf_len,
                                   !!(flags & RPP_ECHO_ON));
  if (ret && flags & RPP_ECHO_ON) {
    write(2, ret, strlen(ret));
  }
  write(2, "\r\n", 2);

  return ret;
}
