#!/usr/bin/env python3
# Copyright 2018 The ChromiumOS Authors
# Use of this source code is governed by a BSD-style license that can be
# found in the LICENSE file.

"""Common ssh_client util code."""

import logging
import multiprocessing
import os
from pathlib import Path
import re
import shutil
import sys


BIN_DIR = Path(__file__).resolve().parent
DIR = BIN_DIR.parent
LIBAPPS_DIR = DIR.parent


sys.path.insert(0, str(LIBAPPS_DIR / "libdot" / "bin"))

import libdot  # pylint: disable=wrong-import-position


# The top output directory.  Everything lives under this.
OUTPUT = DIR / "output"

# Where archives are cached for fetching & unpacking.
DISTDIR = OUTPUT / "distfiles"

# All package builds happen under this path.
BUILDDIR = OUTPUT / "build"

# Directory to put build-time tools.
BUILD_BINDIR = OUTPUT / "bin"

# Some tools like to scribble in $HOME.
HOME = OUTPUT / "home"

# Where we save shared libs and headers.
SYSROOT = OUTPUT / "sysroot"

# Base path to our source mirror.
SRC_URI_MIRROR = (
    "https://commondatastorage.googleapis.com/"
    "chromeos-localmirror/secureshell"
)


# Number of jobs for parallel operations.
JOBS = multiprocessing.cpu_count()


# Help simplify the API for users of ssh_client.py.
run = libdot.run
symlink = libdot.symlink
touch = libdot.touch
unlink = libdot.unlink


def copy(source, dest):
    """Always copy |source| to |dest|."""
    logging.info("Copying %s -> %s", source, dest)
    os.makedirs(os.path.dirname(dest), exist_ok=True)
    # In case the dest perms are broken, remove the file.
    if os.path.exists(dest):
        unlink(dest)
    shutil.copy2(source, dest)


def emake(*args, **kwargs):
    """Run `make` with |args| and automatic -j."""
    jobs = kwargs.pop("jobs", JOBS)
    run(["make", f"-j{jobs}"] + list(args), **kwargs)


def get_mandoc_cmd(p: str) -> list[str]:
    """Get the mandoc command for the specified package."""
    return [
        "mandoc",
        "-Thtml",
        "-I",
        f"os={p}",
        "-O",
        "man=%N.%S.html,style=mandoc.css",
    ]


def fetch(uri=None, name=None):
    """Download |uri| into DISTDIR as |name|."""
    if uri is None:
        uri = "/".join((SRC_URI_MIRROR, name))
    if name is None:
        name = os.path.basename(uri)

    libdot.fetch(uri, DISTDIR / name)


def stamp_name(workdir, phase, unique):
    """Get a unique name for this particular step.

    This is useful for checking whether certain steps have finished (and thus
    have been given a completion "stamp").

    Args:
      workdir: The package-unique work directory.
      phase: The phase we're in e.g. "unpack" or "prepare".
      unique: A unique name for the step we're checking in this phase.

    Returns:
      The full file path to the stamp file.
    """
    return os.path.join(workdir, f".stamp.{phase}.{unique}")


def unpack(archive, cwd=None, workdir=None):
    """Unpack |archive| into |cwd|."""
    distfile = DISTDIR / archive

    stamp = stamp_name(workdir, "unpack", distfile.name)
    if workdir and os.path.exists(stamp):
        logging.info("Archive already unpacked: %s", archive)
    else:
        libdot.unpack(distfile, cwd=workdir or cwd)
        touch(stamp)


def parse_metadata(metadata):
    """Turn the |metadata| file into a dict."""
    ret = {}
    re_field = re.compile(r'^(name|version): "(.*)"')

    with open(metadata, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()

            m = re_field.match(line)
            if m:
                ret[m.group(1)] = m.group(2)

    return ret


class ToolchainInfo:
    """Information about the active toolchain environment."""

    def __init__(self, target: str, env: dict) -> None:
        """Initialize."""
        self._env = env
        self._cbuild = None
        self._chost = self._env.get("CHOST")
        self.targetname = target

        # Not used with build tools.
        if self.targetname != "build":
            self.sysroot = Path(self._env["SYSROOT"])
            self.libdir = self.sysroot / "lib"
            self.incdir = self.sysroot / "include"
            multitarget = self._env.get("MULTITARGET")
            if multitarget:
                self.libdir /= multitarget
                self.incdir /= multitarget
            self.pkgconfdir = self.libdir / "pkgconfig"
        else:
            # This isn't strictly correct, but our build tool usage is pretty
            # minimal, so should suffice for now.
            self.sysroot = Path("/")
            self.incdir = self.sysroot / "usr" / "include"
            self.libdir = self.sysroot / "usr" / "lib"

        self.ar = self._env.get("AR")

    @classmethod
    def from_id(cls, name):
        """Figure out what environment should be used."""
        if name == "wasm" or name.startswith("wasi"):
            env = _toolchain_wasm_env(name)
            return cls(env["MULTITARGET"], env)

        assert name == "build"
        return cls(
            "build",
            {
                "CC": "gcc",
                "CXX": "g++",
            },
        )

    def activate(self):
        """Update the current environment with this toolchain."""
        os.environ.update(self._env)

        for var in (
            "AR",
            "CC",
            "CXX",
            "CFLAGS",
            "CPPFLAGS",
            "CXXFLAGS",
            "LDFLAGS",
            "RANLIB",
            "STRIP",
            "SYSROOT",
            "PKG_CONFIG_PATH",
            "PKG_CONFIG_LIBDIR",
            "PKG_CONFIG_SYSROOT_DIR",
        ):
            if var not in self._env:
                os.environ.pop(var, None)

        if shutil.which("ccache"):
            for var in ("CC", "CXX"):
                os.environ[var] = f"ccache {os.environ[var]}"

    @property
    def chost(self):
        """Get the current hsst system."""
        return self.cbuild if self._chost is None else self._chost

    @property
    def cbuild(self):
        """Get the current build system."""
        if self._cbuild is None:
            prog = BUILD_BINDIR / "config.guess"
            result = run([prog], capture_output=True)
            self._cbuild = result.stdout.strip().decode("utf-8")
        return self._cbuild

    @property
    def relincdir(self) -> Path:
        """Relative include dir path.

        Set the include dir when building packages under sysrots.
        """
        return self.incdir.relative_to(self.sysroot)

    @property
    def rellibdir(self) -> Path:
        """Relative library dir path.

        Set the library dir when building packages under sysrots.
        """
        return self.libdir.relative_to(self.sysroot)

    def write_cmake_toolchain_file(self, path: Path) -> None:
        """Write a cmake toolchain file."""
        path.write_text(
            f"""
set(CMAKE_SYSTEM_NAME  Generic)
set(CMAKE_C_COMPILER   {os.environ["CC"]} {self._env["CPPFLAGS"]})
set(CMAKE_CXX_COMPILER {os.environ["CXX"]} {self._env["CPPFLAGS"]})
set(CMAKE_AR {os.environ["AR"]})
set(CMAKE_RANLIB {os.environ["RANLIB"]})
set(CMAKE_FIND_ROOT_PATH {self.sysroot})
set(CMAKE_FIND_ROOT_PATH_MODE_PROGRAM NEVER)
set(CMAKE_FIND_ROOT_PATH_MODE_LIBRARY ONLY)
set(CMAKE_FIND_ROOT_PATH_MODE_INCLUDE ONLY)
"""
        )


def _toolchain_wasm_env(target: str) -> dict:
    """Get custom env to build using WASM toolchain."""
    sdk_root = OUTPUT / "wasi-sdk"

    # We currently support the WASI preview1 ABI.
    if target == "wasm":
        target = "wasm32-wasip1"
    elif target.startswith("wasi"):
        # We only really care about 32-bit atm.
        target = f"wasm32-{target}"

    bin_dir = sdk_root / "bin"
    sysroot = sdk_root / "share" / "wasi-sysroot"
    libdir = sysroot / "lib" / target
    incdir = sysroot / "include" / target
    pcdir = libdir / "pkgconfig"

    ret = {
        # Only use single core here due to known bug in 89 release:
        # https://github.com/WebAssembly/binaryen/issues/2273
        "BINARYEN_CORES": "1",
        "ac_cv_func_calloc_0_nonnull": "yes",
        "ac_cv_func_malloc_0_nonnull": "yes",
        "ac_cv_func_realloc_0_nonnull": "yes",
        "CHOST": "wasm32-wasi",
        "CC": f"{bin_dir / 'clang'} --sysroot={sysroot} -target {target}",
        "CXX": f"{bin_dir / 'clang++'} --sysroot={sysroot} -target {target}",
        "AR": str(bin_dir / "llvm-ar"),
        "RANLIB": str(bin_dir / "llvm-ranlib"),
        "STRIP": str(BUILD_BINDIR / "wasm-strip"),
        "PKG_CONFIG_SYSROOT_DIR": str(sysroot),
        "PKG_CONFIG_LIBDIR": str(pcdir),
        "SYSROOT": str(sysroot),
        "MULTITARGET": target,
        "CPPFLAGS": " ".join(
            (
                f'-isystem {incdir / "wassh-libc-sup"}',
                "-D_WASI_EMULATED_GETPID",
                "-D_WASI_EMULATED_PROCESS_CLOCKS",
                "-D_WASI_EMULATED_SIGNAL",
            )
        ),
        "LDFLAGS": " ".join(
            (
                f"-L{libdir}",
                "-lwassh-libc-sup",
                "-lwasi-emulated-getpid",
                "-lwasi-emulated-process-clocks",
                "-lwasi-emulated-signal",
                (
                    "-Wl,--allow-undefined-file="
                    f"{libdir / 'wassh-libc-sup.imports'}"
                ),
                "-Wl,--export=__wassh_signal_deliver",
                # Move the stack in the memory layout to help catch stack
                # overflows better.
                # https://github.com/llvm/llvm-project/issues/151015
                "-Wl,--stack-first",
                # The default stack size in WASM is 64KiB.  This is much smaller
                # than your standard POSIX platform, and OpenSSH 10.0 blows it.
                f"-Wl,-z,stack-size={128 * 1024}",
                # The default max memory size is set to the size of the WASM
                # program (rounded up to 64KiB page size).  This is then grown
                # at runtime by the allocator as more memory is needed.  Under
                # C++, this logic involves exceptions which we don't support, so
                # the programs fail almost immediately.  Our current program
                # sizes are all under 5MiB, so setting the default max memory
                # size much larger should "just work".  Since it's using virtual
                # memory, it shouldn't cost us anything when not actually used.
                f"-Wl,--max-memory={64 * 1024 * 1024}",
            )
        ),
    }

    if target.endswith("-threads"):
        ret.update(
            {
                "CFLAGS": "-O2 -g0 -pipe -pthread",
                "CXXFLAGS": "-O2 -g0 -pipe -pthread",
            }
        )

    return ret


def default_src_unpack(metadata):
    """Default src_unpack phase."""
    for archive in metadata["archives"]:
        name = archive % metadata
        fetch(name=name)
        unpack(name, workdir=metadata["workdir"])


def default_src_prepare(metadata):
    """Default src_prepare phase."""
    filesdir = metadata["filesdir"]
    workdir = metadata["workdir"]
    for patch in metadata["patches"]:
        patch = patch % metadata
        name = os.path.basename(patch)
        stamp = stamp_name(workdir, "prepare", name)
        if os.path.exists(stamp):
            logging.info("Patch already applied: %s", name)
        else:
            patch = filesdir / patch
            logging.info("Applying patch %s", name)
            with patch.open("rb") as fp:
                run(["patch", "-p1"], stdin=fp)
            touch(stamp)


def default_src_configure(_metadata):
    """Default src_configure phase."""


def default_src_compile(_metadata):
    """Default src_compile phase."""
    if os.path.exists("Makefile"):
        emake()


def default_src_install(_metadata):
    """Default src_install phase."""


def get_parser(desc, default_toolchain):
    """Get a command line parser."""
    parser = libdot.ArgumentParser(description=desc)
    parser.add_argument(
        "--toolchain",
        choices=(
            "build",
            "wasm",
            "wasip1",
            "wasip1-threads",
            "wasip2",
            "wasip2-threads",
        ),
        default=default_toolchain,
        help="Which toolchain to use (default: %(default)s).",
    )
    parser.add_argument(
        "-j", "--jobs", type=int, help="Number of jobs to use in parallel."
    )
    return parser


def update_gnuconfig(metadata, sourcedir):
    """Update config.guess/config.sub files in |sourcedir|."""
    # Special case the sorce of gnuconfig.
    if metadata["PN"] == "gnuconfig":
        return

    for prog in ("config.guess", "config.sub"):
        source = BUILD_BINDIR / prog
        target = os.path.join(sourcedir, prog)
        if os.path.exists(source) and os.path.exists(target):
            copy(source, target)


def build_package(module, default_toolchain):
    """Build the package in the |module|.

    The file system layout is:
    output/                    OUTPUT
      build/                   BUILDDIR
        build/                 toolchain
          mandoc-1.14.3/         metadata['basedir']
            work/                metadata['workdir']
              $p/                metadata['S']
            temp/                metadata['T']
        pnacl/                 toolchain
          zlib-1.2.11/           metadata['basedir']
            work/                metadata['workdir']
              $p/                metadata['S']
            temp/                metadata['T']
    """
    parser = get_parser(module.__doc__, default_toolchain)
    opts = parser.parse_args()

    if opts.jobs:
        global JOBS  # pylint: disable=global-statement
        JOBS = opts.jobs

    # Create a metadata object from the METADATA file and other settings.
    # This object will be used throughout the build to pass around vars.
    filesdir = getattr(module, "FILESDIR")
    metadata_file = os.path.join(filesdir, "METADATA")
    metadata = parse_metadata(metadata_file)
    metadata.update(
        {
            # pylint: disable=consider-using-f-string
            "P": "%(name)s-%(version)s" % metadata,
            "PN": "%(name)s" % metadata,
            "PV": "%(version)s" % metadata,
        }
    )
    metadata.update(
        {
            "p": metadata["P"].lower(),
            "pn": metadata["PN"].lower(),
        }
    )

    toolchain = ToolchainInfo.from_id(opts.toolchain)
    toolchain.activate()
    metadata["toolchain"] = toolchain

    # All package-specific build state is under this directory.
    basedir = BUILDDIR / toolchain.targetname / metadata["p"]
    workdir = basedir / "work"
    # Package-specific source directory with all the source.
    sourcedir = getattr(module, "S", os.path.join(workdir, metadata["p"]))
    # Package-specific temp directory.
    tempdir = basedir / "temp"

    metadata.update(
        {
            "archives": getattr(module, "ARCHIVES", ()),
            "patches": getattr(module, "PATCHES", ()),
            "filesdir": filesdir,
            "workdir": workdir,
            "T": tempdir,
        }
    )
    metadata.update(
        {
            "S": Path(sourcedir % metadata),
        }
    )

    sourcedir = metadata["S"]

    for path in (tempdir, workdir, BUILD_BINDIR, HOME):
        os.makedirs(path, exist_ok=True)

    os.environ["HOME"] = str(HOME)
    os.environ["PATH"] = os.pathsep.join(
        (str(BUILD_BINDIR), os.environ["PATH"])
    )

    # Run all the source phases now to build it.
    common_module = sys.modules[__name__]

    def run_phase(phase, cwd):
        """Run this single source phase."""
        logging.info(">>> %s: Running phase %s", metadata["P"], phase)
        func = getattr(
            module, phase, getattr(common_module, f"default_{phase}")
        )
        os.chdir(cwd)
        func(metadata)

    run_phase("src_unpack", workdir)
    update_gnuconfig(metadata, sourcedir)
    run_phase("src_prepare", sourcedir)
    run_phase("src_configure", sourcedir)
    run_phase("src_compile", sourcedir)
    run_phase("src_install", sourcedir)
