// Copyright 2019 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

// Test code for the WASI browser layers.

#include <assert.h>
#include <errno.h>
#include <fcntl.h>
#include <sched.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <netinet/in.h>
#include <sys/random.h>
#include <sys/socket.h>
#include <sys/types.h>
#include <time.h>
#include <unistd.h>

#include <wasi/api.h>

#define ARRAY_SIZE(x) (sizeof(x) / sizeof(*(x)))

#define __WASI_SYSCALL_NAME(name) \
    __attribute__((__import_module__("wassh_experimental"), __import_name__(#name)))

__wasi_errno_t __wassh_test_func(
    int in,
    int* out
) __WASI_SYSCALL_NAME(test_func) __attribute__((__warn_unused_result__));

int test_func(int in, int* out) {
  __wasi_errno_t error = __wassh_test_func(in, out);
  if (error != 0) {
    errno = error;
    return -1;
  }
  return 0;
}

int main(int argc, char *argv[])
{
	setbuf(stdout, NULL);
	setbuf(stderr, NULL);

#if 1
#define S(x) printf("sizeof(" #x ") = %zu\n", sizeof(x))
#define O(s,m) printf("offsetof(" #s ", " #m ") = %zu\n", offsetof(s, m))
	{
		S(__wasi_fdstat_t);
		S(__wasi_rights_t);
		O(__wasi_fdstat_t, fs_filetype);
		O(__wasi_fdstat_t, fs_flags);
		O(__wasi_fdstat_t, fs_rights_base);
		O(__wasi_fdstat_t, fs_rights_inheriting);
		puts("");
	}
#undef O
#undef S
#endif

#if 1
	{
		int fd = open("/dev/null", O_RDONLY);
		printf("open(/dev/null) = %i\n", fd);
		char buf[5] = {};
		printf("read(%i, %p, %zu) = %zi\n", fd, buf, sizeof(buf),
			read(fd, buf, sizeof(buf)));
		close(fd);
		puts("");
	}
#endif

#if 1
	{
		printf("argc = %i\n", argc);
		printf("argv = %p\n", argv);
		for (int i = 0; i < argc; ++i) {
			printf("argv{%p}[%i] = ", argv[i], i);
			printf("{{{%s}}}\n", argv[i]);
		}
		puts("");
	}
#endif

#if 1
	{
		extern const char** environ;
		const char** envp = environ;
		printf("envp = %p\n", envp);
		int i = 0;
		const char* ptr;
		do {
			ptr = envp[i];
			printf("envp{%p}[%i] = ", ptr, i);
			printf("{{{%s}}}\n", envp[i]);
			++i;
		} while (ptr != NULL);
		puts("");
	}
#endif

#if 0
	{
		char buf[3] = {};
		printf("getrandom() = %i [%x, %x, %x] (%s)\n", getrandom(buf, 3, 0),
			buf[0], buf[1], buf[2],
			strerror(errno));
		puts("");
	}
#endif

#if 1
	{
		const size_t buf_size = 10;
		char buf[buf_size];
		printf("arc4random() = %#x\n", arc4random());
		arc4random_buf(buf, buf_size);
		for (int i = 0; i < buf_size; i++) {
			printf("arc4random_buf[%d] = 0x%02x\n", i, buf[i] & 0xff);
		}
		puts("");
	}
#endif

#if 0
	{
		char *path = "/dev/urandom";
		if (argc > 1)
			path = argv[1];
	    printf("open(%s) = %i (%i = %s)\n", path, open(path, O_RDONLY), errno, strerror(errno));
	}
#endif

#if 1
	errno = 0;
	int out = -100;
	int ret = test_func(argc, &out);
	printf("test_func() = %i\nerrno = %i (%s)\nout = %i %#x\n", ret, errno, strerror(errno), out, out);
#endif

#if 1
	{
		sched_yield();
		puts("");
	}
#endif

#if 1
	{
		clockid_t clocks[] = {CLOCK_REALTIME, CLOCK_MONOTONIC};
		struct timespec ts;
		int ret;
		for (size_t i = 0; i < ARRAY_SIZE(clocks); ++i) {
			clockid_t clock = clocks[i];

			errno = 0;
			ret = clock_getres(clock, &ts);
			printf("clock_getres(%p) = %i [%i %s]\n", clock, ret, errno, strerror(errno));
			if (ret == 0)
				printf("  {%lld, %ld}\n", ts.tv_sec, ts.tv_nsec);

			errno = 0;
			ret = clock_gettime(clock, &ts);
			printf("clock_gettime(%p) = %i [%i %s]\n", clock, ret, errno, strerror(errno));
			if (ret == 0)
				printf("  {%lld, %ld}\n", ts.tv_sec, ts.tv_nsec);
		}
	}
#endif

#if 0
	int ret;
	errno = 0;

	int sock = ret = socket(AF_INET, SOCK_STREAM, 0);
	printf("socket() = %i\nerrno = %i (%s)\n", ret, errno, strerror(errno));
	assert(sock >= 0);

	union {
		struct sockaddr_storage storage;
		struct sockaddr addr;
		struct sockaddr_in in4;
		struct sockaddr_in6 in6;
	} sa = {};

	socklen_t len = sizeof(sa.storage);
	sa.addr.sa_family = AF_INET;
	sa.in4.sin_port = htons(22);
	sa.in4.sin_addr.s_addr = htonl(INADDR_LOOPBACK);
	errno = 0;
	ret = connect(sock, &sa.addr, len);
	printf("connect(s_addr[%p]=%#x, port=%i) = %i\nerrno = %i (%s)\n",
		&sa.in4.sin_addr.s_addr, sa.in4.sin_addr.s_addr, sa.in4.sin_port,
		ret, errno, strerror(errno));

mkdir("/.ssh", 0);

#endif

    return 0;
}
