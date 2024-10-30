// Copyright 2012 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview
 * @suppress {moduleLoad}
 */

import {lib} from '../../libdot/index.js';

import {hterm} from '../../hterm/index.js';
import {punycode} from './deps_punycode.rollup.js';
import {
  IMG_VISIBILITY_URI, IMG_VISIBILITY_OFF_URI, RELEASE_LAST_VERSION,
  RELEASE_NOTES,
} from './deps_resources.rollup.js';

import {
  getManifest, isCrOSSystemApp, localize, osc8Link, sgrText,
} from './nassh.js';
import {Agent} from './nassh_agent.js';
import {setDefaultBackend} from './nassh_buffer.js';
import {
  syncFilesystemFromDomToIndexeddb, syncFilesystemFromIndexeddbToDom,
} from './nassh_fs.js';
import {
  gcseRefreshCert, getGnubbyExtension, probeExtensions,
} from './nassh_google.js';
import {Plugin as NaclPlugin} from './nassh_plugin_nacl.js';
import {Plugin as WasmPlugin} from './nassh_plugin_wasm.js';
import {
  LocalPreferenceManager, PreferenceManager, ProfilePreferenceManager,
} from './nassh_preference_manager.js';
import {Corp as RelayCorp} from './nassh_relay_corp.js';
import {Corpv4 as RelayCorpv4} from './nassh_relay_corpv4.js';
import {Sshfe as RelaySshfe} from './nassh_relay_sshfe.js';
import {Websockify as RelayWebsockify} from './nassh_relay_websockify.js';
import {Client as sftpClient} from './nassh_sftp_client.js';
import {SftpFsp} from './nassh_sftp_fsp.js';
import {Cli as nasftpCli} from './nasftp_cli.js';

/**
 * @typedef {{
 *   io: !hterm.Terminal.IO,
 *   args: (!Array<string>|undefined),
 *   environment: (!Object<string,string>|undefined),
 *   isSftp: (boolean|undefined),
 *   sftpStartupCallback: (function(boolean, (string|null))|undefined),
 *   basePath: (string|undefined),
 *   isMount: (boolean|undefined),
 *   fsp: (!SftpFsp|undefined),
 *   mountOptions: (!chrome.fileSystemProvider.MountOptions|undefined),
 *   sshClientVersion: (string|undefined),
 *   onExit: (function(number)|undefined),
 *   sessionStorage: (!lib.Storage|undefined),
 *   syncStorage: (!lib.Storage),
 *   terminalLocation: (!Location|undefined),
 *   terminalWindow: (!Object|undefined),
 *   connectPage: (string|undefined),
 * }}
 */
export let CommandInstanceArgv;

/**
 * The ssh terminal command.
 *
 * This class defines a command that can be run in an hterm.Terminal instance.
 * This command creates an instance of the ssh plugin and uses it to communicate
 * with an ssh daemon.
 *
 * If you want to use something other than this plugin to connect to a remote
 * host (like a shellinaboxd, etc), you'll want to create a brand new command.
 *
 * @param {!CommandInstanceArgv} argv The command line arguments.
 * @constructor
 */
export function CommandInstance(argv) {
  // Command arguments.
  this.argv_ = argv;

  // Command environment.
  this.environment_ = argv.environment || {};

  // hterm.Terminal.IO instance (can accept another hterm.Terminal.IO instance).
  this.io = argv.io;

  // Relay manager.
  this.relay_ = null;

  // Parsed extension manifest.
  this.manifest_ = getManifest();

  // WASM requires SABs, so if they aren't available, fallback to NaCl.
  const naclSupported =
      (navigator.mimeTypes ?? {})['application/x-pnacl'] !== undefined ||
      globalThis.SharedArrayBuffer === undefined;
  // The version of the ssh client to load.
  this.sshClientVersion_ = naclSupported ? 'pnacl' : 'wasm';

  // Application ID of auth agent.
  this.authAgentAppID_ = null;

  // Internal SSH agent.
  this.authAgent_ = null;

  // Whether the instance is a SFTP instance.
  this.isSftp = argv.isSftp || false;

  // SFTP Client for SFTP instances.
  this.sftpClient = (this.isSftp) ? new sftpClient(argv.basePath) : null;

  // Callback to receive sftp startup status.
  this.sftpStartupCallback = argv.sftpStartupCallback;

  // Whether we're setting up the connection for mounting.
  this.isMount = argv.isMount || false;

  // SFTP FSP.  Must be provided if isMount is true.
  this.fsp = argv.fsp;

  // Mount options for a SFTP instance.
  this.mountOptions = argv.mountOptions || null;

  // Session storage (can accept another hterm tab's sessionStorage).
  this.sessionStorage = argv.sessionStorage || globalThis.sessionStorage;

  // Sync storage is where synced prefs are saved.
  this.syncStorage = argv.syncStorage;

  // Terminal Location reference (can accept another hterm tab's location).
  this.terminalLocation = argv.terminalLocation || globalThis.location;

  // Terminal Window reference (can accept another hterm tab's window).
  this.terminalWindow = argv.terminalWindow || globalThis;

  // URL path of connect page to show after exit dialog.
  this.connectPage = argv.connectPage || '/html/nassh_connect_dialog.html';

  /**
   * @type {(?NaclPlugin|?WasmPlugin)} The current plugin (WASM/NaCl/etc...).
   */
  this.plugin_ = null;

  /**
   * @type {?string} The current connection profile.
   */
  this.profileId_ = null;

  // Root preference managers.
  this.prefs_ = new PreferenceManager(this.syncStorage);
  this.localPrefs_ = new LocalPreferenceManager();

  // Prevent us from reporting an exit twice.
  this.exited_ = false;
}

/**
 * The name of this command used in messages to the user.
 *
 * Perhaps this will also be used by the user to invoke this command if we
 * build a command line shell.
 */
CommandInstance.prototype.commandName = 'nassh';

/**
 * When the command exit is from nassh instead of ssh_client.  The ssh module
 * can only ever exit with positive values, so negative values are reserved.
 */
const EXIT_INTERNAL_ERROR = -1;

/**
 * Start the nassh command.
 *
 * Instance run method invoked by the CommandInstance ctor.
 */
CommandInstance.prototype.run = async function() {
  // Useful for console debugging.
  globalThis.nassh_ = this;

  // Kick off gnubby extension probing in the background.
  const probePromise = probeExtensions();

  // In case something goes horribly wrong, display an error to the user so it's
  // easier for them to copy & paste when reporting issues.
  globalThis.addEventListener('error', (e) => {
    this.io.println(localize('UNEXPECTED_ERROR'));
    if (e.error?.stack) {
      const lines = e.error.stack.split(/[\r\n]/);
      lines.forEach((line) => this.io.println(line));
    }
    if (e.message) {
      this.io.println(`${e.filename}:${e.lineno}:${e.colno}: ${e.message}`);
    }
  });

  this.prefs_.readStorage().then(async () => {
    // Set default window title.
    this.io.print('\x1b]0;' + this.manifest_.name + ' ' +
                    this.manifest_.version + '\x07');

    showWelcome();

    // Wait for the probing results before we connect to a remote.
    await probePromise;
    onFileSystemFound();

    this.localPrefs_.readStorage().then(() => {
      this.localPrefs_.syncProfiles(this.prefs_);

      // updateWindowDimensions_ uses chrome.windows.getCurrent.
      if (!globalThis.chrome?.windows?.getCurrent) {
        return;
      }

      const updater = this.updateWindowDimensions_.bind(this);
      globalThis.addEventListener('resize', updater);
      // Window doesn't offer a 'move' event, and blur/resize don't seem to
      // work.  Listening for mouseout should be low enough overhead.
      globalThis.addEventListener('mouseout', updater);
    });
  });

  const showWelcome = () => {
    const style = {bold: true};

    this.io.println(localize(
        'WELCOME_VERSION',
        [sgrText(this.manifest_.name, style),
         sgrText(this.manifest_.version, style)]));

    this.io.println(localize(
        'WELCOME_FAQ',
        [sgrText(osc8Link('https://hterm.org/x/ssh/faq'), style)]));

    if (hterm.windowType !== 'app' &&
        hterm.windowType !== 'popup' &&
        hterm.os !== 'mac') {
      this.io.println('');
      this.io.println(localize(
          'OPEN_AS_WINDOW_TIP',
          [sgrText(osc8Link('https://hterm.org/x/ssh/faq'), style)]));
    }

    // Show some release highlights the first couple of runs with a new version.
    // We'll reset the counter when the release notes change.
    const notes = RELEASE_NOTES.map((n) => `\r\n \u00A4 ${n}`);
    if (this.prefs_.getNumber('welcome/notes-version') != notes.length) {
      // They upgraded, so reset the counters.
      this.prefs_.set('welcome/show-count', 0);
      this.prefs_.set('welcome/notes-version', notes.length);
    }
    // Figure out how many times we've shown this.
    const notesShowCount = this.prefs_.getNumber('welcome/show-count');
    if (notesShowCount < 10) {
      // For new runs, show the highlights directly.
      this.io.println('');
      this.io.print(localize('WELCOME_RELEASE_HIGHLIGHTS',
                             [RELEASE_LAST_VERSION]));
      this.io.println(notes);
      this.prefs_.set('welcome/show-count', notesShowCount + 1);

      this.io.println(localize(
          'WELCOME_CHANGELOG',
          [sgrText(osc8Link('/html/changelog.html'), style)]));
    }

    // Display a random tip every time they launch to advertise features.
    const num = lib.f.randomInt(1, 14);
    this.io.println('');
    this.io.println(localize('WELCOME_TIP_OF_DAY',
                              [num, localize(`TIP_${num}`)]));

    if (this.isDevVersion()) {
      // If we're a development version, show hterm details.
      const htermDate = lib.resource.getData('hterm/concat/date');
      const htermVer = lib.resource.getData('hterm/changelog/version');
      const htermRev = lib.resource.getData('hterm/git/HEAD');
      const htermAgeMinutes =
          Math.round((new Date().getTime() - new Date(htermDate).getTime()) /
                     1000 / 60);

      this.io.println('');
      this.io.println(`[dev] hterm v${htermVer} (git ${htermRev})`);
      this.io.println(`[dev] built on ${htermDate} ` +
                      `(${htermAgeMinutes} minutes ago)`);
    }

    this.io.println('');
  };

  const onFileSystemFound = () => {
    const argstr = this.argv_.args.join(' ');
    if (!argstr) {
      this.promptForDestination_();
    } else {
      this.connectToArgString(argstr);
    }
  };
};

/**
 * Whether this is a developer-oriented build.
 *
 * This includes ToT extension (locally unpacked) builds & dev channel builds.
 *
 * @return {boolean}
 */
CommandInstance.prototype.isDevVersion = function() {
  // For Terminal, opt in R108 in dev/canary channel.  We don't have access to
  // the channels, so time-delay it to prevent slipping into stable.  We go by
  // the branch date in https://chromiumdash.appspot.com/schedule.
  const version = parseInt(this.manifest_.version, 10);
  if (version >= 108) {
    const now = new Date();
    switch (version) {
      case 108:
        return now < new Date(2022, 10, 13);
      case 109:
        return now < new Date(2022, 11, 10);
      case 110:
        return now < new Date(2022, 12, 15);
      case 111:
        return now < new Date(2023, 1, 26);
      case 112:
        return now < new Date(2023, 2, 23);
    }
    // Hopefully we'll have a better solution by R113.
    return false;
  }

  // For the normal extension, check the manifest build type.
  // We set version_name to "ToT" in git itself, to the build date in the dev
  // version, and clear it in the stable version.
  return this.manifest_.version_name !== undefined;
};

/**
 * Reconnects to host, using the same CommandInstance.
 *
 * @param {string} argstr The connection ArgString.
 */
CommandInstance.prototype.reconnect = function(argstr) {
  // Terminal reset.
  this.io.print('\x1b[!p');

  this.removePlugin_();

  this.stdoutAcknowledgeCount_ = 0;
  this.stderrAcknowledgeCount_ = 0;

  this.exited_ = false;

  this.connectToArgString(argstr);
};

/**
 * Event for when the window dimensions change.
 */
CommandInstance.prototype.updateWindowDimensions_ = function() {
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
      profile.set('win/top', globalThis.screenTop);
      profile.set('win/left', globalThis.screenLeft);
      profile.set('win/height', globalThis.outerHeight);
      profile.set('win/width', globalThis.outerWidth);
    }
  });
};

/** Prompt for destination */
CommandInstance.prototype.promptForDestination_ = function() {
  // Clear retry count whenever we show the dialog.
  globalThis.sessionStorage.removeItem('googleRelay.redirectCount');

  const url = lib.f.getURL(this.connectPage);
  this.terminalLocation.replace(url);
};

/**
 * Navigate to new page without updating history.
 *
 * Nassh uses the `#hash` part of the query string to control which connection
 * profile is used.  If we set the location's .hash directly, this causes the
 * history to be updated which we don't want.  This helper jumps through all the
 * hoops to switch pages without updating history.
 *
 * @param {string} hash The new subpage to navigate to.
 */
CommandInstance.prototype.navigate_ = function(hash) {
  const url = new URL(this.terminalLocation.href);
  url.hash = hash;
  this.terminalLocation.replace(url.toString());
};

/** @param {string} argstr */
CommandInstance.prototype.connectToArgString = function(argstr) {
  const isMount = (this.sessionStorage.getItem('nassh.isMount') == 'true');
  const isSftp = (this.sessionStorage.getItem('nassh.isSftp') == 'true');
  this.sessionStorage.removeItem('nassh.isMount');
  this.sessionStorage.removeItem('nassh.isSftp');

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
 * @param {function(!ProfilePreferenceManager)} callback Callback when the prefs
 *     have finished loading.
 */
CommandInstance.prototype.commonProfileSetup_ = function(profileID, callback) {
  const onReadStorage = () => {
    let prefs;
    try {
      prefs = this.prefs_.getProfile(profileID);
    } catch (e) {
      this.io.println(localize('GET_PROFILE_ERROR', [profileID, e]));
      this.exit(EXIT_INTERNAL_ERROR, true);
      return;
    }

    this.profileId_ = profileID;
    document.querySelector('#terminal').focus();

    this.navigate_(`profile-id:${profileID}`);
    document.title = prefs.get('description') + ' - ' +
      this.manifest_.name + ' ' + this.manifest_.version;

    callback(prefs);
  };

  // Re-read prefs from storage in case they were just changed in the connect
  // dialog.
  this.prefs_.readStorage().then(onReadStorage);
};

/**
 * Turn a prefs object into the params object connectTo expects.
 *
 * @param {!Object} prefs
 * @return {!Object}
 */
CommandInstance.prototype.prefsToConnectParams_ = function(prefs) {
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
CommandInstance.prototype.mountProfile = function(profileID) {
  const port = chrome.runtime.connect({name: 'mount'});

  // The main event loop -- process messages from the bg page.
  port.onMessage.addListener((msg) => {
    const {error, message, command} = msg;

    // Handle all error messages here.
    if (error) {
      io.println(message);
      io.pop();
      this.exit(EXIT_INTERNAL_ERROR, true);
      port.disconnect();
      return;
    }

    switch (command) {
      case 'write':
        // Display content to the user.
        io.print(message);
        break;

      case 'overlay':
        // Display the UI popup.
        io.showOverlay(message, msg.timeout);
        break;

      case 'input':
        // Get secure user input.
        this.secureInput(message, msg.buf_len, msg.echo).then((data) => {
          port.postMessage({command: 'input', data});
        });
        break;

      case 'exit':
      case 'done':
        // The client has exited (bad), or the mount setup is done (good).
        port.disconnect();
        if (command === 'done') {
          io.showOverlay(localize('MOUNTED_MESSAGE') + ' ' +
                         localize('CONNECT_OR_EXIT_MESSAGE'), null);
        } else {
          io.showOverlay(localize('DISCONNECT_MESSAGE', [msg.status]), null);
        }

        // Disable most I/O other than reconnect shortcuts.
        io.onVTKeystroke = (string) => {
          const ch = string.toLowerCase();
          switch (ch) {
            case 'c':
            case '\x12': // ctrl-r
              this.terminalLocation.replace(lib.f.getURL(this.connectPage));
              break;

            case 'e':
            case 'x':
            case '\x1b': // ESC
            case '\x17': // ctrl-w
              this.terminalWindow.close();
          }
        };
        io.sendString = () => {};
        break;

      default:
        io.println(`internal error: unknown command '${command}'`);
        port.disconnect();
        io.pop();
        break;
    }
  });

  // Not sure there's much else to do here.
  port.onDisconnect.addListener(() => {
    console.log('disconnect');
  });

  // Send all user input to the background page.
  const io = this.io.push();
  io.onVTKeystroke = io.sendString = (string) => {
    port.postMessage({command: 'write', data: string});
  };

  // Once we've loaded prefs from storage, kick off the mount in the bg.
  const onStartup = (prefs) => {
    this.isMount = true;
    this.isSftp = true;
    const params = this.prefsToConnectParams_(prefs);
    this.connectTo(params, async () => {
      if (this.relay_) {
        params.relayState = this.relay_.saveState();
      }
      port.postMessage({
        command: 'connect',
        argv: {
          isSftp: true,
          basePath: prefs.get('mount-path'),
          isMount: true,
          // Mount options are passed directly to Chrome's FSP mount(),
          // so don't add fields here that would otherwise collide.
          mountOptions: {
            fileSystemId: prefs.id,
            displayName: prefs.get('description'),
            writable: true,
          },
          sshClientVersion: this.sshClientVersion_,
        },
        connectOptions: params,
      });
    });
  };

  this.commonProfileSetup_(profileID, onStartup);
};

/**
 * Creates a new SFTP CommandInstance that runs in the background page.
 *
 * @param {string} profileID Terminal preference profile name.
 */
CommandInstance.prototype.sftpConnectToProfile = function(profileID) {
  const onStartup = (prefs) => {
    this.isSftp = true;
    this.sftpClient = new sftpClient();

    this.connectTo(this.prefsToConnectParams_(prefs));
  };

  this.commonProfileSetup_(profileID, onStartup);
};

/**
 * Initiate a connection to a remote host given a profile id.
 *
 * @param {string} profileID Terminal preference profile name.
 */
CommandInstance.prototype.connectToProfile = function(profileID) {
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
export function parseURI(uri, stripSchema = true, decodeComponents = false) {
  let schema;
  if (stripSchema) {
    schema = uri.split(':', 1)[0];
    if (schema === 'ssh' || schema === 'web+ssh' || schema === 'sftp' ||
        schema === 'web+sftp') {
      // Strip off the schema prefix.
      uri = uri.substr(schema.length + 1);

      if (schema.startsWith('web+')) {
        schema = schema.substr(4);
      }
    } else {
      schema = undefined;
    }
    // Strip off the "//" if it exists.
    if (uri.startsWith('//')) {
      uri = uri.substr(2);
    }
  }

  // For empty URIs, show the connection dialog.
  if (uri === '') {
    return {hostname: '>connections'};
  }

  /* eslint-disable max-len,spaced-comment */
  // Parse the connection string.
  const ary = uri.match(
      //|user    |@|   [  ipv6       %zoneid   ]|  host  |   :port     |@| [  ipv6       %zoneid   ]| relay |   :relay port |
      /^(?:([^@]*)@)?(\[[:0-9a-f]+(?:%[^\]]+)?\]|[^\s:@]+)(?::(\d+))?(?:@(\[[:0-9a-f]+(?:%[^\]]+)?\]|[^\s:]+)(?::(\d+))?)?$/);
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
    schema: schema,
    uri: uri,
  }, params);
}

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
export function parseDestination(destination) {
  let stripSchema = false;
  let decodeComponents = false;

  // Deal with ssh:// links.  They are encoded with % hexadecimal sequences.
  // Note: These might be ssh: or ssh://, so have to deal with that.
  if (destination.startsWith('uri:')) {
    // Strip off the "uri:" before decoding it.
    destination = unescape(destination.substr(4));
    const schema = destination.split(':', 1)[0];
    if (schema !== 'ssh' && schema !== 'web+ssh' && schema !== 'sftp' &&
        schema !== 'web+sftp') {
      return null;
    }

    stripSchema = true;
    decodeComponents = true;
  }

  const rv = parseURI(destination, stripSchema, decodeComponents);
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
}

/**
 * Initiate a connection to a remote host given a destination string.
 *
 * @param {string} destination A string of the form username@host[:port].
 */
CommandInstance.prototype.connectToDestination = function(destination) {
  if (destination == 'crosh') {
    this.terminalLocation.href = 'crosh.html';
    return;
  }

  const rv = parseDestination(destination);
  if (rv === null) {
    this.io.println(localize('BAD_DESTINATION', [destination]));
    this.exit(EXIT_INTERNAL_ERROR, true);
    return;
  }
  if (rv.schema === 'sftp') {
    this.sftpConnectToDestination(destination);
    return;
  }

  // We have to set the url here rather than in connectToArgString, because
  // some callers may come directly to connectToDestination.
  this.navigate_(destination);

  this.connectTo(rv);
};

/**
 * Mount a remote host given a destination string.
 *
 * @param {string} destination A string of the form username@host[:port].
 */
CommandInstance.prototype.mountDestination = function(destination) {
  // This code path should currently be unreachable.  If that ever changes,
  // we can look at merging with the mountProfile code.
  this.io.println('Not implemented; please file a bug.');
  this.exit(EXIT_INTERNAL_ERROR, true);
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
export function splitCommandLine(argstr) {
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
}

/**
 * Initiate a SFTP connection to a remote host.
 *
 * @param {string} destination A string of the form username@host[:port].
 */
CommandInstance.prototype.sftpConnectToDestination = function(destination) {
  const rv = parseDestination(destination);
  if (rv === null) {
    this.io.println(localize('BAD_DESTINATION', [destination]));
    this.exit(EXIT_INTERNAL_ERROR, true);
    return;
  }

  // We have to set the url here rather than in connectToArgString, because
  // some callers may come directly to connectToDestination.
  this.navigate_(destination);

  this.isSftp = true;
  this.sftpClient = new sftpClient();

  this.connectTo(rv);
};

/**
 * Initiate an asynchronous connection to a remote host.
 *
 * @param {!Object} params The various connection settings setup via the
 *     prefsToConnectParams_ helper.
 * @param {function(!Object, !Object): !Promise<void>=} finalize Call this
 *     instead of the normal connectToFinalize_.
 * @return {!Promise<void>}
 */
CommandInstance.prototype.connectTo = async function(params, finalize) {
  if (params.hostname == '>crosh') {
    // TODO: This should be done better.
    const template = 'crosh.html?profile=%encodeURIComponent(terminalProfile)';
    this.terminalLocation.href = lib.f.replaceVars(template, params);
    return;
  } else if (params.hostname === '>connections') {
    this.promptForDestination_();
    return;
  }

  // If no username was specified, prompt the user for one.
  if (params.username === undefined) {
    const io = this.io.push();

    const container = document.createElement('div');
    const prompt = document.createElement('p');
    prompt.textContent = 'Please enter username:';
    container.appendChild(prompt);
    const input = document.createElement('input');
    container.appendChild(input);
    io.showOverlay(container, null);

    // Force focus after the browser has a chance to render things.
    setTimeout(() => input.focus());

    // Keep accepting input until they press Enter.
    input.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Enter') {
        params.username = input.value;
        io.hideOverlay();
        io.pop();
        this.connectTo(params, finalize);
      }
    }, true);
    // The terminal will eat all key events, so make sure we stop that.
    input.addEventListener('keyup', (e) => e.stopPropagation(), true);
    input.addEventListener('keypress', (e) => e.stopPropagation(), true);

    // If the terminal becomes active for some reason, force back to the input.
    io.onVTKeystroke = io.sendString = (string) => {
      input.focus();
    };
    return;
  }

  // First tokenize the options into an object we can work with more easily.
  let /** @type {!Object<string, string>} */ options = {};
  try {
    options = tokenizeOptions(params.nasshOptions);
  } catch (e) {
    this.io.println(localize('NASSH_OPTIONS_ERROR', [e]));
    this.exit(EXIT_INTERNAL_ERROR, true);
    return;
  }

  let /** @type {!Object<string, string>} */ userOptions = {};
  try {
    userOptions = tokenizeOptions(params.nasshUserOptions);
  } catch (e) {
    this.io.println(localize('NASSH_OPTIONS_ERROR', [e]));
    this.exit(EXIT_INTERNAL_ERROR, true);
    return;
  }

  // Merge nassh options from the ssh:// URI that we believe are safe.
  Object.keys(userOptions).forEach((option) => {
    if (isSafeUriNasshOption(option)) {
      options[option] = userOptions[option];
    } else {
      console.warn(`Option ${option} not currently supported`);
    }
  });

  // Finally post process the combined result.
  options =
      postProcessOptions(options, params.hostname, params.username,
                         this.isMount);

  // Merge ssh options from the ssh:// URI that we believe are safe.
  params.userSshArgs = [];
  const userSshOptionsList = splitCommandLine(params.nasshUserSshOptions).args;
  userSshOptionsList.forEach((option) => {
    if (isSafeUriSshOption(option)) {
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
    setDefaultBackend(/** @type {string} */ (options['--field-trial-buffer']));
  }

  // If the user has requested a proxy relay, load it up.
  if (options['--proxy-mode'] === 'websockify') {
    this.relay_ = new RelayWebsockify(this.io, options, this.terminalLocation,
                                      this.sessionStorage, this.localPrefs_);
  } else if (!options['--proxy-host']) {
    // Do nothing when disabled.  We check this first to avoid excessive
    // indentation or redundant checking of the proxy-host setting below.
  } else if (options['--proxy-mode'] == 'ssh-fe@google.com') {
    this.relay_ = new RelaySshfe(
        this.io, options, this.terminalLocation, this.sessionStorage,
        this.localPrefs_);
    this.io.println(localize(
        'FOUND_RELAY',
        [`${this.relay_.proxyHost}:${this.relay_.proxyPort}`]));
    await this.relay_.init();
  } else if (options['--proxy-mode'] == 'corp-relay@google.com' ||
             options['--proxy-mode'] == 'corp-relay-v4@google.com') {
    if (options['--proxy-mode'] == 'corp-relay@google.com') {
      this.relay_ = new RelayCorp(this.io, options, this.terminalLocation,
                                  this.sessionStorage, this.localPrefs_);
    } else {
      this.relay_ = new RelayCorpv4(this.io, options, this.terminalLocation,
                                    this.sessionStorage, this.localPrefs_);
    }

    this.io.println(localize(
        'INITIALIZING_RELAY',
        [`${this.relay_.proxyHost}:${this.relay_.proxyPort}`]));

    if (params.relayState !== undefined) {
      this.relay_.loadState(params.relayState);
    } else if (!await this.relay_.init()) {
      // If --relay-method=direct, this is an error.
      if (this.relay_.relayMethod === 'direct') {
        this.io.println(localize(
            'RELAY_AUTH_ERROR',
            [`${this.relay_.proxyHost}:${this.relay_.proxyPort}`]));
        this.exit(EXIT_INTERNAL_ERROR, true);
        return;
      }

      // A false return value means we have to redirect to complete
      // initialization.  Bail out of the connect for now.  We'll resume it
      // when the relay is done with its redirect.

      // If we're trying to mount the connection, remember it.
      this.sessionStorage.setItem('nassh.isMount', this.isMount);
      this.sessionStorage.setItem('nassh.isSftp', this.isSftp);

      if (!this.relay_.redirect()) {
        this.exit(EXIT_INTERNAL_ERROR, true);
      }
      return;
    }
  } else if (options['--proxy-mode']) {
    // Unknown proxy mode.
    this.io.println(localize('NASSH_OPTIONS_ERROR',
                              [`--proxy-mode=${options['--proxy-mode']}`]));
    this.exit(EXIT_INTERNAL_ERROR, true);
    return;
  }

  // Attempt to refresh certificates if need be.
  const refresh = options['cert-refresh'] ?
      gcseRefreshCert(this.io) : Promise.resolve();
  // Even if refreshing went horribly, attempt the connection anyways.
  return refresh.finally(() => {
    if (finalize) {
      return finalize(params, options);
    } else {
      return this.connectToFinalize_(params, options);
    }
  });
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
CommandInstance.prototype.connectToFinalize_ = async function(params, options) {
  // Make sure the selected ssh-client version is somewhat valid.
  if (options['--ssh-client-version']) {
    this.sshClientVersion_ = options['--ssh-client-version'];
  } else if (this.sshClientVersion_ === 'pnacl') {
    if (lib.f.randomInt(0, 100) < 5 || this.isDevVersion()) {
      this.io.println(sgrText(
          'Opting in to WASM for this session.  Please report issues.\n\r' +
          'Use --ssh-client-version=pnacl to temporarily opt-out.\n\r',
          {bold: true}));
      this.sshClientVersion_ = 'wasm';
    }
  }
  if (!this.sshClientVersion_.match(/^[a-zA-Z0-9.-]+$/)) {
    this.io.println(localize('UNKNOWN_SSH_CLIENT_VERSION',
                              [this.sshClientVersion_]));
    this.exit(127, true);
    return;
  }

  if (options['--ssh-agent']) {
    params.authAgentAppID = options['--ssh-agent'];
  }

  this.io.setTerminalProfile(
      params.terminalProfile || hterm.Terminal.DEFAULT_PROFILE_ID);

  // If they're using an internationalized domain name (IDN), then punycode
  // will return a different ASCII name.  Include that in the display for the
  // user so it's clear where we end up trying to connect to.
  const idn_hostname = punycode.toASCII(params.hostname);
  let disp_hostname = params.hostname;
  if (idn_hostname != params.hostname) {
    disp_hostname += ' (' + idn_hostname + ')';
  }

  const argv = {
    debugTrace: options['--debug-trace-syscalls'],
  };
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
  const extraArgs = splitCommandLine(params.argstr);
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
    this.authAgent_ = new Agent(backendIDs, this.io.terminal_, forwardAgent);
  }

  await this.initPlugin_(argv);
  this.terminalWindow.addEventListener('beforeunload', this.onBeforeUnload_);

  this.io.println(localize('CONNECTING',
                           [`${params.username}@${disp_hostname}`]));

  lib.notNull(this.plugin_);
  if (this.plugin_ instanceof NaclPlugin) {
    this.plugin_.send('startSession', [argv]);
  }
  if (this.isSftp) {
    try {
      await this.sftpClient.initConnection(this.plugin_);
      this.onSftpInitialised();
    } catch (e) {
      this.io.println(localize('NASFTP_ERROR_MESSAGE', [e]));
      this.exit(EXIT_INTERNAL_ERROR, true);
    }
  }
};

/**
 * Turn the nassh option string into an object.
 *
 * @param {string=} optionString The set of --long options to parse.
 * @return {!Object<string, string>} A map of --option to its value.
 */
export function tokenizeOptions(optionString = '') {
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
}

/**
 * Nassh options we allow from ssh:// URIs that we believe are safe.
 *
 * NB: We implicitly allow negative verions.  For example, --welcome implies
 * --no-welcome is also safe.
 *
 * @type {!Set<string>}
 */
const safeUriNasshOptions = new Set([
  '--config', '--proxy-mode', '--proxy-host', '--proxy-port', '--proxy-user',
  '--ssh-agent', '--welcome', '--egress-domain',
]);

/**
 * Determine whether a nassh option is safe for URIs.
 *
 * NB: This function is expected to be called after tokenizing.  Thus it looks
 * for values like `--config`, not `--config=google`.
 *
 * @param {string} option The option to check.
 * @return {boolean} Whether the option is safe.
 */
export function isSafeUriNasshOption(option) {
  // See if the option is explicitly listed.
  if (safeUriNasshOptions.has(option)) {
    return true;
  }

  // See if the negative variant is used.
  if (option.startsWith('--no-')) {
    return isSafeUriNasshOption(`--${option.substr(5)}`);
  }

  // No matches, so assume it's unsafe.
  return false;
}

/**
 * OpenSSH options we allow from ssh:// URIs that we believe are safe.
 *
 * @type {!Set<string>}
 */
const safeUriSshOptions = new Set([
  '-4', '-6', '-a', '-A', '-C', '-q', '-Q', '-v', '-V',
]);

/**
 * Determine whether an OpenSSH option is safe for URIs.
 *
 * NB: This function is expected to be called after command line splitting.
 * Thus it supports separate options only like -4 -q and not -4q.
 *
 * @param {string} option The option to check.
 * @return {boolean} Whether the option is safe.
 */
export function isSafeUriSshOption(option) {
  return safeUriSshOptions.has(option);
}

/**
 * Expand & process nassh options.
 *
 * @param {!Object<string, *>} options A map of --option to its value.
 * @param {string} hostname The hostname we're connecting to.
 * @param {string} username The ssh username we're using.
 * @param {boolean} isMount Whether the connection is for mounting.
 * @return {!Object<string, *>} A map of --option to its value.
 */
export function postProcessOptions(options, hostname, username, isMount) {
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
        'ssh-relay-router.corp.google.com' : 'ssh-relay.corp.google.com';
    const proxyMode = useSupSshRelay ?
        'corp-relay-v4@google.com' : 'corp-relay@google.com';
    const proxyHostFallback = useSupSshRelay ?
        'sup-ssh-relay.corp.google.com' : 'ssh-relay-fallback.corp.google.com';

    rv = Object.assign({
      'auth-agent-forward': forwardAgent,
      '--proxy-host': proxyHost,
      '--proxy-host-fallback': proxyHostFallback,
      '--proxy-port': '443',
      '--proxy-mode': proxyMode,
      '--proxy-remote-host': hostname,
      '--use-ssl': true,
      '--report-ack-latency': !isMount,
      '--report-connect-attempts': true,
      '--relay-protocol': 'v2',
      '--ssh-agent': 'gnubby',
      'cert-refresh': true,
    }, rv);

    // Default enable connection resumption when using newer proxy mode.
    rv = Object.assign({
      '--resume-connection': rv['--proxy-mode'] === 'corp-relay-v4@google.com',
    }, rv);

    // Terminal-SSH must use method=direct since it does not allow redirects.
    if (isCrOSSystemApp()) {
      rv = Object.assign({
        '--relay-method': 'direct',
      }, rv);
    }
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
    rv['--ssh-agent'] = getGnubbyExtension();
  }

  // Default the relay username to the ssh username.
  if (!rv['--proxy-user']) {
    rv['--proxy-user'] = username;
  }

  return rv;
}

/**
 * Dispatch a "message" to one of a collection of message handlers.
 *
 * @param {string} desc
 * @param {!Object} handlers
 * @param {!Object} msg
 */
CommandInstance.prototype.dispatchMessage_ = function(desc, handlers, msg) {
  if (msg.name in handlers) {
    handlers[msg.name].apply(this, msg.argv);
  } else {
    console.log('Unknown "' + desc + '" message: ' + msg.name);
  }
};

/**
 * @param {!Array<string>} argv SSH command line arguments.
 * @param {!Object<string, string>} environ SSH environment variables.
 * @param {!Object=} options
 * @return {!Promise<void>}
 */
CommandInstance.prototype.initWasmPlugin_ =
    async function(argv, environ, {trace = false} = {}) {
  this.plugin_ = new WasmPlugin({
    executable: `../../plugin/${this.sshClientVersion_}/ssh.wasm`,
    argv: argv,
    environ: environ,
    terminal: this.io.terminal_,
    trace: trace,
    authAgent: this.authAgent_,
    authAgentAppID: this.authAgentAppID_,
    relay: this.relay_,
    isSftp: this.isSftp,
    sftpClient: this.sftpClient,
    secureInput: (...args) => this.secureInput(...args),
    syncStorage: this.syncStorage,
  });
  return this.plugin_.init();
};

/**
 * @param {!Object} argv Plugin arguments.
 * @return {!Promise<void>}
 */
CommandInstance.prototype.initNaclPlugin_ = async function(argv) {
  syncFilesystemFromIndexeddbToDom();

  this.plugin_ = new NaclPlugin({
    io: this.io,
    sshClientVersion: this.sshClientVersion_,
    onExit: async (code) => {
      syncFilesystemFromDomToIndexeddb();

      await this.onPluginExit(code);
      this.exit(code, /* noReconnect= */ false);
    },
    secureInput: (...args) => this.secureInput(...args),
    authAgent: this.authAgent_,
    authAgentAppID: this.authAgentAppID_,
    relay: this.relay_,
    isSftp: this.isSftp,
    sftpClient: this.sftpClient,
  });
  return this.plugin_.init();
};

/**
 * @param {!Object} argv Plugin arguments.
 * @return {!Promise<void>}
 */
CommandInstance.prototype.initPlugin_ = async function(argv) {
  this.io.print(localize('PLUGIN_LOADING', [this.sshClientVersion_]));
  if (this.sshClientVersion_.startsWith('pnacl')) {
    await this.initNaclPlugin_(argv);
    this.io.println(localize('PLUGIN_LOADING_COMPLETE'));
  } else {
    await this.initWasmPlugin_(argv.arguments, argv.environment, {
      trace: argv.debugTrace,
    });
    this.io.println(localize('PLUGIN_LOADING_COMPLETE'));
    this.plugin_.run().then(async (code) => {
      await this.onPluginExit(code);
      this.exit(code, /* noReconnect= */ false);
    });
  }
};

/**
 * Remove the plugin from the runtime.
 */
CommandInstance.prototype.removePlugin_ = function() {
  if (this.plugin_) {
    this.plugin_.remove();
    this.plugin_ = null;
  }
};

/**
 * Exit the nassh command.
 *
 * @param {number} code Exit code, 0 for success.
 * @param {boolean} noReconnect
 */
CommandInstance.prototype.exit = function(code, noReconnect) {
  if (this.exited_) {
    return;
  }

  this.exited_ = true;

  this.terminalWindow.removeEventListener('beforeunload', this.onBeforeUnload_);

  // Hard destroy the plugin object.  In the past, we'd send onExitAcknowledge
  // to the plugin and let it exit/cleanup itself.  The NaCl runtime seems to
  // be a bit unstable though when using threads, so we can't rely on it.  See
  // https://crbug.com/710252 for more details.
  this.removePlugin_();

  if (this.isMount) {
    if (this.fsp) {
      this.fsp.unmount(this.mountOptions.fileSystemId);
    }
    if (this.argv_.onExit) {
      this.argv_.onExit(code);
    }

    console.log(localize('DISCONNECT_MESSAGE', [code]));
    return;
  }

  const io = this.io.push();
  const container = document.createElement('div');
  container.appendChild(new Text(localize('DISCONNECT_MESSAGE', [code])));
  container.appendChild(document.createElement('br'));
  container.appendChild(new Text(localize(
      noReconnect ? 'CONNECT_OR_EXIT_MESSAGE' : 'RECONNECT_MESSAGE')));
  io.showOverlay(container, null);

  io.onVTKeystroke = (string) => {
    const ch = string.toLowerCase();
    switch (ch) {
      case 'c':
      case '\x12': // ctrl-r
        this.terminalLocation.replace(lib.f.getURL(this.connectPage));
        break;

      case 'e':
      case 'x':
      case '\x1b': // ESC
      case '\x17': // ctrl-w
        io.hideOverlay();
        io.pop();
        if (this.argv_.onExit) {
          this.argv_.onExit(code);
        }
        break;

      case 'r':
      case ' ':
      case '\x0d': // enter
        if (!noReconnect) {
          io.hideOverlay();
          io.pop();
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
CommandInstance.prototype.onBeforeUnload_ = function(e) {
  if (hterm.windowType == 'popup') {
    return;
  }

  const msg = localize('BEFORE_UNLOAD');
  e.returnValue = msg;
  return msg;
};

/**
 * SFTP Initialization handler. Mounts the SFTP connection as a file system.
 */
CommandInstance.prototype.onSftpInitialised = function() {
  if (this.isMount) {
    this.mountOptions['persistent'] = false;

    // Mount file system.
    chrome.fileSystemProvider.mount(this.mountOptions, () => {
      const err = lib.f.lastError();
      if (!err) {
        // Add this instance to list of SFTP instances.
        this.fsp.addMount(this.mountOptions.fileSystemId, {
          sftpClient: lib.notNull(this.sftpClient),
          exit: this.exit.bind(this),
        });
      }

      if (this.sftpStartupCallback) {
        this.sftpStartupCallback(!err, err);
      }
    });
  } else {
    // Interactive SFTP client case.
    this.sftpCli_ = new nasftpCli(this);

    // Useful for console debugging.
    this.terminalWindow.nasftp_ = this.sftpCli_;

    this.sftpCli_.run().then(() => {
      if (this.sftpStartupCallback) {
        this.sftpStartupCallback(true, null);
      }
    });
  }
};

/**
 * Get secure input from the user.
 *
 * This internal wrapper is because the Web APIs are callback based, and writing
 * this with Promises is not easy.  So this can be easily wrapped with Promises.
 *
 * @param {string} prompt The prompt for the user.
 * @param {number} buf_len Max length of user input.
 * @param {boolean} echo Whether to echo the user input.
 * @param {function(string)} callback Called with the user's input.
 */
CommandInstance.prototype.secureInput_ = function(
    prompt, buf_len, echo, callback) {
  const io = this.io.push();

  // Perform common cleanup tasks before exiting the prompt.
  const cleanup = (pass) => {
    io.hideOverlay();
    io.pop();
    this.io.terminal_.focus();
    callback(pass);
  };

  // Strip leading & trailing newlines & random spaces.  Often the prompt is
  // expected to be displayed inline, so it has to include padding to separate
  // it from existing output.  That doesn't apply here.
  prompt = prompt.trim();

  const container = document.createElement('div');

  const header = document.createElement('p');
  header.style.fontWeight = 'bold';
  header.style.whiteSpace = 'pre-wrap';
  header.textContent = prompt;
  container.appendChild(header);

  const span = document.createElement('span');
  span.style.whiteSpace = 'nowrap';

  // If echo is disabled, assume it's a password field.  If it's enabled, allow
  // normal text editing & viewing.
  const input = document.createElement('input');
  input.type = echo ? 'text' : 'password';
  input.ariaLabel = prompt;
  input.maxLength = buf_len - 1;
  input.style.width = echo ? '100%' : '90%';
  span.appendChild(input);

  // For password inputs, add a dynamic toggle.
  if (!echo) {
    const toggle = document.createElement('img');
    toggle.src = IMG_VISIBILITY_URI;
    toggle.style.cursor = 'pointer';
    toggle.style.verticalAlign = 'middle';
    toggle.addEventListener('click', (e) => {
      if (input.type === 'text') {
        input.type = 'password';
        toggle.src = IMG_VISIBILITY_URI;
      } else {
        input.type = 'text';
        toggle.src = IMG_VISIBILITY_OFF_URI;
      }
    });
    span.appendChild(toggle);
  }

  container.appendChild(span);
  io.showOverlay(container, null);

  // Force focus after the browser has a chance to render things.
  setTimeout(() => input.focus());

  // The terminal will eat all key events, so make sure we stop that.
  input.addEventListener('keyup', (e) => e.stopPropagation(), true);
  input.addEventListener('keypress', (e) => e.stopPropagation(), true);

  // If the terminal becomes active for some reason, force back to the input.
  io.onVTKeystroke = io.sendString = (string) => {
    input.focus();
  };

  // Keep accepting input until they press Enter or Escape.
  input.addEventListener('keydown', (e) => {
    e.stopPropagation();
    if (e.key === 'Enter') {
      cleanup(input.value);
      e.preventDefault();
    } else if (e.key === 'Escape') {
      cleanup('');
      e.preventDefault();
    }
  }, true);
};

/**
 * Get secure input from the user.
 *
 * @param {string} prompt The prompt for the user.
 * @param {number} buf_len Max length of user input.
 * @param {boolean} echo Whether to echo the user input.
 * @return {!Promise<string>} A Promise that resolves to the user's input.
 */
CommandInstance.prototype.secureInput = function(prompt, buf_len, echo) {
  return new Promise((resolve) => {
    this.secureInput_(prompt, buf_len, echo, resolve);
  });
};

/**
 * A user should override this if they want to get notified when the ssh NaCl
 * plugin exits.
 *
 * @param {number} code The exit code.
 * @return {!Promise<void>}
 */
CommandInstance.prototype.onPluginExit = async function(code) {};
