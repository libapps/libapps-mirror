#!/usr/bin/env python3
# Copyright 2018 The Chromium OS Authors. All rights reserved.
# Use of this source code is governed by a BSD-style license that can be
# found in the LICENSE file.

"""Common libdot util code."""

import argparse
import base64
import hashlib
import importlib.machinery
import io
import logging
import logging.handlers
import os
from pathlib import Path
import subprocess
import sys
import time
import types
from typing import Dict, List, Optional, Union
import urllib.error
import urllib.request


# Require recent Python 3 versions as a sanity check.
# NB: We cannot require newer versions than CrOS itself supports.
assert (sys.version_info.major, sys.version_info.minor) >= (3, 6), (
    'Python 3.6 or newer is required; found %s' % (sys.version,))


BIN_DIR = Path(__file__).resolve().parent
DIR = BIN_DIR.parent
LIBAPPS_DIR = DIR.parent


class ColoredFormatter(logging.Formatter):
    """Colorize warning/error messages automatically."""

    _COLOR_MAPPING = {
        'WARNING': '\033[1;33m',
        'ERROR': '\033[1;31m'
    }
    _RESET = '\033[m'

    def __init__(self, *args, **kwargs):
        """Initialize!"""
        self._use_colors = 'NOCOLOR' not in os.environ
        super().__init__(*args, **kwargs)

    def format(self, record):
        """Formats |record| with color."""
        msg = super().format(record)
        color = self._COLOR_MAPPING.get(record.levelname)
        if self._use_colors and color:
            msg = '%s%s%s' % (color, msg, self._RESET)
        return msg


def setup_logging(debug=False, quiet=0):
    """Setup the logging module."""
    fmt = '%(asctime)s: %(levelname)-7s: '
    if debug:
        fmt += '%(filename)s:%(funcName)s: '
    fmt += '%(message)s'

    # 'Sat, 05 Oct 2013 18:58:50 -0400 (EST)'
    datefmt = '%a, %d %b %Y %H:%M:%S %z'
    tzname = time.strftime('%Z', time.localtime())
    if tzname and ' ' not in tzname and len(tzname) <= 5:
        # If the name is verbose, don't include it.  Some systems like to use
        # "Eastern Daylight Time" which is much too chatty.
        datefmt += f' ({tzname})'

    if debug:
        level = logging.DEBUG
    elif quiet <= 0:
        level = logging.INFO
    elif quiet <= 1:
        level = logging.WARNING
    elif quiet <= 2:
        level = logging.ERROR
    elif quiet <= 3:
        level = logging.CRITICAL

    formatter = ColoredFormatter(fmt, datefmt)
    handler = logging.StreamHandler(stream=sys.stdout)
    handler.setFormatter(formatter)

    logger = logging.getLogger()
    logger.addHandler(handler)
    logger.setLevel(level)


class ArgumentParser(argparse.ArgumentParser):
    """Custom parser to hold a consistent set of options & runtime env."""

    def __init__(self, short_options=True, **kwargs):
        """Initialize!"""
        super().__init__(**kwargs)

        self.add_common_arguments(short_options=short_options)

    def parse_args(self, args=None, namespace=None):
        """Parse all the |args| and save the results to |namespace|."""
        # This will call our parse_known_args below, so don't use setup_logging.
        namespace = argparse.ArgumentParser.parse_args(
            self, args=args, namespace=namespace)
        return namespace

    def parse_known_args(self, args=None, namespace=None):
        """Parse all the |args| and save the results to |namespace|."""
        namespace, unknown_args = argparse.ArgumentParser.parse_known_args(
            self, args=args, namespace=namespace)
        setup_logging(debug=namespace.debug, quiet=namespace.quiet)
        return (namespace, unknown_args)

    def add_common_arguments(self, short_options=True):
        """Add our custom/consistent set of command line flags."""
        getopts = lambda *args: args if short_options else args[1:]
        self.add_argument(*getopts('-d', '--debug'), action='store_true',
                          help='Run with debug output.')
        self.add_argument(*getopts('-q', '--quiet'), action='count', default=0,
                          help='Use once to hide info messages, twice to hide '
                               'warnings, and thrice to hide errors.')


def touch(path):
    """Touch (and truncate) |path|."""
    open(path, 'wb').close()


def unlink(path):
    """Remove |path| and ignore errors if it doesn't exist."""
    try:
        os.unlink(path)
    except FileNotFoundError:
        pass


def symlink(target, path):
    """Always symlink |path| to a relativized |target|."""
    unlink(path)
    path = os.path.realpath(path)
    target = os.path.relpath(os.path.realpath(target), os.path.dirname(path))
    logging.info('Symlinking %s -> %s', path, target)
    os.symlink(target, path)


def cmdstr(cmd):
    """Return a string for the |cmd| list w/reasonable quoting."""
    if isinstance(cmd, str):
        return cmd

    quoted = []
    for arg in cmd:
        if isinstance(arg, Path):
            arg = str(arg)
        if ' ' in arg:
            arg = '"%s"' % (arg,)
        quoted.append(arg)
    return ' '.join(quoted)


def run(cmd: List[str],
        cmd_prefix: List[str] = None,
        log_prefix: List[str] = None,
        check: bool = True,
        cwd: str = None,
        extra_env: Dict[str, str] = None,
        **kwargs):
    """Run |cmd| inside of |cwd| and exit if it fails.


    Args:
      cmd: The command to run.
      cmd_prefix: (Unlogged) prefix for the command to run.  Useful for passing
          interpreters like `java` or `python` but omitting from default output.
      log_prefix: Prefix for logging the command, but not running.  Useful for
          wrapper scripts that get executed directly and use |cmd_prefix|.
      check: Whether to exit if |cmd| execution fails.
      cwd: The working directory to run |cmd| inside of.
      extra_env: Extra environment settings to set before running.

    Returns:
      A subprocess.CompletedProcess instance.
    """
    # Python 3.6 doesn't support capture_output.
    if sys.version_info < (3, 7):
        capture_output = kwargs.pop('capture_output', None)
        if capture_output:
            assert 'stdout' not in kwargs and 'stderr' not in kwargs
            kwargs['stdout'] = subprocess.PIPE
            kwargs['stderr'] = subprocess.PIPE

    # The |env| setting specifies the entire environment, so we need to manually
    # merge our |extra_env| settings into it before passing it along.
    if extra_env is not None:
        env = kwargs.pop('env', os.environ)
        env = env.copy()
        env.update(extra_env)
        kwargs['env'] = env

    if not log_prefix:
        log_prefix = []
    log_cmd = log_prefix + cmd
    if not cmd_prefix:
        cmd_prefix = []
    real_cmd = cmd_prefix + cmd

    if cwd is None:
        cwd = os.getcwd()
    logging.info('Running: %s\n  (cwd = %s)', cmdstr(log_cmd), cwd)
    if cmd_prefix:
        logging.debug('Real full command: %s', cmdstr(real_cmd))
    result = subprocess.run(real_cmd, cwd=cwd, check=False, **kwargs)
    if check and result.returncode:
        logging.error('Running %s failed!', log_cmd[0])
        if result.stdout is not None:
            logging.error('stdout:\n%s', result.stdout)
        if result.stderr is not None:
            logging.error('stderr:\n%s', result.stderr)
        sys.exit(result.returncode)
    return result


def sha256(path: Union[Path, str]) -> str:
    """Return sha256 hex digest of |path|."""
    # The file shouldn't be too big to load into memory, so be lazy.
    with open(path, 'rb') as fp:
        data = fp.read()
    m = hashlib.sha256()
    m.update(data)
    return m.hexdigest()


def unpack(archive: Union[Path, str],
           cwd: Optional[Path] = None,
           files: Optional[List[Union[Path, str]]] = ()):
    """Unpack |archive| into |cwd|."""
    archive = Path(archive)
    if cwd is None:
        cwd = Path.cwd()
    if files:
        files = ['--'] + list(files)
    else:
        files = []

    # Try to make symlink usage easier in Windows.
    extra_env = {
        'MSYS': 'winsymlinks:nativestrict',
    }

    logging.info('Unpacking %s', archive.name)
    # We use relpath here to help out tar on platforms where it doesn't like
    # paths with colons in them (e.g. Windows).  We have to construct the full
    # before running through relpath as relative archives will implicitly be
    # checked against os.getcwd rather than the explicit cwd.
    src = os.path.relpath(cwd / archive, cwd)
    run(['tar', '--no-same-owner', '-xf', src] + files, cwd=cwd,
        extra_env=extra_env)


def pack(archive: Union[Path, str],
         paths: List[Union[Path, str]],
         cwd: Optional[Path] = None,
         exclude: Optional[List[Union[Path, str]]] = ()):
    """Create an |archive| with |paths| in |cwd|.

    The output will use XZ compression.
    """
    archive = Path(archive)
    if cwd is None:
        cwd = Path.cwd()
    if archive.suffix == '.xz':
        archive = archive.with_suffix('')

    # Make sure all the paths have sane permissions.
    def walk(path):
        if path.is_symlink():
            return
        elif path.is_dir():
            # All dirs should be 755.
            mode = path.stat().st_mode & 0o777
            if mode != 0o755:
                path.chmod(0o755)

            for subpath in path.glob('*'):
                walk(subpath)
        elif path.is_file():
            # All scripts should be 755 while other files should be 644.
            mode = path.stat().st_mode & 0o777
            if mode in (0o755, 0o644):
                return
            if mode & 0o111:
                path.chmod(0o755)
            else:
                path.chmod(0o644)
        else:
            raise ValueError(f'{path}: unknown file type')

    logging.info('Forcing sane permissions on inputs')
    for path in paths:
        walk(cwd / path)

    logging.info('Creating %s tarball', archive.name)
    # We use relpath here to help out tar on platforms where it doesn't like
    # paths with colons in them (e.g. Windows).  We have to construct the full
    # before running through relpath as relative archives will implicitly be
    # checked against os.getcwd rather than the explicit cwd.
    tar = os.path.relpath(cwd / archive, cwd)
    run(['tar', '--owner=0', '--group=0', '-cf', tar] +
        [f'--exclude={x}' for x in exclude] + ['--'] + paths, cwd=cwd)

    logging.info('Compressing tarball')
    run(['xz', '-f', '-T0', '-9', tar], cwd=cwd)


def fetch_data(uri: str, output=None, verbose: bool = False, b64: bool = False):
    """Fetch |uri| and write the results to |output| (or return BytesIO)."""
    # This is the timeout used on each blocking operation, not the entire
    # life of the connection.  So it's used for initial urlopen and for each
    # read attempt (which may be partial reads).  5 minutes should be fine.
    TIMEOUT = 5 * 60

    if output is None:
        output = io.BytesIO()

    try:
        with urllib.request.urlopen(uri, timeout=TIMEOUT) as infp:
            mb = 0
            length = infp.length
            while True:
                data = infp.read(1024 * 1024)
                if not data:
                    break
                # Show a simple progress bar if the user is interactive.
                if verbose:
                    mb += 1
                    print('~%i MiB downloaded' % (mb,), end='')
                    if length:
                        percent = mb * 1024 * 1024 * 100 / length
                        print(' (%.2f%%)' % (percent,), end='')
                    print('\r', end='', flush=True)
                if b64:
                    data = base64.b64decode(data)
                output.write(data)
    except urllib.error.HTTPError as e:
        logging.error('%s: %s', uri, e)
        sys.exit(1)

    return output


def fetch(uri, output, b64=False):
    """Download |uri| and save it to |output|."""
    output = os.path.abspath(output)
    distdir, name = os.path.split(output)
    if os.path.exists(output):
        logging.info('Using existing download: %s', name)
        return

    logging.info('Downloading %s to %s', uri, output)
    os.makedirs(distdir, exist_ok=True)

    # Use kokoro build cache or Gentoo distdir if available.
    for envvar in ('KOKORO_GFILE_DIR', 'DISTDIR'):
        cache_dir = os.getenv(envvar)
        if cache_dir:
            cache_file = os.path.join(cache_dir, name)
            if os.path.exists(cache_file):
                logging.info('  Cache hit via %s', envvar)
                symlink(cache_file, output)
                return

    # Don't be verbose if running on CI systems.
    verbose = os.isatty(sys.stdout.fileno())

    # We use urllib rather than wget or curl to avoid external utils & libs.
    # This seems to be good enough for our needs.
    tmpfile = output + '.tmp'
    for _ in range(0, 5):
        try:
            with open(tmpfile, 'wb') as outfp:
                fetch_data(uri, outfp, verbose=verbose, b64=b64)
            break
        except ConnectionError as e:
            time.sleep(1)
            logging.warning('Download failed; retrying: %s', e)
    else:
        logging.error('Unabled to download; giving up')
        unlink(tmpfile)
        sys.exit(1)

    # Clear the progress bar.
    if verbose:
        print(' ' * 80, end='\r')

    os.rename(tmpfile, output)


def node_and_npm_setup():
    """Download our copies of node & npm to our tree and updates env ($PATH)."""
    # We have to update modules first as it'll nuke the dir node lives under.
    node.modules_update()
    node.update()


def load_module(name, path):
    """Load a module from the filesystem.

    Args:
      name: The name of the new module to import.
      path: The full path to the file to import.
    """
    loader = importlib.machinery.SourceFileLoader(name, path)
    module = types.ModuleType(loader.name)
    loader.exec_module(module)
    return module


class HelperProgram:
    """Wrapper around local programs that get reused by other projects.

    This allows people to do inprocess execution rather than having to fork+exec
    another Python instance.

    This allows us to avoid filesystem symlinks (which aren't portable), and to
    avoid naming programs with .py extensions, and to avoid clashes between
    projects that use the same program name (e.g. "import lint" would confuse
    libdot/bin/lint & nassh/bin/lint), and to avoid merging all libdot helpers
    into the single libdot.py module.
    """

    _BIN_DIR = BIN_DIR

    def __init__(self, name, path=None):
        """Initialize.

        Args:
          name: The base name of the program to import.
          path: The full path to the file.  It defaults to libdot/bin/|name|.
        """
        self._name = name
        if path is None:
            path = os.path.join(self._BIN_DIR, name)
        self._path = path
        self._module_cache = None

    @property
    def _module(self):
        """Load & cache the program module."""
        if self._module_cache is None:
            self._module_cache = load_module(self._name, self._path)
        return self._module_cache

    def __getattr__(self, name):
        """Dynamic forwarder to module members."""
        return getattr(self._module, name)


# Wrappers around libdot/bin/ programs for other tools to access directly.
closure_compiler = HelperProgram('closure-compiler')
concat = HelperProgram('concat')
cpplint = HelperProgram('cpplint')
eslint = HelperProgram('eslint')
headless_chrome = HelperProgram('headless-chrome')
jsonlint = HelperProgram('jsonlint')
lint = HelperProgram('lint')
load_tests = HelperProgram('load_tests')
mdlint = HelperProgram('mdlint')
minify_translations = HelperProgram('minify-translations')
node = HelperProgram('node')
npm = HelperProgram('npm')
pylint = HelperProgram('pylint')
