// Copyright 2019 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

// https://pubs.opengroup.org/onlinepubs/9699919799/basedefs/unistd.h.html

#ifndef WASSH_UNISTD_H
#define WASSH_UNISTD_H

#include_next <unistd.h>

#include <sys/cdefs.h>

__BEGIN_DECLS

#define fork() -1
#define getpid() 100
pid_t getppid(void);
pid_t getpgrp(void);

#define getuid() 0
#define geteuid() 0
#define setuid(...) 0
#define seteuid(...) 0
#define getgid() 0
#define getegid() 0
#define setgid(...) 0
#define setegid(...) 0
#define setsid() 0

#define getgroups(...) 0
#define setgroups(...) 0
#define initgroups(...) 0

int execl(const char*, const char*, ...);
int execlp(const char*, const char*, ...);
int execv(const char*, char *const[]);
int execvp(const char*, char *const[]);
int system(const char*);

int dup(int);
int dup2(int, int);
int pipe(int[2]);
int chdir(const char*);
char* getcwd(char*, size_t);

#define alarm(...) 0

__END_DECLS

#endif
