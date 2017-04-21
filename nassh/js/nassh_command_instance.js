// Copyright (c) 2012 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

'use strict';

lib.rtdep('lib.f', 'lib.fs', 'lib.punycode',
          'nassh.CommandInstance', 'nassh.GoogleRelay',
          'nassh.PreferenceManager');

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
 * @param {Object} argv The argument object passed in from the Terminal.
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

  // An HTML5 DirectoryEntry for /.ssh/.
  this.sshDirectoryEntry_ = null;

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

  // Mount options for a SFTP instance.
  this.mountOptions = argv.mountOptions || null;

  // Session storage (can accept another hterm tab's sessionStorage).
  this.storage = argv.terminalStorage || window.sessionStorage;

  // Terminal Location reference (can accept another hterm tab's location).
  this.terminalLocation = argv.terminalLocation || document.location;

  // Terminal Window reference (can accept another hterm tab's window).
  this.terminalWindow = argv.terminalWindow || window;

  // Root preference manager.
  this.prefs_ = new nassh.PreferenceManager();

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
 */
nassh.CommandInstance.run = function(argv) {
  return new nassh.CommandInstance(argv);
};

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
  var ferr = (msg) => {
    return (err) => {
      var ary = Array.apply(null, arguments);
      console.error(msg + ': ' + ary.join(', '));

      this.io.println(nassh.msg('UNEXPECTED_ERROR'));
      this.io.println(err);
    };
  };

  this.prefs_.readStorage(() => {
    this.manifest_ = chrome.runtime.getManifest();

    // Set default window title.
    this.io.print('\x1b]0;' + this.manifest_.name + ' ' +
                    this.manifest_.version + '\x07');

    this.io.println(
        nassh.msg('WELCOME_VERSION',
                  ['\x1b[1m' + this.manifest_.name + '\x1b[m',
                   '\x1b[1m' + this.manifest_.version + '\x1b[m']));

    this.io.println(
        nassh.msg('WELCOME_FAQ', ['\x1b[1mhttps://goo.gl/muppJj\x1b[m']));

    if (hterm.windowType != 'popup' && hterm.os != 'mac') {
      this.io.println('');
      this.io.println(nassh.msg('OPEN_AS_WINDOW_TIP',
                                ['\x1b[1mhttps://goo.gl/muppJj\x1b[m']));
      this.io.println('');
    }

    // Show some release highlights the first couple of runs with a new version.
    // We'll reset the counter when the release notes change.
    this.io.println(nassh.msg('WELCOME_CHANGELOG',
                              ['\x1b[1mhttps://goo.gl/YnmXOs\x1b[m']));
    let notes = lib.resource.getData('nassh/release/highlights');
    if (this.prefs_.get('welcome/notes-version') != notes.length) {
      // They upgraded, so reset the counters.
      this.prefs_.set('welcome/show-count', 0);
      this.prefs_.set('welcome/notes-version', notes.length);
    }
    // Figure out how many times we've shown this.
    var notesShowCount = this.prefs_.get('welcome/show-count');
    if (notesShowCount < 10) {
      // For new runs, show the highlights directly.
      this.io.print(nassh.msg('WELCOME_RELEASE_HIGHLIGHTS',
                              [lib.resource.getData('nassh/release/lastver')]));
      this.io.println(notes.replace(/%/g, '\r\n \u00A4'));
      this.prefs_.set('welcome/show-count', notesShowCount + 1);
    }

    // Display a random tip every time they launch to advertise features.
    let num = lib.f.randomInt(1, 13);
    this.io.println('');
    this.io.println(nassh.msg('WELCOME_TIP_OF_DAY',
                              [num, nassh.msg(`TIP_${num}`)]));
    this.io.println('');

    if (this.manifest_.name.match(/\(tot\)/)) {
      // If we're a tot version, show how old the hterm deps are.
      var htermAge = Math.round(
          (new Date() -
           new Date(lib.resource.getData('hterm/concat/date'))) / 1000);

      this.io.println(
          '[TOT] hterm ' + lib.resource.getData('hterm/changelog/version') +
          ': updated ' + (htermAge / 60).toFixed(2) + ' minutes ago.');
    }

    nassh.getFileSystem(onFileSystemFound, ferr('FileSystem init failed'));
  });

  var onFileSystemFound = (fileSystem, sshDirectoryEntry) => {
    this.fileSystem_ = fileSystem;
    this.sshDirectoryEntry_ = sshDirectoryEntry;

    var argstr = this.argv_.argString;

    // This item is set before we redirect away to login to a relay server.
    // If it's set now, it's the first time we're reloading after the redirect.
    var pendingRelay = this.storage.getItem('nassh.pendingRelay');
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
    } else if (!this.connectToArgString(argstr)) {
      this.io.println(nassh.msg('BAD_DESTINATION', [this.argv_.argString]));
      this.exit(1);
    }
  };
};

/**
 * This method moved off to be a static method on nassh, but remains here
 * for js console users who expect to find it here.
 */
nassh.CommandInstance.prototype.exportPreferences = function(onComplete) {
  nassh.exportPreferences(onComplete);
};

/**
 * This method moved off to be a static method on nassh, but remains here
 * for js console users who expect to find it here.
 */
nassh.CommandInstance.prototype.importPreferences = function(
    json, opt_onComplete) {
  nassh.importPreferences(json, opt_onComplete);
};

/**
 * Reconnects to host, using the same CommandInstance.
 *
 * @param {string} argstr The connection ArgString
 */
nassh.CommandInstance.prototype.reconnect = function(argstr) {
  // Terminal reset.
  this.io.print('\x1b[!p');

  this.io = this.argv_.io.push();

  if (this.plugin_)
    this.plugin_.parentNode.removeChild(this.plugin_);
  this.plugin_ = null;

  this.stdoutAcknowledgeCount_ = 0;
  this.stderrAcknowledgeCount_ = 0;

  this.exited_ = false;

  this.connectToArgString(argstr);
};

/**
 * Removes a file from the HTML5 filesystem.
 *
 * Most likely you want to remove something from the /.ssh/ directory.
 *
 * This command is only here to support unsavory JS console hacks for managing
 * the /.ssh/ directory.
 *
 * @param {string} fullPath The full path to the file to remove.
 */
nassh.CommandInstance.prototype.removeFile = function(fullPath) {
  lib.fs.removeFile(this.fileSystem_.root, '/.ssh/' + identityName);
};

/**
 * Removes a directory from the HTML5 filesystem.
 *
 * Most likely you'll want to remove the entire /.ssh/ directory.
 *
 * This command is only here to support unsavory JS console hacks for managing
 * the /.ssh/ directory.
 *
 * @param {string} fullPath The full path to the file to remove.
 */
nassh.CommandInstance.prototype.removeDirectory = function(fullPath) {
  this.fileSystem_.root.getDirectory(
      fullPath, {},
      function (f) {
        f.removeRecursively(lib.fs.log('Removed: ' + fullPath),
                            lib.fs.err('Error removing' + fullPath));
      },
      lib.fs.log('Error finding: ' + fullPath)
  );
};

/**
 * Remove all known hosts.
 *
 * This command is only here to support unsavory JS console hacks for managing
 * the /.ssh/ directory.
 */
nassh.CommandInstance.prototype.removeAllKnownHosts = function() {
  this.fileSystem_.root.getFile(
      '/.ssh/known_hosts', {create: false},
      function(fileEntry) { fileEntry.remove(function() {}) });
  /*
   * This isn't necessary, but it makes the user interface a little nicer as
   * most people don't realize that "undefined" is what you get from a void
   * javascript function.  Example console output:
   * > term_.command.removeAllKnownHosts()
   * true
   */
  return true;
};

/**
 * Remove a known host by index.
 *
 * This command is only here to support unsavory JS console hacks for managing
 * the /.ssh/ directory.
 *
 * @param {integer} index One-based index of the known host entry to remove.
 */
nassh.CommandInstance.prototype.removeKnownHostByIndex = function(index) {
  var onError = lib.fs.log('Error accessing /.ssh/known_hosts');

  lib.fs.readFile(this.fileSystem_.root, '/.ssh/known_hosts', (contents) => {
    var ary = contents.split('\n');
    ary.splice(index - 1, 1);
    lib.fs.overwriteFile(this.fileSystem_.root, '/.ssh/known_hosts',
                         ary.join('\n'), lib.fs.log('done'), onError);
  }, onError);
};

nassh.CommandInstance.prototype.promptForDestination_ = function(opt_default) {
  var connectDialog = this.io.createFrame(
      lib.f.getURL('/html/nassh_connect_dialog.html'), null);

  connectDialog.onMessage = (event) => {
    event.data.argv.unshift(connectDialog);
    this.dispatchMessage_('connect-dialog', this.onConnectDialog_, event.data);
  };

  // Resize the connection dialog iframe to try and fit all the content,
  // but not more.  This way we don't end up with a lot of empty space.
  function resize() {
    let body = this.iframe_.contentWindow.document.body;
    let shortcutList = body.querySelector('#shortcut-list');
    let dialogBillboard = body.querySelector('.dialog-billboard');
    let dialogButtons = body.querySelector('.dialog-buttons');

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

    var resize_ = resize.bind(this);
    resize_();
    window.addEventListener('resize', resize_);
  };

  // Clear retry count whenever we show the dialog.
  sessionStorage.removeItem('googleRelay.redirectCount');

  connectDialog.show();
};

nassh.CommandInstance.prototype.connectToArgString = function(argstr) {
  var isSftp = this.storage.getItem('nassh.isSftp');
  this.storage.removeItem('nassh.isSftp');

  // Handle profile-id:XXX forms.  These are bookmarkable.
  var ary = argstr.match(/^profile-id:([a-z0-9]+)(\?.*)?/i);
  var rv;
  if (ary) {

    if (isSftp) {
      rv = this.mountProfile(ary[1], ary[2]);
    } else {
      rv = this.connectToProfile(ary[1], ary[2]);
    }

  } else {

    if (isSftp) {
      rv = this.mountDestination(argstr);
    } else {
      rv = this.connectToDestination(argstr);
    }

  }

  return rv;
};

/**
 * Mount a remote host given a profile id. Creates a new SFTP CommandInstance
 * that runs in the background page.
 */
nassh.CommandInstance.prototype.mountProfile = function(
    profileID, querystr) {

  var onReadStorage = () => {
    try {
      var prefs = this.prefs_.getProfile(profileID);
    } catch (e) {
      this.io.println(nassh.msg('GET_PROFILE_ERROR', [profileID, e]));
      this.exit(1, true);
      return;
    }

    document.querySelector('#terminal').focus();

    if (chrome.extension.getBackgroundPage()
        .nassh.sftp.fsp.sftpInstances[prefs.id]) {
      this.io.println(nassh.msg('ALREADY_MOUNTED_MESSAGE'));
      this.exit(1, true);
      return;
    }

    this.terminalLocation.hash = 'profile-id:' + profileID;
    document.title = prefs.get('description') + ' - ' +
      this.manifest_.name + ' ' + this.manifest_.version;

    var args = {
      argv: {
        terminalIO: this.io,
        terminalStorage: this.storage,
        terminalLocation: this.terminalLocation,
        terminalWindow: this.terminalWindow,
        isSftp: true,
        basePath: prefs.get('mount-path'),
        // Mount options are passed directly to chrome.fileSystemProvider.mount,
        // so don't add fields here that would otherwise collide.
        mountOptions: {
          fileSystemId: prefs.id,
          displayName: prefs.get('description'),
          writable: true
        }
      },
      connectOptions: {
        username: prefs.get('username'),
        hostname: prefs.get('hostname'),
        port: prefs.get('port'),
        relayOptions: prefs.get('relay-options'),
        identity: prefs.get('identity'),
        argstr: prefs.get('argstr'),
        terminalProfile: prefs.get('terminal-profile'),
        authAgentAppID: prefs.get('auth-agent-appid')
      }
    };

    chrome.extension.getBackgroundPage()
      .nassh.sftp.fsp.createSftpInstance(args);
  };

  // Re-read prefs from storage in case they were just changed in the connect
  // dialog.
  this.prefs_.readStorage(onReadStorage);
  return true;
};

/**
 * Initiate a connection to a remote host given a profile id.
 */
nassh.CommandInstance.prototype.connectToProfile = function(
    profileID, querystr) {

  var onReadStorage = () => {
    try {
      var prefs = this.prefs_.getProfile(profileID);
    } catch (e) {
      this.io.println(nassh.msg('GET_PROFILE_ERROR', [profileID, e]));
      this.exit(1, true);
      return;
    }

    document.querySelector('#terminal').focus();

    // We have to set the url here rather than in connectToArgString, because
    // some callers will come directly to connectToProfile.
    this.terminalLocation.hash = 'profile-id:' + profileID;

    document.title = prefs.get('description') + ' - ' +
      this.manifest_.name + ' ' + this.manifest_.version;

    this.connectTo({
      username: prefs.get('username'),
      hostname: prefs.get('hostname'),
      port: prefs.get('port'),
      relayOptions: prefs.get('relay-options'),
      identity: prefs.get('identity'),
      argstr: prefs.get('argstr'),
      terminalProfile: prefs.get('terminal-profile'),
      authAgentAppID: prefs.get('auth-agent-appid')
    });
  };

  // Re-read prefs from storage in case they were just changed in the connect
  // dialog.
  this.prefs_.readStorage(onReadStorage);

  return true;
};

/**
 * Parse the destination string.
 *
 * This also handles ssh:// URIs.
 *
 * @param {string} destination A string of the form username@host[:port].
 * @return {boolean|Object} False if we couldn't parse the destination.
 *     An object if we were able to parse out the connect settings.
 */
nassh.CommandInstance.prototype.parseDestination = function(destination) {
  // Deal with ssh:// links.  They are encoded with % hexadecimal sequences.
  // Note: These might be ssh: or ssh://, so have to deal with that.
  if (destination.startsWith('uri:')) {
    // Strip off the "uri:" before decoding it.
    destination = unescape(destination.substr(4));
    if (!destination.startsWith('ssh:'))
      return false;

    // Strip off the "ssh:" prefix.
    destination = destination.substr(4);
    // Strip off the "//" if it exists.
    if (destination.startsWith('//'))
      destination = destination.substr(2);
  }

  // Parse the connection string.
  var ary = destination.match(
      //|user |@| [  ipv6       %zoneid   ]| host |   :port      @ relay options
      /^([^@]+)@(\[[:0-9a-f]+(?:%[^\]]+)?\]|[^:@]+)(?::(\d+))?(?:@([^:]+)(?::(\d+))?)?$/);

  if (!ary)
    return false;

  var username = ary[1];
  var hostname = ary[2];
  var port = ary[3];

  // If it's IPv6, remove the brackets.
  if (hostname.startsWith('[') && hostname.endsWith(']'))
    hostname = hostname.substr(1, hostname.length - 2);

  var relayOptions = '';
  if (ary[4]) {
    relayOptions = '--proxy-host=' + ary[4];

    if (ary[5])
      relayOptions += ' --proxy-port=' + ary[5];
  }

  return {
      username: username,
      hostname: hostname,
      port: port,
      relayOptions: relayOptions,
      destination: destination,
  };
};

/**
 * Initiate a connection to a remote host given a destination string.
 *
 * @param {string} destination A string of the form username@host[:port].
 * @return {boolean} True if we were able to parse the destination string,
 *     false otherwise.
 */
nassh.CommandInstance.prototype.connectToDestination = function(destination) {
  if (destination == 'crosh') {
    this.terminalLocation.href = 'crosh.html';
    return true;
  }

  var rv = this.parseDestination(destination);
  if (rv === false)
    return rv;

  // We have to set the url here rather than in connectToArgString, because
  // some callers may come directly to connectToDestination.
  this.terminalLocation.hash = rv.destination;

  return this.connectTo(rv);
};

/**
 * Mount a remote host given a destination string.
 *
 * @param {string} destination A string of the form username@host[:port].
 * @return {boolean} True if we were able to parse the destination string,
 *     false otherwise.
 */
nassh.CommandInstance.prototype.mountDestination = function(destination) {
  var rv = this.parseDestination(destination);
  if (rv === false)
    return rv;

  // We have to set the url here rather than in connectToArgString, because
  // some callers may come directly to connectToDestination.
  this.terminalLocation.hash = rv.destination;

  var args = {
    argv: {
      terminalIO: this.io,
      terminalStorage: this.storage,
      terminalLocation: this.terminalLocation,
      terminalWindow: this.terminalWindow,
      isSftp: true,
      // Mount options are passed directly to chrome.fileSystemProvider.mount,
      // so don't add fields here that would otherwise collide.
      mountOptions: {
        fileSystemId: rv.username + rv.hostname,
        displayName: rv.username + rv.hostname,
        writable: true
      }
    },
    connectOptions: rv,
  };

  return chrome.extension.getBackgroundPage().
    nassh.sftp.fsp.createSftpInstance(args);
};

/**
 * Split the ssh command line string up into its components.
 *
 * We currently only support simple quoting -- no nested or escaped.
 * That would require a proper lexer in here and not utilize regex.
 * See https://crbug.com/725625 for details.
 *
 * @param {string} argstr The full ssh command line.
 * @return {Object} The various components.
 */
nassh.CommandInstance.splitCommandLine = function(argstr) {
  var args = argstr || '';
  var command = '';

  // Tokenize the string first.
  var i;
  var ary = args.match(/("[^"]*"|\S+)/g);
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
    if (args)
      ary = [args];
    else
      ary = [];
  }

  return {
    args: ary,
    command: command,
  };
};

/**
 * Initiate a connection to a remote host.
 *
 * @param {string} username The username to provide.
 * @param {string} hostname The hostname or IP address to connect to.
 * @param {string|integer} opt_port The optional port number to connect to.
 * @return {boolean} False if there was some trouble with the parameters, true
 *     otherwise.
 */
nassh.CommandInstance.prototype.connectTo = function(params) {
  if (!(params.username && params.hostname))
    return false;

  if (params.hostname == '>crosh') {
    // TODO: This will need to be done better.  document.location changes don't
    // work in v2 apps.
    this.terminalLocation.href = 'crosh.html';
    return;
  }

  if (params.relayOptions) {
    try {
      var relay = new nassh.GoogleRelay(this.io, params.relayOptions,
                                        this.terminalLocation,
                                        this.storage);
    } catch (e) {
      this.io.println(nassh.msg('RELAY_OPTIONS_ERROR', [e]));
      this.exit(-1);
      return false;
    }

    // TODO(rginda): The `if (relay.proxyHost)` test is part of a goofy hack
    // to add the --ssh-agent param to the relay-options pref.  --ssh-agent has
    // no business being a relay option, but it's the best of the bad options.
    // In the future perfect world, 'relay-options' would probably be a generic
    // 'nassh-options' value and the parsing code wouldn't be part of the relay
    // class.
    //
    // For now, we let the relay code parse the options, and if the resulting
    // options don't include a proxyHost then we don't have an actual relay.
    // We may have a --ssh-agent argument though, which we'll pull out of
    // the relay object later.
    if (relay.proxyHost) {
      this.relay_ = relay;

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

        // If we're trying to mount an SFTP connection, remember it.
        if (this.isSftp) {
          this.storage.setItem('nassh.isSftp', 'yes');
        }

        this.relay_.redirect();
        return true;
      }
    }

    if (relay.options['--ssh-agent'])
      params.authAgentAppID = relay.options['--ssh-agent'];
    params.authAgentForward = relay.options['auth-agent-forward'];

    if (relay.options['--ssh-client-version'])
      this.sshClientVersion_ = relay.options['--ssh-client-version'];
  }

  if (!this.sshClientVersion_.match(/^[a-zA-Z0-9.-]+$/)) {
    this.io.println(nassh.msg('UNKNOWN_SSH_CLIENT_VERSION',
                              [this.sshClientVersion_]));
    this.exit(127);
    return false;
  }

  this.authAgentAppID_ = params.authAgentAppID;
  // If the agent app ID is not just an app ID, we parse it for the IDs of
  // built-in agent backends based on nassh.agent.Backend.
  if (this.authAgentAppID_ && !/^[a-z]{32}$/.test(this.authAgentAppID_)) {
    const backendIDs = this.authAgentAppID_.split(',');
    this.authAgent_ = new nassh.agent.Agent(backendIDs, this.io.terminal_);
  }

  this.io.setTerminalProfile(params.terminalProfile || 'default');

  // If they're using an internationalized domain name (IDN), then punycode
  // will return a different ASCII name.  Include that in the display for the
  // user so it's clear where we end up trying to connect to.
  var idn_hostname = lib.punycode.toASCII(params.hostname);
  var disp_hostname = params.hostname;
  if (idn_hostname != params.hostname)
    disp_hostname += ' (' + idn_hostname + ')';

  // TODO(rginda): The "port" parameter was removed from the CONNECTING message
  // on May 9, 2012, however the translations haven't caught up yet.  We should
  // remove the port parameter here once they do.
  this.io.println(nassh.msg('CONNECTING',
                            [params.username + '@' + disp_hostname,
                             (params.port || '??')]));
  this.io.onVTKeystroke = this.onVTKeystroke_.bind(this);
  this.io.sendString = this.sendString_.bind(this);
  this.io.onTerminalResize = this.onTerminalResize_.bind(this);

  var argv = {};
  argv.terminalWidth = this.io.terminal_.screenSize.width;
  argv.terminalHeight = this.io.terminal_.screenSize.height;
  argv.useJsSocket = !!this.relay_;
  argv.environment = this.environment_;
  argv.writeWindow = 8 * 1024;

  if (this.isSftp)
    argv.subsystem = 'sftp';

  argv.arguments = ['-C'];  // enable compression

  if (params.authAgentAppID) {
    argv.authAgentAppID = params.authAgentAppID;
    if (params.authAgentForward)
      argv.arguments.push('-A');
  }

  // Disable IP address check for connection through proxy.
  if (argv.useJsSocket)
    argv.arguments.push('-o CheckHostIP=no');

  if (params.identity)
    argv.arguments.push('-i/.ssh/' + params.identity);
  if (params.port)
    argv.arguments.push('-p' + params.port);

  // We split the username apart so people can use whatever random characters in
  // it they want w/out causing parsing troubles ("@" or leading "-" or " ").
  argv.arguments.push('-l' + params.username);
  argv.arguments.push(idn_hostname);

  // Finally, we append the custom command line the user has constructed.
  // This matches native `ssh` behavior and makes our lives simpler.
  var extraArgs = nassh.CommandInstance.splitCommandLine(params.argstr);
  if (extraArgs.args)
    argv.arguments = argv.arguments.concat(extraArgs.args);
  if (extraArgs.command)
    argv.arguments.push('--', extraArgs.command);

  this.initPlugin_(() => {
      if (!nassh.v2)
        this.terminalWindow.addEventListener('beforeunload', this.onBeforeUnload);

      this.sendToPlugin_('startSession', [argv]);
      if (this.isSftp) {
        this.sftpClient.initConnection(this.plugin_);
      }
    });

  return true;
};

/**
 * Dispatch a "message" to one of a collection of message handlers.
 */
nassh.CommandInstance.prototype.dispatchMessage_ = function(
    desc, handlers, msg) {
  if (msg.name in handlers) {
    handlers[msg.name].apply(this, msg.argv);
  } else {
    console.log('Unknown "' + desc + '" message: ' + msg.name);
  }
};

nassh.CommandInstance.prototype.initPlugin_ = function(onComplete) {
  var onPluginLoaded = () => {
    this.io.println(nassh.msg('PLUGIN_LOADING_COMPLETE'));
    onComplete();
  };

  this.io.print(nassh.msg('PLUGIN_LOADING'));

  this.plugin_ = window.document.createElement('embed');
  this.plugin_.style.cssText =
      ('position: absolute;' +
       'top: -99px' +
       'width: 0;' +
       'height: 0;');

  const pluginURL = `../plugin/${this.sshClientVersion_}/ssh_client.nmf`;

  this.plugin_.setAttribute('src', pluginURL);
  this.plugin_.setAttribute('type', 'application/x-nacl');
  this.plugin_.addEventListener('load', onPluginLoaded);
  this.plugin_.addEventListener('message', this.onPluginMessage_.bind(this));

  var errorHandler = (ev) => {
    this.io.println(nassh.msg('PLUGIN_LOADING_FAILED'));
    console.error('loading plugin failed', ev);
    this.exit(-1);
  };
  this.plugin_.addEventListener('crash', errorHandler);
  this.plugin_.addEventListener('error', errorHandler);

  document.body.insertBefore(this.plugin_, document.body.firstChild);
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
 * @param {integer} fd The file descriptor index.
 * @param {boolean} allowRead True if this stream can be read from.
 * @param {boolean} allowWrite True if this stream can be written to.
 * @param {function} onOpen Callback to call when the stream is opened.
 *
 * @return {Object} The newly created stream.
 */
nassh.CommandInstance.prototype.createTtyStream = function(
    fd, allowRead, allowWrite, onOpen) {
  var arg = {
    fd: fd,
    allowRead: allowRead,
    allowWrite: allowWrite,
    inputBuffer: this.inputBuffer_,
    io: this.io
  };

  var stream = this.streams_.openStream(nassh.Stream.Tty, fd, arg, onOpen);
  if (allowRead) {
    var onDataAvailable = (isAvailable) => {
      // Send current read status to plugin.
      this.sendToPlugin_('onReadReady', [fd, isAvailable]);
    };

    this.inputBuffer_.onDataAvailable.addListener(onDataAvailable);

    stream.onClose = (reason) => {
      this.inputBuffer_.onDataAvailable.removeListener(onDataAvailable);
      this.sendToPlugin_('onClose', [fd, reason]);
    };
  }

  return stream;
};

/**
 * Send a message to the nassh plugin.
 *
 * @param {string} name The name of the message to send.
 * @param {Array} arguments The message arguments.
 */
nassh.CommandInstance.prototype.sendToPlugin_ = function(name, args) {
  var str = JSON.stringify({name: name, arguments: args});

  this.plugin_.postMessage(str);
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
 * @param {string|integer} terminal width.
 * @param {string|integer} terminal height.
 */
nassh.CommandInstance.prototype.onTerminalResize_ = function(width, height) {
  this.sendToPlugin_('onResize', [Number(width), Number(height)]);
};

/**
 * Exit the nassh command.
 */
nassh.CommandInstance.prototype.exit = function(code, noReconnect) {
  if (this.exited_) {
    return;
  }

  this.exited_ = true;

  if (!nassh.v2)
    this.terminalWindow.removeEventListener('beforeunload', this.onBeforeUnload_);

  // Close all streams upon exit.
  this.streams_.closeAllStreams();

  if (this.isSftp) {
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
    var ch = string.toLowerCase();
    switch (ch) {
      case 'c':
      case '\x12': // ctrl-r
        nassh.reloadWindow();
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

nassh.CommandInstance.prototype.onBeforeUnload_ = function(e) {
  if (hterm.windowType == 'popup')
    return;

  var msg = nassh.msg('BEFORE_UNLOAD');
  e.returnValue = msg;
  return msg;
};

/**
 * Called when the plugin sends us a message.
 *
 * Plugin messages are JSON strings rather than arbitrary JS values.  They
 * also use "arguments" instead of "argv".  This function translates the
 * plugin message into something dispatchMessage_ can digest.
 */
nassh.CommandInstance.prototype.onPluginMessage_ = function(e) {
  var msg = JSON.parse(e.data);
  msg.argv = msg.arguments;
  this.dispatchMessage_('plugin', this.onPlugin_, msg);
};

/**
 * Connect dialog message handlers.
 */
nassh.CommandInstance.prototype.onConnectDialog_ = {};

/**
 * Sent from the dialog when the user chooses to mount a profile.
 */
nassh.CommandInstance.prototype.onConnectDialog_.mountProfile = function(
    dialogFrame, profileID) {
  dialogFrame.close();

  if (!this.mountProfile(profileID)) {
    this.promptForDestination_();
  }
};

/**
 * Sent from the dialog when the user chooses to connect to a profile.
 */
nassh.CommandInstance.prototype.onConnectDialog_.connectToProfile = function(
    dialogFrame, profileID) {
  dialogFrame.close();

  if (!this.connectToProfile(profileID))
    this.promptForDestination_();
};

/**
 * Plugin message handlers.
 */
nassh.CommandInstance.prototype.onPlugin_ = {};

/**
 * Log a message from the plugin.
 */
nassh.CommandInstance.prototype.onPlugin_.printLog = function(str) {
  console.log('plugin log: ' + str);
};

/**
 * Plugin has exited.
 */
nassh.CommandInstance.prototype.onPlugin_.exit = function(code) {
  console.log('plugin exit: ' + code);
  this.sendToPlugin_('onExitAcknowledge', []);
  this.exit(code);
};

/**
 * Plugin wants to open a file.
 *
 * The plugin leans on JS to provide a persistent filesystem, which we do via
 * the HTML5 Filesystem API.
 *
 * In the future, the plugin may handle its own files.
 */
nassh.CommandInstance.prototype.onPlugin_.openFile = function(fd, path, mode) {
  var isAtty = true;
  var onOpen = (success) => {
    this.sendToPlugin_('onOpenFile', [fd, success, isAtty]);
  }

  var DEV_TTY = '/dev/tty';
  var DEV_STDIN = '/dev/stdin';
  var DEV_STDOUT = '/dev/stdout';
  var DEV_STDERR = '/dev/stderr';

  if (path == '/dev/random') {
    var stream = this.streams_.openStream(nassh.Stream.Random,
      fd, path, onOpen);
    stream.onClose = (reason) => {
      this.sendToPlugin_('onClose', [fd, reason]);
    };
  } else if (path == DEV_TTY || path == DEV_STDIN || path == DEV_STDOUT ||
             path == DEV_STDERR) {
    var allowRead = path == DEV_STDIN || path == DEV_TTY;
    var allowWrite = path == DEV_STDOUT || path == DEV_STDERR || path == DEV_TTY;
    if (this.isSftp && path != DEV_TTY) {
      isAtty = false;
    }
    var stream = this.createTtyStream(fd, allowRead, allowWrite, onOpen);
  } else {
    this.sendToPlugin_('onOpenFile', [fd, false, false]);
  }
};

nassh.CommandInstance.prototype.onPlugin_.openSocket = function(fd, host, port) {
  var stream = null;

  if (port == 0 && host == this.authAgentAppID_) {
    // Request for auth-agent connection.
    if (this.authAgent_) {
      stream = this.streams_.openStream(
          nassh.Stream.SSHAgent, fd, {authAgent: this.authAgent_},
          (success) => {
            this.sendToPlugin_('onOpenSocket', [fd, success, false]);
          });
    } else {
      stream = this.streams_.openStream(
          nassh.Stream.SSHAgentRelay, fd,
          {authAgentAppID: this.authAgentAppID_}, (success) => {
            this.sendToPlugin_('onOpenSocket', [fd, success, false]);
          });
    }
  } else {
    // Regular relay connection request.
    if (!this.relay_) {
      this.sendToPlugin_('onOpenSocket', [fd, false, false]);
      return;
    }

    stream = this.relay_.openSocket(fd, host, port, this.streams_,
      (success) => {
        this.sendToPlugin_('onOpenSocket', [fd, success, false]);
      });
  }

  stream.onDataAvailable = (data) => {
    this.sendToPlugin_('onRead', [fd, data]);
  };

  stream.onClose = (reason) => {
    this.sendToPlugin_('onClose', [fd, reason]);
  };
};

/**
 * Plugin wants to write some data to a file descriptor.
 *
 * This is used to write to HTML5 Filesystem files.
 */
nassh.CommandInstance.prototype.onPlugin_.write = function(fd, data) {
  if (this.isSftp && !this.sftpClient.isInitialised
      && isSftpInitResponse(data)) {
    this.onSftpInitialised();
  }

  var stream = this.streams_.getStreamByFd(fd);

  if (!stream) {
    console.warn('Attempt to write to unknown fd: ' + fd);
    return;
  }

  stream.asyncWrite(data, (writeCount) => {
    this.sendToPlugin_('onWriteAcknowledge', [fd, writeCount]);
  }, 100);
};

/**
 * Checks to see if the plugin responded with a VERSION SFTP packet.
 */
function isSftpInitResponse(data) {
  var packet = new nassh.sftp.Packet(atob(data));
  var packetLength = packet.getUint32();
  var packetType = packet.getUint8();

  // returns true if the packet has a valid length and is of type VERSION.
  return packetLength == packet.getLength() - 4 &&
         packetType == nassh.sftp.packets.RequestPackets.VERSION;
}

/**
 * SFTP Initialization handler. Mounts the SFTP connection as a file system.
 */
nassh.CommandInstance.prototype.onSftpInitialised = function() {
  // Newer versions of Chrome support this API, but olders will error out.
  if (lib.f.getChromeMilestone() >= 64)
    this.mountOptions['persistent'] = false;

  // Mount file system.
  chrome.fileSystemProvider.mount(this.mountOptions);

  // Add this instance to list of SFTP instances.
  nassh.sftp.fsp.sftpInstances[this.mountOptions.fileSystemId] = this;

  // Update stdout stream to output to the SFTP Client.
  this.streams_.getStreamByFd(1).setIo(this.sftpClient);

  this.io.showOverlay(nassh.msg('MOUNTED_MESSAGE') + ' '
                      + nassh.msg('CONNECT_OR_EXIT_MESSAGE'), null);

  this.io.onVTKeystroke = (string) => {
    var ch = string.toLowerCase();
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
}

/**
 * Plugin wants to read from a fd.
 */
nassh.CommandInstance.prototype.onPlugin_.read = function(fd, size) {
  var stream = this.streams_.getStreamByFd(fd);

  if (!stream) {
    console.warn('Attempt to read from unknown fd: ' + fd);
    return;
  }

  stream.asyncRead(size, (b64bytes) => {
    this.sendToPlugin_('onRead', [fd, b64bytes]);
  });
};

/**
 * Notify the plugin that data is available to read.
 */
nassh.CommandInstance.prototype.onPlugin_.isReadReady = function(fd) {
  var stream = this.streams_.getStreamByFd(fd);

  if (!stream) {
    console.warn('Attempt to call isReadReady from unknown fd: ' + fd);
    return;
  }

  var rv = stream.isReadReady();
  this.sendToPlugin_('onIsReadReady', [fd, rv]);
};

/**
 * Plugin wants to close a file descriptor.
 */
nassh.CommandInstance.prototype.onPlugin_.close = function(fd) {
  var stream = this.streams_.getStreamByFd(fd);

  if (!stream) {
    console.warn('Attempt to close unknown fd: ' + fd);
    return;
  }

  this.streams_.closeStream(fd);
};
