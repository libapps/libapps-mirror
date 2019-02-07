```
                            .--~~~~~~~~~~~~~------.
                           /--===============------\
                           | |```````````````|     |
                           | |               |     |
                           | |      >_<      |     |
                           | |               |     |
                           | |_______________|     |
                           |                   ::::|
                           '======================='
                           //-"-"-"-"-"-"-"-"-"-"-\\
                          //_"_"_"_"_"_"_"_"_"_"_"_\\
                          [-------------------------]
                          \_________________________/


                          Secure Shell Developer Guide
```

[TOC]

# Introduction

Secure Shell is a Chrome App (currently a "v1.5" app, soon to become a "v2" or
Platform App) that combines hterm with a NaCl build of OpenSSH to provide
a PuTTY-like app for Chrome users.

See [/HACK.md](/HACK.md) for general information about working with the source
control setup.

# Building the dependencies

The Secure Shell app depends on some library code from
[libapps/libdot/](/libdot/) and the hterm terminal emulator from in
[libapps/hterm/](/hterm/).  To build these external dependencies, run...

    nassh$ ./bin/mkdeps.sh

This will create the `nassh/js/nassh_deps.concat.js` file containing all of the
necessary libdot and hterm source.  If you find yourself changing a lot of
libdot or hterm code and testing those changes in Secure Shell you can run this
script with the "--forever" (aka -f) option.  When run in this manner it will
automatically re-create nassh_deps.concat.js file whenever one of the source
files is changed.

## The NaCl plugin dependency

Secure Shell depends on a NaCl (Native Client) plugin to function.  This plugin
is a port of OpenSSH.  You'll have to find or create a version of this plugin,
and copy it into `libapps/nassh/plugin/`.

Your options are (pick one):

1. Build it yourself from [ssh_client].  This can take some time, but once it's
finished:
```
# In the ssh_client/ directory.
$ cp -a output/hterm/plugin/ ../nassh/
```

2. Grab an existing release.  For example:
```
# In the nassh/ directory.
$ wget https://commondatastorage.googleapis.com/chromeos-localmirror/secureshell/releases/0.8.39.tar.xz
$ tar --strip-components=1 -xf 0.8.39.tar.xz hterm/plugin
```

3. Copy the `plugin/` directory from the latest version of Secure Shell.
If you have Secure Shell installed, the plugin can be found in your profile
directory, under
`Default/Extensions/pnhechapfaindjhompbnflcldabbghjo/<version>/plugin/`.

# Dev-Test cycle

## Loading Unpacked Extensions

Loading directly from the checked out nassh directory is the normal way of
testing.  It will use the dev extension id to avoid conflicts with the stable
extension id, although it will still conflict if you have the dev version
installed from the Chrome Web Store (CWS).

You will need to manually select the variant you want to work on.  The extension
is defined by the [manifest_ext.json] file while the app is defined by the
[manifest_v1.5.json] file.  Simply symlink it to manifest.json:

    nassh$ ln -s manifest_ext.json manifest.json

For details on the different manifests and modes, see the next section (and the
[FAQ]).  You probably want to start with the extension version if you're not
going to be hacking on Chrome OS features.

The extension id is controlled by the `key` field in the manifest.json.  See
the [manifest key docs](https://developer.chrome.com/extensions/manifest/key)
for more details.

### Adding To Chrome

Now that your checkout is ready, you can load it into Chrome.

1. Navigate to the `chrome://extensions` page.
2. Turn on *Developer Mode* (look for the toggle in the upper right or bottom
   right of the page depending on Chrome version).
3. Click *Load Unpacked Extension* and navigate to the `nassh/` directory.

If you're not running on Chrome OS device, and loading the app, you might see
warnings right away about certain permissions (see the whitelisted sections
below).  You can ignore those.  It's unfortunate they show up with the same
level/color as legitmate errors.
```
* 'file_system_provider_capabilities' is only allowed for extensions and packaged apps, but this is a legacy packaged app.
* 'terminalPrivate' is not allowed for specified platform.
* 'fileSystemProvider' is not allowed for specified platform.
```

## Manifests

There are three manifest files in here currently.  The [manifest_v1.5.json] is
used to build the Secure Shell App and has been what we've used for the longest
time, but is largely for Chrome OS only now.  The [manifest_ext.json] is used to
build the Secure Shell Extension which works on all platforms (but lacks any
Chrome OS specific features).

The [manifest_v2.json] is not used currently.  Some day we might finish the
migration and replace [manifest_v1.5.json] with it so we only have one app
manifest.  Today it is not often tested.

The "v1.5" and "v2" app formats should not be confused with the "v1" and "v2"
manifest formats.  Secure Shell uses the legacy/deprecated "v1.5" app style to
launch itself rather than the "v2" style.  It means that, in many ways, the
"v1.5" app behaves more like an extension (e.g. it shares cookies with your main
browser instance and can run inside a tab) rather than an app (e.g. it doesn't
get access to many newer `chrome.app.*` APIs).

See the [FAQ] for more details on the differences between the extension & app.

If you're updating these files, you'll sometimes also need to update the
[manifest][manifest_crosh.json] for [crosh] which lives in the Chromium tree.

## Whitelisted Permissions

Using the dev extension id is necessary in order to access some APIs that are
whitelisted only for Secure Shell.  If you don't need these features, you can
get by with using a different id (and delete the settings from the
[manifest_v1.5.json] for the app to avoid warnings at runtime).  These settings
are already removed from the [manifest_ext.json] for the extension.

* Access to [crosh] under Chrome OS (`terminalPrivate`).
  [(1)](https://cs.chromium.org/search/?q=terminalPrivate)
  [(2)](https://cs.chromium.org/chromium/src/chrome/common/extensions/api/terminal_private.json)
  [(3)](https://cs.chromium.org/chromium/src/chrome/browser/extensions/api/terminal/terminal_extension_helper.cc)
* Access to raw sockets under NaCl.  This allows connecting directly to SSH
  servers (e.g. port 22).
  [(1)](https://cs.chromium.org/search/?q=kPredefinedAllowedSocketOrigins)
  <br>
  Note: Making connections over https using relay servers will still work
  though.  See the [FAQ] for more details.
* SFTP backend for Chrome OS (`fileSystemProvider` and
  `file_system_provider_capabilities`).
  [(1)](https://cs.chromium.org/chromium/src/chrome/common/extensions/api/_permission_features.json)
  <br>
  Note: Normal extensions/apps can use these features, but since Secure Shell
  is still a "legacy packaged app", we had to whitelist access.

To double check what & where things are whitelisted, search the Chromium code
base for our extension ids:

| Name             | ID                                    | hash                                          |
|------------------|---------------------------------------|-----------------------------------------------|
| Stable App       | [cs/pnhechapfaindjhompbnflcldabbghjo] | [cs/0EA6B717932AD64C469C1CCB6911457733295907] |
| Dev App          | [cs/okddffdblfhhnmhodogpojmfkjmhinfp] | [cs/58B0C2968C335964D5433E89CA4D86628A0E3D4B] |
| Stable Extension | [cs/iodihamcpbpeioajjeobimgagajmlibd] | [cs/3BC1ED0B3E6EFDC7BD4D3D1D75D44B52DEE0A226] |
| Dev Extension    | [cs/algkcnfjnajfhgimadimbjhmpaeohhln] | [cs/38C361D4A0726CE45D3572D65071B6BDB3092371] |
| Crosh            | [cs/nkoccljplnhpfnfiajclkommnmllphnl] | [cs/505FEAE9DD5B27637DCF72045ECA2D5D7F66D2FD] |

The hashes are the SHA1's of the (lower case) extension id.
```sh
$ ext_id_hash() { printf "$1" | tr '[:upper:]' '[:lower:]' | sha1sum | tr '[:lower:]' '[:upper:]'; }
$ ext_id_hash pnhechapfaindjhompbnflcldabbghjo
0EA6B717932AD64C469C1CCB6911457733295907
```

[cs/pnhechapfaindjhompbnflcldabbghjo]: https://cs.chromium.org/search/?q=pnhechapfaindjhompbnflcldabbghjo
[cs/okddffdblfhhnmhodogpojmfkjmhinfp]: https://cs.chromium.org/search/?q=okddffdblfhhnmhodogpojmfkjmhinfp
[cs/iodihamcpbpeioajjeobimgagajmlibd]: https://cs.chromium.org/search/?q=iodihamcpbpeioajjeobimgagajmlibd
[cs/algkcnfjnajfhgimadimbjhmpaeohhln]: https://cs.chromium.org/search/?q=algkcnfjnajfhgimadimbjhmpaeohhln
[cs/nkoccljplnhpfnfiajclkommnmllphnl]: https://cs.chromium.org/search/?q=nkoccljplnhpfnfiajclkommnmllphnl
[cs/0EA6B717932AD64C469C1CCB6911457733295907]: https://cs.chromium.org/search/?q=0EA6B717932AD64C469C1CCB6911457733295907
[cs/58B0C2968C335964D5433E89CA4D86628A0E3D4B]: https://cs.chromium.org/search/?q=58B0C2968C335964D5433E89CA4D86628A0E3D4B
[cs/3BC1ED0B3E6EFDC7BD4D3D1D75D44B52DEE0A226]: https://cs.chromium.org/search/?q=3BC1ED0B3E6EFDC7BD4D3D1D75D44B52DEE0A226
[cs/38C361D4A0726CE45D3572D65071B6BDB3092371]: https://cs.chromium.org/search/?q=38C361D4A0726CE45D3572D65071B6BDB3092371
[cs/505FEAE9DD5B27637DCF72045ECA2D5D7F66D2FD]: https://cs.chromium.org/search/?q=505FEAE9DD5B27637DCF72045ECA2D5D7F66D2FD

## Partner Extensions

There are a few extensions we talk to for various services at runtime which need
to whitelist our extension ids (for source verification).  If you don't need any
of these services, then you can ignore it.

* [gnubbyd app beknehfpfkghjoafdifaflglpjkojoco](https://chrome.google.com/webstore/detail/beknehfpfkghjoafdifaflglpjkojoco)
  * Optional SSH Agent backend (mostly for internal Google use).
  * See http://cl/180966847 as an example.
* [gnubbyd extension lkjlajklkdhaneeelolkfgbpikkgnkpk](https://chrome.google.com/webstore/detail/lkjlajklkdhaneeelolkfgbpikkgnkpk)
  * Same as above.
* [Smart Card Connector khpfeaanjngmcnplbdlpegiifgpfgdco](https://chrome.google.com/webstore/detail/khpfeaanjngmcnplbdlpegiifgpfgdco)
  * Optional SSH Agent backend built for [hardware keys](./hardware-keys.md).
  * See https://github.com/GoogleChromeLabs/chromeos_smart_card_connector/pull/54 as an example.

## Stable Extension

If you try to load an unpacked extension using the stable extension id, you
might run into problems if your administrator installs it via enterprise
policy.  If you see the error below, you won't be able to bypass it.  Just
use the dev extension id instead.
```
Secure Shell (extension ID "pnhechapfaindjhompbnflcldabbghjo") is blocked by the administrator.
```

## Crosh

While most of the UI code for [crosh] lives here (e.g. HTML/CSS/JS), the backend
code and manifest lives in Chrome.

* [chrome/common/extensions/api/](https://cs.chromium.org/chromium/src/chrome/common/extensions/api/):
  * [terminal_private.json](https://cs.chromium.org/chromium/src/chrome/common/extensions/api/terminal_private.json):
    Defines the `chrome.terminalPrivate` JavaScript API.
* [chrome/browser/extensions/api/terminal/](https://cs.chromium.org/chromium/src/chrome/browser/extensions/api/terminal/):
  Implements the `chrome.terminalPrivate` JavaScript API.
* [chrome/browser/resources/chromeos/crosh_builtin/](https://cs.chromium.org/chromium/src/chrome/browser/resources/chromeos/crosh_builtin/)
  * [manifest.json][manifest_crosh.json]: Manifest for the [crosh] extension.
* [chromeos/process_proxy/](https://cs.chromium.org/chromium/src/chromeos/process_proxy/):
  * Utility classes to manage processes and input/output for commands invoked
    by the `api/terminal/` code.

# Coding Style

See the [libapps hacking document](../../HACK.md) for details.

# Source Layout

Keep in mind that the NaCl [ssh_client] code does not live here.

The vast majority of the code here lives under [js/].

* [bin/]: Tools for building/testing this extension.
* concat/: Compiled output of other projects we use.
* [css/]: Any CSS needed for styling UI.
  * [chrome-bootstrap.css]: Theme code for the extensions options page.
  * [nassh_box.css]: Common utility styling code.
  * [nassh_connect_dialog.css]: Styling for the connection dialog.
  * [nassh_preferences_editor.css]: Styling for the extensions options page.
* dist/: Builds of the Chrome extension.
* [doc/]: Documentation files.
* [html/]: The main UI objects.
  * [crosh.html]: Chrome OS developer shell.  Not used outside of Chrome OS.
  * [nassh.html]: The main ssh terminal page.
  * [nassh_connect_dialog.html]: The main connection dialog.
  * [nassh_google_relay.html]: Stub page when redirecting with external relay.
  * [nassh_preferences_editor.html]: The options page.
  * [nassh_popup.html]: The small popup when using the extension (not the app).
  * [nassh_test.html]: Run all available unittests.
* [images/]: Various extension images.
* [js/]: The majority of relevant code for this extension.
  * `*.concat.js`: Compiled JS output of other projects we use.
  * See the section below.
* [_locales/]: [Translations](https://developer.chrome.com/extensions/i18n) of strings shown to the user.
* plugin/: Compiled NaCl & output from [ssh_client]
* [manifest_ext.json]: The Chrome manifest for the extension.
* [manifest_v1.5.json]: The Chrome manifest for the "v1.5" app.
* [manifest_v2.json]: The Chrome manifest for the "v2" app.

## JavaScript Source Layout

* Main Secure Shell code
  * [nassh.js]: Main `nassh` object setup and glue code to Chrome runtime.
  * [nassh_app.js]: Main `nassh.App` code.
  * [nassh_command_instance.js]: Main `nassh.CommandInstance` launching code.
  * [nassh_google_relay.js]: Web relay `nassh.GoogleRelay` code for proxying
    connections.
  * [nassh_preference_manager.js]: Logic holding user preferences.
* Extension glue code
  * [nassh_background.js]: Background extension code.  
  * [nassh_main.js]: Main code to initialize a new connection and hand off.
* Stream (I/O) related code
  * [nassh_stream.js]: Basic class for implementing all `nassh.Stream` streams.
  * [nassh_stream_google_relay.js]: 
  * [nassh_stream_set.js]: 
  * [nassh_stream_sftp.js]: Stream for passing binary SFTP data through.
  * [nassh_stream_sshagent.js]:
    SSH agent implementation using nassh.agent.Agent to relay requests to
    backends.
  * [nassh_stream_sshagent_relay.js]:
    SSH Agent API for connecting to other extensions.  They provide key store
    backing (such as the [gnubbyd] extension).
  * [nassh_stream_tty.js]: Basic input/output tty streams.
* Testing related code
  * [nassh_test.js]: Main unittest runner logic.  Locates & runs all tests.
  * `*_tests.js`: Each module has a corresponding set of unittests.  The
    filename follows the convention of adding `_tests`.  e.g. `nassh_tests.js`
    contains the tests for `nassh.js`.
* SSH agent code
  * [nassh_agent.js]:
    An SSH agent that aggregates responses from multiple dynamically loaded
    backends.
  * [nassh_agent_backend.js]:
    A dummy backend for the SSH agent from which all other backends derive.
  * [nassh_agent_message.js]:
    General message handling in accordance with the SSH agent protocol.
  * [nassh_agent_message_types.js]:
    Code for dealing with the specific message types used in the SSH agent
    protocol.
  * [nassh_agent_backend_gsc.js]:
    An SSH agent backend that supports private keys stored on smart cards,
    using the Google Smart Card Connector app.

There are a few specialized modules that are not relevant to the core
Secure Shell logic.

* [crosh.js]: Chrome OS developer shell.  Only used with [crosh.html].
* Code for hooking into [wash].  Only used with that.
  * [nassh_executables.js]
  * [nassh_nassh.js]
* Connections page specific code (i.e. [nassh_connect_dialog.html]).
  * [nassh_column_list.js]: Utility code for showing things in columns.
  * [nassh_connect_dialog.js]: The main connection dialog page.
* Extension popup specific code (i.e. [nassh_popup.html]).
  * [nassh_extension_popup.js]: The extension popup startup logic.
* Redirection page specific code
  * [nassh_google_relay_html.js]
* Options page specific code
  * [nassh_preferences_editor.js]
* [SFTP specific code](#SFTP)
  * [nassh_sftp_client.js]: High level API over SFTP.
  * [nassh_sftp_fsp.js]: Glue layer between SFTP and
    [Chrome's File System Provider (FSP) API](https://developer.chrome.com/apps/fileSystemProvider).
  * [nassh_sftp_packet.js]: Basic nassh.sftp.Packet class.
  * [nassh_sftp_packet_types.js]: Specific packet types.
  * [nassh_sftp_status.js]: Status objects for SFTP code.

# NaCl/JS Life cycle

When the extension is launched (e.g. a new connection is opened), the background
page is automatically created.  This is used to monitor global state like
extension updates and coordinate SFTP mounts.  The logic lives in
[nassh_background.js] and takes care of creating a new instance of `nassh.App`
which it saves in the background page's `app` variable.  If you aren't looking
at the SFTP logic, you can probably ignore this code.

When the extension is run, a new [nassh.html] window is shown.  If no connection
info is provided via the URL, then an iframe is created to show
[nassh_connect_dialog.html].  Here the user manages their saved list of
connections and picks the one they want to connect to.  This logic is in
[nassh_connect_dialog.js].  Once the user makes a selection (either connecting
or mounting), a message is sent to [nassh_command_instance.js].  There the
connection dialog is closed, the NaCl plugin is loaded, and the streams are
connected to hterm.

## Exit Codes

Since the ssh program uses positive exit statuses, we tend to use -1 for
internal exit states in the JS code.
It doesn't matter too much as the exit values are purely for showing the user.

## JS->NaCl API

Here is the API that the JS code uses to communicate with the NaCl [ssh_client]
module.

The `nassh.CommandInstance.prototype.sendToPlugin_` function in
[nassh_command_instance.js] is used to package up and make all the calls.
Helper functions are also provided in that file to avoid a JS API to callers.

At the lowest level, we pass a dictionary to the plugin.  It has two fields,
both of which must be specified (even if `arguments` is just `[]`).

* `name`: The function we want to call (as a string).
* `arguments`: An array of arguments to the function.

The `name` field can be any one of:

| Function name        | Description                      | Arguments |
|----------------------|----------------------------------|-----------|
| `startSession`       | Start a new ssh connection!      | (object `session`) |
| `onOpenFile`         | Open a new file.                 | (int `fd`, bool `success`, bool `is_atty`) |
| `onOpenSocket`       | Open a new socket.               | (int `fd`, bool `success`, bool `is_atty`) |
| `onRead`             | Send new data to the plugin.     | (int `fd`, ArrayBuffer `data`) |
| `onWriteAcknowledge` | Tell plugin we've read data.     | (int `fd`, int `count`) |
| `onClose`            | Close an existing fd.            | (int `fd`) |
| `onReadReady`        | Notify plugin data is available. | (int `fd`, bool `result`) |
| `onResize`           | Notify terminal size changes.    | (int `width`, int `height`) |
| `onExitAcknowledge`  | Used to quit the plugin.         | () |

The session object currently has these members:

* str `username`: Username for accessing the remote system.
* str `host`: Hostname for accessing the remote system.
* int `port`: Port number for accessing the remote system.
* int `terminalWidth`: Initial width of the terminal window.
* int `terminalHeight`: Initial height of the terminal window.
* bool `useJsSocket`: Whether to use JS for network traffic.
* object `environment`: A key/value object of environment variables.
* array `arguments`: Extra command line options for ssh.
* int `writeWindow`: Size of the write window.
* str `authAgentAppID`: Extension id to use as the ssh-agent.
* str `subsystem`: Which subsystem to launch.

## NaCl->JS API

Here is the API that the NaCl [ssh_client] code uses to communicate with the
JS layers.

At the lowest level, we pass a dictionary to the JS code.  It has two fields,
both of which must be specified (even if `arguments` is just `[]`).

* `name`: The function we want to call (as a string).
* `arguments`: An array of arguments to the function.

The `name` field can be any one of:

| Function name | Description                       | Arguments |
|---------------|-----------------------------------|-----------|
| `openFile`    | Plugin wants to open a file.      | (int `fd`, str `path`, int `mode`) |
| `openSocket`  | Plugin wants to open a socket.    | (int `fd`, str `host`, int `port`) |
| `read`        | Plugin wants to read data.        | (int `fd`, int `count`) |
| `write`       | Plugin wants to write data.       | (int `fd`, ArrayBuffer `data`) |
| `close`       | Plugin wants to close an fd.      | (int `fd`) |
| `isReadReady` | Plugin wants to know read status. | (int `fd`) |
| `exit`        | The plugin is exiting.            | (int `code`) |
| `printLog`    | Send a string to `console.log`.   | (str `str`) |

# SFTP {#SFTP}

On Chrome OS, it is possible to mount remote paths via SFTP and the Files app.
We currently support [version 3][SFTPv3] of the protocol.
We don't support newer standards because the most popular implementation is
[OpenSSH]'s which only supports SFTPv3, and for the majority of Secure Shell
users, they only interact with [OpenSSH].

We could support newer versions, but they wouldn't be well tested, and not a
lot of people would even use it, and it's not like we'd see any performance
improvements (as our operations tend to be basic open/read/write/close).

## Extensions

We support a few optional extensions to improve behavior or performance.

### SSH_FXP_SYMLINK arguments

The [SFTPv3] protocol says the argument order should be linkpath then the
targetpath, but OpenSSH made a mistake and reversed the order.
They can't change the order without breaking existing clients or servers, so
they document it and leave it as-is.

We follow the [OpenSSH SFTP Protocol] here, as do many other clients.

[SFTPv6] noted this desync between implementations and the specification and
replaced the `SSH_FXP_SYMLINK` packet type with a new `SSH_FXP_LINK`.

### posix-rename@openssh.com (v1)

The [OpenSSH SFTP Protocol] defines a `posix-rename@openssh.com` extension with
the same API as `SSH_FXP_RENAME`, but uses the simple `rename(2)` semantics on
the server.
Otherwise, the default rename operation can be a bit buggy/racy.

We use this extension when available, or fallback to `SSH_FXP_RENAME` if not.

### copy-data

The [copy-data] extension is great for speeding up remote copies as it avoids
having to download data from one file and uploading to a different one.

# External API

The extension provides an external API to allow other apps/extensions make
requests using the [Chrome messaging API](https://developer.chrome.com/apps/messaging).

The nassh background page adds a listener for
[`chrome.runtime.onMessageExternal`](https://developer.chrome.com/apps/runtime#event-onMessageExternal)
which can be invoked by other apps / extensions by calling
[`chrome.runtime.sendMessage`](https://developer.chrome.com/extensions/runtime#method-sendMessage)
with the following fields in message:

| Field name     | Type    | Description |
|----------------|---------|-------------|
| `command`      | !string | Command to run.  Currently only `mount` supported |

The API will then respond with an object:

| Field name     | Type    | Description |
|----------------|---------|-------------|
| `error`        | bool    | Whether the request succeeded. |
| `message`      | !string | A short message providing more details. |
| `stack`        | ?string | A JavaScript stack trace for errors. |

## Mount

On Chrome OS, trigger a SFTP filesystem mount with the Files app.

| Field name     | Type    | Description |
|----------------|---------|-------------|
| `command`      | !string | Must be `mount`. |
| `knownHosts`   | !string | File contents of known_hosts to be used for connection.  e.g. output from `ssh-keyscan <ssh-server>` |
| `identityFile` | !string | File contents of private key identity_file (e.g. contents of id_rsa file `-----BEGIN RSA PRIVATE KEY----- ...`) |
| `username`     | !string | Username for connection |
| `hostname`     | !string | Hostname or IP address for connection |
| `port`         | number  | (optional) Port, default is 22 |
| `fileSystemId` | !string | ID used for Chrome OS mounted filesystem |
| `displayName`  | !string | Display name in Chrome OS Files.app for mounted filesystem |

## Crosh

On Chrome OS, open a new [crosh] session.

| Field name     | Type    | Description |
|----------------|---------|-------------|
| `command`      | !string | Must be `crosh`. |
| `height`       | !number | The height of the new window. |
| `width`        | !number | The width of the new window. |

# References

Here's a random list of documents which would be useful to people.

* [OpenSSH]: The ssh client we use
* [NaCl]: Chrome's Native Client that we build using (including the PPAPI plugin)
* [RFC 4251 - The Secure Shell (SSH) Protocol Architecture](https://tools.ietf.org/html/rfc4251)
* [RFC 4252 - The Secure Shell (SSH) Authentication Protocol](https://tools.ietf.org/html/rfc4252)
* [RFC 4253 - The Secure Shell (SSH) Transport Layer Protocol](https://tools.ietf.org/html/rfc4253)
* [RFC 4254 - The Secure Shell (SSH) Connection Protocol](https://tools.ietf.org/html/rfc4254)
* [RFC 4716 - The Secure Shell (SSH) Public Key File Format](https://tools.ietf.org/html/rfc4716)
* [SFTP (SSH File Transfer Protocol) version 3][SFTPv3]
  (Note: We focus on SFTPv3 as defined in the v02 RFC draft and not any of the newer ones)
* [OpenSSH SFTP Protocol]
* [SFTP Optional Extensions](https://tools.ietf.org/html/draft-ietf-secsh-filexfer-extensions-00)


[bin/]: ../bin/
[css/]: ../css/
[doc/]: ../doc/
[html/]: ../html/
[images/]: ../images/
[js/]: ../js/
[_locales/]: ../_locales/

[manifest_ext.json]: ../manifest_ext.json
[manifest_v1.5.json]: ../manifest_v1.5.json
[manifest_v2.json]: ../manifest_v2.json
[manifest_crosh.json]: https://cs.chromium.org/chromium/src/chrome/browser/resources/chromeos/crosh_builtin/manifest.json

[chrome-bootstrap.css]: ../css/chrome-bootstrap.css
[nassh_box.css]: ../css/nassh_box.css
[nassh_connect_dialog.css]: ../css/nassh_connect_dialog.css
[nassh_preferences_editor.css]: ../css/nassh_preferences_editor.css

[crosh.html]: ../html/crosh.html
[nassh.html]: ../html/nassh.html
[nassh_connect_dialog.html]: ../html/nassh_connect_dialog.html
[nassh_google_relay.html]: ../html/nassh_google_relay.html
[nassh_popup.html]: ../html/nassh_popup.html
[nassh_preferences_editor.html]: ../html/nassh_preferences_editor.html
[nassh_test.html]: ../html/nassh_test.html

[crosh.js]: ../js/crosh.js
[nassh.js]: ../js/nassh.js
[nassh_agent.js]: ../js/nassh_agent.js
[nassh_agent_backend.js]: ../js/nassh_agent_backend.js
[nassh_agent_backend_gsc.js]: ../js/nassh_agent_backend_gsc.js
[nassh_agent_message.js]: ../js/nassh_agent_message.js
[nassh_agent_message_types.js]: ../js/nassh_agent_message_types.js
[nassh_app.js]: ../js/nassh_app.js
[nassh_background.js]: ../js/nassh_background.js
[nassh_column_list.js]: ../js/nassh_column_list.js
[nassh_command_instance.js]: ../js/nassh_command_instance.js
[nassh_connect_dialog.js]: ../js/nassh_connect_dialog.js
[nassh_executables.js]: ../js/nassh_executables.js
[nassh_extension_popup.js]: ../js/nassh_extension_popup.js
[nassh_google_relay_html.js]: ../js/nassh_google_relay_html.js
[nassh_google_relay.js]: ../js/nassh_google_relay.js
[nassh_main.js]: ../js/nassh_main.js
[nassh_nassh.js]: ../js/nassh_nassh.js
[nassh_preference_manager.js]: ../js/nassh_preference_manager.js
[nassh_preferences_editor.js]: ../js/nassh_preferences_editor.js
[nassh_sftp_client.js]: ../js/nassh_sftp_client.js
[nassh_sftp_fsp.js]: ../js/nassh_sftp_fsp.js
[nassh_sftp_packet.js]: ../js/nassh_sftp_packet.js
[nassh_sftp_packet_types.js]: ../js/nassh_sftp_packet_types.js
[nassh_sftp_status.js]: ../js/nassh_sftp_status.js
[nassh_stream_google_relay.js]: ../js/nassh_stream_google_relay.js
[nassh_stream.js]: ../js/nassh_stream.js
[nassh_stream_set.js]: ../js/nassh_stream_set.js
[nassh_stream_sftp.js]: ../js/nassh_stream_sftp.js
[nassh_stream_sshagent.js]: ../js/nassh_stream_sshagent.js
[nassh_stream_sshagent_relay.js]: ../js/nassh_stream_sshagent_relay.js
[nassh_stream_tty.js]: ../js/nassh_stream_tty.js
[nassh_test.js]: ../js/nassh_test.js
[nassh_tests.js]: ../js/nassh_tests.js

[FAQ]: FAQ.md

[copy-data]: https://tools.ietf.org/html/draft-ietf-secsh-filexfer-extensions-00#section-7
[crosh]: chromeos-crosh.md
[gnubbyd]: https://chrome.google.com/webstore/detail/beknehfpfkghjoafdifaflglpjkojoco
[NaCl]: https://developer.chrome.com/native-client
[OpenSSH]: https://www.openssh.com/
[OpenSSH SFTP Protocol]: https://github.com/openssh/openssh-portable/blob/master/PROTOCOL
[SFTPv3]: https://tools.ietf.org/html/draft-ietf-secsh-filexfer-02
[SFTPv6]: https://tools.ietf.org/html/draft-ietf-secsh-filexfer-13
[ssh_client]: ../../ssh_client/
[wash]: ../../wash/
