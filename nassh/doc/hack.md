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

# The NaCl plugin dependency

Secure Shell depends on a NaCl (Native Client) plugin to function.  This plugin
is a port of OpenSSH.  You'll have to find or create a version of this plugin,
and copy it into `libapps/nassh/plugin/`.

Your options are:

1. Build it yourself from [ssh_client].

2. Copy it from `plugin/` directory of the latest version of Secure Shell.
If you have Secure Shell installed, the plugin can be found in your profile
directory, under
`Default/Extensions/pnhechapfaindjhompbnflcldabbghjo/<version>/plugin/`.

# Dev-Test cycle

The `./bin/run_local.sh` script can be used to launch a new instance of Chrome
in an isolated profile, with the necessary command line arguments, and launch
the Secure Shell app.  You can run this script again to rebuild dependencies
and relaunch the Secure Shell app.

# Loading Unpacked Extensions

Loading directly from the checked out nassh directory is the normal way of
testing.  It will use the dev extension id (`okddffdblfhhnmhodogpojmfkjmhinfp`)
to avoid conflicts with the stable extension id, although it will still conflict
if you have the dev version installed from the CWS.

The extension id is controlled by the `key` field in the [manifest.json].  See
the [manifest key docs](https://developer.chrome.com/extensions/manifest/key)
for more details.

## Whitelisted Permissions

Using the dev extension id is necessary in order to access some APIs that are
whitelisted only for Secure Shell.  If you don't need these features, you can
get by with using a different id (and delete the settings from the
[manifest.json] to avoid warnings at runtime).

* Access to [crosh](chromeos-crosh.md) under Chrome OS (`terminalPrivate`).
  [(1)](https://cs.chromium.org/search/?q=terminalPrivate)
  [(2)](https://cs.chromium.org/chromium/src/chrome/browser/extensions/api/terminal/terminal_extension_helper.cc)
* Access to raw sockets under NaCl.  This allows connecting directly to SSH
  servers (e.g. port 22).
  [(1)](https://cs.chromium.org/search/?q=kPredefinedAllowedSocketOrigins)
  <br>
  Note: Making connections over https using relay servers will still work
  though.  See the FAQ for more details.
* SFTP backend for Chrome OS (`fileSystemProvider` and
  `file_system_provider_capabilities`).
  [(1)](https://cs.chromium.org/chromium/src/chrome/common/extensions/api/_permission_features.json)
  <br>
  Note: Normal extensions/apps can use these features, but since Secure Shell
  is still a "legacy packaged app", we had to whitelist access.

To double check what & where things are whitelisted, search the Chromium code
base for out extension ids:

* [pnhechapfaindjhompbnflcldabbghjo](https://cs.chromium.org/search/?q=pnhechapfaindjhompbnflcldabbghjo):
  Stable ID
* [okddffdblfhhnmhodogpojmfkjmhinfp](https://cs.chromium.org/search/?q=okddffdblfhhnmhodogpojmfkjmhinfp):
  Dev ID
* [nkoccljplnhpfnfiajclkommnmllphnl](https://cs.chromium.org/search/?q=nkoccljplnhpfnfiajclkommnmllphnl):
  Crosh ID
* [0EA6B717932AD64C469C1CCB6911457733295907](https://cs.chromium.org/search/?q=0EA6B717932AD64C469C1CCB6911457733295907):
  Stable ID (in hex)
* [58B0C2968C335964D5433E89CA4D86628A0E3D4B](https://cs.chromium.org/search/?q=58B0C2968C335964D5433E89CA4D86628A0E3D4B):
  Dev ID (in hex)

## Stable Extension

If you try to load an unpacked extension using the stable extension id, you
might run into problems if your administrator installs it via enterprise
policy.  If you see the error below, you won't be able to bypass it.  Just
use the dev extension id instead.
```
Secure Shell (extension ID "pnhechapfaindjhompbnflcldabbghjo") is blocked by the administrator.
```

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
  * [nassh_connect_dialog.html]: The main connection dialog.
  * [nassh_google_relay.html]: Stub page when redirecting with external relay.
  * [nassh.html]: The main ssh terminal page.
  * [nassh_preferences_editor.html]: The extensions options page.
  * [nassh_test.html]: Run all available unittests.
* [images/]: Various extension images.
* [js/]: The majority of relevant code for this extension.
  * `*.concat.js`: Compiled JS output of other projects we use.
  * See the section below.
* [_locales/]: [Translations](https://developer.chrome.com/extensions/i18n) of strings shown to the user.
* plugin/: Compiled NaCl & output from [ssh_client]
* [manifest.json]: The Chrome extension manifest.

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
  * [nassh_stream_sshagent_relay.js]:
    SSH Agent API for connecting to other extensions.  They provide key store
    backing (such as the [gnubbyd] extension).
  * [nassh_stream_tty.js]: Basic input/output tty streams.
* Testing related code
  * [nassh_test.js]: Main unittest runner logic.  Locates & runs all tests.
  * `*_tests.js`: Each module has a corresponding set of unittests.  The
    filename follows the convention of adding `_tests`.  e.g. `nassh_tests.js`
    contains the tests for `nassh.js`.

There are a few specialized modules that are not relevant to the core
Secure Shell logic.

* [crosh.js]: Chrome OS developer shell.  Only used with [crosh.html].
* Code for hooking into [wash].  Only used with that.
  * [nassh_executables.js]
  * [nassh_nassh.js]
* Connections page specific code
  * [nassh_column_list.js]
  * [nassh_connect_dialog.js]
* Redirection page specific code
  * [nassh_google_relay_html.js]
* Options page specific code
  * [nassh_preferences_editor.js]
* SFTP specific code
  * [nassh_sftp_client.js]
  * [nassh_sftp_fsp.js]
  * [nassh_sftp_packet.js]
  * [nassh_sftp_packet_types.js]
  * [nassh_sftp_status.js]

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

## JS->NaCl API

Here is the API that the JS code uses to communicate with the NaCl [ssh_client]
module.

The `nassh.CommandInstance.prototype.sendToPlugin_` function in
[nassh_command_instance.js] is used to package up and make all the calls.
Helper functions are also provided in that file to avoid a JS API to callers.

At the lowest level, we pass a JSON string to the plugin.  It has two fields,
both of which must be specified (even if `arguments` is just `[]`).

* `name`: The function we want to call (as a string).
* `arguments`: An array of arguments to the function.

The `name` field can be any one of:

| Function name        | Description                      | Arguments |
|----------------------|----------------------------------|-----------|
| `startSession`       | Start a new ssh connection!      | (object `session`) |
| `onOpenFile`         | Open a new file.                 | (int `fd`, bool `success`, bool `is_atty`) |
| `onOpenSocket`       | Open a new socket.               | (int `fd`, bool `success`, bool `is_atty`) |
| `onRead`             | Send new data to the plugin.     | (int `fd`, base64 `data`) |
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

At the lowest level, we pass a JSON string to the JS code.  It has two fields,
both of which must be specified (even if `arguments` is just `[]`).

* `name`: The function we want to call (as a string).
* `arguments`: An array of arguments to the function.

The `name` field can be any one of:

| Function name | Description                       | Arguments |
|---------------|-----------------------------------|-----------|
| `openFile`    | Plugin wants to open a file.      | (int `fd`, str `path`, int `mode`) |
| `openSocket`  | Plugin wants to open a socket.    | (int `fd`, str `host`, int `port`) |
| `read`        | Plugin wants to read data.        | (int `fd`, int `count`) |
| `write`       | Plugin wants to write data.       | (int `fd`, base64 `data`) |
| `close`       | Plugin wants to close an fd.      | (int `fd`) |
| `isReadReady` | Plugin wants to know read status. | (int `fd`) |
| `exit`        | The plugin is exiting.            | (int `code`) |
| `printLog`    | Send a string to `console.log`.   | (str `str`) |

[bin/]: ../bin/
[css/]: ../css/
[doc/]: ../doc/
[html/]: ../html/
[images/]: ../images/
[js/]: ../js/
[_locales/]: ../_locales/
[manifest.json]: ../manifest.json

[chrome-bootstrap.css]: ../css/chrome-bootstrap.css
[nassh_box.css]: ../css/nassh_box.css
[nassh_connect_dialog.css]: ../css/nassh_connect_dialog.css
[nassh_preferences_editor.css]: ../css/nassh_preferences_editor.css

[crosh.html]: ../html/crosh.html
[nassh_connect_dialog.html]: ../html/nassh_connect_dialog.html
[nassh_google_relay.html]: ../html/nassh_google_relay.html
[nassh.html]: ../html/nassh.html
[nassh_preferences_editor.html]: ../html/nassh_preferences_editor.html

[crosh.js]: ../js/crosh.js
[nassh_app.js]: ../js/nassh_app.js
[nassh_background.js]: ../js/nassh_background.js
[nassh_column_list.js]: ../js/nassh_column_list.js
[nassh_command_instance.js]: ../js/nassh_command_instance.js
[nassh_connect_dialog.js]: ../js/nassh_connect_dialog.js
[nassh_executables.js]: ../js/nassh_executables.js
[nassh_google_relay_html.js]: ../js/nassh_google_relay_html.js
[nassh_google_relay.js]: ../js/nassh_google_relay.js
[nassh.js]: ../js/nassh.js
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
[nassh_stream_sshagent_relay.js]: ../js/nassh_stream_sshagent_relay.js
[nassh_stream_tty.js]: ../js/nassh_stream_tty.js

[gnubbyd]: https://chrome.google.com/webstore/detail/beknehfpfkghjoafdifaflglpjkojoco
[ssh_client]: ../../ssh_client/
[wash]: ../../wash/
