/*
 * Copyright 2008 The Native Client Authors. All rights reserved.
 * Use of this source code is governed by a BSD-style license that can
 * be found in the LICENSE file.
 */

/* TODO(mseaborn): Import this header file from outside rather than
   keeping a copy in the glibc tree. */

#ifndef _NACL_STAT_H
#define _NACL_STAT_H


/* From service_runtime/include/machine/_types.h */

#include <stdint.h>

#ifndef nacl_abi___dev_t_defined
#define nacl_abi___dev_t_defined
typedef int64_t       nacl_abi___dev_t;
typedef nacl_abi___dev_t nacl_abi_dev_t;
#endif

#ifndef nacl_abi___ino_t_defined
#define nacl_abi___ino_t_defined
typedef int64_t nacl_abi___ino_t;
typedef nacl_abi___ino_t nacl_abi_ino_t;
#endif

#ifndef nacl_abi___mode_t_defined
#define nacl_abi___mode_t_defined
typedef uint32_t      nacl_abi___mode_t;
typedef nacl_abi___mode_t nacl_abi_mode_t;
#endif

#ifndef nacl_abi___nlink_t_defined
#define nacl_abi___nlink_t_defined
typedef unsigned int  nacl_abi___nlink_t;
typedef nacl_abi___nlink_t nacl_abi_nlink_t;
#endif

#ifndef nacl_abi___uid_t_defined
#define nacl_abi___uid_t_defined
typedef uint32_t      nacl_abi___uid_t;
typedef nacl_abi___uid_t nacl_abi_uid_t;
#endif

#ifndef nacl_abi___gid_t_defined
#define nacl_abi___gid_t_defined
typedef uint32_t      nacl_abi___gid_t;
typedef nacl_abi___gid_t nacl_abi_gid_t;
#endif

#ifndef nacl_abi___off_t_defined
#define nacl_abi___off_t_defined
typedef int64_t nacl_abi__off_t;
typedef nacl_abi__off_t nacl_abi_off_t;
#endif

#ifndef nacl_abi___blksize_t_defined
#define nacl_abi___blksize_t_defined
typedef long int      nacl_abi___blksize_t;
typedef nacl_abi___blksize_t nacl_abi_blksize_t;
#endif

#ifndef nacl_abi___blkcnt_t_defined
#define nacl_abi___blkcnt_t_defined
typedef long int      nacl_abi___blkcnt_t;
typedef nacl_abi___blkcnt_t nacl_abi_blkcnt_t;
#endif

#ifndef nacl_abi___time_t_defined
#define nacl_abi___time_t_defined
typedef int64_t nacl_abi___time_t;
typedef nacl_abi___time_t nacl_abi_time_t;
#endif


/* From service_runtime/fs/fs.h */

struct nacl_abi_stat {  /* must be renamed when ABI is exported */
  nacl_abi_dev_t     nacl_abi_st_dev;       /* not implemented */
  nacl_abi_ino_t     nacl_abi_st_ino;       /* not implemented */
  nacl_abi_mode_t    nacl_abi_st_mode;      /* partially implemented. */
  nacl_abi_nlink_t   nacl_abi_st_nlink;     /* link count */
  nacl_abi_uid_t     nacl_abi_st_uid;       /* not implemented */
  nacl_abi_gid_t     nacl_abi_st_gid;       /* not implemented */
  nacl_abi_dev_t     nacl_abi_st_rdev;      /* not implemented */
  nacl_abi_off_t     nacl_abi_st_size;      /* object size */
  nacl_abi_blksize_t nacl_abi_st_blksize;   /* not implemented */
  nacl_abi_blkcnt_t  nacl_abi_st_blocks;    /* not implemented */
  nacl_abi_time_t    nacl_abi_st_atime;     /* access time */
  int64_t            nacl_abi_st_atimensec; /* possibly just pad */
  nacl_abi_time_t    nacl_abi_st_mtime;     /* modification time */
  int64_t            nacl_abi_st_mtimensec; /* possibly just pad */
  nacl_abi_time_t    nacl_abi_st_ctime;     /* inode change time */
  int64_t            nacl_abi_st_ctimensec; /* possibly just pad */
};

/* Converts struct nacl_abi_stat to struct stat. Implemented in fxstat.c */
void __nacl_abi_stat_to_stat (struct nacl_abi_stat *nacl_st,
                                struct stat *st);
#endif
