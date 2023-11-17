# 0.61, 2023-11-22, Fix WASM IPv4 regression.

* nasftp: Split execution startup from construction.
* wassh: Clear Chrome "last error".
* wassh: Add framework to translate Chrome net errors to errno.
* wassh: Do not queue fake addresses for IP addresses.
* wassh: Fix result checking with tcp writes.
* wasi-js-bindings: Return EINTR when handling signals w/no other events.

# 0.60, 2023-11-16, Deframe connection dialog, WASM IPv6 fixes, nasftp speed improvements.

* wassh: Fix IPv6 address parsing with socket get name.
* wassh: Have GAI return 2 results for AF_UNSPEC.
* wassh: Fix NUL termination in secure prompt.
* nassh: Add Ctrl+Shift+N binding.
* connect: Delete promptOnReload logic.
* connect: Make connection dialog a dedicated page.
* nasftp: Change <a> downloads to use blobs for all chunks.
* nasftp: Rate limit how often we update transfer bars.
* external api: Fix connection error responses.

# 0.59, 2023-09-21, Major nasftp improvements, internal overhauls.

* nasftp: Add mput/mreput helpers.
* nasftp: Support resuming downloads (reget).
* nasftp: Start implementing local commands.
* nasftp: Support new File System Access API for saving large files.
* nasftp: Add mget support.
* nasftp: Colorize completions too.
* nasftp: Resolve symlinks with command completion.
* nasftp: Narrow exception handlers a bit for test failures.
* dist: Build hterm via rollup as ES6 module.
* dist: Build libdot via rollup as ES6 module.
* dist: Switch from concat to rollup.
* dist: Switch lib.resource release info to rollup.
* dist: Switch lib.resource svg imports to rollup.
* reconnect: Use a dedicated io to capture user input to avoid repeats.

# 0.58, 2023-08-31, Some minor fixes.

* launcher: Clear own opener to break linkage with opener.
* connect/popup: Handle macOS command key better.
* ssh_client: openssh: Increase fd_set size to 4096.

# 0.57, 2023-08-10, MV3 regression fixes & UI reworks.

* nasftp: Autocomplete common prefixes.
* launcher: Avoid changing current window state with multiple tabs.
* openWindow: Leverage extension APIs if window.open is missing.
* fsp: Switch extra fields to a table for alignment.
* connect: Switch extra fields to a table for alignment.
* fsp: Switch to common styles.
* connect: Support light & dark mode dynamically.
* css: Change cursor style to align better with Chrome.
* popup: Stop changing dialog theme based on terminal theme.
* connect: Stop changing dialog theme based on terminal theme.
* css: Split theme vars into dedicated file.
* popup: Move css to a dedicated file.

# 0.56, 2023-07-27, MV3 regression fixes.

* wassh: Always create /.ssh.
* fs: Create parent /.ssh for key.
* command: Chain connectTo into refresh & finalize calls.
* plugin: Change init callbacks to promises.
* nacl: Change plugin init from callbacks to promises.
* pull default location from globalThis.

# 0.55, 2023-07-20, MV3 regression fixes.

* mount: Pass ssh client version down.
* nassh: Do not assume navigator.mimeTypes exists.
* api: Make handlers available regardless of DOM fs.
* extension: Fix context menu context.
* connect dialog: Move css var init to pure css.
* connect dialog: Set title too.
* relay: Update corp sup proxy for regionalization.
* mkdist: Update icon path for MV3.
* l10n: Update translations.

# 0.54, 2023-06-13, MV3 migration & require Chrome 108+.

* connect dialog: Update pattern= to work with RegExp v flag.
* nassh: Switch iframe settings to manifest csp.
* Update shortlink URIs.
* relay: Allow for fallback endpoint proxy.
* pwa: Update IWA manifest and remove service worker.
* manifest: update to MV3.
* wassh: vfs: Search for handlers right to left in VFS.findHandler_.
* wassh: sockets: Add WebTcpServerSocket based on TCPServerSocket.
* wassh: handle_fd_fdstat_get: Await PathHandler.stat() Promise.
* wassh-libc-sup: socket: Support more protocol values.
* fsp: Call onSuccess for SftpFsp onMountRequested.
* wassh: fd_fdstat_set_flags: Verify fd is a valid file descriptor.
* l10n: Update translations.

# 0.53, 2022-12-13, Fix mosh breakage.

* mosh: Update to hterm & libdot ES6 modules.
* wassh: Class Tty should not decode the data by itself

# 0.52, 2022-11-28, Prepare for MV3 with refactors.

* wassh: Fix timeout processing with BigInts.
* l10n: Await hterm.initPromise before hterm.messageManager.
* mount: Refactor for Terminal usage.
* fsp: Convert SftpFsp to class.
* extension: Use chrome.action API if available.
* fs: Skip DOM FS migration when API is unavailable.
* prefs: Switch local prefs to chrome.storage.local.
* concat: Hack libdot & hterm into es6 module.
* nassh: Convert window to globalThis.
* nassh: google-smart-card: Update to latest 1.3.10.1 version.
* init: Drop framework init logic.

# 0.51, 2022-10-20, WASM SFTP support.

* nassh: remove resetTerminal called from reconnect.
* wassh: sockets: document the stack.
* rollup: Drop combined deps file.
* rollup: Switch to split deps.
* rollup: Split deps apart.
* deps: Rename nassh_deps.concat.js to deps_local.concat.js.
* wassh: sockets: Handle -4/-6 preferences with Chrome TCP APIs.
* nassh: Drop chrome app deprecation message.
* array: Move out of libdot.
* ssh_client: mandoc: Update to 1.14.6.
* l18n: Move message manager setup to hterm.initPromise.
* fs: Move out of libdot.
* credential_cache: Move out of libdot.
* options: Add internal --debug-xxx options.
* crosh: Inline call to message setup.
* crosh: Use common setupForWebApp logic.
* swa: Unify duplicate checks.
* crosh: Fix pop up message for apps.
* prefs: Drop console.log notice.
* gnubby: Move from lib.init framework to explicit init.
* welcome: Rework startup spam a bit.
* wassh: sockets: Ignore IPV6_TCLASS options.
* nassh: Mark Terminal R108-R112 dev/canary versions as "dev" versions.
* metrics: Update endpoint for GoogMetricsReporter.
* nasftp: Initial WASM support.
* wassh: fs: Fix fd exhaustion bug.
* wassh: sockets: Fix filetype of agent socket.
* feedback: Automatically include current version for users.
* nasftp: Generalize the sftp<->plugin interface.
* wassh: readpassphrase: Handle ONLCR when displaying prompt.
* wassh: Opt in 100% of dev extension users to WASM.
* wassh: poll: Check filetype rather than class.
* wassh: Start opting in 0.5% of runs to WASM.
* licensing: Don't escape license quotes.
* licensing: Merge duplicate licenses.

# 0.50, 2022-09-25, WASM port forwarding support.

* wassh: sockets: Stub out SO_ERROR.
* wassh: fs: Stub out fd_fdstat_set_flags.
* Update license boilerplate text in source code files.
* relays: Harmonize onWriteSuccess usage.
* wassh: sockets: Implement listening support
* wassh: sockets: Don't warn about unhandled sockets
* wassh: sockets: Implement shutdown() support
* wassh: sockets: Initial accept() support
* wassh: sockets: Initial listen() support
* wassh: sockets: Initial bind() support
* agent: Use correct write count for ssh-agent relay.
* wassh: sockets: Ignore SO_REUSEADDR.
* wasi-js-bindings/wassh: Fix passing debug setting down.
* wassh: sockets: Unify get/set socket option methods.
* wassh: sockets: Tweak chrome.sockets.tcp checks.
* wassh: vfs/sockets: Improve debugging a little more.

# 0.49, 2022-09-09, FS migration to indexeddb-fs, WASM updates.

* wassh: sockets: Drop redundant checks.
* prefs: Fix loading for non-default profiles.
* wassh: fs: Connect to indexeddb-fs.
* wassh: fs: Wire up link functions.
* wassh: fs: Wire up rename functions.
* wassh: fs: Wire up unlink functions.
* manifest: Drop crash & metrics for now.
* wassh: fs: Push statat logic down a level.
* wassh: fs: Add a path resolver helper.
* wassh: fs: Add some debug logs.
* wassh: fs: Make stat funcs async.
* wassh: fs: Fix path_filestat_get implementation.
* wassh: fs: Pass fs_flags down to open calls.
* wassh: fs: mkdir: Hook up basic logic.
* command: Fix reconnect keyboard input.
* fs: Migrate to indexddb-fs.
* fs: Add logic to sync indexeddb-fs & DOM FS when running NaCl.
* fs: Migrate filesystem backends.
* fs: Rename getDomFileSystem.
* fs: Enable indexeddb-fs usage.
* man-pages: Improve css styles & add support for dark mode.
* changelog: Enable dark mode.
* wassh: sockets: Implement WebTcpSocket backed by Direct Sockets API.
* nassh: Implement sanitizeScriptUrl to avoid policy issue.
* relay: Show reconnect dialog for entire time while connecting.
* licenses: Add darkmode support.
* prefs: Move chrome-bootstrap darkmode overrides to dedicated file.
* licenses: Tighten up print style a little more.
* licenses: Move style to dedicated CSS file.
* wassh: sockets: Fix Unix socket recv callback.
* relay: Fix corp relay v4 reconnect.
* wassh: relay: Stub out connection info better.
* ssh_client: openssh: Do not close all fds on startup.
* pwa: Automatically use wasm plugin for web app.
* pwa: Add manifest.
* wassh: sockets: Remove all socket recv logic from syscall_handler.js.
* prefs: Replace innerHTML with innerText to avoid policy issue.
* protocols: Use getManifest function.
* mkdist: Update list of files.
* nasftp: Remove use of lib.registerInit.
* gsc: Move to ES6 module.
* wassh: sockets: Split TcpSocket into RelaySocket & ChromeTcpSocket.
* storage: Add getSyncStorage helper function.
* uri: Allow negative options.
* Dockerfile: Upgrade to Debian bullseye.
* crosh: Drop support for non-crosh commands.
* coil: Improve terminology usage.
* command: Add a check for chrome.windows.getCurrent.

# 0.48, 2022-07-19, House keeping & bandwidth optimizations.

* main: Workaround LaCrOS accessibility bug.
* main: Request persisted storage if storage is temporary.
* buffer: Use scatgat buffer by default.
* relay: RelayCorpv4WsStream copies data into ArrayBuffer instead of Array.
* ssh_client: Don't patch openssh channel window.
* polyfill: Move manifest polyfill to common code.
* fs: Add a call to requestQuota.
* relay: Use lib.f.getURL.
* wassh: Add a WIP wasm warning.
* Replace chrome.runtime.getURL with helper function.
* google-smart-card: Update to latest 1.3.8.0 version.
* metrics: Adjust OS names to match data destination.
* metrics: Remove collection for mount connections.
* metrics: update latency metric fields.
* metrics: Build payload and send it via go/monapi.
* metrics: Show prompts only when chrome.permissions is available.
* wassh: vfs: Change cwd path to /.
* wassh: constants: New module to only hold constants.
* wassh: Drop custom DirectWasiPreview1.
* fs: Move getFileSystem to the new module.
* command: Handle stackless errors.
* command: Stop looking up filesystem.
* prefs: Convert to ES6 modules.
* utils: Convert to ES6 module.
* prefs: Convert to ES6 module.
* hterm: Drop hterm.defaultStorage fallback.
* main: Pass explicit storage to hterm.Terminal.
* prefs editor: Add dark mode support.
* prefs: Require explicit storage.
* command: Make syncStorage a requirement.
* background: Move import/export functions out of main code.
* background: Rename main page to _main.js.
* prefs: Switch import/export APIs to Chrome sync storage.
* libdot: prefs: Change import APIs from callbacks to async.
* libdot: prefs: Clear all prefs on import.
* prefs editor: Call background page to import/export settings.
* popup: Switch to explicit sync storage.
* prefs: Switch editor to explicit sync storage.
* mosh: Migrate off of hterm.Terminal.runCommandClass.
* tests: Stop using hterm.defaultStorage.
* mosh: Stop using hterm.defaultStorage.
* nassh: Stop using hterm.defaultStorage.
* crosh: Stop using hterm.defaultStorage.
* l10n: Update translations.

# 0.47, 2022-04-26, More ES6 modules & WASM work.

* relay: save user's choice for GoogMetricsReporter prompt.
* ske: search for SKE for ssh-agent & certificate refresh handling.
* check permissions before fetching client metadata.
* command instance: convert to ES6 modules.
* buffer: convert to ES6 modules.
* sftp: convert packet APIs to ES6 modules.
* sftp: fix up various typing information.
* sftp: make helper funcs more forgiving of undefined args.
* nasftp: fix return value for simple commands.
* nasftp: chmod: add missing argument validation.
* ssh_client: openssh: fix memory corruption with select().
* wasi-js-bindings: move debug output behind a flag.
* wassh: set argv[0] to the program.
* ssh_client: lower starting free fd value.
* gcse: trigger cert refresh if none exist.
* wassh: fix unix socket wakeup.
* wassh: handle when wasm plugin exits.
* wasi-js-bindings: implement exit & abort handling.
* plugins: generalize loading messages for wasm.
* sftp status: convert to ES6 module.
* sftp client: convert to ES6 module.
* fsp: convert to ES6 modules.
* external API: convert to ES6 module.
* external API: switch external API to explicit init.
* prefs: move profile out of the frozen header block.
* prefs: keep large border sizes from breaking settings page.
* websockify: new basic relay.
* fs: add a few utils functions to handle identity files.
* relay: metric reporter fetches metadata.
* relay: switch pages without adding to history.

# 0.46, 2022-03-25, ES6 modules & WASM work.

* wassh: Connect relay streams through.
* wassh: Connect ssh-agent streams through.
* wasm: Move plugin to dedicated file too.
* wassh-libc-sup: getsockname: Fix port return value.
* agent: Convert to ES6 modules.
* wassh: sockets: Fix closing unconnected TCP sockets
* wassh: Initial UNIX socket support
* wassh: vfs: Convert read/pread to async methods.
* wasi-js-bindings: check read handle return length
* wassh-libc-sup: connect: Decode errno on failure.
* nacl: Rip out integration into a dedicated module.
* nassh: Integrate wassh.
* wassh: Implement basic signal delivery.
* goog: Change GoogMetricsReporter to ES6.
* wassh-libc-sup: Require wasi-sdk signal logic.
* wassh: Support tty window size ioctls.
* streamset: Convert to ES6 class.
* wassh: Implement getpeername & getsockname.
* ssh_client: Optimize wasm optimization step.
* nasftp: Simplify main input loop with async/await.
* streams: Convert to ES6 modules.
* identity: Drop old key paths.
* wassh: Flesh out GAI APIs a bit more.
* corpv4: Include ssh username in /connect call.
* background page: Add new metrics code to background page too.
* ssh_client: Preserve timestamps when copying files.
* ssh_client: Drop use of nacl getos.py.
* dist: Include wasi-js-bindings & wassh in release.
* wassh-libc-sup: Add err APIs.
* goog: Convert to ES6 module.
* streamset: Convert to ES6 module.
* crosh: Change from getA11yStatus() to getPrefs().
* relay: Add 'async' keyword to 'asyncOpen' functions.
* relay: Return false from relay reconnect if no connection.
* ssh_client: Make pnacl use python2 instead of python.
* relays: Convert to ES6 modules.
* nasftp: Convert to ES6 modules.
* manifest: Enable wasm eval CSP.
* mkdeps: Setup wassh paths for development.
* relay: Take into account partial ACKs when measuring ACK latency.
* nassh: Remove $i18n{themeColor} replacement.
* wassh: Flesh out readpassphrase & tty interface more.
* background page: Convert main App to ES6 modules.
* wassh: Flesh out termios APIs.
* wassh: Switch to hterm for output.
* wassh-libc-sup: Build with C17.
* wassh: Implement readpassphrase.
* wassh: Flesh out socket emulation a bit.

# 0.45, 2022-03-04, Minor bug fixes.

* Roll hterm fixes.
* dev: Utilize version_name for prettier dev info.
* google: Metrics skeleton reporter.

# 0.44, 2022-02-25, Relay improvements and internal cleanups.

* relay: Fix reconnect when socket has unclean close.
* relay: Add ACK latency measurement to CorpV4 relay.
* crosh: Support terminalPrivate.onProcessOutput() with binary output.
* terminal: handle ssh exit and reconnect properly for tmux.
* sftp: Fix sftp limits packet fallback.
* relay: Update relay to use /endpoint.
* api: Tweak default style for new window helper.
* google: Wait for cert renewal to finish before continuing.
* hterm: Migrate away from runCommandClass.
* relay: use chrome.windows.onRemoved rather than poll.
* column list: Convert to ES6 module.
* connect: Convert to ES6 module.
* fsp: Fonvert config page to ES6 module.
* nassh: Use placeholder for top-level document background-color.
* nassh/crosh/popup: Convert standalone pages to ES6 module.
* relay: Show error when --relay-method=direct auth fails.
* prefs: Add a hack for DEL display.

# 0.43, 2021-10-11, OpenSSH 8.8p1, SFTP features, font adjustments.

* prefs: Refresh bootstrap code.
* prefs: Avoid clipping wide fields.
* l10n: Improve default reconnect tip.
* mosh: Add a dedicated icon.
* crosh: Drop pre-R82 support.
* fonts: Move nassh.loadWebFonts out of critical path.
* nasftp: Support tab completion of remote paths.
* nasftp: Rework command line completion for deeper integration.
* sftp: Query server limits dynamically.
* sftp: Abort if server version is not supported.
* sftp: Make init logic async.
* nasftp: Clean up autocomplete display.
* l10n: Fix version typo.
* ssh_client: Update to openssh-8.8.

# 0.42, 2021-10-01, OpenSSH 8.7p1, Unicode 14.0.

* corp relay: Add support for direct relay used by terminal.
* relays: Change nassh.Relay.init to async.
* corp relay v4: Remove duplicate logic in nassh_relay_corpv4.js.
* l10n: Use hterm.messageManager and nassh.msg() in ConnectDialog.
* ssh_client: Add groups stubs.
* ssh_client: Update to openssh-8.7.
* plugin: Download latest plugin from gcs to be used in crosh dist.
* nassh: Add support to run nassh inside Terminal SWA.
* popup: Open connection dialog on fresh installs.
* mosh: Switch label to plain ASCII.
* Move reconnect dialog to overlay popup.

# 0.41, 2021-05-19, OpenSSH 8.6p1.

* ssh_client: wasi-sdk: Update to 12.0 release.
* ssh_client: openssh: Turn host key updates off by default for nacl.
* ssh_client: Upgrade to OpenSSH 8.6p1.
* ssh_client: mosh-chrome: Fix transmitting non-ASCII data.

# 0.40, 2021-05-12, OpenSSH 8.5p1.

* l10n: Update translations.
* ssh_client: Upgrade to OpenSSH 8.5p1.
* crosh: Use nassh options page when non-SWA.
* crosh: Use terminalPrivate.openOptionsPage() if running as SWA.

# 0.39, 2021-02-01, Make URI parsing more robust.

* nassh: Disable iframe usage.
* uri: Make parsing a bit more robust.
* l10n: Update omnibox tip.
* popup: Add border between hosts & non-hosts.
* l10n: Improve translator tips based on feedback.

# 0.38, 2020-12-14, SFTP mount regression fix.

* fsp: Fix mounting after UI rewrite.
* ssh_client: mosh: Improve UI a bit.

# 0.37, 2020-12-07, SFTP mount rewrite, UI prompts rewrite, and alpha mosh import.

* contextmenu: Add some items to improve discoverability.
* extension: Integrate mosh-chrome project.
* ssh_client: mosh-chrome: Update to libssh-0.9.5.
* ssh_client: mosh-chrome: Integrate mosh-chrome project.
* agent: Use hterm overlay for user input.
* uri: Make usernames optional in ssh:// URIs.
* extension: Support keyboard navigation.
* nassh/ssh_client: Implement readpassphrase interface.
* wasi-js-bindings: Require wasm bigint import support.
* ssh_client: Import bazel-0.17.
* ssh_client: Add missing exit broadcast.
* ssh_client: Send a warning back on unknown messages.
* uri: Show the connection dialog for empty ssh://.
* prefs: Allow loading specific profiles in the editor.
* ssh_client: mandoc: Fix building w/newer make.
* ssh_client: wabt: Fix install.
* Replace parent{Element,Node}.removeChild() with remove().
* FAQ: Move shelf interaction here.
* extension: Have middle clicks open in a tab.
* nassh: Constify namespace.
* Require Chrome R86+.
* fsp: Inline last user of createSftpInstance.
* bg: Delete getBackgroundPage logic.
* fsp: Move mounting to API layer.
* api: Add support for bidirectional connections.
* eslint/closure-compiler: Raise min language version to ES2020.
* relay: Add an API to save+restore internal state.
* relay: Harmonize the different implementations.
* FAQ: Update the app-vs-ext details.
* sshfe: Use new nassh.buffer API.
* Drop building of Chrome App.
* l10n: Improve translator tips for reconnect dialogs.
* corp relay: Pass io down to the stream.
* uri: Fix handling of sftp & web+ssh URIs.
* google: Automatically check & refresh SSH certificates.

# 0.36, 2020-11-09, 2020-11-11, OpenSSH 8.4p1, UI tweaks.

* connect: Improve incomplete form UX.
* command: Make deprecation warning a big angry blinking red block.
* command: Warn newer CrOS users to migrate too.
* command: Add a default error handler.
* api: Move listener init to bg page.
* fsp: Move listener init to bg page.
* fsp: Move mount info to the API layer.
* api: Add an unmount command.
* util: Inline reloadWindow.
* buffer: Add a toString method.
* api: Log more details about the sender.
* options: Allow users to select the pref text.
* prefs: Inline global nassh.defaultStorage.
* ssh_client: upgrade to OpenSSH 8.4p1.
* util: Unify chrome.runtime.sendMessage promise wrappers.
* gsc: Workaround Yubikey ECC OID bug.

# 0.35, 2020-09-14, Some bug fixes.

* hterm: Fix scrolling with newer Chrome.
* libdot: intl: Fix with newer Chrome & v8.
* prefs: Fix color input syncing.
* google: Enable connection resumption by default with v4 relays.
* agent: Add ed25519 mapping for non-standard Yubikey OID.

# 0.34, 2020-08-12, Some regression fixes.

* icons: Increase >_ in 24px-64px icons to help with contrast.
* Fix capturing of keyboard shortcuts in windows.
* storage: Fix running on Chrome <R73 versions.

# 0.33, 2020-07-06, OpenSSH 8.3p1, UI tweaks, bug fixes, and internal cleanups.

* Update to hterm 1.90.  Material design theming.
* Update to libdot 7.0.0.  Tooling updates.
* storage: Convert get APIs to promises.
* storage: Convert set APIs to promises.
* fonts: Load web fonts in css and package powerline fonts.
* npm: Refresh tool versions.
* lib.init: Rewrite from callbacks to promises.
* gnubby: Give it a dedicated namespace.
* terminal: Pull init out of constructor.
* i18n: change getAcceptLanguages from callbacks to promises.
* Make ES2018 requirement official.
* command: Remove unused FS helpers.
* contextmenu: Send known_hosts context menu to options page.
* google: Split common logic out of the relay module.
* omnibox: Read storage at startup.
* connect: Move lastProfileId to local prefs.
* omnibox: Use arrow funcs.
* connect: Make focused inputs less confusing.
* connect: Fix button init on first run.
* connect: Make DEL button enablement more robust.
* l10n: Improve some descriptions and translation tips.
* ssh_client: Upgrade to OpenSSH 8.3p1.
* command: Fix --no-proxy-host handling.
* docs: Fix the `/v4/connect` path on documentation.
* google: Default internal Google Cloud VM users to new proxy protocol.
* icons: Refresh stable icon themes.
* fsp: Switch to Chrome error constants.
* nasftp: Drop Event.reason externs workaround.
* licenses: Fix to be able to load in chrome-untrusted.
* ssh_client: Clean up cpplint warnings.
* SSHAgentRelay: Use new nassh.buffer API.
* l10n: Update translations.
* l10n: Rename the OPTIONS_BUTTON_LABEL to HTERM_OPTIONS_BUTTON_LABEL.

# 0.32, 2020-05-16, Fix relay buffer accumulation.

* corp relay: Fix ack-vs-read typo.
* l10n: Improve some descriptions and translation tips.
* popup: Add missing <meta charset=utf-8/> tag.
* npm: Rework how we invoke node programs.
* crosh: Use terminalPrivate a11y functions.
* crosh: No open as window tip for chrome-untrusted.
* doc: Switch docs to Secure Shell extension variant.
* crosh: gzip resources in dist to save rootfs space.
* closure: Update to v20200504.
* crosh: Modify to run as chrome-untrusted://crosh/.

# 0.31, 2020-05-07, Fresh extension dialog regression fix.

* popup: Save a handle for live debugging.
* popup: Filter out connection dialog from saved settings.
* Add Send Feedback buttons everywhere.
* import-translations: Avoid deleting en locale.
* kokoro: Use tot translations if available.
* eslint: Enable no-multi-spacesfix checks.
* omnibox: Workaround bugs in incognito mode.

# 0.30, 2020-04-30, SFTP regression fix.

* sftp: Fix DataView loading.
* sftp: Fix typo in packet name.
* externs: Update chrome.runtime.onMessage APIs.

# 0.29, 2020-04-29, Linting cleanups, new buffer logic, and restore window settings.

* prefs: Remember & restore window dimensions per-profile.
* prefs: Extend openas for fullscreen/maximized state.
* prefs: Add framework for local (non-syncable) prefs.
* command_instance: Save active profile id.
* lit-element: Update to 2.3.1 to get live().
* mkdeps: Add basic license checking.
* closure: Update to v20200204.
* closure: Update to v20191027.
* sftp: Formalize nassh.sftp.fsp.sftpInstances structure.
* sftp: Fix outdated string->arraybuffer types.
* sftp: Tweak FileAttrs/File handling.
* lint: Fix up various number handling.
* lint: Avoid date->number coercion.
* externs: Avoid "const".
* eslint: Enable default-param-last check.
* eslint: Enable no-case-declarations checks.
* eslint: Enable no-throw-literal check.
* lint: Add missing dangling commas.
* eslint: Enable prefer-rest-params check.
* mocha: Upgrade to v7.
* eslint: Enable no-var & prefer-const checks.
* lint: Convert var to let/const.
* docs: Update processes/translations document.
* prefs: Delete relay-options migration.
* prefs: Clarify the terminal settings header.
* import-translations: Handle more edge cases.
* l10n: Improve some descriptions and translation tips.
* sftp: Use new nassh.buffer API.
* corp relay: Use new nassh.buffer API.
* corpv4 relay: Use new nassh.buffer API.
* prefs: Fix unselected panels bleeding through.
* prefs: Fix navigation panel in small windows.
* identity: Fix refresh when importing.
* identity: Handle -cert.pub files.
* prefs: Drop unused auth-agent-appid preference.
* buffer: Add a scatter/gather buffer.
* popup: Add tooltip hint for opening in a tab.
* buffer: New API for managing byte buffers.
* nassh: Add a basic framework for field trials.
* streams: Throttle WebSocket sending as needed.

# 0.28, 2020-04-14, Linting & perf fixes for corpv4 relay.

* relay: corp: Rename original corp relay.
* relay: Rename class to match style guide.
* preferences: Add UI for managing identify files.
* nasftp: Fix bad command lookups.
* nasftp: help: Support displaying specific commands.
* corpv4: Fix plugin ack logic.
* doc: hack: Update release version.
* background: Add new corp v4 scripts.
* lint: Enable object-curly-spacing checks.
* ssh_client: wasmtime: Version bump to 0.15.0.
* ssh_client: wasi-sdk: Version bump to 10.0.
* ssh_client: binaryen: Version bump to 91.
* lint: Enable func-call-spacing checks.
* lint: Enable space-before-function-paren checks.
* lint: Enable arrow-parens checks.
* lint: Enable comma-dangle checks.
* lint: Enable space-infix-ops checks.
* lint: Enable comma-spacing checks.
* lint: Enable keyword-spacing checks.
* lint: Enable spaced-comment checks.
* lint: Use const with for...of loops.
* lint: Add missing braces everywhere per our style guide.

# 0.27, 2020-04-05, Better options page.

* Update to hterm 1.88.  Better word breaks, more keyboard prefs, and dynamic colors.
* Update to libdot 5.0.0.  Unicode 13.0.0 update, and minor tooling improvements.
* ssh_client: Fix tty echo handling.
* preferences: Remove unused label text.
* preferences: Add sidebar links to subsections.
* import-translations: Fix handling of new translations.
* preferences: Add UI for managing .ssh/ files.
* preferences: Support multiple pages of settings.
* l10n: Pull in some minor translation updates.
* l10n: Improve translation import process.
* l10n: Update translations with renamed/deleted fields.
* preferences: Switch from i18n-content to i18n tag.
* licenses: Localize all fixed content.
* l10n: Support translating the official name.
* uri: Add a helper page for registering protocol handlers.
* api: Switch to using a Map.
* uri: Handle IPv6 relay hosts.

# 0.26, 2020-03-25, SSH-FE & SFTP fixes & keybinding & copy/paste tweaks.

* changelog: Point people to local changelog.
* nassh: Make all links clickable via OSC-8 link sequences.
* nassh: Add helper for generating SGR style sequences.
* sshfe: Add dedicated --proxy-user setting.
* nassh: Always use legacy pasting for nassh and crosh.
* nasftp: ls: Fix fake file listings.
* nasftp: truncate: Support truncating to a specific size.
* nasftp: Support numeric units on sizes.
* nasftp: Make command loop more robust with rejected promises.
* nasftp: Fix rm/del subcommand ordering.
* nasftp: Implement upload resume.
* ssh_client: Handle streams larger than 2GB.
* changelog: Autogenerate a bundled copy.

# 0.25, 2020-03-15, hterm tweaks & URI reconnect fixes.

* nassh: Retain the original destination in the location.
* Replace minus with plus for key shortcuts.

# 0.24, 2020-03-08, Relay fixes.

* relay corpv4/sshfe: Fix write ack confusion.
* relay corpv4: Use discovered relay.
* mkzip: Start building versions for stable rollback.

# 0.23, 2020-03-03, OpenSSH 8.2p1.

* nassh: Enable metrics/crash APIs for crosh/Terminal.
* ssh_client: openssh: Update to 8.2p1 release.

# 0.22, 2020-02-05, New relay protocol & minor SSH-FE & SSH fixes.

* corp relay: Port cleanups from new corpv4 code.
* grue: Implement new corp-ssh-v4@google.com protocol.
* ssh_client: Fix hang in openssh with broken connections.
* ssh_client: Have select return EBADFD with invalid fds.
* app: Start encouraging people to move to the extension.
* extension: Have Ctrl-Shift-N open connect dialog.
* sshfe: Fix error after closure compilation change.
* sshfe: Make connection parsing a little more robust.
* ssh_client: wabt: Update to 1.0.13 release.
* hterm: word-breaks: Add more quote marks.
* ssh_client: binaryen: Update to 90 release.
* nassh: Auto-sync prefs on install.
* api: Add prefereneces import/export commands.
* nassh: Fix favicon usage with shortcuts.
* extension: Add crosh & socket APIs.
* connect dialog: Drop from web_accessible_resources.
* nassh: Drop Chrome Apps (v2) support.
* api: Add a simple hello message.
* api: Rework to better handle startup.
* extension: Drop "Extension" from the name.  It's cleaner.
* omnibox: Fix opening windows.
* extension: Enable FSP support.

# 0.21, 2019-12-02, SFTP mount fix.

* nassh: Fix up new --welcome setting.
* eslint: Enable single quote checking.
* mkdist: Update extension icons too.

# 0.20, 2019-11-28, OpenSSH 8.1p1 & code cleanups.

* Update to hterm 1.87.  Tons of linting/cleanups.
* Update to libdot 4.0.0.  Tons of tooling improvements & linting cleanups.
* nassh: Use hterm default storage.
* mkdist: Gzip crosh files.
* crosh: Fix preferences page to run in chrome://terminal.
* l10n: Add loadMessages, reuse hterm messageManager.
* ssh_client: openssh: Initial wasm port.
* ssh_client: wassh-libc-sup: Custom C library additions.
* uri: Add option -nassh-args=--no-welcome.
* mkdist: Minify CSS/JS files for crosh.
* mkdist: Improve minification a bit.
* mkdist: Filter out more unused files.
* ssh_client: wasi-sdk: Update to 8.0.
* mkcrosh/mkzip/promote: Drop shell scripts.
* mkdist: Rewrite release generation.
* doc: FAQ: Correct docs to note that osc52.vim supports screen/tmux.
* ssh_client: naclsdk: Switch to tar.xz.
* nasftp: ls: Support listing files.
* js: Replace libdot.fs.FileReader with Blob.arrayBuffer/text.
* ssh_client: wasi-sdk: Add patch for fifo defines.
* bin: Unify argument parsing & log setup.
* nassh.getFileSystem: Fix to return single object in Promise.
* stream: Drop /dev/random handler.
* ssh_client: Move glibc-compat to nacl toolchain.
* ssh_client: openssh: Update to 8.1p1 release.
* ssh_client: openssh: Disable some more unused code.
* npm/rollup: Depend on lit-element for Terminal.
* ssh_client: openssh-8.0: Add upstream fix for chown/chmod fallbacks.
* ssh_client: ldns: Force some struct tests.
* ssh_client: openssl: Initial wasm port.
* ssh_client: build.sh: Refactor a bit to build nacl & wasm.
* ssh_client: Initial wasm toolchain support.
* ssh_client: Import wasm tools.
* js: Fill out remaining jsdocs & update APIs.
* eslint: Enable more jsdoc checks.
* eslint: Set max-len 80.
* js: Rewrite code for jsdoc usage.
* ssh_client: Support multiple versions of openssh.
* eslint: Enable jsdoc plugin & tag naming.
* ssh_client: improve --host/--build handling.
* ssh_client: gnuconfig: Add build package.
* kokoro: Slim down container.
* ssh_client: Move openssh libs into the sysroot.
* ssh_client: Overhaul toolchain management to support multiple types.
* mkdeps: Add option to skip rollup.
* nassh: Get v2 app working again.
* fs: Migrate lib.fs APIs to Promises.
* kokoro: Add ssh client archive to output.
* tests: Drop support for node testing.
* lint: Fix chdir logic with default paths.
* docker: Upgrade build to buster.
* pylint: Clean up various pylint issues in the code base.
* google-smart-card: Port helper script to Python 3.
* lint: Unify helper program.
* crosh: Use lib.MessageManager rather than chrome.i18n.
* eslint: Turn on more rules.
* filter_translations: Fix inplace usage.
* js: Fix lint and closure-compile errors.
* lint: Use new closure-compiler wrapper.
* crosh/nassh: Pass commandName in Command constructor.
* nassh: openNewWindow: Use new API to open new windows.
* external api: Add an "nassh" API.
* doc: Split api doc out.
* gsc: Allow non-numeric PIV PINs to be sent to the card.
* openWindow: use absolute html paths everywhere.
* mkcrosh: Support for bundling chrome://terminal.

# 0.19, 2019-08-06, Minor bug fixes & better licensing info.

* Update to hterm 1.86.  Very minor improvements.
* Update to libdot 3.0.0.  Few API improvements, and test suite improvements.
* licenses: Add ssh_client details too.
* punycode: Import from npm instead.
* agent: Add support for RSA and ECDSA via PIV applet.
* licenses: Bundle licenses of prod NPM dependencies.
* tests: Leverage mocha-headless-chrome for headless/CI.
* identity: Move key files to /.ssh/identity/.
* load_tests: Refactor mkdeps call.
* relay: Handle invalid proxy host settings.
* agent: Use lib.codec.codeUnitArrayToString.
* fs: Convert getFileSystem to Promises.
* nassh: Write our own background page.
* load_tests: Run tests against local node server.
* uri: Delay expanding user nassh args.
* nassh: Handle protocol registration errors better.
* nasftp: Fix put command after ArrayBuffer conversion.
* nassh: Scrub more update notification code.
* nassh: Delete unused wash hooks.
* ssh_client: Improve debug logs.
* stream: Drop writeArrayBuffer migration.
* mkcrosh: Add a python3.6 hack.
* package.json: Start npm packaging files.
* import-translations: Rewrite in Python.
* mkdeps: Rewrite in Python.

# 0.18, 2019-06-17, OpenSSH 8.0p1 & Unicode improvements.

* Update to hterm 1.85.  Significant Unicode improvements.
* Update to libdot 2.0.0.  Significant API overhaul.
* ssh_client: Hoist python helpers out to libdot.
* lint: Rewrite helper in python.
* streams: Workaround fd reopen ack race.
* load_tests: Convert to python.
* concat: Replace arbitrary shell scripts with explicit commands.
* ssh_client: openssl: Disable more unused features.
* tests: Drop --allow-file-access-from-files.
* ssh_client: ldns: Roll in some patches.
* ssh_client: Disable C++ exceptions & rtti.
* ssh_client: Drop unused build settings.
* uri: Fix nassh-args that where being parsed as nassh-ssh-args and vice-versa.
* ssh_client: openssh: update to 8.0p1.
* ssh_client: mandoc: update to 1.14.5.
* uri: Add ssh-agent as a valid option for -nash-ssh-args.
* uri: Use proxy-mode for conection if specified on the ssh arguments.
* uri: Add support for parsing ssh arguments in ssh:// URIs.
* uri: Fix fingerprint decoding in URIs.
* test: Rework to catch early errors.
* connect: Convert lib.fs.readDirectory to Promises.

# 0.17, 2019-03-26, Minor polish.

* hterm: Pull in multi-screen copy fix.
* manifest: Add SFTP client to the short description.
* relay: Use sup-ssh-relay for internal GCE nodes.

# 0.16, 2019-03-20, SFTP client everywhere.

* agent: Refactor and rename wire encoding primitives.
* agent: Only offer PIN caching if using agent forwarding.
* agent: Add support for ECDSA keys via OpenPGP applet.
* agent: Add support for Ed25519 via OpenPGP applet.
* GoogleRelay: Convert to ArrayBuffers.
* SSHAgentRelay: Pull out message size parsing.
* SSHAgentRelay: Convert to ArrayBuffers.
* nassh: Drop runtime dep checks.
* tests: Fix assert identity tests.
* chrome-bootstrap: Move to third_party.
* tests: Switch core to chai for asserts.
* sftp: Support creating hardlinks.
* sftp: Support statvfs@openssh.com.
* sftp: Support fsync@openssh.com.
* SSHAgent: Pull out message size parsing.
* SSHAgent: Convert to ArrayBuffers.
* crosh: Drop onTerminalResize existence check.
* tests: Call chai asserts directly.
* sftp: Allow nassh.sftp.Packet to be initialized from an array.
* sftp: Change toByteArray helper to return typed arrays.
* sftp: Allow setData to take arrays.
* sftp: Change getData helper to return typed arrays.
* sftp: Change stream to accept ArrayBuffers.
* sftp: Pull out message size parsing.
* sftp: Simplify the buffer parsing logic.
* sftp: Change client buffer to typed array.
* crosh: Fix getBackgroundPage in native crosh.
* crosh: Fix opening in window from a tab.
* tests: Convert test suite to mocha.
* stream: Drop remaining binary/ascii helpers.
* crosh: Make it easier to open as a window.
* nasftp: Add a cli.
* crosh: Fix command parsing in the query string.
* crosh: Don't assume ids are pids (numbers).
* agent: Revise when we default enable ssh-agent forwarding.
* sftp: Finish conversion to ArrayBuffers.
* crosh: Switch last lib.f.parseQuery to URLSearchParams.
* agent: Switch from custom array helpers to DataView.
* prefs: Fix export with URI-special characters.
* fsp: Support runtime config tweaking.
* stream: Drop reason argument to close.
* plugin: Rework how we tear down the plugin.
* agent: Add a --ssh-agent=gnubby alias.
* proxies: Make IPv6 addresses nicer w/--proxy-host.
* identity: Allow resetting back to the default.
* identity: Improve the import process.
* identity: Improve cleanup.
* identity: List all id_* files in dropdown.
* agent: Allow agent message to accept Arrays.
* RelaySshfe: Convert to ArrayBuffers.
* fsp: Handle symlink deletion.
* fsp: Handle symlinks better.
* fsp: Copy symlinks as symlinks.
* fsp: Handle symlinks when recursively copying.
* fsp: Internalize internal copy functions.
* omnibox: Fix handling of default port.

# 0.15, 2019-02-17, Fix SFTP mounting bugs.

* Pull a few minor unreleased libdot & hterm changes.
* fsp: Switch onReadFileRequested to readChunks helper.
* sftp: Expand getData API for reuse.
* sftp: Change DataPackets to data APIs.
* Unify connection startup a bit.
* Fix race with background page and sftp mounts.
* sftp: Move UTF-8 logic into Packet APIs.
* sftp: Switch to web Text{En,De}coder APIs.

# 0.14, 2019-02-06, Workaround Chrome bug in crosh & fix X10 encoding.

* Pull a few minor unreleased libdot & hterm changes.
* fsp: Remove redundant path filtering.
* stream: Allow tty data to be passed as ArrayBuffers.
* sftp: Move directory listing helper out of fsp.
* sftp: Merge removeDirectory from fsp.
* fsp: Simplify onDeleteEntryRequested.
* fsp: Use Promise.finally when closing file handles.
* sftp: Fix copy-data usage.
* fsp: Add tests.
* switch to array buffers with relay ssh-agent
* Harmonize script load ordering.
* sftp: Split sftp stream logic out of tty.
* crosh: Add a workaround for missing chrome.runtime bug.

# 0.13, 2019-01-29, Fix SFTP mount on CrOS.

* Pull a few minor unreleased libdot & hterm changes.
* streams: pull out /dev/tty file handling.
* fsp: rewrite write file loop.
* fsp: fix onTruncateRequested handling.
* ssh_client: change NaCl->JS data to be sent as ArrayBuffer.

# 0.12, 2019-01-24, Workaround Chrome bug.

* Add a workaround for missing chrome.runtime bug.

# 0.11, 2019-01-19, Lots of bugfixes and internal optimizations.

* Update to hterm 1.84.  Firefox fixes, openWindow security fixes,
  and few improvements.
* Update to libdot 1.26.  openWindow & new codec helpers.
* Move c.googlers.com config into the relay.
* Allow bookmarks to open as windows.
* crosh: Exclude more files from the distribution.
* Switch to chrome.runtime.getBackgroundPage.
* Make relay connection resume an option.
* Switch to libdot.fs.FileReader.
* Switch to array buffers with ssh-fe@google.com.
* sshfe: Pass Uint8Array to stringToCodeUnitArray.
* Drop update available check.
* Switch to array buffers with corp-relay@google.com.
* sftp: convert to stringToCodeUnitArray.
* Switch to array buffers for sending /dev/random data.
* sftp: fix readChunks reading.
* Add more edge cases/tests for nassh-option parsing.
* Fix Chrome App v2 check on other platforms.
* Switch to array buffers for sending sftp packets.
* Update translations.
* Switch to array buffers for sending tty data.
* fsp: Use copy-data extension if available.
* fsp: Switch to client data sizes.
* sftp: Use larger read/write sizes with OpenSSH.
* sftp: Add some higher level read helpers.
* sftp: Add some constants for read/write data sizes.
* options: Provide readable pref strings.
* ssh_client: Allow JS->NaCl data to be sent via arrays.
* sftp: Rename {read,write}File to {read,write}Chunk.
* FAQ: Add a tip for OS shortcuts and launching windows.
* Add SSH-FE relay support.
* streams: Pass low level open errors back up.
* streams: Stop passing stream to onOpen callback.
* Add a --proxy-mode option.
* Split connectTo up a bit.
* Switch to new lib.codec module.
* tests: Switch to a dark theme.
* Automatically trim whitespace in connection settings.
* Document the current relay server protocol properly.
* Fix tab discarding to only affect current tab.
* ssh_client: depot_tools/webports: Punt.
* ssh_client: glibc-compat: Split out of webports.
* ssh_client: ldns: Fix cross-compile build.
* ssh_client: Switch from glibc-compat to ldns.
* ssh_client: ldns: Import version 1.7.0.
* GoogleRelayWS: Use DataView to get/set uint32 length.
* ssh_client: openssl: Enable libssl building.
* Unify duplicate base64url handling.
* Fix v2 & sftp after plugin API change.
* Drop forced compression.
* sftp: Add unittests for sftp packet types.
* ssh_client: Migrate from jsoncpp to native ppapi vars.
* Use new lib.f.openWindow helper.
* Rip option parsing out of nassh.GoogleRelay.
* Rename relay-options to nassh-options.
* sftp: Use UTF8 encoding for pathnames.

# 0.10, 2018-12-02, OpenSSH 7.9p1 and sftp/build improvements.

* Update to hterm 1.83.  Minor improvements.
* Update to libdot 1.25.  Minor improvements.
* prefs: Fix handling of default port settings.
* prefs: Drop old relay-host/relay-port migration.
* sftp: Simplify intToNByteArrayString a bit.
* gnubby: Skip check on the web platform.
* nassh: Show hterm debug info for dev versions too.
* api: Add an API for opening crosh windows.
* sftp: Improve protocol documentation.
* sftp: Use posix-rename@openssh.com if available.
* sftp: Support sending extended packets.
* gnubby: Prefer certain versions of gnubbyd.
* doc: processes: Update docs to cover new signed workflow.
* sftp: Improve permission bit parsing.
* fsp: Add missing open flags.
* ssh_client: Move plugin outputs to build/ subdir.
* ssh_client: Link the naclsdk version directly.
* ssh_client: Move mandoc to common bin dir.
* ssh_client: Add a --jobs build flag.
* ssh_client: openssl: Split out of webports.
* ssh_client: jsoncpp: Split out of webports.
* ssh_client: zlib: Split out of webports.
* ssh_client: openssh: Convert to new Python build system.
* ssh_client: Change dev packages to install python3.
* ssh_client: Move cpplint to bin/.
* ssh_client: mandoc: Convert to new Python framework.
* ssh_client: depot_tools/webports: Convert to new Python framework.
* ssh_client: naclsdk: Convert to new Python framework.
* ssh_client: Start a new build system in Python.
* ssh_client: Rework plugin/ install steps.
* ssh_client: Update OpenSSH to 7.9p1.

# 0.9, 2018-10-24, OpenSSH 7.8p1 and a context menu.

* Update to hterm 1.82.  New context menu.
* Update to libdot 1.24.  Tool improvements for supporting nightly builds.
* crosh: Drop legacy build code.
* nassh/crosh: Add context menu support.
* Update translations.
* agent: Improve documentation for the PIN cache.
* nassh: Restrict the automatic description expansion in connection screen.
* build: Support nightly timestamped builds.
* FAQ: Add an entry about relay servers & 0.0.0.0 addresses.
* relay: Delete unused --relay-prefix-field support.
* sftp: Move pendingRequests internally.
* sftp: Bind stdout to sftp immediately.
* sftp: Move init logic into a callback.
* nassh: Move connecting message after plugin loading.
* FAQ: Note what is sync'ed to the cloud.
* sftp: Improve server version packet parsing.
* ssh_client: Drop NaCl support.
* ssh_client: Update to OpenSSH 7.8p1.
* ssh_client: Rework build layout a bit.

# 0.8.45, 2018-08-29, A11y improvements, and handle tab discarding.

* Update to hterm 1.81.  A11y improvements, and keyboard/mouse tweaks.
* Update to libdot 1.23.  Build improvements, i18n helpers, and npm support.
* nassh: Warn before closing open SSH connection.
* FAQ: Add a section about terminal encoding.
* mkcrosh: Rewrite to simplify the build.
* Disable Automatic tab discarding.
* build: Convert concat to a python script.
* nassh: Drop nonexistent file.
* gnubby: Clear lastError from gnubby probe.
* FAQ: Add more details to the legacy cipher/mac questions.
* FAQ: Expand IPv6 zone id docs.
* fsp: Split mount logic into sep knob.
* nassh: Unify profile based connection setup.
* nassh: Make connectToArgString fully async.
* nassh: Use -1 exit status for internal JS errors.
* nassh: Make registerProtocolHandler a bit more flexible.
* FAQ: Improve omnibox docs with different launch modes.
* build: Use readlink instead of realpath in promote script.
* a11y: Make it possible to enable/disable accessibility at runtime.

# 0.8.44.1, 2018-06-22, Extension startup fix.

* Update to hterm 1.80.  Minor tweaks.
* prefs: Support translating hterm categories.
* Automatically add -oSendEnv args for hterm env vars.
* Fix a11y crash in extension on non-CrOS systems.
* FAQ: Document mouse cursor customization.

# 0.8.44, 2018-06-20, OpenSSH 7.7p1, Unicode 11.0.0, and bug fixes.

* Update to libdot 1.22.  Unicode 11.0.0 updates and new helpers.
* Update to hterm 1.79.  A11y (screen reader) improvements & keyboard/mouse fixes.
* crosh: Extend for arbitrary commands.
* crosh: Support passing command line args down.
* sftp: Fix directory deletion and copying.
* docs: Improve building/reference documentation.
* extension: Add a link to the options page at the bottom.
* Use new lib.f.lastError helper.
* crosh: Display errors from terminalPrivate if available.
* removeFile: Fix param typo.
* docs: Update the hex ids info.
* terminal: Adds the crostini terminal icon to use with crosh.
* ssh_client: Update to openssh-7.7p1.
* FAQ: Add a X11 forwarding answer.
* FAQ: Add omnibox with multiple extensions.
* API: Add onSendMessageExternal to allow FilesApp to sftp mount.
* lint: Clean up semi-colon usage.
* a11y: Add basic support for announcing command output to AT.
* Handle option page loading failures.
* docs: Document the crosh code on the Chrome side.
* gsc: Implement a PIN cache for GSC agent.
* a11y: Preserve selection when scrolling collapsed selections.
* crosh: Pass the selected profile over.
* ssh_client: Stub out permission check.
* agent: Improve gnubby extension probing.
* Crush all images.
* release: Automatically minimize translations.
* ssh_client: Add a echosshd utility.
* l10n: Improve pref descriptions and translation tips.
* l10n: Import updated translations.
* prefs: Auto-select icon for preferences page.

# 0.8.43, 2018-01-26, Few new features and support for Chrome Extensions.

* Update to hterm 1.78.  Extended underlying support.
* Rework label alignment logic.
* Accept URI escapes in usernames & fingerprints.
* Document extensions that list us.
* sftp: document the source a bit more
* Delay some connection dialog work until visibility.
* Unify params object setup.
* Document expected coding style.
* Support running as an extension.

# 0.8.42, 2018-01-05, Bug fixes & smaller extension downloads.

* Update to libdot 1.21.  Minor fixes.
* Update to hterm 1.77.  Various bug fixes.
* Remove screenshots from releases.
* Document F11 when running in a tab for fullscreen for keyboard shortcuts.
* Shuffle nacl plugin paths for CWS filtering for smaller downloads for users.
* Fix resize errors after connect.
* Fix minor dialog error w/unbalanced rows.
* Set charset=utf-8 in html files.
* Refactor URI parsing into helper functions.
* Parse out fingerprint from ssh:// URIs.

# 0.8.41, 2017-12-13, Features & fixes galore.

* Update to libdot 1.20.  Features & fixes.
* Update to hterm 1.76.  Standards/compatibility fixes & OSC-8 links & OSC-1337 image features.
* Refactor and reformat before adding PIV.
* Set base path for SFTP RENAME and SETSTAT packets.
* support multiple gnubby extensions.
* crosh: finish localizing messages.
* crosh: set default background color to black.
* FAQ: extend the macOS auto-repeat entry.
* support translating all the hterm preferences.
* add a lib.f.getOs helper.
* mark sftp mounts as non-persistent across logouts.
* include all profiles all the time when backing up.

# 0.8.40.1, 2017-11-20, Multiple plugin support.

* Add option to select different ssh client plugin versions.

# 0.8.40, 2017-11-20, Pull in hterm fixes.

* Update to hterm 1.75.  Many color/style/mouse fixes & features.
* Use chrome.runtime.openOptionsPage helper.

# 0.8.39, 2017-10-27, OpenSSH upgrade.

* Update to hterm 1.74.  Minor improvements.
* Upgrade to OpenSSH 7.6p1.
* Update mdocml to latest release.
* Fix /dev/null pseudo file reads.
* Update relay options if the hostname changes.
* Rewrite translations in pure UTF-8.
* Update translation help text.
* Update translations.
* Fix newline handling in translations.

# 0.8.38, 2017-10-16, Bugfixes galore.

* Update to libdot 1.19.  Bug fixes.
* Update to hterm 1.73.  Various bugfixes and minor features.
* crosh: Fix pasting Unicode content.
* Fix base64url encoding translation with relays.
* Display relay error messages to the user.
* Detect relay loops.
* agent: Print SSH public key blobs to the console.
* Add a guide for setting up smart card backed ssh keys.
* agent: Improve TLV handling with smart cards.
* agent: Take OpenPGP card capabilities into account.
* agent: Add short names for Gemalto readers.
* Validate relay options.
* Ignore common browser shortcuts in connection dialog.
* omnibox: Allow matching saved profile names.

# 0.8.37, 2017-09-12, Unicode updates and ssh-agent frameworks.

* Update to libdot 1.18.  Unicode 10.0.0 updates (from Unicode 5).
* Update to hterm 1.72.  Misc bugfixes.
* Implement an extensible SSH agent (stub backend).
* Integrate Google Smart Card Connector client.
* Add an agent backend for smart card keys.
* Also set relay page to black background.
* Fail gracefully when loading an unknown profile.
* Fix argstr parsing when connecting via URIs.
* Fix opening a new window from the omnibox.
* Use lib.f.getStack helper in more places.

# 0.8.36.12, 2017-09-01, Bugfixes galore.

* Update to libdot 1.17.  Better handling for Unicode combining characters.
* Update to hterm 1.71.  Better handling for Unicode combining characters.
* Improve startup display to not flash so much white.
* Promote some array helpers to new lib.array API.
* Promote binary<->base64 helpers for all stream classes.
* Refactor Stream.asyncRead API to unify duplicate implementations.

# 0.8.36.11, 2017-08-16, Improve Unicode handling.

* Update to libdot 1.16.  Better handling for Unicode combining characters.
* Update to hterm 1.70.  Better handling for Unicode combining characters.
* Use new lib.f.randomInt helper.
* Fix helper scripts/docs to use POSIX portable \033 instead of \e with printf.
* Support basic quoting rules with ssh command line.
* Add random feature tips to startup screen.

# 0.8.36.10, 2017-08-08, Minor improvements.

* Update to hterm 1.69.  Improve cursor tracking and add pref for default
  encoding.
* Rework user ssh command line processing.

# 0.8.36.9, 2017-07-26, New feature polish.

* Update to hterm 1.68.  Various fixes for new features, and make accidental
  character map transitions more robust.
* Shrink & shift connection dialog to not take up so much space.
* Rework passing of subsystem down to the OpenSSH NaCl.

# 0.8.36.8, 2017-07-19, New feature polish.

* Fix identity dropdown list display.

# 0.8.36.7, 2017-07-17, New feature polish.

* Update to hterm 1.67.  Various fixes for new features.
* Tweak relay options for .c.googlers.com domains.

# 0.8.36.6, 2017-06-29, Bug fixes & more features!

* Update to libdot 1.15.  Some standards fixes.
* Update to hterm 1.66.  Unicode rendering fixes, mouse fixes, custom
  notification support, and character map robustification.
* Fix handling of custom --ssh-agent when using --config=google.
* Stop enabling ssh-agent forwarding by default for non-google configs.
* Document support for cycling input methods (in CrOS).
* Refresh translations everywhere!
* Document more relay options.

# 0.8.36.5, 2017-05-30, New OpenSSL & UX improvements.

* Update to libdot 1.14.  Some standards fixes.
* Update to hterm 1.65.  Lots of keyboard/mouse fixes/improvements.
* Add a console.log to point term_ hackers to the options page.
* More internal SFTP API improvements.
* Delay display of connection dialog until it's finished loading.
* Add more FAQs about font ligatures & keyboard bindings.
* Autopopulate --config=google for Google corporate domains.
* Fix rendering of mount path in the connection dialog.
* Improve options page terminal preview to handle paste events.
* Fix ServerAliveInterval handling (and perhaps other configs).
* Upgrade mdocml (used to generate ssh man pages).
* Upgrade OpenSSL to 1.0.2k.

# 0.8.36.4, 2017-05-18, IDN & UX improvements.

* Update to libdot 1.13.  Brings in punycode (for IDN) support.
* Update to hterm 1.64.  Adds shift+arrow key scrolling.
* Start documenting tribal knowledge^W^W our release processes.
* Highlight invalid fields in the connection manager better.
* Pretty format JSON objects in the options page.
* Support completely arbitrary usernames (spaces, dashes, etc...).
* Expand our Chrome exceptions features document.
* Add basic hostname checking to the connection manager.
* Add IDN support (to connect to international hostnames using Unicode).
* Lots of internal SFTP API cleanups & improvements.
* Set the title (tooltip) text of input fields in the connection manager.
* Improve accessibility labels in the connection manager.
* Catch NaCl plugin crashes in more places.
* Support showing release highlights in the initial terminal.
* Add an option for changing the base path with SFTP mounts in Chrome OS.
* Upgrade zlib to 1.2.11.

# 0.8.36.3, 2017-05-03, new features for users.

* Update to libdot 1.12.  Fixes preference syncing between open windows.
* Update to hterm 1.63.  Lots of little new features.
* Log the actual relay we're connecting through.
* Increase the field size in the options page for easier editing.
* Add a user-css-text field for injecting custom CSS directly.
  Simplifies use of webfonts.
* Ignore custom ssh commands when creating a SFTP mount.

# 0.8.36.2, 2017-04-17, bumps + cleanups + bug fixes.

* Update to libdot 1.11.  Adds support for legacy X11 RGB color formats.
* Update to hterm 1.62.  Adds blink support and sticky alt key.
* Fix some typos in UI strings.
* Merge NaCl ssh_client into the libapps repo!
* Clean up some dead legacy code in NaCl plugin.
* Fix wedged sftp mounts in the Files app.
* Add support IPv6 addresses in URIs (e.g. ssh://[::1]).
* Add omnibox integration via the "ssh" keyword.

# 0.8.36.1, 2017-04-03, openssh cleanups.

* Strip openssh binaries to shrink considerably.
* Set openssh --prefix to / instead of the build path.
* Fix reading of local ssh keys.

# 0.8.36.0, 2017-03-31, cleanup + openssh upgrade.

* Upgraded openssh from 6.6p1 to 7.5p1.  Notably, support for ECDSA/ED25519.
  Multiple legacy options have been dropped or disabled; see the [FAQ](./FAQ.md)
  for more details.
* Fixed handling of errno values in NaCl plugin for clearer errors.
* Auto register ourselves as ssh:// protocol handler.
* Add protip for ctrl+clicking links to startup message.
* Cleanup obsolete CSS variable hacks.
* Drop support for Chrome <22 versions.
* Drop wash hooks from the manifest.

# 0.8.35.6, 2017-03-28, password paste fix.

* Drop unused dialogs.css file.
* Fix pasting text during initial password prompts.  This broke w/0.8.35.0.

# 0.8.35.5, 2017-03-24, initial sftp.

* Add v2 support for --config=google relays.
* Enable sftp filesystem support for Chrome OS.  This requires Chrome 57+ now.

# 0.8.35.4, 2017-03-10, resource lite.

* Switch background page to being non-persistent so it closes when not used.
* Fix >crosh connection shortcut after sftp rework.
* Update to libdot-1.10.  Fixes non-fatal, but annoying, FileError warnings.

# 0.8.35.3, 2017-02-17, pre-sftp.

* Rebuilt plugin again for working agent.
* Initial sftp work for Chrome OS.  Not enabled in manifest.
* Improve exit cleanup logic.

# 0.8.35.2, 2017-02-02, rollback.

* Not a real release.  Rolled back to 0.8.34.4 due to breakage with agents.

# 0.8.35.1, 2017-01-31, relay fixes.

* Fix some logic bugs in stream reworking.

# 0.8.35.0, 2017-01-31, hterm 1.61 + sftp prep.

* Bump min Chrome version to 41 since we don't test on anything older.
* Rebuilt ssh_client plugins to include some fd related changes.
* Update to hterm 1.61.  Fixes missing last line, and adds clickable URLs.
* Include ssh man pages in html form for users to read.
* Fix --proxy-port passing for Google relays.
* Add Ctrl-Shift-P shortcut in crosh for opening preferences.
* Drop blocking of Ctrl-Shift-N shortcut in crosh.

# 0.8.34.4, 2016-09-15, hterm 1.60.

* Update to hterm 1.60.  This horizontal cursor position tracking.

# 0.8.34.3, 2016-09-14, hterm 1.59.

* Update to hterm 1.59.  This fixes loading errors under Chrome M54+.

# 0.8.34.2, 2016-04-06, hterm 1.57, minor polish.

* Update to hterm 1.57.
* Update various short URLs.
* Try to fix blank page on startup problems.

# 0.8.34.1, 2015-06-16, hterm 1.56, freshen up the options page.

* Update to hterm 1.56.
* Use hterm's new pref category and data type data to improve the options
  page.

# 0.8.33.2, 2015-05-28, Prefs backup/restore tweaks

* Refresh the backup link at startup and after each pref change.
* Use the new MouseEvent ctor instead of the deprecated
  initMouseEvent function.

# 0.8.33.1, 2015-05-19, Update to hterm 1.55 plus fixes in nassh

* Trim trailing spaces from ssh and relay arguments.
* Add preference save/restore UI to the options page.
* Fix preferences under strict mode.

# 0.8.32.4, 2015-03-19, Update to hterm 1.54.

* Update to hterm 1.54.

# 0.8.32.3, 2015-03-02, Fix rtdep errror.

* Remove bogus rtdep on lib.f.Sequence which cause the bg page to fail to start.

# 0.8.32.2, 2015-03-02, Update to hterm 1.53

* Update to hterm 1.53.

# 0.8.32.1, 2015-02-18, Update to hterm 1.52

* Update to hterm 1.52.

# 0.8.31.2, 2014-11-11, Include dialog sync fix.

* Rebase and rebuild to include commit 458213... which fixed a race condition
  in the connection dialog.

# 0.8.31.1, 2014-11-11, Add --ssh-agent option, hterm 1.51.

* Add "--ssh-agent" as a relay-option.  This can be set to a chrome app id
  which will act as an ssh-agent over chrome app messaging.
* Update --config=google to use the default Google key agent app.
* Update to hterm 1.51 for 24-bit color support.

# 0.8.30.1, 2014-10-07, Update to hterm 1.50

* Update to hterm 1.50 for OSC 52 and HOME/END vs application cursor fixes.

# 0.8.29.1, 2014-09-23, Reorder background scripts.

* Reorder the background scripts in the manifest file to account for a race
  condition.  Before this change, the callback in nassh_background.js would
  sometimes execute before the rest of the background scripts had loaded.
* Change the proxy host used in --config=google.

# 0.8.28.2, 2014-08-13, Update to hterm 1.48.

* Update to the latest hterm.

# 0.8.28.1, 2014-07-31, Add onUpdateAvailable handler.

* Handle the chrome.runtime.onUpdateAvailable event so that we're
  not automatically reloaded when there's a pending update.

# 0.8.27.12, 2014-07-08, Update to hterm 1.47.

* Update to the latest hterm.

# 0.8.27.11, 2014-07-24, Update to hterm 1.46.

* Update to the latest hterm.

# 0.8.27.10, 2014-07-23, Update to hterm 1.44.

* Update to the latest hterm.

# 0.8.27.9, 2014-06-25, Update to hterm 1.42.

* Update to the latest hterm.
* Add the "notifications" perimission.

# 0.8.27.8, 2014-06-24, Update to hterm 1.41.

* Update to the latest hterm.

# 0.8.27.7, 2014-05-27, Rebuild nacl ssh plugin.

* Update to latest build of plugin to fix getsockname errors.

# 0.8.27.6, 2014-05-27, Update to wam 1.1 for 'open' support.

* Update to wam 1.1 for the latest changes.

# 0.8.27.5, 2014-04-29, Add wash support, update hterm.

* Update to hterm 1.38 for 'ctrl-c-copy' and 'pass-meta-v' prefs and selection
  collapse fixes.
* Add wam/wash support.  Enabled by default in Secure shell (dev).  Toggle
  the wam listener from the js console of the secure shell background page with:

    app_.prefs_.set('enable-wam', true);   // enable
    app_.prefs_.set('enable-wam', false);  // disable

    // Array if chrome extension ids which are allowed to make wam connections
    // to nassh.  Defaults to Wash (tot) and Wash (dev).
    app_.prefs_.set('wam-allowlist', [...]);

# 0.8.27.2, 2014-04-29, Update hterm.

* Update to hterm 1.37 for double-paste fix.

# 0.8.27.1, 2014-04-28, Update hterm, openssh/openssl libs.

* Update to ssh binary to "OpenSSH_6.6, OpenSSL 1.0.1g 7 Apr 2014"
* Update to hterm 1.36.
* Update to libdot 1.7.

# 0.8.26.6, 2014-03-25, Options page initialization fix.

* Reorder options page initialization so that it actually works.

# 0.8.26.5, 2014-03-25, Update to hterm 1.35, new options page.

* Update to hterm 1.35 for enable-bold-as-bright preference.
* Rewrite options page to be more Chrome like.

# 0.8.26.4, 2014-03-14, Update to hterm 1.34.

* Update to hterm 1.34 for user-css and ctrl-plus-minus-zero-zoom prefs.

# 0.8.26.3, 2014-03-06, Update to hterm 1.32.

* Update to hterm 1.32 for zoom warning and mouse selection fixes.

# 0.8.26.2, 2014-03-05, Update to hterm 1.30.

* Update to hterm 1.30 for "scrolling speedups" revert (fixes scrolling selected
  text off screen), and copy/paste of wrapped lines fix.

# 0.8.26.1, 2014-02-25, Fix google relay, Update to hterm 1.29+, libdot 1.6

* Fix undefined var in nassh_stream_google_relay.js.
* Update to hterm <unnamed version after 1.39> for scrollport speedups.
* Update to libdot 1.6 for pref manager fixes.

# 0.8.25.3, 2014-02-14, Update to hterm 1.29.

* Update to hterm 1.29 for auto-copy fix-fix.

# 0.8.25.2, 2014-02-13, Update to hterm 1.28.

* Update to hterm 1.28 for auto-copy fix.

# 0.8.25.1, 2014-01-28, Update to hterm 1.27.

* Update to hterm 1.27 for fullwidth support.

# 0.8.24.2, 2014-01-16, Update to hterm 1.26.

* Update to hterm 1.26 for 'user-css' preference.

# 0.8.24.1, 2014-01-08, Update to libdot 1.5, hterm 1.25.

* Update to libdot 1.5 for BlobBuilder fix.
* Update to hterm 1.25 for Ctrl-V/Ctrl-Shift-V pref, DECSET 1002 fix.
* Fix tristate fields in the options page.

# 0.8.23.2, 2013-12-11, Fix cursor height regression.

* Update to hterm 1.24, which has a fix for cursor height troubles.

# 0.8.23.1, 2013-12-10, Crosh Ctrl-N fix.

* Fix the Ctrl-N handler in crosh.js.

# 0.8.22.4, 2013-12-02, Relay fix.

* Fix to use the correct relayHost in the event that the relayPrefixField is
  in effect, but the prefix had already been included in the proxyHost.

# 0.8.22.3, 2013-11-26, Learn the new relay dance.

* Update the google relay code to understand the new proxy front-end to the
  relay servers.  Should be backwards compatible.  Googlers can now specify
  the relay option "--config=google" to magically specify the correct config.

# 0.8.22.2, 2013-11-26, Crosh polish.

* Display reconnect menu on non-zero exit status.
* Override ctrl/meta-shift-n to load a new nassh.html window rather than
  crosh.html, if available.
* Add nassh.html/crosh.html to web_accessible_resources to allow linking.

# 0.8.22.1, 2013-11-25, Update hterm, add ">crosh" host.

* Update to hterm 1.23.
* Add special hostname ">crosh" to redirect to the crosh shell on Chrome OS,
  so that it's possible to open crosh in an app window.  This is a temporary
  fix that will have to change when Secure Shell moves to a v2 app.

# 0.8.22, 2013-07-30, Stable release of 0.8.21.1.

* Stable release of 0.8.21.1.

# 0.8.21.1, 2013-07-30, Actually update to hterm 1.17.

* Forgot to mkdeps for 0.8.20.5 :/

# 0.8.21, 2013-07-30, Stable release of 0.8.20.5.

* Stable release of 0.8.20.5.

# 0.8.20.5, 2013-07-27, Update to hterm 1.17.

* Update to hterm 1.17.

# 0.8.20.4, 2013-07-25, Update to hterm 1.16.

* Update to hterm 1.16.

# 0.8.20.3, 2013-07-25, Update to hterm 1.15.

* Update to hterm 1.15.

# 0.8.20.2, 2013-07-19, Update to hterm 1.14.

* Update to hterm 1.14.

# 0.8.20.1, 2013-07-18, Update to hterm 1.13.

* Disable zoom warning on newer Chrome builds.

# 0.8.20, 2013-07-08, Stable release of 0.8.19.4

* Stable release of 0.8.19.4

# 0.8.19.4, 2013-06-24, Update to hterm 1.12.

* Include zoom warning fix from hterm 1.12.

# 0.8.19.3, 2013-06-20, Update to hterm 1.11.

* Include 'send-encoding'/'receive-encoding' preferences from hterm 1.11.

# 0.8.19.2, 2013-06-20, Update to hterm 1.10.

* Include 'characer-encoding' preference from hterm 1.10.

# 0.8.19.1, 2013-06-19, Update to hterm 1.9.

* Include Shift-Tab fixes from hterm 1.9.

# 0.8.19, 2013-06-19, Stable release of 0.8.18.5

* Stable release of 0.8.18.5.

# 0.8.18.5, 2013-05-31, Overscroll fix.

* Update to hterm 1.8.

# 0.8.18.4, 2013-05-31, Small fixes.

* Update to hterm 1.7.
* BUG=245459: Disable the "Are you sure?" before-unload dialog when open as a
  window.

# 0.8.18.3, 2013-05-03, Update to libdot 1.3.

* Update to libdot 1.3.

# 0.8.18.2, 2013-04-16, Update to hterm 1.4.

* Update to hterm 1.4.
* Modify ./bin/mkzip.sh to warn if nassh_deps.concat.js is not current.

# 0.8.18.1, 2013-04-08, Update to hterm 1.3.

* Update to hterm 1.3 to get clear screen, media key, and alt-backspace changes.

# 0.8.18, 2014-04-08, Stable release of 0.8.17.3

* Stable release of 0.8.17.3.

# 0.8.17.3, 2013-04-02, Add preferences export/import.

* Added some basic plumbing for preference import/export.  Must be driven from
  the command line console at the moment.

# 0.8.17.2, 2013-04-01, Rebuild nacl plugin with ixany fix.

* Rebuild plugin with https://codereview.chromium.org/13008014/.
  BUG=chromium:218361, ...ixany/tostop being set in termios

# 0.8.17.1, 2013-03-28, Add relay port option, update nacl plugin

* Update NaCl plugin to the latest source.
* Add ability to specify relay port.

# 0.8.16.3, 2013-03-19, Update to hterm 1.2

* Update to hterm 1.2 to get terminal bell fix.

# 0.8.16.2, 2013-03-18, Fix crosh/prefs pages

* Fix script includes in nassh_preferences_editor.html and crosh.html pages.

# 0.8.16.1, 2013-03-14, Grab bag of fixes

* Update to libdot 1.1, hterm 1.1.
* Add notice about the age of the hterm library on startup in TOT builds.
* BUG=chromium-os:34460, can't delete connections with on-screen "[DEL] Delete"
  button.
* BUG=chromium-os:39287, col walking in connection manager doesn't work quite
  right.
* BUG=chromium-os:39594, When focused, Enter button does not respond to pressing
  the Enter key.

# 0.8.16, 2013-02-28, Stable release of 0.8.15.1

* Stable release of 0.8.15.1.

# 0.8.15.1, 2013-02-26, Improve character size precision.

* Change hterm.ScrollPort..measureCharacterSize to average out 100 characters
  rather than measuring just one.  The improved precision is necessary on
  high-dpi devices.
* Fix a bug in measureCharacterSize that got the zoomFactor wrong (we never
  re-measured after disabling zoom adjustments.)

# 0.8.15, 2013-02-25, Stable release of 0.8.14.1.

* Stable release of 0.8.14.1.

# 0.8.14.1, 2013-02-25, Fix column-list scrolling.

* Swap out the flexbox based listbox for an old skool table.  The flexbox
  version didn't scroll properly and didn't handle text-overflow: ellipsis.

# 0.8.14, 2013-02-22, Stable release of 0.8.13.1.

* Stable release of 0.8.13.1.

# 0.8.13.1, 2013-02-22, Fix version detection regression.

* Fix version detection regression.

# 0.8.13, 2013-02-22, Re-release of 0.8.13 with correct icon.

* Re-release after fix to ../libdot/bin/mkzip.sh to use the correct app icon.

# 0.8.12.1, 2013-02-22, Combine changelogs.

* Combine doc/changelog-dev.txt and doc/changelog-stable.txt into
  doc/changelog.txt.
* Unreleased No-op dev version bump so we can re-package 0.8.12 as 0.8.13, but
  with the correct icon.

# 0.8.12, 2013-02-22, Stable release of 0.8.11.6

* Stable release of 0.8.11.6

# 0.8.11.6, 2013-01-20, Address review comments, restrict to >=M23

* Includes changes that were made during 0.8.11.5 code reviews.
* Remove the nacl (not pnacl) plugin and the code to load it in Chrome 22 and
  lower.
* Restrict to Chrome 23 and higher in manifest.json.

# 0.8.11.5, 2013-01-06, Dialog cleanup, scrollbar fixes

* Fix size of rowNodes element in hterm.ScrollPort so that it doesn't cover
  the scrollbar.
* Fix bug where we'd focus the wrong connection profile after creating
  a new one.
* Populate the username and hostname fields as soon as the description
  loses focus.

# 0.8.11.4, 2013-01-05, More getBoundingClientRect fixes

* Fix remaining getBoundingClientRect issues so that all tests pass.

# 0.8.11.3, 2013-01-05, Fix preferences page

* Fix preferences page.

# 0.8.11.2, 2013-01-05, Fix crosh

* Fix crosh init.

# 0.8.11.1, 2013-01-04, libs and fixin's

* Removed "pattern" attribute on hostname input box.
  BUG=chromium-os:36832 host field doesn't accept IPv6 addresses.
* Use getBoundingClientRect() so we can handle sub-pixel positioning.
  BUG=chromium-os:31840, Sub-pixel text positioning breaks cursor position
  calculations
* Make connection dialog size a function of window size.
* Explicitly specify the size of new windows open with Ctrl-Shift-N.
  BUG=chromium-os:38272 The second Secure Shell window is always very small

* Add ability to register new init functions via lib.registerInit.  These
  will be called in order during lib.init().
* Make ensureRuntimeDependencies private and call it during lib.init().
* Move lib.getStack to lib.f.getStack.
* Add "escapeHTML" flag to lib.f.replaceVars.
* Add lib.f.alarm to wrap callbacks with a timer that logs a warning
  message if the callback isn't invoked before time expires.

* Update existing preference record when a dupe is passed to
  lib.PreferenceManager..definePreference, rather than throw an exception.
* Change lib.PreferenceManager..defineChildren to take a factory function
  instead of a constructor, so that children can be of different classes.
* Add opt_hint to lib.PreferenceManager..createChild, to allow callers to
  include an opaque string in a generated id.
* Add opt_id to lib.PreferenceManager..createChild, to allow callers to
  specify a child id.
* Add opt_default to getChild.  If passed, getChild will return
  it, rather than throw an exception.
* Pass the preference manager instance, rather than the storage object,
  to the child factory when creating a new child.  This gives the
  child instance much more context to work with.
* Add lib.PreferenceManager.diffChildLists utility function to make it
  easy to find out what's changed in a list of children since you last
  saw it.

* Add nassh.test() to launch the tests from a chrome-extension: url,
  since file: urls don't appear to allow XHR anymore.
* Fix stack trace logging in lib.TestManager.Test..run.
* Make lib.TestManager.Result..completeTest_ throw a TestComplete
  exception even for re-completes.  This ensures the test case is interrupted.

# 0.8.9.2, 2013-01-03, Fix OSC 52 with UTF-8 text.

* Convert UTF-8 strings to UTF-16 before copying to clipboard for OSC 52.

# 0.8.9.1, 2012-12-12, Add Alt/Meta-0..9 handlers.

* Add prefs to send Alt/Meta-1..9 to the host.  Preferences default to
  autodetect based on OS platform and window type.

# 0.8.9.0, 2012-12-12, Add Ctrl-Shift-K and Ctrl-1..9 handlers.

* Add Terminal.prototype.wipe() method to clear primary screen, alternate
  screen, and scrollback buffer.
* Map Ctrl-Shift-K to term_.wipe().
* Detect the window type during hterm.init() so we can branch based on the
  open-as-window state.
* Add prefs to send Ctrl-1..9 to the host.  Preferences default to
  autodetect based on OS platform and window type.
* Add "Pro Tip" about open-as-window for non-OS X users who are not opened
  in a dedicated app window.

BUG=chromium-os:35507, Pass alt/ctrl 0..9
BUG=chromium-os:32111, Add ability to clear scrollback buffer

# 0.8.8, 2012-12-10, Stable release of 0.8.8.10.

* Stable release of 0.8.8.10.

# 0.8.8.10, 2012-11-30, Chrome 21 fixes.

* Fix to properly select lib.Storage.Local on Chrome 21.
* Re-read from storage *before* trying to resolve selected the profile in
  connectToProfile().
* Add lib.Storage.Memory for the test harness.

# 0.8.8.9, 2012-11-28, Rebuild Pepper 25 binaries

* Tweak build scripts and rebuild Pepper 25 based nacl binaries.

# 0.8.8.8, 2012-11-27, Pepper 25 changes

* Build pnacl binaries with Pepper 25.
* Add Chrome >=24 plugin selection.

# 0.8.8.7, 2012-10-31, Fix missing 'var' in preference manager.

* Add a missing 'var' keyword in lib_preference_manager.js.

# 0.8.8.6, 2012-10-31, Fixes for options page and Chrome 21 storage

* Fix 'enable-bold' pref.
* Fix non-text inputs in options page.
* Fix copy/paste error in lib.Storage.Local (which is only used in
  Chrome <= 21).

BUG=chromium-os:35109, Disable bold fonts

# 0.8.8.5, 2012-10-25, Options page, baud rate, c/p cleanup

* Initial add of an options page, thanks to Mike Frysinger.
* Tweak the nacl plugin to set a default baud rate for the tty.
* It turns out webkit stops sending "paste" events if you have a child with
  -webkit-user-select: none.  This patch works around the issue by calling
  preventDefault() from the mousedown event, instead of using
  -webkit-user-select.
* eraseToRight: If the current background color is default, then delete instead
  of inserting spaces.  This trims the trailing whitespace in the most common
  case.
* Replace new-lines with carriage-returns on paste, since it's the right thing
  to do.
* Add osc52.vim and osc52.sh scripts to help users with clipboard integration.

BUG=chromium-os:35643, Incorrect tty baud rate

# 0.8.8.4, 2012-10-15, Reland 0.8.8.1 changes

* Broke 0.8.8.1 changes into smaller CLs for easier review.  This commit marks
  the re-integration of the changes.
* Re-order includes in nassh_connect_dialog.html
* Make hterm.init call back on a timeout.
* Removed lib.f.alarm for now.  This function was released as part of 0.8.8.1
  but I'm holding off on landing it until later.

# 0.8.8.3, 2012-10-15, Include pnacl binary.

* Actually include the pnacl binary in the package.

# 0.8.8.2, 2012-10-14, Use pnacl on Chrome >= 23.

* Add a pnacl version of the plugin which we load only in Chrome >= 23.

# 0.8.8.1, 2012-10-14, Chrome stable vs storage.sync fix.

* Fix nassh.PreferenceManager to degrade to window.localStorage if
  chrome.storage.sync is not available.
* Add lib.f.alarm.
* Fix scroll-on-output preference.

# 0.8.8.0, 2012-10-08, Synchronized preferences.

* Add lib.Storage.Local and lib.Storage.Chrome classes to normalize the API
  between window.localStorage and chrome.storage.
* Generalize nassh.PreferenceManager profile management code into
  lib.PreferenceManager so that other code can easily define child preferences.
* Add preference to override the default color palette.

# 0.8.7, 2012-10-08, Stable release of 0.8.7.5.

* Stable release of 0.8.7.5.

# 0.8.7.5, 2012-10-2, Text selection fix.

* Fix mouse-based text selection when the selection involves styled text.

# 0.8.7.4, 2012-09-26, Insert lines fix.

* Fix hterm.Terminal.insertLines to move the correct rows.  This fixes the
  Reverse Index (RI) sequence (and probably others) that depended on it.

# 0.8.7.3, 2012-09-25, Styled holes

* Backfill holes created by Erase Characters (ECH) and Delete Characters (DCH)
  with spaces in the current text style.
* Fix minor issue with Character Attributes (SGR) with colors 100-107.  These
  were setting the foreground color instead of the background.

BUG=chromium-os:30258, Text attributes not rendered for whitespace at the end
    of a line

# 0.8.7.2, 2012-09-24, Fix regressions, disable pnacl

* Recompile nacl plugin without pnacl to avoid crashes on Mac and extreme
  slowness elsewhere.
* Fix keyboard regression that prevented multi-accelerator sequences
  (ctrl-alt-foo, etc) from working.
* Stop bolding colors >= 16.

BUG=chromium-os:34306, hterm shows wrong colors for bold colors 16 through 249

# 0.8.7.1, 2012-09-20, Some keyboard fixes and pnacl

* Recompile nacl plugin with --pnacl enabled.
  (See https://chromium-review.googlesource.com/#/c/33519/.)
* Changed hterm_keyboard.js to only add modifier munging to strings that
  came from the "default" action.  Other actions are assumed to already
  be appropriate for the in use modifier.
* Make Alt-F1...F12 send F11-F22.  This similar to xterm with the "VT220
  Keyboard" option is enabled, except xterm uses Ctrl as the modifier.  We use
  Alt because Ctrl-F1...F12 are not capturable on Chrome OS devices.

BUG=chromium-os:30857, Shift+F6 doesn't work
BUG=chromium-os:32608, Add extended function key (F13-24) support.

# 0.8.7.0, 2012-09-13, Handle synthetic keystrokes on OS X.

* Added a "textInput" event handler to hterm_keyboard.js.  We're not actually
  supposed to get these, but we do on the Mac in the case where a third party
  app sends synthetic keystrokes to Chrome.

Internal bugs:
6111077 Bluetooth OTP not working with hterm
6838548 Bluetooth OTP is not able to make past SSHinaTab

# 0.8.6, 2012-09-13, Stable release of 0.8.6.0.

* Stable release of 0.8.6.0.

# 0.8.6.0, 2012-09-11, Increase max-string-sequence, add enable-clipboard-notice

* Increased the size of the max-string-sequence pref from 1,024 to 100,000, in
  order to support larger clipboard transfers via OSC 52.
* Add an enable-clipboard-notice preference, defaulted to true.  Change this
  to false to turn off the "Selection Copied" message.
* Added etc/osc52.el, a reference implementation of emacs-to-hterm clipboard
  sync.  The script should also work for xterm and other OSC 52 compliant
  terminals.

# 0.8.5, 2012-09-07, Stable release of 0.8.5.1.

* Stable release of 0.8.5.1.

# 0.8.5.1, 2012-09-07, Fix triple-click selection.

* Another selection bug.  Triple clicks result in the selection of exactly one
  full row.  This means that the selection ends at the 0 offset of the following
  x-row.  hterm.Terminal.getSelectionText assumed that an x-row couldn't be
  selected, only elements within the row could be.  You could also get into
  this state if you manually selected exactly to the end of a row.

# 0.8.5.0, 2012-09-06, Fix selection bug.

* The code that tried to determine which node came first in a single-line
  selection was busted.  It didn't work if the selection involved styled
  text.
* Clear location.hash when "(C)hoose another connection" is selected.
* Allow Ctrl-W to close window at the reconnect prompt.
* Show product name and version in the title by default.

BUG=chromium-os:34003
BUG=chromium-os:34149

# 0.8.4, 2012-09-05, Stable release of 0.8.4.0

* Stable release of 0.8.4.0

# 0.8.4.0, 2012-09-05, Fix another OSC 4 regression.

* We were mishandling hex X11 rgb values.  They weren't being translated into
  decimal, and would result in invalid CSS rgba(...) values.

# 0.8.3, 2012-09-05, Stable release of 0.8.3.0

*  Stable release of 0.8.3.0

# 0.8.3.0, 2012-09-04, Reject invalid resizes.

* Reject attempts to resize or realize a row or column count <= 0.  This fixed
  a bug where new windows opened with ctrl-shift-n would usually hang if
  performed from an active connection.

BUG=chromium-os:34123

# 0.8.2, 2012-08-27, Stable release of 0.8.2.11

* Stable release of 0.8.2.11.

# 0.8.2.11, 2012-08-28, Fix OSC-4 regression.

* Fixes a regression that broke OSC-4, color palette read/write, and adds a
  testcase to catch future regressions.

# 0.8.2.10, 2012-08-24, Fix another missing-rows bug.

* Fix a bug where we'd shift the rowNodes element up to offset hidden nodes
  before the top fold, but never compensated by making the rowNodes element
  taller.

# 0.8.2.9, 2012-08-22, Don't clear selection for copy-on-select.

* Remove the delay and selection clearing from copy-on-select.  The copy now
  happens immediately, and the selection is not cleared.

BUG=chromium-os:33786, hterm: double paste on right-click

# 0.8.2.8, 2012-08-21, backout dialog resize CL.

* Remove the dialog size CL, since it requires M21.

# 0.8.2.7, 2012-08-21, writelnUTF16 fix.

* Actually append '\r\n' in hterm.Terminal.io.writelnUTF16.

# 0.8.2.6, 2012-08-21, UTF8 fix, copy fix, dialog cleanup

* Fix display of utf-8 data from translated messages.
* connect dialog: Select the previous connection by default.
* connect dialog: Fix dis/enable issues with the buttons.
* connect dialog: Double click to connect.
* Re-add copy-on-select delay.
* Add 'close-on-exit' preference to control whether or not the window closes
  on exit.  Defaults to on.
* Properly handle overflow lines during clipboard copy.
* Offer to reconnect on disconnect.
* Session id parsing in connection arguments.

BUG=chromium-os:27974, Exit command does not close the hterm window
BUG=chromium-os:27020, newlines added during clipboard copy
BUG=chromium-os:29217, offer to reconnect after disconnect

# 0.8.2.5, 2012-08-15, Misc cleanup.

* Add 'enable-clipboard-write' preference to enable/disable the OSC 52
  (host write to system clipboard) sequence, on by default.
* Change default Windows font to "Terminal".
* Fix the delete profile/delete identity behavior in the connect dialog.
* Fix the placeholder text of the "Terminal Profile" field in the connect
  dialog.
* Remeasure the character size on resize, to catch browser zoom changes.
* Don't show the size overlay for alt/primary screen swaps.

BUG=30604, font face 'Lucida Console' Bold characters disabled

# 0.8.2.4, 2012-08-13, Add missing dep to crosh.html.

* Fix missing lib_utf8.js in crosh.html.

# 0.8.2.3, 2012-08-13, NaCl plugin fixes.

* Various termios fixes for input and output transformation. Fixes
  drawing issue with some ncurses applications.

# 0.8.2.2, 2012-08-10, Add Ctrl-Shift-N to open new instance.

* Make Ctrl-Shift-N/Meta-Shift-N keyboard combinations open a new window.

# 0.8.2.1, 2012-08-10, VT mouse, copy/paste work, and bug fixes.

* Moved common libraries under the "lib" object.
* Add "hterm_" prefix to the hterm source files.
* Add 'use strict' everywhere, fix some fallout.
* Split hterm.js filesystem functions into lib.fs.
* Split hterm.js utility functions into lib.f.
* Remove unused dialogs.js,css code.
* Implement character set selection (SCS)
* Pass Alt-*-Tab to the browser.
* Fix bug which may abort connections with "Unknown error 4294967292".
* Encode pasted text as UTF-8.
* Properly encode and decode UTF-8, handling surrogate pairs and
  retaining state between terminal writes.
* Add mouse support via DECSET modes 1000, 1002, 1003.
* Add mouse button paste.  Preference 'mouse-paste-button' defaults to off
  on typical X11, on everywhere else (including Aura on X11).
* Add ability to automatically copy the mouse selection to the keyboard.
  Preference 'copy-on-select' defaults to on.
* Add ability to let Shift-Insert cause a clipboard paste.  Preference
  'shift-insert-paste' defaults to on.
* Add partial OSC 52 support to allow the host to write to the system clipboard.
* Fix extra-long line wrapping.
* Add basic line editing for local ssh prompts (password, fingerprint prompt,
  and the "~C" command line).
* Add websockets to the google proxy and make it the default connection type.
* Fix ssh "target command" parsing.
* Make the JavaScript side of things more robust against a NaCl plugin crash.

BUG=chromium-os:30296, UTF-8 decoder is not a function of input stream; will
    break when UTF-8 sequence split across reads
BUG=chromium-os:30297, UTF-8 decoder does not conform to Unicode standard
    re: invalid sequences
BUG=chromium-os:29490, Middle click should paste in the terminal
BUG=chromium-os:26288, hterm: Add mouse support via DECSET 1000, 1002, 1003

# 0.8.2.0, 2012-06-14, Localization and Accessibility for the connect dialog

* Add message_manager.js to manage string bundles.
* Add a bunch of new strings for the dialog.
* Make nassh_connect_dialog.html/js use the new strings.
* Fix minor issue with argument parsing.

# 0.8.1.0, 2012-06-12, New connection dialog, flow control

* New nassh binary:
  - Support for flow control (try aafire!)
  - Use Pepper host resolver when possible.
  - Smaller TCP window in ssh (try ^C in aafire!)
* Add preferences for background-size and background-position
* Move hterm.NaSSH out to NaSSH.  This is in preparation for upcoming changes
  to further isolate the terminal from commands that run within it.
* Fix handling of the cursor overflow flag for the ICH, ED, EL, DL,
  DCH, and ECH commands.
* nassh_box.css: Add box layout css library.
* nassh_connect_dialog.css: New file, connect dialog styles.
* google_relay.js: Moved to nassh_google_relay.js
* nassh.html: Update script tags.
* nassh_connect_dialog.html:
  - New file, connect dialog UI, making liberal use of nassh_box.css.
  - TODO: i18n, a11y.
* nassh_google_relay.html: Moved from google_relay.html
* colors.js:
  - Added Ned Stark reference.
  - Added rgba color support.
  - Added setAlpha(), mix(), and crackRGB().
* frame.js:
  - First draft of the interface between the terminal and a third party dialog.
  - This will change substantially as the interface is fleshed out.
* google_relay_html.js: moved to nassh_google_relay_html.js.
* hterm.js:
  - Add getURL().
  - Rename old ferr() to fthrow(), make ferr() be like flog() except using
    console.error().
  - Add removeFile() and readDirectory() utility functions.
* nassh.js:
  - Moved most code out into nassh_command_instance.js, some into nassh_main.js.
  - Only static utility functions (and the namespace delcaration) remaing here,
    since this file is now shared by nassh_command_instance.js and
    nassh_connect_dialog.js.
* nassh_column_list.js: "Resuable" multicolumn list control.
* nassh_command_instance.js:
  - Sorry, rename and modifications in the same CL.
  - Update to work with Dmitry's outputWindow changes.
  - Add another session variable so we can distinguish between a
    reload-for-relay-auth, and a user initiated reload.  Now we can re-display
    the connect dialog ONLY for user initiated reloads, even when using a relay.
  - Integrate with nassh_connect_dialog.js.
* nassh_connect_dialog.js:
  - New file containing most of the code backing the new connect dialog.
  - TODO: i18n.
* nassh_css_variables.js:
  - OMG.  CSS variables hack until they land for real.
  - This allows the connect dialog to adapt to the user's color scheme.
* nassh_google_relay.js:
  - s/NaSSH./nassh./g
  - Refactor "destination" into "resumePath", since it was really only being
    used as an opaque place to resume to.
  - Integrate with Dmitry's writeWindow changes.
* nassh_google_relay_html.js: Move from google_relay_html.js.
* nassh_main.js: Split out of nassh.js.
* nassh_preferences.js:
  - New file containing nassh specific preferences.
  - Contains "global" nassh preferences, as well as a collection of remembered
    connection "profiles".
* nassh_streams.js: s/NaSSH./nassh./g
* preference_manager.js:
  - Promote out of the hterm namespace.
  - Allow for multiple preference observers.
  - Allow for after-the-fact registration of preference observers.
  - Throw an error when set() called for unknown pref.
  - Add setLater to set a pref after a timeout and coalesce multiple calls.
  - Fix error when notified about changes to prefs that are no longer declared.
* screen.js:
  - Cache textContent in deleteChars for a decent speedup.
* scrollport.js:
  - Remove focus outline now that the cursor changes style for focus.
* terminal.js:
  - Cache foreground and background colors for major speedup.
  - Add focus/unfocused cursor styles.
  - Remove default background gradient.
* terminal_io.js:
  - Add createFrame().
  - Add setTerminalProfile().
* vt.js: s/cssToX11/rgbToX11/.

BUG=chromium-os:25417, Split screen scrolling in hterm about 5x slower than in
    konsole
BUG=chromium-os:25563, Support specifying imported keys files in hterm
BUG=chromium-os:30103, Add a UI for port forwarding.
BUG=chromium-os:30302, CSI K (erase in line) does not clear wrap-around flag

# 0.8.0.6, 2012-05-14, rginda@chromium.org

* Add hterm.NaSSH..removeDirectory().

# 0.8.0.5, 2012-05-11, rginda@chromium.org

* Fix double invocation of initialization code.  This also fixed the reload
  loop when connecting via a relay.
* Minor faq and jsdoc cleanup.

# 0.8.0.4, 2012-05-11, rginda@chromium.org

* Add hterm.NaSSH..removeFile().

# 0.8.0.3, 2012-05-10, rginda@chromium.org

* Fix "parseState_" typo in 'ESC %' handler.

# 0.8.0.2, 2012-05-10, rginda@chromium.org

* Remove trailing comma from messages.json.
* Ensure that /.ssh directory exists before starting.
* Update FAQ to point out that keys don't work on 0.7.9.
* Change manifest-dev.json and package.sh script to move dev version from
  internal home directory to public web store.

# 0.8.0.1, 2012-05-10, rginda@chromium.org

* Add 'enable-8-bit-control' preference to enable eight bit control sequences.
  This is off by default (which matches xterm) in order to avoid accidental
  usage of some sequences that require termination.  If you encounter one of
  these on accident (while cat'ing binary data, for example) the terminal
  will appear to lock up while waiting for the terminator byte.
* Add 'max-unterminated-sequence' preference to prevent sequences that require
  a terminator from running away forever.
* Squelch warning that used to appear when clearing an empty screen.
* Refactor the parser logic a bit to make it easier to back up when
  we fail to find the end of a string sequence.
* Fix to DECSTBM to resepect origin mode when resetting the cursor position
  after setting the VT scroll region.
* Make soft-reset more like xterm.
* Resize the terminal after the character measurements change rather than
  re-measure the character during a resize.  The latter causes the terminal
  to get the row, column count wrong based on event ordering.
* Fix text wrapping to not wrap text pushed to the right in insert mode. Only
  wrap newly-printed text.
* Fix default tab-stop handling to not restore on resize after TBC. Also fix
  some cases where tab-stops would be dropped.
* Fix ED to erase to the start and end of the screen, independent of scroll
  area.
* Fix a number of issues in color handling. In particular, treat toggling bold
  and inverse independently from setting color indices.
* Fix to ECH to not shift text to the right of the cursor.
* Fix to argument parsing to always treat zero as a default value.
* Remove extra '/' from google_relay.js proxy request.
* Fix alt-sends-what/alt-is-meta pref change handlers.
* Don't re-display connection dialog after a relay redirect.
* Add showFileImporter hack.  This makes it possible to import files from the
  device filesystem into the Secure Shell filesystem.  This makes it "easy"
  to get keypairs and ssh configs into Secure Shell.
* Stop assuming an unspecified port means port 22, since the config file may
  have a different default set.

Internal bug:
6375936 hterm hangs when \x90, \x9D, or \x9E is printed

BUG=chromium-os:30142,chromium-os:30303,chromium-os:30305,chromium-os:30345
BUG=chromium-os:30105,chromium-os:29955,chromium-os:25563

# 0.7.9.3, 2012-04-20, rginda@chromium.org

* Show app name and version number at startup.
* Add cursor blink preference.
* Add doc/faq.txt.

# 0.7.9.2, 2012-04-19, rginda@chromium.org

* More sanitary handling of color names in the palette set/get sequence.
* Added colors.js file to contain color utilities and palettes.
* Remove old vt100.js file.

# 0.7.9.1, 2012-04-18, rginda@chromium.org

* Allow Ctrl +/-/0 to control browser zoom when the browser zoom isn't already
  set to 100%.  This makes it possible to dismiss the new "zoom warning" using
  keyboard shortcuts.

# 0.7.9.0, 2012-04-18, rginda@chromium.org

* Modify nassh plugin to accept a hash of environment variables.
* Add 'environment' preference, set by default to { TERM: 'xterm-256color' }.
* Implement Operating System Command (OSC) 4.  This allows the host to set
  or read the terminal color palette.
* Reset color palette on soft terminal reset.
* Add JSDoc to text_attributes.js.
* Merge COLORS_16 and COLORS_256 objects into a single
  TextAttributes.prototype.defaultColorPalette object.
* Fix bold-implies-bright logic for extended colors.
* Add a stern warning message when the browser zoom is not 100%.
* Change the naming convention for sessionStorage keys (added a dot, as in
  googleRelay.queryString).
* Add logic to re-display the connect-to dialog on reload, only if nassh was not
  started from a bookmark.
* Fetch the HTML5 persistent filesystem at nassh startup.
* Add NaSSH..removeAllKnownHosts() and NaSSH..removeKnownHostByIndex(i).  These
  can be accessed from the JS console as 'term_.command.remove...()'.
* Fix Terminal.isPrimaryScreen() assign-instead-of-test typo.
* Fix G0/G2/G3 character set control "ESC (", etc. to properly handle a
  mid-sequence ESC character.  (Thanks to nethack for turning this up :)

BUG=chromium-os:28050,chromium-os:25122

# 0.7.8.3, 2012-04-11, rginda@chromium.org

* Fix 'home-keys-scroll' preference.

# 0.7.8.2, 2012-04-11, rginda@chromium.org

* Fix google_relay.html CSP issues.

# 0.7.8.1, 2012-04-10, rginda@chromium.org

* Fix update_url in manifest.

# 0.7.8.0, 2012-04-10, rginda@chromium.org

* Replace 'alt-sends-escape' preference with 'alt-sends-what'.  The new pref
  can be set to 'escape', '8-bit', or 'browser-key'.  If set to 'escape' (the
  default), hterm will send ESC (as if alt-sends-escape were true, the previous
  default).  If set to '8-bit', hterm sends the unshifted character + 128 (as
  if alt-sends-escape were false).  If set to 'browser-key', hterm waits for
  the keypress event, and sends whatever character code the browser thinks best.
  On Mac, this will depend on your keyboard locale.  Composed characters
  (requiring multiple keystrokes) aren't yet implemented.  'browser-key'
  shouldn't be used in cases where Chrome uses Alt sequences for the browser.

# 0.7.7.1, 2012-04-10, rginda@chromium.org

* Fix crosh.html/js to work with CSP.

BUG=chromium-os:29179
TEST=Install on Chrome OS, press Ctrl-Alt-T.

# 0.7.7.0, 2012-04-08, rginda@chromium.org

* Fix version number.  We should have gone to 0.7.7.0 rather than 0.7.6.4 :/
* Renamed to "Secure Shell".
* Updated stable manifest to include CSP and new icons.

BUG=chromium-os:29148

# 0.7.6.6, 2012-04-06, rginda@chromium.org

* Update to the latest nassh binaries.

# 0.7.6.5, 2012-04-06, rginda@chromium.org

* Fix Ctrl-\.
* Added keyboard related preferences, 'home-keys-scroll', 'page-keys-scroll',
  'meta-sends-escape', 'backspace-sends-backspace'.
* Added altSendsEscape option to keyboard (and 'alt-sends-escape' pref).  The
  default for alt-is-meta is now false, while alt-sends-escape is true.  This
  lets Alt and Meta be distinct keys when possible (like on a Mac), while making
  Alt work "almost" like meta by default.
* Added a little platform detection logic so we don't burn BOTH Alt-1..9 and
  Meta-1..9 on every platform.
* Fixed broken backspaceSendsBackspace behavior.
* Fix Meta-Space to send ESC \x20 rather than ESC [.
* Fix character sizing issues, which solves the missing underscores in some
  fonts, and should solve partial/completely missing terminal row issues.
* Add background-image pref, defaults to a mostly transparent gradient.
* Change a few one-byte colors to work better with both light and dark
  backgrounds.

Internal bugs:
6100845 Significant color differences with hterm compared to shellinabox
6183497 Backspace sends delete to emacs
6270109 option-space sends ESC [
6270158 hterm (OS X): option-v and option-1 thru option-9 have no effect
6063659 First line of the console appears off the top of the screen

BUG=chromium-os:28771,chromium-os:28611

# 0.7.6.4, 2012-04-04, rginda@chromium.org

* Add 'manifest_version': 2 to manifest file, specify default
  Content Security Policy (CSP) policy.
* Kick off nassh initialization from nassh.js rather than
  nassh.html to make CSP happy.
* Move dialog code from terminal.* into nassh.*, makes CSP happier
  and it's the right thing to do.

BUG=chromium-os:28561

# 0.7.6.3, 2012-03-19, rginda@chromium.org

* Fix regression that caused hterm to fail to load if the chosen font was not
  "safe" for bold charcters.

BUG=chromium-os:28020

# 0.7.6.2, 2012-03-16, rginda@chromium.org

* Fix regression in terminal reset.

BUG=chromium-os:27950

# 0.7.6.1, 2012-03-15, rginda@chromium.org

* Make the relay code more resiliant to intermittent failures.

# 0.7.6.0, 2012-03-14, rginda@chromium.org

* Refactor and clean up of the relay server code.
* Add backoff logic to relay server code.
* Promote Terminal.showOverlay to Terminal.IO.showOverlay.
* PASS on handling Meta-~, since on Mac Meta is Cmd and Cmd-~ is the 'switch
  between windows of this app' sequence.

# 0.7.5.2, 2102-03-07, rginda@chromium.org

* Re-add default tab width, add a testcase to catch future regressions.

# 0.7.5.1, 2102-03-07, rginda@chromium.org

* Cached scroll-on-output and scroll-on-keystroke preferences to avoid the
  performance hit of reading a preference for each bit of output and keystroke.

# 0.7.5.0, 2102-03-07, rginda@chromium.org

* Add preferences.  Preferences are persisted to localStorage.  Active hterm
  instances will respond to preference changes by listening to the 'storage'
  event.
* Preferences can be grouped into "profiles" so that it's possible
  to maintain multiple terminal configurations and easily switch
  between them.
* The preference profile can be selected at load-time by adding
  'profile=NAME' to the url used to load nassh.html or crosh.html.

# 0.7.4.4, 2012-02-28, rginda@chromium.org

* Add ability to detect fonts with mismatched bold/normal sizes, and disable
  bold characters when that happens.

# 0.7.4.3, 2012-02-28, rginda@chromium.org

* Switch out "Andale Mono" in favor of "Menlo" in the default font family list,
  since bold characters in Andale Mono are a different width than normal
  weight characters.

# 0.7.4.2, 2012-02-28, rginda@chromium.org

* Fix CONNECTING message to take a single DESTINATION parameter rather
  than distinct USER and HOST parameters.  This avoids an issue in the
  chrome i18n code that chokes on the translated messages.
  https://crbug.com/209464

# 0.7.4.1, 2012-02-28, rginda@chromium.org

* Fix remaining issues with ESC 0x20 handler.

# 0.7.4.0, 2012-02-28, rginda@chromium.org

* Fix permission issue in package.sh script.
* Remove spash screen.
* Fix syntax error in ESC 0x20 handler.
* Warn before closing an active crosh tab.

# 0.7.3.0, 2012-02-17, rginda@chromium.org

* Manifest files split into -dev and -stable versions.
* Add an altIsMeta flag, on by default.
* Treat Meta-C/Meta-Shift-V the same as Ctrl-C/Ctrl-Shift-V to
  make mac users happy.
* Pass (Ctrl|Meta)-Shift-B bookmark bar key to browser.
* Pass (Ctrl|Alt|Meta)-1/9 to the browser so as not to block
  tab switching.
* Skip pro-tip if nassh started with a known location.
* Fix TextAttributes.prototype.reset().

BUG=chromium-os:25824,chromium-os:25833,chromium-os:26082
BUG=chromium-os:26280,chromium-os:26285,chromium-os:26463
TEST=test_harness.html, 55/55 tests passed.
