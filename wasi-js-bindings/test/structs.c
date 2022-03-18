// Copyright 2020 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

// Utility to dump structure offsets & sizes.

#include <stdio.h>

#include <wasi/api.h>

#define START(name) \
  fields = 0; \
  if (types++) printf(",\n"); \
  printf("  \"%s\": {\n" \
         "    \"struct_size\": %zu,\n" \
         "    \"fields\": {\n", \
         name, sizeof(TYPE))
#define FIELD(field) \
  if (fields++) printf(",\n"); \
  printf("      \"%s\": {\n" \
         "        \"offset\": %zu,\n" \
         "        \"size\": %zu\n" \
         "      }\n", \
         #field, \
         offsetof(TYPE, field), \
         sizeof(((TYPE *)(NULL))->field))
#define END() \
  printf("    }\n" \
         "  }\n")

int main(int argc, char *argv[]) {
  // Output in JSON format for easier test runner parsing.
  printf("{\n");

  size_t types = 0;
  size_t fields;

#define TYPE __wasi_iovec_t
  START("iovec_t");
  FIELD(buf);
  FIELD(buf_len);
  END();
#undef TYPE

#define TYPE __wasi_ciovec_t
  START("ciovec_t");
  FIELD(buf);
  FIELD(buf_len);
  END();
#undef TYPE

#define TYPE __wasi_dirent_t
  START("dirent_t");
  FIELD(d_next);
  FIELD(d_ino);
  FIELD(d_namlen);
  FIELD(d_type);
  END();
#undef TYPE

#define TYPE __wasi_fdstat_t
  START("fdstat_t");
  FIELD(fs_filetype);
  FIELD(fs_flags);
  FIELD(fs_rights_base);
  FIELD(fs_rights_inheriting);
  END();
#undef TYPE

#define TYPE __wasi_filestat_t
  START("filestat_t");
  FIELD(dev);
  FIELD(ino);
  FIELD(filetype);
  FIELD(nlink);
  FIELD(size);
  FIELD(atim);
  FIELD(mtim);
  FIELD(ctim);
  END();
#undef TYPE

#define TYPE __wasi_event_fd_readwrite_t
  START("event_fd_readwrite_t");
  FIELD(nbytes);
  FIELD(flags);
  END();
#undef TYPE

#define TYPE __wasi_event_t
  START("event_t");
  FIELD(userdata);
  FIELD(error);
  FIELD(type);
  FIELD(fd_readwrite);
  END();
#undef TYPE

#define TYPE __wasi_subscription_clock_t
  START("subscription_clock_t");
  FIELD(id);
  FIELD(timeout);
  FIELD(precision);
  FIELD(flags);
  END();
#undef TYPE

#define TYPE __wasi_subscription_fd_readwrite_t
  START("subscription_fd_readwrite_t");
  FIELD(file_descriptor);
  END();
#undef TYPE

#define TYPE __wasi_subscription_u_t
  START("subscription_u_t");
  FIELD(tag);
  FIELD(u);
  END();
#undef TYPE

#define TYPE __wasi_subscription_t
  START("subscription_t");
  FIELD(userdata);
  FIELD(u);
  END();
#undef TYPE

#define TYPE __wasi_prestat_dir_t
  START("prestat_dir_t");
  FIELD(pr_name_len);
  END();
#undef TYPE

#define TYPE __wasi_prestat_t
  START("prestat_t");
  FIELD(tag);
  FIELD(u);
  END();
#undef TYPE

  printf("}\n");

  return 0;
}
