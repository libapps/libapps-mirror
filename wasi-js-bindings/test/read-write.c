// Copyright 2021 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

// Utility to trigger read & write callbacks.

#include <assert.h>
#include <errno.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/uio.h>
#include <unistd.h>

#include "test-utils.h"

static char buf[1024 * 1024];
static ssize_t ret;
static struct iovec iov[10];

int main(int argc, char* argv[]) {
  if (argc < 2) {
    fprintf(stderr,
            "Usage: read-write <action> [action...]\n"
            "\n"
            "Read actions:\n"
            "  read     <fd> <length>\n"
            "  # <length> will be repeated <count> times.\n"
            "  readv    <fd> <count> [<length>]\n"
            "  pread    <fd> <length> <offset>\n"
            "  # <length> will be repeated <count> times.\n"
            "  preadv   <fd> <offset> <count> [<length>]\n"
            "\n"
            "Write actions (buffer is accessed via 'read' actions):\n"
            "  write    <fd> <string>\n"
            "  # <string> will be repeated <count> times.\n"
            "  writev   <fd> <count> [<string>]\n"
            "  pwrite   <fd> <string> <offset>\n"
            "  # <string> will be repeated <count> times.\n"
            "  pwritev  <fd> <offset> <count> [<string>]\n"
            "\n"
            "Assert actions:\n"
            "  # Assert the return value.\n"
            "  ret      <number>\n"
            "  errno    <number>\n"
            "  string   <string>\n"
            "  lstring  <length> <string>\n"
            "\n"
            "Misc actions:\n"
            "  clear-errno\n");
    abort();
  }

  setbuf(stdout, NULL);

  errno = 0;

  for (int i = 1; i < argc; ++i) {
    const char* mode = argv[i];

    printf("argc=%i mode=%s\n", i, mode);
    fflush(stdout);

    // Reads.
    if (streq(mode, "read")) {
      int fd = atoi(argv[++i]);
      int len = atoi(argv[++i]);
      ret = read(fd, buf, len);
      printf("read(%i, %p, %i) = %zi  errno=%i(%s)\n", fd, buf, len, ret, errno,
             strerror(errno));
    } else if (streq(mode, "readv")) {
      int fd = atoi(argv[++i]);
      int count = atoi(argv[++i]);
      void* base = buf;
      for (int c = 0; c < count; ++c) {
        int len = atoi(argv[++i]);
        iov[c].iov_base = base;
        iov[c].iov_len = len;
        base += len;
      }
      ret = readv(fd, iov, count);
    } else if (streq(mode, "pread")) {
      int fd = atoi(argv[++i]);
      int len = atoi(argv[++i]);
      int off = atoi(argv[++i]);
      ret = pread(fd, buf, len, off);
    } else if (streq(mode, "preadv")) {
      int fd = atoi(argv[++i]);
      int off = atoi(argv[++i]);
      int count = atoi(argv[++i]);
      void* base = buf;
      for (int c = 0; c < count; ++c) {
        int len = atoi(argv[++i]);
        iov[c].iov_base = base;
        iov[c].iov_len = len;
        base += len;
      }
      ret = preadv(fd, iov, count, off);

      // Writes.
    } else if (streq(mode, "write")) {
      int fd = atoi(argv[++i]);
      const char* str = argv[++i];
      size_t len = strlen(str);
      ret = write(fd, str, len);
      printf("write(%i, %p, %zu) = %zi  errno=%i(%s)\n", fd, str, len, ret,
             errno, strerror(errno));
    } else if (streq(mode, "writev")) {
      int fd = atoi(argv[++i]);
      int count = atoi(argv[++i]);
      for (int c = 0; c < count; ++c) {
        char* str = argv[++i];
        size_t len = strlen(str);
        iov[c].iov_base = str;
        iov[c].iov_len = len;
      }
      ret = writev(fd, iov, count);
    } else if (streq(mode, "pwrite")) {
      int fd = atoi(argv[++i]);
      const char* str = argv[++i];
      size_t len = strlen(str);
      int off = atoi(argv[++i]);
      ret = pwrite(fd, str, len, off);
    } else if (streq(mode, "pwritev")) {
      int fd = atoi(argv[++i]);
      int off = atoi(argv[++i]);
      int count = atoi(argv[++i]);
      for (int c = 0; c < count; ++c) {
        char* str = argv[++i];
        size_t len = strlen(str);
        iov[c].iov_base = str;
        iov[c].iov_len = len;
      }
      ret = pwritev(fd, iov, count, off);

      // Asserts.
    } else if (streq(mode, "ret")) {
      int exp = atoi(argv[++i]);
      printf("ret=%zi exp=%i\n", ret, exp);
      assert(ret == exp);
    } else if (streq(mode, "errno")) {
      int exp = atoi(argv[++i]);
      printf("errno=%i(%s) exp=%i\n", errno, strerror(errno), exp);
      assert(errno == exp);
    } else if (streq(mode, "string")) {
      const char* exp = argv[++i];
      printf("buf=\"%s\" exp=\"%s\"\n", buf, exp);
      assert(streq(buf, exp));
    } else if (streq(mode, "lstring")) {
      int len = atoi(argv[++i]);
      const char* exp = argv[++i];
      assert(!memcmp(buf, exp, len));

      // Misc
    } else if (streq(mode, "clear-errno")) {
      errno = 0;

      // Unknown.
    } else {
      fprintf(stderr, "argc=%i unknown mode '%s'\n", i, mode);
      abort();
    }
  }

  return 0;
}
