// Copyright (c) 2012 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview
 * @suppress {moduleLoad}
 */

import {punycode} from './nassh_deps.rollup.js';

/**
 * The NaCl-ssh-powered terminal command.
 *
 * This class defines a command that can be run in an hterm.Terminal instance.
 * This command creates an instance of the NaCl-ssh plugin and uses it to
 * communicate with an ssh daemon.
 *
 * If you want to use something other than this NaCl plugin to connect to a
 * remote host (like a shellinaboxd, etc), you'll want to create a brand new
 * command.
 *
 * @param {!Object} argv The argument object passed in from the Terminal.
 * @constructor
 */
nassh.CommandInstance = function(argv) {
  // Command arguments.
  this.argv_ = argv;

  // Command environment.
  this.environment_ = argv.environment || {};

  // hterm.Terminal.IO instance (can accept another hterm.Terminal.IO instance).
  this.io = argv.terminalIO || null;

  // Relay manager.
  this.relay_ = null;

  // Parsed extension manifest.
  this.manifest_ = null;

  // The HTML5 persistent FileSystem instance for this extension.
  this.fileSystem_ = null;

  // A set of open streams for this instance.
  this.streams_ = new nassh.StreamSet();

  // The version of the ssh client to load.
  this.sshClientVersion_ = 'pnacl';

  // Application ID of auth agent.
  this.authAgentAppID_ = null;

  // Internal SSH agent.
  this.authAgent_ = null;

  // Whether the instance is a SFTP instance.
  this.isSftp = argv.isSftp || false;

  // SFTP Client for SFTP instances.
  this.sftpClient = (this.isSftp) ? new nassh.sftp.Client(argv.basePath) : null;

  // Whether we're setting up the connection for mounting.
  this.isMount = argv.isMount || false;

  // Mount options for a SFTP instance.
  this.mountOptions = argv.mountOptions || null;

  // Session storage (can accept another hterm tab's sessionStorage).
  this.storage = argv.terminalStorage || window.sessionStorage;

  // Terminal Location reference (can accept another hterm tab's location).
  this.terminalLocation = argv.terminalLocation || document.location;

  // Terminal Window reference (can accept another hterm tab's window).
  this.terminalWindow = argv.terminalWindow || window;

  /**
   * @type {?string} The current connection profile.
   */
  this.profileId_ = null;

  // Root preference managers.
  this.prefs_ = new nassh.PreferenceManager();
  this.localPrefs_ = new nassh.LocalPreferenceManager();

  // Prevent us from reporting an exit twice.
  this.exited_ = false;

  // Buffer for data coming from the terminal.
  this.inputBuffer_ = new nassh.InputBuffer();
};

/**
 * The name of this command used in messages to the user.
 *
 * Perhaps this will also be used by the user to invoke this command if we
 * build a command line shell.
 */
nassh.CommandInstance.prototype.commandName = 'nassh';

/**
 * Static run method invoked by the terminal.
 *
 * @param {!Object} argv
 * @return {!nassh.CommandInstance}
 */
nassh.CommandInstance.run = function(argv) {
  return new nassh.CommandInstance(argv);
};

/**
 * When the command exit is from nassh instead of ssh_client.  The ssh module
 * can only ever exit with positive values, so negative values are reserved.
 */
nassh.CommandInstance.EXIT_INTERNAL_ERROR = -1;

/**
 * Start the nassh command.
 *
 * Instance run method invoked by the nassh.CommandInstance ctor.
 */
nassh.CommandInstance.prototype.run = function() {
  // Useful for console debugging.
  window.nassh_ = this;

  this.io = this.argv_.io.push();

  // Similar to lib.fs.err, except this logs to the terminal too.
  const ferr = (msg) => {
    return (err, ...args) => {
      console.error(`${msg}: ${args.join(', ')}`);

      this.io.println(nassh.msg('UNEXPECTED_ERROR'));
      this.io.println(err);
    };
  };

  this.prefs_.readStorage(() => {
    this.manifest_ = chrome.runtime.getManifest();

    // Set default window title.
    this.io.print('\x1b]0;' + this.manifest_.name + ' ' +
                    this.manifest_.version + '\x07');

    showWelcome();

    nassh.getFileSystem()
      .then(onFileSystemFound)
      .catch(ferr('FileSystem init failed'));

    this.localPrefs_.readStorage(() => {
      this.localPrefs_.syncProfiles(this.prefs_);
      const updater = this.updateWindowDimensions_.bind(this);
      window.addEventListener('resize', updater);
      // Window doesn't offer a 'move' event, and blur/resize don't seem to
      // work.  Listening for mouseout should be low enough overhead.
      window.addEventListener('mouseout', updater);
    });
  });

  const showWelcome = () => {
    const style = {bold: true};

    this.io.println(nassh.msg(
        'WELCOME_VERSION',
        [nassh.sgrText(this.manifest_.name, style),
         nassh.sgrText(this.manifest_.version, style)]));

    this.io.println(nassh.msg(
        'WELCOME_FAQ',
        [nassh.sgrText('https://goo.gl/muppJj', style)]));

    if (hterm.windowType != 'popup' && hterm.os != 'mac') {
      this.io.println('');
      this.io.println(nassh.msg(
          'OPEN_AS_WINDOW_TIP',
          [nassh.sgrText('https://goo.gl/muppJj', style)]));
      this.io.println('');
    }

    // Show some release highlights the first couple of runs with a new version.
    // We'll reset the counter when the release notes change.
    this.io.println(nassh.msg(
        'WELCOME_CHANGELOG',
        [nassh.sgrText(nassh.osc8Link('/html/changelog.html'), style)]));
    const notes = lib.resource.getData('nassh/release/highlights');
    if (this.prefs_.getNumber('welcome/notes-version') != notes.length) {
      // They upgraded, so reset the counters.
      this.prefs_.set('welcome/show-count', 0);
      this.prefs_.set('welcome/notes-version', notes.length);
    }
    // Figure out how many times we've shown this.
    const notesShowCount = this.prefs_.getNumber('welcome/show-count');
    if (notesShowCount < 10) {
      // For new runs, show the highlights directly.
      this.io.print(nassh.msg('WELCOME_RELEASE_HIGHLIGHTS',
                              [lib.resource.getData('nassh/release/lastver')]));
      this.io.println(notes.replace(/%/g, '\r\n \u00A4'));
      this.prefs_.set('welcome/show-count', notesShowCount + 1);
    }

    // Display a random tip every time they launch to advertise features.
    const num = lib.f.randomInt(1, 14);
    this.io.println('');
    this.io.println(nassh.msg('WELCOME_TIP_OF_DAY',
                              [num, nassh.msg(`TIP_${num}`)]));
    this.io.println('');

    if (this.manifest_.name.match(/\((dev|tot)\)/)) {
      // If we're a development version, show hterm details.
      const htermDate = lib.resource.getData('hterm/concat/date');
      const htermVer = lib.resource.getData('hterm/changelog/version');
      const htermRev = lib.resource.getData('hterm/git/HEAD');
      const htermAgeMinutes =
          Math.round((new Date().getTime() - new Date(htermDate).getTime()) /
                     1000 / 60);

      this.io.println(`[dev] hterm v${htermVer} (git ${htermRev})`);
      this.io.println(`[dev] built on ${htermDate} ` +
                      `(${htermAgeMinutes} minutes ago)`);
    }
  };

  const onFileSystemFound = (fileSystem) => {
    this.fileSystem_ = fileSystem;

    const argstr = this.argv_.args.join(' ');

    // This item is set before we redirect away to login to a relay server.
    // If it's set now, it's the first time we're reloading after the redirect.
    const pendingRelay = this.storage.getItem('nassh.pendingRelay');
    this.storage.removeItem('nassh.pendingRelay');

    if (!argstr || (this.storage.getItem('nassh.promptOnReload') &&
                    !pendingRelay)) {
      // If promptOnReload is set or we haven't gotten the destination
      // as an argument then we need to ask the user for the destination.
      //
      // The promptOnReload session item allows us to remember that we've
      // displayed the dialog, so we can re-display it if the user reloads
      // the page.  (Items in sessionStorage are scoped to the tab, kept
      // between page reloads, and discarded when the tab goes away.)
      this.storage.setItem('nassh.promptOnReload', 'yes');

      this.promptForDestination_();
    } else {
      const params = new URLSearchParams(this.terminalLocation.search);
      // An undocumented hack for extension popup to force a one-off connection.
      if (params.get('promptOnReload') == 'yes') {
        this.storage.setItem('nassh.promptOnReload', 'yes');
      }

      this.connectToArgString(argstr);
    }
  };
};

/**
 * Reconnects to host, using the same CommandInstance.
 *
 * @param {string} argstr The connection ArgString.
 */
nassh.CommandInstance.prototype.reconnect = function(argstr) {
  // Terminal reset.
  this.io.print('\x1b[!p');

  this.io = this.argv_.io.push();

  this.removePlugin_();

  this.stdoutAcknowledgeCount_ = 0;
  this.stderrAcknowledgeCount_ = 0;

  this.exited_ = false;

  this.connectToArgString(argstr);
};

/**
 * Event for when the window dimensions change.
 */
nassh.CommandInstance.prototype.updateWindowDimensions_ = function() {
  if (!this.profileId_) {
    // We haven't connected yet, so nothing to save.
    return;
  }

  // The web platform doesn't provide a way to check the window state, so use
  // Chrome APIs directly for that.
  chrome.windows.getCurrent((win) => {
    // Ignore minimized state completely.
    if (win.state === 'minimized') {
      return;
    }

    const profile = this.localPrefs_.getProfile(lib.notNull(this.profileId_));
    profile.set('win/state', win.state);

    // Only record dimensions when we're not fullscreen/maximized.  This allows
    // the position/size to be remembered independent of temporarily going to
    // the max screen dimensions.
    if (win.state === 'normal') {
      profile.set('win/top', window.screenTop);
      profile.set('win/left', window.screenLeft);
      profile.set('win/height', window.outerHeight);
      profile.set('win/width', window.outerWidth);
    }
  });
};

/** Prompt for destination */
nassh.CommandInstance.prototype.promptForDestination_ = function() {
  const connectDialog = this.io.createFrame(
      lib.f.getURL('/html/nassh_connect_dialog.html'), null);

  connectDialog.onMessage = (event) => {
    event.data.argv.unshift(connectDialog);
    this.dispatchMessage_('connect-dialog', this.onConnectDialog_, event.data);
  };

  // Resize the connection dialog iframe to try and fit all the content,
  // but not more.  This way we don't end up with a lot of empty space.
  function resize() {
    const body = this.iframe_.contentWindow.document.body;
    const shortcutList = body.querySelector('#shortcut-list');
    const dialogBillboard = body.querySelector('.dialog-billboard');
    const dialogButtons = body.querySelector('.dialog-buttons');

    this.container_.style.height = '0px';
    let height = shortcutList.scrollHeight +
                 dialogBillboard.scrollHeight +
                 dialogButtons.scrollHeight;
    // Since the document has a bit of border/padding, fudge the height
    // slightly higher than the few main elements we calculated above.
    height *= 1.15;

    // We don't have to worry about this being too big or too small as the
    // frame CSS has set min/max height attributes.
    this.container_.style.height = height + 'px';
  }

  // Once the dialog has finished loading all of its data, resize it.
  connectDialog.onLoad = function() {
    // Shift the dialog to be relative to the bottom so the notices/links we
    // show at the top of the are more readily visible.
    this.container_.style.top = '';
    this.container_.style.bottom = '10%';

    const resize_ = resize.bind(this);
    resize_();
    window.addEventListener('resize', resize_);
    this.onClose = () => {
      window.removeEventListener('resize', resize_);
    };
  };

  // Clear retry count whenever we show the dialog.
  window.sessionStorage.removeItem('googleRelay.redirectCount');

  connectDialog.show();
};

/** @param {string} argstr */
nassh.CommandInstance.prototype.connectToArgString = function(argstr) {
  const isMount = (this.storage.getItem('nassh.isMount') == 'true');
  const isSftp = (this.storage.getItem('nassh.isSftp') == 'true');
  this.storage.removeItem('nassh.isMount');
  this.storage.removeItem('nassh.isSftp');

  // Handle profile-id:XXX forms.  These are bookmarkable.
  const ary = argstr.match(/^profile-id:([a-z0-9]+)(\?.*)?/i);
  if (ary) {
    if (isMount) {
      this.mountProfile(ary[1]);
    } else if (isSftp) {
      this.sftpConnectToProfile(ary[1]);
    } else {
      this.connectToProfile(ary[1]);
    }
  } else {
    if (isMount) {
      this.mountDestination(argstr);
    } else if (isSftp) {
      this.sftpConnectToDestination(argstr);
    } else {
      this.connectToDestination(argstr);
    }
  }
};

/**
 * Common phases that we run before making an actual connection.
 *
 * @param {string} profileID Terminal preference profile name.
 * @param {function(!nassh.PreferenceManager)} callback Callback when the prefs
 *     have finished loading.
 */
nassh.CommandInstance.prototype.commonProfileSetup_ = function(
    profileID, callback) {

  const onReadStorage = () => {
    let prefs;
    try {
      prefs = this.prefs_.getProfile(profileID);
    } catch (e) {
      this.io.println(nassh.msg('GET_PROFILE_ERROR', [profileID, e]));
      this.exit(nassh.CommandInstance.EXIT_INTERNAL_ERROR, true);
      return;
    }

    this.profileId_ = profileID;
    document.querySelector('#terminal').focus();

    this.terminalLocation.hash = 'profile-id:' + profileID;
    document.title = prefs.get('description') + ' - ' +
      this.manifest_.name + ' ' + this.manifest_.version;

    callback(prefs);
  };

  // Re-read prefs from storage in case they were just changed in the connect
  // dialog.
  this.prefs_.readStorage(onReadStorage);
};

/**
 * Turn a prefs object into the params object connectTo expects.
 *
 * @param {!Object} prefs
 * @return {!Object}
 */
nassh.CommandInstance.prototype.prefsToConnectParams_ = function(prefs) {
  return {
    username: prefs.get('username'),
    hostname: prefs.get('hostname'),
    port: prefs.get('port'),
    nasshOptions: prefs.get('nassh-options'),
    identity: prefs.get('identity'),
    argstr: prefs.get('argstr'),
    terminalProfile: prefs.get('terminal-profile'),
  };
};

/**
 * Mount a remote host given a profile id. Creates a new SFTP CommandInstance
 * that runs in the background page.
 *
 * @param {string} profileID Terminal preference profile name.
 */
nassh.CommandInstance.prototype.mountProfile = function(profileID) {
  const onBackgroundPage = (bg, prefs) => {
    if (bg.nassh.sftp.fsp.sftpInstances[prefs.id]) {
      this.io.println(nassh.msg('ALREADY_MOUNTED_MESSAGE'));
      this.exit(nassh.CommandInstance.EXIT_INTERNAL_ERROR, true);
      return;
    }

    const args = {
      argv: {
        terminalIO: this.io,
        terminalStorage: this.storage,
        terminalLocation: this.terminalLocation,
        terminalWindow: this.terminalWindow,
        isSftp: true,
        basePath: prefs.get('mount-path'),
        isMount: true,
        // Mount options are passed directly to chrome.fileSystemProvider.mount,
        // so don't add fields here that would otherwise collide.
        mountOptions: {
          fileSystemId: prefs.id,
          displayName: prefs.get('description'),
          writable: true,
        },
      },
      connectOptions: this.prefsToConnectParams_(prefs),
    };

    bg.nassh.sftp.fsp.createSftpInstance(args);
  };

  const onStartup = (prefs) => {
    nassh.getBackgroundPage()
      .then((bg) => onBackgroundPage(bg, prefs));
  };

  this.commonProfileSetup_(profileID, onStartup);
};

/**
 * Creates a new SFTP CommandInstance that runs in the background page.
 *
 * @param {string} profileID Terminal preference profile name.
 */
nassh.CommandInstance.prototype.sftpConnectToProfile = function(profileID) {
  const onStartup = (prefs) => {
    this.isSftp = true;
    this.sftpClient = new nassh.sftp.Client();

    this.connectTo(this.prefsToConnectParams_(prefs));
  };

  this.commonProfileSetup_(profileID, onStartup);
};

/**
 * Initiate a connection to a remote host given a profile id.
 *
 * @param {string} profileID Terminal preference profile name.
 */
nassh.CommandInstance.prototype.connectToProfile = function(profileID) {
  const onStartup = (prefs) => {
    this.connectTo(this.prefsToConnectParams_(prefs));
  };

  this.commonProfileSetup_(profileID, onStartup);
};

/**
 * Parse ssh:// URIs.
 *
 * This supports the IANA spec:
 *   https://www.iana.org/assignments/uri-schemes/prov/ssh
 *   ssh://[<user>[;fingerprint=<hash>]@]<host>[:<port>]
 *
 * It also supports Secure Shell extensions to the protocol:
 *   ssh://[<user>@]<host>[:<port>][@<relay-host>[:<relay-port>]]
 *
 * Note: We don't do IPv4/IPv6/hostname validation.  That's a DNS/connectivity
 * problem and user error.
 *
 * @param {string} uri The URI to parse.
 * @param {boolean=} stripSchema Whether to strip off ssh:// at the start.
 * @param {boolean=} decodeComponents Whether to unescape percent encodings.
 * @return {?Object} Returns null if we couldn't parse the destination.
 *     An object if we were able to parse out the connect settings.
 */
nassh.CommandInstance.parseURI = function(uri, stripSchema = true,
                                          decodeComponents = false) {
  if (stripSchema && uri.startsWith('ssh:')) {
    // Strip off the "ssh:" prefix.
    uri = uri.substr(4);
    // Strip off the "//" if it exists.
    if (uri.startsWith('//')) {
      uri = uri.substr(2);
    }
  }

  /* eslint-disable max-len,spaced-comment */
  // Parse the connection string.
  const ary = uri.match(
      //|user |@| [  ipv6       %zoneid   ]|  host  |   :port     |@| [  ipv6       %zoneid   ]| relay |   :relay port |
      /^([^@]+)@(\[[:0-9a-f]+(?:%[^\]]+)?\]|[^\s:@]+)(?::(\d+))?(?:@(\[[:0-9a-f]+(?:%[^\]]+)?\]|[^\s:]+)(?::(\d+))?)?$/);
  /* eslint-enable max-len,spaced-comment */

  if (!ary) {
    return null;
  }

  const params = {};
  let username = ary[1];
  let hostname = ary[2];
  const port = ary[3];

  // If it's IPv6, remove the brackets.
  if (hostname.startsWith('[') && hostname.endsWith(']')) {
    hostname = hostname.substr(1, hostname.length - 2);
  }

  // If the hostname starts with bad chars, reject it.  We use these internally,
  // so don't want external links to access them too.  We probably should filter
  // out more of the ASCII space.
  if (hostname.startsWith('>') || hostname.startsWith('-')) {
    return null;
  }

  let relayHostname, relayPort;
  if (ary[4]) {
    relayHostname = ary[4];
    // If it's IPv6, remove the brackets.
    if (relayHostname.startsWith('[') && relayHostname.endsWith(']')) {
      relayHostname = relayHostname.substr(1, relayHostname.length - 2);
    }
    if (relayHostname.startsWith('-')) {
      return null;
    }
    if (ary[5]) {
      relayPort = ary[5];
    }
  }

  const decode = (x) => decodeComponents && x ? unescape(x) : x;

  if (username) {
    // See if there are semi-colon delimited options following the username.
    // Arguments should be URI encoding their values.
    const splitParams = username.split(';');
    username = splitParams[0];
    splitParams.slice(1, splitParams.length).forEach((param) => {
      // This will take the first '=' appearing from left to right and take
      // what's on its left as the param's name and what's to its right as its
      // value. For example, if we have '-nassh-args=--proxy-mode=foo' then
      // '-nassh-args' will be the name of the param and
      // '--proxy-mode=foo' will be its value.
      const key = param.split('=', 1)[0];
      const validKeys = new Set([
          'fingerprint', '-nassh-args', '-nassh-ssh-args',
      ]);
      if (validKeys.has(key)) {
        const value = param.substr(key.length + 1);
        if (value) {
          params[key.replace(/^-/, '')] = decode(value);
        }
      } else {
        console.error(`${key} is not a valid parameter so it will be skipped`);
      }
    });
  }

  // We don't decode the hostname or port.  Valid values for both shouldn't
  // need it, and probably could be abused.
  return Object.assign({
    username: decode(username),
    hostname: hostname,
    port: port,
    relayHostname: relayHostname,
    relayPort: relayPort,
    uri: uri,
  }, params);
};

/**
 * Parse the destination string.
 *
 * These are strings that we get from the browser bar.  It's mostly ssh://
 * URIs, but it might have more stuff sprinkled in to smooth communication
 * with various entry points into Secure Shell.
 *
 * @param {string} destination The string to connect to.
 * @return {?Object} Returns null if we couldn't parse the destination.
 *     An object if we were able to parse out the connect settings.
 */
nassh.CommandInstance.parseDestination = function(destination) {
  let stripSchema = false;
  let decodeComponents = false;

  // Deal with ssh:// links.  They are encoded with % hexadecimal sequences.
  // Note: These might be ssh: or ssh://, so have to deal with that.
  if (destination.startsWith('uri:')) {
    // Strip off the "uri:" before decoding it.
    destination = unescape(destination.substr(4));
    if (!destination.startsWith('ssh:')) {
      return null;
    }

    stripSchema = true;
    decodeComponents = true;
  }

  const rv = nassh.CommandInstance.parseURI(destination, stripSchema,
                                            decodeComponents);
  if (rv === null) {
    return rv;
  }

  // Turn the relay URI settings into nassh command line options.
  let nasshOptions;
  if (rv.relayHostname !== undefined) {
    nasshOptions = '--proxy-host=' + rv.relayHostname;
    if (rv.relayPort !== undefined) {
      nasshOptions += ' --proxy-port=' + rv.relayPort;
    }
  }
  rv.nasshOptions = nasshOptions;

  rv.nasshUserOptions = rv['nassh-args'];
  rv.nasshUserSshOptions = rv['nassh-ssh-args'];

  // If the fingerprint is set, maybe add it to the known keys list.

  return rv;
};

/**
 * Initiate a connection to a remote host given a destination string.
 *
 * @param {string} destination A string of the form username@host[:port].
 */
nassh.CommandInstance.prototype.connectToDestination = function(destination) {
  if (destination == 'crosh') {
    this.terminalLocation.href = 'crosh.html';
    return;
  }

  const rv = nassh.CommandInstance.parseDestination(destination);
  if (rv === null) {
    this.io.println(nassh.msg('BAD_DESTINATION', [destination]));
    this.exit(nassh.CommandInstance.EXIT_INTERNAL_ERROR, true);
    return;
  }

  // We have to set the url here rather than in connectToArgString, because
  // some callers may come directly to connectToDestination.
  this.terminalLocation.hash = destination;

  this.connectTo(rv);
};

/**
 * Mount a remote host given a destination string.
 *
 * @param {string} destination A string of the form username@host[:port].
 */
nassh.CommandInstance.prototype.mountDestination = function(destination) {
  const rv = nassh.CommandInstance.parseDestination(destination);
  if (rv === null) {
    this.io.println(nassh.msg('BAD_DESTINATION', [destination]));
    this.exit(nassh.CommandInstance.EXIT_INTERNAL_ERROR, true);
    return;
  }

  // We have to set the url here rather than in connectToArgString, because
  // some callers may come directly to connectToDestination.
  this.terminalLocation.hash = destination;

  const args = {
    argv: {
      terminalIO: this.io,
      terminalStorage: this.storage,
      terminalLocation: this.terminalLocation,
      terminalWindow: this.terminalWindow,
      isSftp: true,
      isMount: true,
      // Mount options are passed directly to chrome.fileSystemProvider.mount,
      // so don't add fields here that would otherwise collide.
      mountOptions: {
        fileSystemId: rv.username + rv.hostname,
        displayName: rv.username + rv.hostname,
        writable: true,
      },
    },
    connectOptions: rv,
  };

  nassh.getBackgroundPage()
    .then((bg) => bg.nassh.sftp.fsp.createSftpInstance(args));
};

/**
 * Split the ssh command line string up into its components.
 *
 * We currently only support simple quoting -- no nested or escaped.
 * That would require a proper lexer in here and not utilize regex.
 * See https://crbug.com/725625 for details.
 *
 * @param {string} argstr The full ssh command line.
 * @return {!Object} The various components.
 */
nassh.CommandInstance.splitCommandLine = function(argstr) {
  let args = argstr || '';
  let command = '';

  // Tokenize the string first.
  let i;
  let ary = args.match(/("[^"]*"|\S+)/g);
  if (ary) {
    // If there is a -- separator in here, we split that off and leave the
    // command line untouched (other than normalizing of whitespace between
    // any arguments, and unused leading/trailing whitespace).
    i = ary.indexOf('--');
    if (i != -1) {
      command = ary.splice(i + 1).join(' ').trim();
      // Remove the -- delimiter.
      ary.pop();
    }

    // Now we have to dequote the remaining arguments.  The regex above did:
    // '-o "foo bar"' -> ['-o', '"foo bar"']
    // Based on our (simple) rules, there shouldn't be any other quotes.
    ary = ary.map((x) => x.replace(/(^"|"$)/g, ''));
  } else {
    // Strip out any whitespace.  There shouldn't be anything left that the
    // regex wouldn't have matched, but let's be paranoid.
    args = args.trim();
    if (args) {
      ary = [args];
    } else {
      ary = [];
    }
  }

  return {
    args: ary,
    command: command,
  };
};

/**
 * Initiate a SFTP connection to a remote host.
 *
 * @param {string} destination A string of the form username@host[:port].
 */
nassh.CommandInstance.prototype.sftpConnectToDestination = function(
    destination) {
  const rv = nassh.CommandInstance.parseDestination(destination);
  if (rv === null) {
    this.io.println(nassh.msg('BAD_DESTINATION', [destination]));
    this.exit(nassh.CommandInstance.EXIT_INTERNAL_ERROR, true);
    return;
  }

  // We have to set the url here rather than in connectToArgString, because
  // some callers may come directly to connectToDestination.
  this.terminalLocation.hash = destination;

  const args = {
    argv: {
      terminalIO: this.io,
      terminalStorage: this.storage,
      terminalLocation: this.terminalLocation,
      terminalWindow: this.terminalWindow,
      isSftp: true,
    },
    connectOptions: rv,
  };

  nassh.getBackgroundPage()
    .then((bg) => bg.nassh.sftp.fsp.createSftpInstance(args));
};

/**
 * Initiate an asynchronous connection to a remote host.
 *
 * @param {!Object} params The various connection settings setup via the
 *    prefsToConnectParams_ helper.
 */
nassh.CommandInstance.prototype.connectTo = function(params) {
  if (!(params.username && params.hostname)) {
    this.io.println(nassh.msg('MISSING_PARAM', ['username/hostname']));
    this.exit(nassh.CommandInstance.EXIT_INTERNAL_ERROR, true);
    return;
  }

  if (params.hostname == '>crosh') {
    // TODO: This should be done better.
    const template = 'crosh.html?profile=%encodeURIComponent(terminalProfile)';
    this.terminalLocation.href = lib.f.replaceVars(template, params);
    return;
  }

  // First tokenize the options into an object we can work with more easily.
  let options = {};
  try {
    options = nassh.CommandInstance.tokenizeOptions(params.nasshOptions);
  } catch (e) {
    this.io.println(nassh.msg('NASSH_OPTIONS_ERROR', [e]));
    this.exit(nassh.CommandInstance.EXIT_INTERNAL_ERROR, true);
    return;
  }

  let userOptions = {};
  try {
    userOptions = nassh.CommandInstance.tokenizeOptions(
        params.nasshUserOptions);
  } catch (e) {
    this.io.println(nassh.msg('NASSH_OPTIONS_ERROR', [e]));
    this.exit(nassh.CommandInstance.EXIT_INTERNAL_ERROR, true);
    return;
  }

  // Merge nassh options from the ssh:// URI that we believe are safe.
  const safeNasshOptions = new Set([
    '--config', '--proxy-mode', '--proxy-host', '--proxy-port', '--proxy-user',
    '--ssh-agent', '--welcome',
  ]);
  Object.keys(userOptions).forEach((option) => {
    if (safeNasshOptions.has(option)) {
      options[option] = userOptions[option];
    } else {
      console.warn(`Option ${option} not currently supported`);
    }
  });

  // Finally post process the combined result.
  options = nassh.CommandInstance.postProcessOptions(
      options, params.hostname, params.username);

  // Merge ssh options from the ssh:// URI that we believe are safe.
  params.userSshArgs = [];
  const userSshOptionsList = nassh.CommandInstance.splitCommandLine(
      params.nasshUserSshOptions).args;
  const safeSshOptions = new Set([
    '-4', '-6', '-a', '-A', '-C', '-q', '-Q', '-v', '-V',
  ]);
  userSshOptionsList.forEach((option) => {
    if (safeSshOptions.has(option)) {
      params.userSshArgs.push(option);
    } else {
      console.warn(`Option ${option} not currently supported`);
    }
  });
  if (userSshOptionsList.command) {
    console.warn(`Remote command '${userSshOptionsList.command}' not ` +
                 `currently supported`);
  }

  if (options['--welcome'] === false) {
    // Clear terminal display area.
    this.io.terminal_.clearHome();
  }

  if (options['--field-trial-buffer']) {
    nassh.buffer.backend = options['--field-trial-buffer'];
  }

  // Start driving non-CrOS people to the extension variant.
  // We do this only for newer versions so we don't flag users on EOL devices
  // who can't migrate to the extension.
  if (this.manifest_ && this.manifest_.app &&
      (hterm.os != 'cros' || lib.f.getChromeMilestone() >= 90)) {
    const extUrl = 'https://chrome.google.com/webstore/detail/' +
        'iodihamcpbpeioajjeobimgagajmlibd';
    const docUrl = 'https://chromium.googlesource.com/apps/libapps/+/HEAD/' +
        'nassh/doc/app-to-ext-migration.md';

    // Display in the terminal as red+bold+blink text.
    this.io.println('');
    this.io.println(nassh.sgrText(
        nassh.msg('MIGRATE_TO_EXT', [
          nassh.osc8Link(extUrl, 'link'),
          nassh.osc8Link(docUrl, 'link'),
        ]), {bold: true, blink: true, underline: '3', bg: '41', fg: '37'}));
    this.io.println('');

    // Display a popup a few times.
    const showCount = this.localPrefs_.getNumber('migrate/showCount');
    if (showCount < 5) {
      const div = document.createElement('div');
      div.style.whiteSpace = 'pre-wrap';
      div.innerHTML = nassh.msg('MIGRATE_TO_EXT', [
        `<a href="${extUrl}" target=_blank>link</a>`,
        `<a href="${docUrl}" target=_blank>link</a>`,
      ]);
      this.io.showOverlay(div, 10000);
      this.localPrefs_.set('migrate/showCount', showCount + 1);
    }
  }

  // If the user has requested a proxy relay, load it up.
  if (!options['--proxy-host']) {
    // Do nothing when disabled.  We check this first to avoid excessive
    // indentation or redundant checking of the proxy-host setting below.
  } else if (options['--proxy-mode'] == 'ssh-fe@google.com') {
    this.relay_ = new nassh.relay.Sshfe(this.io, options);
    this.io.println(nassh.msg(
        'FOUND_RELAY',
        [`${this.relay_.proxyHost}:${this.relay_.proxyPort}`]));
    this.relay_.init();
  } else if (options['--proxy-mode'] == 'corp-relay@google.com' ||
             options['--proxy-mode'] == 'corp-relay-v4@google.com') {
    if (options['--proxy-mode'] == 'corp-relay@google.com') {
      this.relay_ = new nassh.relay.Corp(this.io, options,
                                          this.terminalLocation,
                                          this.storage);
    } else {
      this.relay_ = new nassh.relay.Corpv4(this.io, options,
                                           this.terminalLocation,
                                           this.storage);
    }

    this.io.println(nassh.msg(
        'INITIALIZING_RELAY',
        [this.relay_.proxyHost + ':' + this.relay_.proxyPort]));

    if (!this.relay_.init()) {
      // A false return value means we have to redirect to complete
      // initialization.  Bail out of the connect for now.  We'll resume it
      // when the relay is done with its redirect.

      // If we're going to have to redirect for the relay then we should make
      // sure not to re-prompt for the destination when we return.
      this.storage.setItem('nassh.pendingRelay', 'yes');

      // If we're trying to mount the connection, remember it.
      this.storage.setItem('nassh.isMount', this.isMount);
      this.storage.setItem('nassh.isSftp', this.isSftp);

      if (!this.relay_.redirect()) {
        this.exit(nassh.CommandInstance.EXIT_INTERNAL_ERROR, true);
      }
      return;
    }
  } else if (options['--proxy-mode']) {
    // Unknown proxy mode.
    this.io.println(nassh.msg('NASSH_OPTIONS_ERROR',
                              [`--proxy-mode=${options['--proxy-mode']}`]));
    this.exit(nassh.CommandInstance.EXIT_INTERNAL_ERROR, true);
    return;
  }

  this.connectToFinalize_(params, options);
};

/**
 * Finish the connection setup.
 *
 * This is called after any relay setup is completed.
 *
 * @param {!Object} params The various connection settings setup via the
 *    prefsToConnectParams_ helper.
 * @param {!Object} options The nassh specific options.
 */
nassh.CommandInstance.prototype.connectToFinalize_ = function(params, options) {
  // Make sure the selected ssh-client version is somewhat valid.
  if (options['--ssh-client-version']) {
    this.sshClientVersion_ = options['--ssh-client-version'];
  }
  if (!this.sshClientVersion_.match(/^[a-zA-Z0-9.-]+$/)) {
    this.io.println(nassh.msg('UNKNOWN_SSH_CLIENT_VERSION',
                              [this.sshClientVersion_]));
    this.exit(127, true);
    return;
  }

  if (options['--ssh-agent']) {
    params.authAgentAppID = options['--ssh-agent'];
  }

  this.io.setTerminalProfile(params.terminalProfile || 'default');

  // If they're using an internationalized domain name (IDN), then punycode
  // will return a different ASCII name.  Include that in the display for the
  // user so it's clear where we end up trying to connect to.
  const idn_hostname = punycode.toASCII(params.hostname);
  let disp_hostname = params.hostname;
  if (idn_hostname != params.hostname) {
    disp_hostname += ' (' + idn_hostname + ')';
  }

  this.io.onVTKeystroke = this.onVTKeystroke_.bind(this);
  this.io.sendString = this.sendString_.bind(this);
  this.io.onTerminalResize = this.onTerminalResize_.bind(this);

  const argv = {};
  argv.terminalWidth = this.io.terminal_.screenSize.width;
  argv.terminalHeight = this.io.terminal_.screenSize.height;
  argv.useJsSocket = !!this.relay_;
  argv.environment = this.environment_;
  argv.writeWindow = 8 * 1024;

  if (this.isSftp) {
    argv.subsystem = 'sftp';
  }

  argv.arguments = [];

  if (params.authAgentAppID) {
    argv.authAgentAppID = params.authAgentAppID;
    if (options['auth-agent-forward']) {
      argv.arguments.push('-A');
    }
  }

  // Automatically send any env vars the user has set.  This does not guarantee
  // the remote side will accept it, but we can always hope.
  Array.prototype.push.apply(
      argv.arguments,
      Object.keys(argv.environment).map((x) => `-oSendEnv=${x}`));

  // Disable IP address check for connection through proxy.
  if (argv.useJsSocket) {
    argv.arguments.push('-o CheckHostIP=no');
  }

  if (params.identity) {
    // Load legacy/filtered keys from /.ssh/.
    // TODO: Delete this at some point after Aug 2019.  Jan 2021 should be long
    // enough for users to migrate.
    argv.arguments.push(`-i/.ssh/${params.identity}`);

    argv.arguments.push(`-i/.ssh/identity/${params.identity}`);
  }
  if (params.port) {
    argv.arguments.push('-p' + params.port);
  }

  // We split the username apart so people can use whatever random characters in
  // it they want w/out causing parsing troubles ("@" or leading "-" or " ").
  argv.arguments.push('-l' + params.username);
  argv.arguments.push(idn_hostname);

  // Finally, we append the custom command line the user has constructed.
  // This matches native `ssh` behavior and makes our lives simpler.
  const extraArgs = nassh.CommandInstance.splitCommandLine(params.argstr);
  if (extraArgs.args) {
    argv.arguments = argv.arguments.concat(extraArgs.args);
  }
  argv.arguments = argv.arguments.concat(params.userSshArgs);
  if (extraArgs.command) {
    argv.arguments.push('--', extraArgs.command);
  }

  this.authAgentAppID_ = params.authAgentAppID;
  // If the agent app ID is not just an app ID, we parse it for the IDs of
  // built-in agent backends based on nassh.agent.Backend.
  if (this.authAgentAppID_ && !/^[a-z]{32}$/.test(this.authAgentAppID_)) {
    const backendIDs = this.authAgentAppID_.split(',');
    // Process the cmdline to see whether -a or -A comes last.
    const enableForward = argv.arguments.lastIndexOf('-A');
    const disableForward = argv.arguments.lastIndexOf('-a');
    const forwardAgent = enableForward > disableForward;
    this.authAgent_ = new nassh.agent.Agent(
        backendIDs, this.io.terminal_, forwardAgent);
  }

  this.initPlugin_(() => {
    this.terminalWindow.addEventListener('beforeunload', this.onBeforeUnload_);

    this.io.println(nassh.msg('CONNECTING',
                              [`${params.username}@${disp_hostname}`]));

    this.sendToPlugin_('startSession', [argv]);
    if (this.isSftp) {
      this.sftpClient.initConnection(this.plugin_);
      this.sftpClient.onInit = this.onSftpInitialised.bind(this);
    }
  });
};

/**
 * Turn the nassh option string into an object.
 *
 * @param {string=} optionString The set of --long options to parse.
 * @return {!Object} A map of --option to its value.
 */
nassh.CommandInstance.tokenizeOptions = function(optionString = '') {
  const rv = {};

  // If it's empty, return right away else the regex split below will create
  // [''] which causes the parser to fail.
  optionString = optionString.trim();
  if (!optionString) {
    return rv;
  }

  const optionList = optionString.split(/\s+/g);
  for (let i = 0; i < optionList.length; ++i) {
    // Make sure it's a long option first.
    const option = optionList[i];
    if (!option.startsWith('--')) {
      throw Error(option);
    }

    // Split apart the option if there is an = in it.
    let flag, value;
    const pos = option.indexOf('=');
    if (pos == -1) {
      // If there is no = then it's a boolean flag (which --no- disables).
      value = !option.startsWith('--no-');
      flag = option.slice(value ? 2 : 5);
    } else {
      flag = option.slice(2, pos);
      value = option.slice(pos + 1);
    }

    rv[`--${flag}`] = value;
  }

  return rv;
};

/**
 * Expand & process nassh options.
 *
 * @param {!Object<string, *>} options A map of --option to its value.
 * @param {string} hostname The hostname we're connecting to.
 * @param {string} username The ssh username we're using.
 * @return {!Object<string, *>} A map of --option to its value.
 */
nassh.CommandInstance.postProcessOptions = function(
    options, hostname, username) {
  let rv = Object.assign(options);

  // Handle various named "configs" we have.
  if (rv['--config'] == 'google') {
    // This list of agent hosts matches the internal gLinux ssh_config.
    const forwardAgent = [
      '.corp.google.com', '.corp', '.cloud.googlecorp.com', '.c.googlers.com',
    ].reduce((ret, host) => ret || hostname.endsWith(host), false);

    // This list of proxy hosts matches the internal gLinux ssh_config.
    // Hosts in these spaces should go through a different relay.
    const useSupSshRelay = [
      '.c.googlers.com', '.internal.gcpnode.com', '.proxy.gcpnode.com',
    ].reduce((ret, host) => ret || hostname.endsWith(host), false);
    const proxyHost = useSupSshRelay ?
        'sup-ssh-relay.corp.google.com' : 'ssh-relay.corp.google.com';
    const proxyMode = useSupSshRelay ?
        'corp-relay-v4@google.com' : 'corp-relay@google.com';

    rv = Object.assign({
      'auth-agent-forward': forwardAgent,
      '--proxy-host': proxyHost,
      '--proxy-port': '443',
      '--proxy-mode': proxyMode,
      '--use-ssl': true,
      '--report-ack-latency': true,
      '--report-connect-attempts': true,
      '--relay-protocol': 'v2',
      '--ssh-agent': 'gnubby',
    }, rv);

    // Default enable connection resumption when using newer proxy mode.
    rv = Object.assign({
      '--resume-connection': rv['--proxy-mode'] === 'corp-relay-v4@google.com',
    }, rv);
  }

  // If the user specified an IPv6 address w/out brackets, add them.  It's not
  // obvious that a command line parameter would need them like a URI does.  We
  // only use the proxy-host in URI contexts currently, so this is OK.
  if (rv['--proxy-host'] && !rv['--proxy-host'].startsWith('[') &&
      rv['--proxy-host'].indexOf(':') != -1) {
    rv['--proxy-host'] = `[${rv['--proxy-host']}]`;
  }

  // If a proxy server is requested but no mode selected, default to the one
  // we've had for years, and what the public uses currently.
  if (rv['--proxy-host'] && !rv['--proxy-mode']) {
    rv['--proxy-mode'] = 'corp-relay@google.com';
  }

  // Turn 'gnubby' into the default id.  We do it here because we haven't yet
  // ported the gnubbyd logic to the new ssh-agent frameworks.
  if (rv['--ssh-agent'] == 'gnubby') {
    rv['--ssh-agent'] = nassh.goog.gnubby.defaultExtension;
  }

  // Default the relay username to the ssh username.
  if (!rv['--proxy-user']) {
    rv['--proxy-user'] = username;
  }

  return rv;
};

/**
 * Dispatch a "message" to one of a collection of message handlers.
 *
 * @param {string} desc
 * @param {!Object} handlers
 * @param {!Object} msg
 */
nassh.CommandInstance.prototype.dispatchMessage_ = function(
    desc, handlers, msg) {
  if (msg.name in handlers) {
    handlers[msg.name].apply(this, msg.argv);
  } else {
    console.log('Unknown "' + desc + '" message: ' + msg.name);
  }
};

/** @param {function()} onComplete */
nassh.CommandInstance.prototype.initPlugin_ = function(onComplete) {
  const onPluginLoaded = () => {
    this.io.println(nassh.msg('PLUGIN_LOADING_COMPLETE'));
    onComplete();
  };

  this.io.print(nassh.msg('PLUGIN_LOADING'));

  this.plugin_ = window.document.createElement('embed');
  // Height starts at 1px, and is changed to 0 below after inserting into body.
  // This modification to the plugin ensures that the 'load' event fires
  // when it is running in the background page.
  this.plugin_.style.cssText =
      ('position: absolute;' +
       'top: -99px' +
       'width: 0;' +
       'height: 1px;');

  const pluginURL = `../plugin/${this.sshClientVersion_}/ssh_client.nmf`;

  this.plugin_.setAttribute('src', pluginURL);
  this.plugin_.setAttribute('type', 'application/x-nacl');
  this.plugin_.addEventListener('load', onPluginLoaded);
  this.plugin_.addEventListener('message', this.onPluginMessage_.bind(this));

  const errorHandler = (ev) => {
    this.io.println(nassh.msg('PLUGIN_LOADING_FAILED'));
    console.error('loading plugin failed', ev);
    this.exit(nassh.CommandInstance.EXIT_INTERNAL_ERROR, true);
  };
  this.plugin_.addEventListener('crash', errorHandler);
  this.plugin_.addEventListener('error', errorHandler);

  document.body.insertBefore(this.plugin_, document.body.firstChild);
  // Force a relayout. Workaround for load event not being called on <embed>
  // for a NaCl module. https://crbug.com/699930
  this.plugin_.style.height = '0';
};

/**
 * Remove the plugin from the runtime.
 */
nassh.CommandInstance.prototype.removePlugin_ = function() {
  if (this.plugin_) {
    this.plugin_.parentNode.removeChild(this.plugin_);
    this.plugin_ = null;
  }
};

/**
 * Callback when the user types into the terminal.
 *
 * @param {string} data The input from the terminal.
 */
nassh.CommandInstance.prototype.onVTKeystroke_ = function(data) {
  this.inputBuffer_.write(data);
};

/**
 * Helper function to create a TTY stream.
 *
 * @param {number} fd The file descriptor index.
 * @param {boolean} allowRead True if this stream can be read from.
 * @param {boolean} allowWrite True if this stream can be written to.
 * @param {function(boolean, ?string=)} onOpen Callback to call when the
 *     stream is opened.
 * @return {!Object} The newly created stream.
 */
nassh.CommandInstance.prototype.createTtyStream = function(
    fd, allowRead, allowWrite, onOpen) {
  const arg = {
    fd: fd,
    allowRead: allowRead,
    allowWrite: allowWrite,
    inputBuffer: this.inputBuffer_,
    io: this.io,
  };

  const stream = this.streams_.openStream(nassh.Stream.Tty, fd, arg, onOpen);
  if (allowRead) {
    const onDataAvailable = (isAvailable) => {
      // Send current read status to plugin.
      this.sendToPlugin_('onReadReady', [fd, isAvailable]);
    };

    this.inputBuffer_.onDataAvailable.addListener(onDataAvailable);

    stream.onClose = () => {
      this.inputBuffer_.onDataAvailable.removeListener(onDataAvailable);
      this.sendToPlugin_('onClose', [fd]);
    };
  }

  return stream;
};

/**
 * Send a message to the nassh plugin.
 *
 * @param {string} name The name of the message to send.
 * @param {!Array} args The message arguments.
 */
nassh.CommandInstance.prototype.sendToPlugin_ = function(name, args) {
  try {
    this.plugin_.postMessage({name: name, arguments: args});
  } catch (e) {
    // When we tear down the plugin, we sometimes have a tail of pending calls.
    // Rather than try and chase all of those down, swallow errors when the
    // plugin doesn't exist.
    if (!this.exited_) {
      console.error(e);
    }
  }
};

/**
 * Send a string to the remote host.
 *
 * @param {string} string The string to send.
 */
nassh.CommandInstance.prototype.sendString_ = function(string) {
  this.inputBuffer_.write(string);
};

/**
 * Notify plugin about new terminal size.
 *
 * @param {string|number} width The new terminal width.
 * @param {string|number} height The new terminal height.
 */
nassh.CommandInstance.prototype.onTerminalResize_ = function(width, height) {
  this.sendToPlugin_('onResize', [Number(width), Number(height)]);
};

/**
 * Exit the nassh command.
 *
 * @param {number} code Exit code, 0 for success.
 * @param {boolean} noReconnect
 */
nassh.CommandInstance.prototype.exit = function(code, noReconnect) {
  if (this.exited_) {
    return;
  }

  this.exited_ = true;

  this.terminalWindow.removeEventListener('beforeunload', this.onBeforeUnload_);

  // Close all streams upon exit.
  this.streams_.closeAllStreams();

  // Hard destroy the plugin object.  In the past, we'd send onExitAcknowledge
  // to the plugin and let it exit/cleanup itself.  The NaCl runtime seems to
  // be a bit unstable though when using threads, so we can't rely on it.  See
  // https://crbug.com/710252 for more details.
  this.removePlugin_();

  if (this.isMount) {
    if (nassh.sftp.fsp.sftpInstances[this.mountOptions.fileSystemId]) {
      delete nassh.sftp.fsp.sftpInstances[this.mountOptions.fileSystemId];
    }

    console.log(nassh.msg('DISCONNECT_MESSAGE', [code]));
    return;
  } else {
    this.io.println(nassh.msg('DISCONNECT_MESSAGE', [code]));
  }

  if (noReconnect) {
    this.io.println(nassh.msg('CONNECT_OR_EXIT_MESSAGE'));
  } else {
    this.io.println(nassh.msg('RECONNECT_MESSAGE'));
  }

  this.io.onVTKeystroke = (string) => {
    const ch = string.toLowerCase();
    switch (ch) {
      case 'c':
      case '\x12': // ctrl-r
        document.location.hash = '';
        document.location.reload();
        break;

      case 'e':
      case 'x':
      case '\x1b': // ESC
      case '\x17': // ctrl-w
        this.io.pop();
        if (this.argv_.onExit) {
          this.argv_.onExit(code);
        }
        break;

      case 'r':
      case ' ':
      case '\x0d': // enter
        if (!noReconnect) {
          this.reconnect(this.terminalLocation.hash.substr(1));
        }
    }
  };
};

/**
 * Registers with window.onbeforeunload and runs when page is unloading.
 *
 * @param {!Event} e Before unload event.
 * @return {string|undefined} Message to display.
 */
nassh.CommandInstance.prototype.onBeforeUnload_ = function(e) {
  if (hterm.windowType == 'popup') {
    return;
  }

  const msg = nassh.msg('BEFORE_UNLOAD');
  e.returnValue = msg;
  return msg;
};

/**
 * Called when the plugin sends us a message.
 *
 * Plugin messages are JSON strings rather than arbitrary JS values.  They
 * also use "arguments" instead of "argv".  This function translates the
 * plugin message into something dispatchMessage_ can digest.
 *
 * @param {!Object} e
 */
nassh.CommandInstance.prototype.onPluginMessage_ = function(e) {
  // TODO: We should adjust all our callees to avoid this.
  e.data.argv = e.data.arguments;
  this.dispatchMessage_('plugin', this.onPlugin_, e.data);
};

/**
 * Connect dialog message handlers.
 *
 * @suppress {lintChecks} Allow non-primitive prototype property.
 */
nassh.CommandInstance.prototype.onConnectDialog_ = {};

/**
 * Sent from the dialog when the user chooses to mount a profile.
 *
 * @this {nassh.CommandInstance}
 * @param {!hterm.Frame} dialogFrame
 * @param {string} profileID Terminal preference profile name.
 */
nassh.CommandInstance.prototype.onConnectDialog_.mountProfile = function(
    dialogFrame, profileID) {
  dialogFrame.close();

  this.mountProfile(profileID);
};

/**
 * Sent from the dialog when the user chooses to connect to a profile via sftp.
 *
 * @this {nassh.CommandInstance}
 * @param {!hterm.Frame} dialogFrame
 * @param {string} profileID Terminal preference profile name.
 */
nassh.CommandInstance.prototype.onConnectDialog_.sftpConnectToProfile =
    function(dialogFrame, profileID) {
  dialogFrame.close();

  this.sftpConnectToProfile(profileID);
};

/**
 * Sent from the dialog when the user chooses to connect to a profile.
 *
 * @this {nassh.CommandInstance}
 * @param {!hterm.Frame} dialogFrame
 * @param {string} profileID Terminal preference profile name.
 */
nassh.CommandInstance.prototype.onConnectDialog_.connectToProfile = function(
    dialogFrame, profileID) {
  dialogFrame.close();

  this.connectToProfile(profileID);
};

/**
 * Plugin message handlers.
 *
 * @suppress {lintChecks} Allow non-primitive prototype property.
 */
nassh.CommandInstance.prototype.onPlugin_ = {};

/**
 * Log a message from the plugin.
 *
 * @param {string} str Message to log to the console.
 */
nassh.CommandInstance.prototype.onPlugin_.printLog = function(str) {
  console.log('plugin log: ' + str);
};

/**
 * Plugin has exited.
 *
 * @this {nassh.CommandInstance}
 * @param {number} code Exit code, 0 for success.
 */
nassh.CommandInstance.prototype.onPlugin_.exit = function(code) {
  console.log('plugin exit: ' + code);
  this.exit(code, /* noReconnect= */ false);
};

/**
 * Plugin wants to open a file.
 *
 * The plugin leans on JS to provide a persistent filesystem, which we do via
 * the HTML5 Filesystem API.
 *
 * In the future, the plugin may handle its own files.
 *
 * @this {nassh.CommandInstance}
 * @param {number} fd The integer to associate with this request.
 * @param {string} path The path to the file to open.
 * @param {number} mode The mode to open the path.
 */
nassh.CommandInstance.prototype.onPlugin_.openFile = function(fd, path, mode) {
  let isAtty;
  const onOpen = (success) => {
    this.sendToPlugin_('onOpenFile', [fd, success, isAtty]);
  };

  const DEV_STDIN = '/dev/stdin';
  const DEV_STDOUT = '/dev/stdout';
  const DEV_STDERR = '/dev/stderr';

  if (path == '/dev/tty') {
    isAtty = true;
    this.createTtyStream(fd, true, true, onOpen);
  } else if (this.isSftp && path == DEV_STDOUT) {
    isAtty = false;
    const info = {
      client: this.sftpClient,
    };
    this.streams_.openStream(nassh.Stream.Sftp, fd, info, onOpen);
  } else if (path == DEV_STDIN || path == DEV_STDOUT || path == DEV_STDERR) {
    isAtty = !this.isSftp;
    const allowRead = path == DEV_STDIN;
    const allowWrite = path == DEV_STDOUT || path == DEV_STDERR;
    this.createTtyStream(fd, allowRead, allowWrite, onOpen);
  } else {
    this.sendToPlugin_('onOpenFile', [fd, false, false]);
  }
};

/**
 * @this {nassh.CommandInstance}
 * @param {number} fd
 * @param {string} host
 * @param {number} port
 */
nassh.CommandInstance.prototype.onPlugin_.openSocket = function(
    fd, host, port) {
  let stream = null;

  /**
   * @param {boolean} success
   * @param {?string=} error
   */
  const onOpen = (success, error) => {
    if (!success) {
      this.io.println(nassh.msg('STREAM_OPEN_ERROR', ['socket', error]));
    }
    this.sendToPlugin_('onOpenSocket', [fd, success, false]);
  };

  if (port == 0 && host == this.authAgentAppID_) {
    // Request for auth-agent connection.
    if (this.authAgent_) {
      stream = this.streams_.openStream(
          nassh.Stream.SSHAgent, fd, {authAgent: this.authAgent_}, onOpen);
    } else {
      stream = this.streams_.openStream(
          nassh.Stream.SSHAgentRelay, fd,
          {authAgentAppID: this.authAgentAppID_}, onOpen);
    }
  } else {
    // Regular relay connection request.
    if (!this.relay_) {
      onOpen(false, '!this.relay_');
      return;
    }

    stream = this.relay_.openSocket(fd, host, port, this.streams_, onOpen);
  }

  stream.onDataAvailable = (data) => {
    this.sendToPlugin_('onRead', [fd, data]);
  };

  stream.onClose = () => {
    this.sendToPlugin_('onClose', [fd]);
  };
};

/**
 * Plugin wants to write some data to a file descriptor.
 *
 * This is used to write to HTML5 Filesystem files.
 *
 * @this {nassh.CommandInstance}
 * @param {number} fd The file handle to write to.
 * @param {!ArrayBuffer} data The content to write.
 */
nassh.CommandInstance.prototype.onPlugin_.write = function(fd, data) {
  const stream = this.streams_.getStreamByFd(fd);

  if (!stream) {
    console.warn('Attempt to write to unknown fd: ' + fd);
    return;
  }

  stream.asyncWrite(data, (writeCount) => {
    if (!stream.open) {
      // If the stream was closed before we got a chance to ack, then skip it.
      // We don't want to update the state of the plugin in case it re-opens
      // the same fd and we end up acking to a new fd.
      return;
    }

    this.sendToPlugin_('onWriteAcknowledge', [fd, writeCount]);
  });
};

/**
 * SFTP Initialization handler. Mounts the SFTP connection as a file system.
 */
nassh.CommandInstance.prototype.onSftpInitialised = function() {
  if (this.isMount) {
    // Newer versions of Chrome support this API, but olders will error out.
    if (lib.f.getChromeMilestone() >= 64) {
      this.mountOptions['persistent'] = false;
    }

    // Mount file system.
    chrome.fileSystemProvider.mount(this.mountOptions);

    // Add this instance to list of SFTP instances.
    nassh.sftp.fsp.sftpInstances[this.mountOptions.fileSystemId] = {
      sftpClient: lib.notNull(this.sftpClient),
      exit: this.exit.bind(this),
    };

    this.io.showOverlay(nassh.msg('MOUNTED_MESSAGE') + ' '
                        + nassh.msg('CONNECT_OR_EXIT_MESSAGE'), null);

    this.io.onVTKeystroke = (string) => {
      const ch = string.toLowerCase();
      switch (ch) {
        case 'c':
        case '\x12': // ctrl-r
          this.terminalLocation.hash = '';
          this.terminalLocation.reload();
          break;

        case 'e':
        case 'x':
        case '\x1b': // ESC
        case '\x17': // ctrl-w
          this.terminalWindow.close();
      }
    };
  } else {
    // Interactive SFTP client case.
    this.sftpCli_ = new nasftp.Cli(this);

    // Useful for console debugging.
    this.terminalWindow.nasftp_ = this.sftpCli_;
  }
};

/**
 * Plugin wants to read from a fd.
 *
 * @this {nassh.CommandInstance}
 * @param {number} fd The file handle to read from.
 * @param {number} size How many bytes to read.
 */
nassh.CommandInstance.prototype.onPlugin_.read = function(fd, size) {
  const stream = this.streams_.getStreamByFd(fd);

  if (!stream) {
    console.warn('Attempt to read from unknown fd: ' + fd);
    return;
  }

  stream.asyncRead(size, (b64bytes) => {
    this.sendToPlugin_('onRead', [fd, b64bytes]);
  });
};

/**
 * Plugin wants to close a file descriptor.
 *
 * @this {nassh.CommandInstance}
 * @param {number} fd The file handle to close.
 */
nassh.CommandInstance.prototype.onPlugin_.close = function(fd) {
  const stream = this.streams_.getStreamByFd(fd);

  if (!stream) {
    console.warn('Attempt to close unknown fd: ' + fd);
    return;
  }

  this.streams_.closeStream(fd);
};
