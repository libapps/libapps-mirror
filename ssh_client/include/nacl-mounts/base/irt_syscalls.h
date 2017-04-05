#ifndef _IRT_SYSCALLS_H
#define _IRT_SYSCALLS_H

#include <sys/types.h>
#include <stddef.h>
#include <fcntl.h>
#include <time.h>

#include "nacl_stat.h"

struct dirent;
struct nacl_abi_stat;
struct timeval;
struct timespec;

extern size_t (*__nacl_irt_query)(const char *interface_ident,
                                  void *table, size_t tablesize);

extern void (*__nacl_irt_exit) (int status);
extern int (*__nacl_irt_gettod) (struct timeval *tv);
extern int (*__nacl_irt_clock) (clock_t *ticks);
extern int (*__nacl_irt_nanosleep) (const struct timespec *req,
                                    struct timespec *rem);
extern int (*__nacl_irt_sched_yield) (void);
extern int (*__nacl_irt_sysconf) (int name, int *value);

extern int (*__nacl_irt_open) (const char *pathname, int oflag, mode_t cmode,
                               int *newfd);
extern int (*__nacl_irt_close) (int fd);
extern int (*__nacl_irt_read) (int fd, void *buf, size_t count, size_t *nread);
extern int (*__nacl_irt_write) (int fd, const void *buf, size_t count,
                                size_t *nwrote);
extern int (*__nacl_irt_seek) (int fd, nacl_abi_off_t offset, int whence,
                               nacl_abi_off_t *new_offset);
extern int (*__nacl_irt_dup) (int fd, int *newfd);
extern int (*__nacl_irt_dup2) (int fd, int newfd);
extern int (*__nacl_irt_fstat) (int fd, struct nacl_abi_stat *);
extern int (*__nacl_irt_stat) (const char *pathname, struct nacl_abi_stat *);
extern int (*__nacl_irt_getdents) (int fd, struct dirent *, size_t count,
                                   size_t *nread);

extern int (*__nacl_irt_sysbrk)(void **newbrk);
extern int (*__nacl_irt_mmap)(void **addr, size_t len, int prot, int flags,
                              int fd, nacl_abi_off_t off);
extern int (*__nacl_irt_munmap)(void *addr, size_t len);

extern int (*__nacl_irt_dyncode_create) (void *dest, const void *src,
            size_t size);
extern int (*__nacl_irt_dyncode_modify) (void *dest, const void *src,
            size_t size);
extern int (*__nacl_irt_dyncode_delete) (void *dest, size_t size);

extern int (*__nacl_irt_thread_create) (void *start_user_address, void *stack,
                                        void *thread_ptr);
extern void (*__nacl_irt_thread_exit) (int32_t *stack_flag);
extern int (*__nacl_irt_thread_nice) (const int nice);

extern int (*__nacl_irt_mutex_create) (int *mutex_handle);
extern int (*__nacl_irt_mutex_destroy) (int mutex_handle);
extern int (*__nacl_irt_mutex_lock) (int mutex_handle);
extern int (*__nacl_irt_mutex_unlock) (int mutex_handle);
extern int (*__nacl_irt_mutex_trylock) (int mutex_handle);

extern int (*__nacl_irt_cond_create) (int *cond_handle);
extern int (*__nacl_irt_cond_destroy) (int cond_handle);
extern int (*__nacl_irt_cond_signal) (int cond_handle);
extern int (*__nacl_irt_cond_broadcast) (int cond_handle);
extern int (*__nacl_irt_cond_wait) (int cond_handle, int mutex_handle);
extern int (*__nacl_irt_cond_timed_wait_abs) (int cond_handle, int mutex_handle,
                                              const struct timespec *abstime);

extern int (*__nacl_irt_tls_init) (void *tdb);
extern void *(*__nacl_irt_tls_get) (void);

extern int (*__nacl_irt_open_resource) (const char* file, int *fd);

#ifdef _LIBC
void init_irt_table (void) attribute_hidden;
#endif
#endif

#if defined(_LIBC) || defined (__need_emulated_syscalls)
#ifndef _IRT_EMULATED_SYSCALLS_H
#define _IRT_EMULATED_SYSCALLS_H 1

#ifndef _LINUX_TYPES_H
#define ustat __kernel_ustat
#include <linux/sysctl.h>
#undef ustat
#ifdef _LIBC
#include <misc/sys/ustat.h>
#else
#include <sys/ustat.h>
#endif
#endif
#ifndef _LIBC
#include <mqueue.h>
#endif

#include <linux/getcpu.h>
#include <linux/posix_types.h>
#include <sys/poll.h>
#include <sched.h>
#include <signal.h>
#include <streams/stropts.h>
#include <sys/epoll.h>
#include <sys/ptrace.h>
#include <sys/times.h>
#include <sys/types.h>
#include <sys/wait.h>
#include <time.h>
#include <utime.h>

#ifdef _LIBC
struct robust_list_head;
#else
struct robust_list_head
{
  void *list;
  long int futex_offset;
  void *list_op_pending;
};
#endif

#endif
#endif
