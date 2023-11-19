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

                            hterm and Secure Shell
                          Frequently Asked Questions
```
[TOC]

Hello World.  This is the hterm/Secure Shell FAQ.  If you have a question that
is not answered here, please ask it on the [chromium-hterm mailing list].


## General Questions


### What is "Secure Shell"?

  Secure Shell is a Chrome Application that combines the "ssh" command (see
  https://www.openssh.com/ for details) ported to NativeClient with the "hterm"
  terminal emulator to provide a secure shell client for the Chrome browser.

  Secure Shell provides similar functionality to PuTTY on Microsoft Windows(c)
  systems, and the ssh command-line application on Mac OS X and Linux systems.


### What is "hterm"?

  "HTML Terminal", or hterm, is an xterm-compatible terminal emulator written
  entirely in JavaScript.

  It is intended to be fast enough and correct enough to compete with native
  terminals such as xterm, gnome-terminal, konsole and Terminal.app.

  hterm is only a terminal emulator.  It does not provide SSH access (or any
  other text-based command) on its own.


### How do Secure Shell and hterm relate to the "crosh" (Ctrl+Alt+T) command in ChromeOS?

  See [chromeos-crosh.md](chromeos-crosh.md) in this directory for the details.

  TL;DR - Don't use crosh for ssh any more, use the Secure Shell app instead.
  The crosh shell will use the newer terminal emulator from Secure Shell when
  possible.


### What's the difference between the Secure Shell App and Extension? {#app-vs-ext}

  Everyone should install & use the extension variant now:

  https://chrome.google.com/webstore/detail/iodihamcpbpeioajjeobimgagajmlibd

  As of Dec 2019, the two variants have complete feature parity.

  For more historical details, please see our
  [Chrome Apps Deprecation guide](./app-to-ext-migration.md).


### How do hterm and Secure Shell differ from existing web terminals?

  hterm stands out from many existing web terminals in that it was built from
  the start to match the performance and correctness of "native" terminals such
  as xterm and Terminal.app.

  It can handle large bursts of text quickly, support very large scrollback
  buffers, and it closely matches xterm's behavior.  The keyboard even mostly
  works.  (ha!  See the note about how to get Ctrl+W below.)

  The Secure Shell app is different because it does not require a proxy or
  relay server to function.  Secure Shell can make a direct connection to
  a standard sshd server on any port of the destination machine.  Other
  web terminals require a proxy server in the middle.  In some cases you
  are even required to hand the proxy your credentials in plain text.


### What should I do if I notice a bug?

  First, please continue reading this FAQ to make sure your issue isn't
  mentioned.  Then check the bug list at <https://hterm.org/x/bugs>.

  If you don't see the issue there, you can search the archives of the
  [chromium-hterm mailing list].

  If all else fails then join the [chromium-hterm mailing list] and post
  about what you've found.

  To file an actual report, you can use <https://hterm.org/x/ssh/newbug>.
  This will route to the right people.

  If your bug involves some mis-interpreted escape sequence and you want
  to file a really useful bug report, then add in a recording of the
  session.  For bonus points, track down the troublesome sequence and
  include the offset into the log file.  For more information about how to
  do this, see [hterm's "Debugging escape sequences"
  section](../../hterm/docs/hack.md#Debugging-escape-sequences).


### Is there a mailing list to discuss hterm or Secure Shell?

  Yes, there is a public [chromium-hterm mailing list] anyone can join!


### Is there a way to try early releases of Secure Shell?

  Yes.  First, you need to subscribe to the [chromium-hterm mailing list].
  Subscribers have access to the "Dev" versions in the Chrome Web Store, which
  are located <https://goo.gl/9NCCZQ>.

  Note: You'll also need to sign in to the Chrome Web Store using the same
  account that joined the mailing list.  Otherwise, the link will result in a
  404 error.

  Please keep in mind that the Dev version has gone through significantly less
  testing than the stable versions.  Fortunately, you can install both and
  switch back to stable if you have trouble with Dev.


### Where is the source code?

  The source is in here: <https://chromium.googlesource.com/apps/libapps/>.
  This includes the front-end code for Secure Shell.

  The Native Client wrapper around ssh is in [ssh_client/](/ssh_client/).

### Is there a changelog?

  Yes.  Look under the docs/ directory for each project.

  There is [one for hterm](../../hterm/docs/ChangeLog.md) and
  [one for Secure Shell](./ChangeLog.md).


### What if I want to make changes to the source?

  Read the [hack.md](hack.md) file in this directory.


## Secure Shell (ssh) Questions


### Is my connection proxied in any way?

  No.  By default all connections are made directly to the sshd server on the
  destination machine.


### But, what if I *want* to ssh over HTTP?

  Secure Shell also knows how to connect to an HTTP-to-ssh relay that was
  built inside Google.  Unfortunately that relay isn't open source, and Google
  doesn't maintain a public pool of relays.

  The good news is that someone has built an
  [open source relay](https://github.com/zyclonite/nassh-relay).  It is not
  supported by us though, so please take any questions/concerns about it to
  the author.

  For more details on the relay protocol that Secure Shell supports, see the
  [Relay Protocol](./relay-protocol.md) document.


### When I use a relay server, the IP address is always 0.0.0.0?

  When using a relay server, Secure Shell only sends the hostname to the remote
  side that has been specified in the connection settings.  The relay server is
  then responsible for resolving that to an actual IP address (since the name is
  often unresolvable locally by design!).  But the relay server has no way of
  communicating that IP address back to the client, so Secure Shell just stubs
  it out with `0.0.0.0`.  This is harmless and may be safely ignored.

  When it comes to the known hosts database, the name will be used instead.


### Is my connection really secure?

  The Secure Shell app uses ssh to manage the encrypted communication channels.
  This makes it about as secure as any other connection based on the ssh
  command.

  It does have the added advantage of running ssh as a sandboxed
  Native Client plugin, which in theory makes it more secure than an
  unsandboxed ssh connection.

  Additionally, the Secure Shell application follows a strict Content Security
  Policy that does not allow access to the JavaScript 'eval' function.  This
  helps lower the risk that a terminal exploit could run arbitrary JavaScript.


### Can I connect using a public key pair or certificate?

  You can import identity files from the connection dialog.  Select the
  "Import..." link to bring up a file picker.

  You must import two files for each identity.  One should be the private key
  and should not have a file extension.  The other should be the public key,
  and must end in ".pub".  For example, "id_rsa" and "id_rsa.pub".

  If you have a key stored in a single ".pem" file, you must split it into two
  files before importing.

  This will import your public/private key files into the HTML5 filesystem
  associated with Secure Shell.  There should be no way for another extension,
  app, or web page to access this sandboxed filesystem.

*** note
  Keep in mind that HTML5 filesystems are relatively new.  As always,
  it's possible that there are still exploits to be found or disclosed.

  Additionally, Chrome stores HTML5 filesystems as normal files (with mode
  600, "-rw-------") under your profile directory.  Non-Chrome
  applications on your system may be able to access these files.

  For your own good, protect your important private keys with a strong
  passphrase.
***

  You can also import a traditional ssh 'config' file using this dialog.
  Nearly anything that ssh might care about from your ~/.ssh directory can go
  here.

  See <http://man.openbsd.org/ssh_config> for more information about the ssh
  configuration syntax.  Keep in mind that any directives that would require
  access outside of the NaCl sandbox will not function properly.  This includes
  (but is not limited to) X11 forwarding,  syslog functionality, and anything
  that requires a domain socket.


### Do my preferences and private keys get synced to Google?

Connection and preference information are synced to the cloud according to your
Chrome sync settings.  SSH private keys are only stored locally and not placed
in sync storage.  If you delete your Chrome profile or switch machines, you'll
have to re-import them.


### Can I use my ~/.ssh/config file?

  Probably.  It depends on what it does.  See the answer to the previous
  question for more details.


### Is X/X11 forwarding supported?

  Not at this time, and most likely won't be supported.

  If you were able to run an existing X client locally (like [XWayland]), and
  tell it to listen on a local TCP/IP port, you could add SSH forwarding options
  so the remote side would be able to export their clients to that instance.

  For context, this is referring to the [X Window System], the method for
  displaying graphics on many UNIX systems like Linux and BSDs.

  Since Secure Shell runs in a sandbox (by design), it doesn't have direct
  access to host paths such as the UNIX socket that X listens on.  That means
  it can't forward access to it to the remote system.

  Even if it did have such access, it would only work when the local system
  was also running X.  ChromeOS long ago stopped using X (instead, it switched
  to "freon" which is a native graphics stack like [Wayland]), and many Linux
  distros are also switching away from X.  That means the userbase is shrinking.

  We're not going to implement a custom protocol parser for X so the client
  would be able to handle/render everything itself.  The amount of code to do
  so would be significant.


### Is the SSH-1.x protocol supported?

  Not anymore.  The SSH-2.0 protocol has been available for over a decade.
  If you need this, then try contacting the [chromium-hterm mailing list].
  Your best bet though would be to upgrade the server, or find a different
  system/client to connect to the old system.


### Is 1024-bit diffie-hellman-group1-sha1 key exchange supported?

  It is disabled by default at runtime.  You can enable it by adding
  `-oKexAlgorithms=+diffie-hellman-group1-sha1` to your ssh command line in the
  connection page.

  However, these key types are insecure.  You should update your server to
  newer key types like RSA or ED25519.  Future support for these key types is
  not guaranteed.

  See the [OpenSSH legacy options] page for more details.


### Are ssh-dss and ssh-dss-cert-* keys supported?

  It is disabled by default at runtime.  You can enable it by adding
  `-oHostKeyAlgorithms=+ssh-dss` to your ssh command line in the connection
  page.

  However, these key types are insecure.  You should update your server to
  newer key types like RSA or ED25519.  Future support for these key types is
  not guaranteed.

  See the [OpenSSH legacy options] page for more details.


### Are ssh-rsa SHA1 keys supported?

  It is disabled by default at runtime starting with [OpenSSH 8.8].
  You can enable it by adding `-oHostKeyAlgorithms=+ssh-rsa` to your ssh command
  line in the connection page.

  However, these key types are insecure.  You should update your server to
  newer key types like RSA/SHA-256/512 or ED25519.
  Future support for these key types is not guaranteed.

  See the [OpenSSH legacy options] page for more details.


### Are legacy v00 cert formats supported?

  Not anymore.  You'll need to use a different client to connect if those are
  the only ciphers your server supports.


### Are blowfish-cbc, cast128-cbc, arcfour variants, the rijndael-cbc AES aliases, and 3des-cbc ciphers supported?

  Secure Shell uses [OpenSSH], and [OpenSSH] has deprecated or dropped these as
  they are legacy and weak or insecure.

  You can find out what ciphers are still supported by adding `-Q ciphers` to
  the ssh command line.
  If the cipher you want is listed there, you can use the `-c` option on the ssh
  command line to enable it.

  If the cipher you want is not listed there, then it isn't supported.
  You'll need to use a different client to connect if those are the only ciphers
  your server supports.

  See the [OpenSSH legacy options] page for more details.


### Are RSA keys smaller than 1024 bits supported?

  Not anymore.  Keys smaller than 1024 bits are insecure.  You'll need to
  generate new keys and use those instead.

  If you still need to connect to such a system, you'll have to use a different
  client to connect.


### Are MD5-based HMAC algorithms supported?

  Not anymore.  You'll need to use a different client to connect if those are
  the only ciphers your server supports.

  See the [OpenSSH legacy options] page for more details.


### How do I remove an identity (ssh key)?

  The easiest way is to visit the options page and select the "SSH Files"
  section on the left.  From there you will find a list of all the identities
  and you can delete individual ones.

  From the connection dialog, select an identity from the dropdown and press
  the DELETE key.  This will remove both the private and public key files from
  the HTML5 filesystem.


### Is there support for keychains?

  Sorry, not yet.  This is a bit of a technical challenge given the nature
  of the NaCl sandbox.  We have a few options that we're exploring.  Feel
  free to post your ideas to the [chromium-hterm mailing list].

  (And yes, we're already considering integrating with the Chrome NSS
  certificate store.)


### Is IPv6 supported?

  Yes (although see next section on zone ids).
  You can connect to hostnames that resolve to IPv6 addresses,
  and you can connect directly to IPv6 addresses.
  Enter them in the connection manager like any other hostname or IPv4 address.

  When using links (see the bookmark section below), you'll need to use the
  standard bracket style such as `[::1]`.


### Are IPv6 zone ids supported?

  Unfortunately, we can only support what the browser supports, and Chrome
  [does not currently support zone ids](https://crbug.com/70762).

  Note: [Zone ids](https://tools.ietf.org/html/rfc4007#section-11) are
  sometimes incorrectly referred to as scope ids.


### Can I create bookmarks to specific sites?

  Mostly.  You can create a few types of bookmarks:
  1. A connection specifying a user & host (and optionally a port).
  2. A profile connection (which you already created/set up).
  3. A `ssh://` URL.

  Note that Chrome opens bookmarks in new tabs.  If you want to have a bookmark
  open as a window, add `?openas=window` to the URI (before `#`).

*** aside
In the examples below, the *[ID]* field will need adjusting based on the
version you have installed:

* `iodihamcpbpeioajjeobimgagajmlibd`: Secure Shell (stable)
* `algkcnfjnajfhgimadimbjhmpaeohhln`: Secure Shell (dev)
* `pnhechapfaindjhompbnflcldabbghjo`: Secure Shell Legacy App (stable)
* `okddffdblfhhnmhodogpojmfkjmhinfp`: Secure Shell Legacy App (dev)
***

#### Direct links

  The first one takes the form of:

  `chrome-extension://[ID]/html/nassh.html#user@host[:port][@proxyhost[:proxyport]]`

  The `user` and `host` fields are mandatory, but you can omit the `:port` if
  you like (as well as the proxy settings).  There is no way to customize any
  other field/connection property.

  Here is an example for connecting to the server `cowfarm` as user `milkman`:

  `chrome-extension://[ID]/html/nassh.html#milkman@cowfarm`

  And on port `2222`:

  `chrome-extension://[ID]/html/nassh.html#milkman@cowfarm:2222`

#### Profile links

  The second method requires you to first create a new connection in the
  connection dialog, and then you can bookmark that connection directly.
  It then takes the form of:

  `chrome-extension://[ID]/html/nassh.html#profile-id:ID`

  The `ID` part will need to be changed to match the unique id assigned to each
  connection.  You can find it by loading Secure Shell into a tab, connecting
  to the profile, then looking at the URL box.
  This allows you to fully control the ssh parameters though: you may add
  arguments or change the command line or relay settings.

#### ssh:// links

  You can create `ssh://` links that will automatically open Secure Shell.
  They take the same form as Direct links above.
  See [uri.md](uri.md) in this directory for the details.

*** aside
The protocol handler is registered upon first connect.  If you want to change
the selection (Allow or Block), or you want to change the default handler to a
different app, visit the chrome://settings/handlers page.
***


### Can I create links in webpages to autoconnect?

  Mostly.  See the previous question about bookmarks.


### Can I connect to systems from the omnibox?

  Yep!  Type "ssh" followed by a space to start a quick connection, then type
  a match to an existing profile, or type a new connection using the format
  defined in the Direct links section above.

  You can open it in the existing tab by pressing Enter, or opening it in a new
  window by pressing Alt+Enter, or opening it in a new background tab by
  pressing Command+Enter/Meta+Enter.


### How do multiple extensions/apps work with the omnibox?

  Since every Secure Shell instance registers the "ssh" keyword, Chrome has to
  pick one.  Chrome goes by the order they were installed, so whichever version
  was installed first, that's the default.

  If you want to change the default, you'll have to delete the others from the
  search engine list.  See the next question for more details.

  Chrome currently doesn't have a way to re-add them if you change your mind
  other than uninstalling & reinstalling extensions.  Make sure to back up your
  settings so you can restore them.


### How do I disable omnibox integration?

  When trying to search for "ssh" via the omnibox, it might trigger the app
  when you actually want to perform a search.  Here are some alternatives:

  * Instead of pressing Ctrl+L to select the omnibox, press Ctrl+K.
    That'll force a search every time regardless of other omnibox integration.
  * Prefix your query with an explicit `?` to force a search.
    i.e. Use `?ssh ...` instead of `ssh ...`.

  If you want to always disable this integration, you can do so in the standard
  search engine management settings page.   It'll be at the very bottom under
  "Search engines added by extensions".
  See the [Google Chrome Help](https://support.google.com/chrome/answer/95426)
  page for more details.

*** note
If the extension is force installed via Enterprise policy, you probably won't be
able to disable it.
Unfortunately, in this scenario, Chrome offers no alternatives either to
extension authors or users.
You'll have to adjust your keyboard/muscle memory accordingly.
***


### Can I forward ports?

  Yes.  Enter your port forwarding options in the "SSH Arguments" field of
  the connect dialog.  The port forward will be active for the duration of
  the Secure Shell session.


### How do I remove a known host fingerprint (aka known_hosts) entry?

  The easiest way to modify the file is to visit the options page and select the
  "SSH Files" section on the left.  From there you will find text fields to edit
  the various files including the known_hosts database.

  You can also hold Ctrl while right clicking the terminal to bring up a context
  menu.  Under that is an option to clear all SSH known hosts.


## Terminal (hterm) Questions


### What is the "Terminal Profile" field for?

  This is the last field in the connect dialog.  It allows you to select
  which set of terminal preferences to use for the connection.

  If you name a terminal profile that doesn't yet exist, it will be created
  and all preferences will be set to their default value.  Any preference
  changes will affect the active terminal profile only.

  For example, enter "light" as the name of a terminal profile for a new
  connection.  Once you've connected, change the color scheme to
  black-on-white (as described in the FAQ entried below).  That change will
  be associated with the "light" profile, and you'll be able to re-use it for
  other saved connections.


### How do I set terminal preferences? {#options-page}

  You should manage your preferences under the Secure Shell Options page like
  any other extension.  The general Chrome developer page
  [offers some tips](https://developer.chrome.com/docs/extensions/mv3/options/#view_page).

  Additionally, the page has links at the bottom of the Connection dialg, at
  the bottom of the extensions popup, and when you right click the terminal of
  an active connection.

  Preferences are saved in synchronized storage, so they're remembered the next
  time you launch Secure Shell, and across multiple computers.

  Most preference changes take effect immediately, in all open instances of
  Secure Shell.  The exception is the 'environment' setting, which won't
  take effect until the next time you reconnect.


### How do I change the audible bell sound?

  Manage your preferences under the [Secure Shell Options page](#options-page).
  It's under Terminal Settings -> Sounds.

  Change the example url to point to the sound file you want to use.
  Unfortunately, local file: urls are not supported at this time.  If you
  want to get fancy you could construct a data: url, but the details of
  that are beyond the scope of this FAQ.


### How do I disable the audible bell?

  Manage your preferences under the [Secure Shell Options page](#options-page).
  It's under Terminal Settings -> Sounds.


### How do I change the color scheme?

  Manage your preferences under the [Secure Shell Options page](#options-page).
  It's under Terminal Settings -> Appearance.

  You can use any
  [valid CSS color value](https://developer.mozilla.org/en-US/docs/Web/CSS/color_value)
  for any of these colors.  You need to use a semi-transparent color (the fourth
  parameter in the `rgba` value) for the cursor if you want to be able to see
  the character behind it.


### How do I change the font face?

  Manage your preferences under the [Secure Shell Options page](#options-page).
  It's under Terminal Settings -> Appearance.

  Be sure to only use monospace fonts.

  Keep in mind that some fonts, especially on macOS systems, have bold
  characters that are larger than the non-bold version.  hterm will print a
  warning to the JS console if it detects that you've selected a font like
  this.  It will also disable "real" bold characters, using only bright
  colors to indicate bold.

### Which fonts are supported?

  The following fonts are loaded automatically as web fonts with Secure Shell.
  * Cousine
  * Inconsolata
  * Roboto Mono
  * Source Code Pro

  In addition, Powerline symbol fonts are bundled and loaded as web fonts for:
  * Powerline For Cousine
  * Powerline For Inconsolata
  * Powerline For Noto Sans Mono
  * Powerline For Roboto Mono
  * Powerline For Source Code Pro

  You can also specify other fonts if they are installed on your system.

### How do I change the default font size?

  Manage your preferences under the [Secure Shell Options page](#options-page).
  It's under Terminal Settings -> Appearance.


### How do I use web fonts?

  Manage your preferences under the [Secure Shell Options page](#options-page).
  It's under Terminal Settings -> Appearance.

  You can define it in the CSS file loaded via the Custom CSS settings -- either
  'user-css' field (URI) or inline the content in 'user-css-text'.

  Here is an example using [Google Web Fonts](https://fonts.google.com/).  Add
  this line to your custom CSS, and add `"Roboto Mono"` to your 'font-family'
  list.

    @import url('https://fonts.googleapis.com/css?family=Roboto+Mono');

  Here is an example for [Powerline Fonts](https://github.com/powerline/fonts/).
  Add this text to your custom CSS, and add `"Anonymous Pro"` to your
  'font-family' list.

    @font-face {
      font-family: "Anonymous Pro";
      src: url(https://cdn.rawgit.com/wernight/powerline-web-fonts/8040cf32c146c7cd4f776c1484d23dc40685c1bc/fonts/AnonymousPro.woff2) format("woff2");
    }


### Are font ligatures supported?

  Manage your preferences under the [Secure Shell Options page](#options-page).

  By default, we disable [ligatures].  Some fonts actively enable them like
  macOS's Menlo (e.g. "ae" is rendered as "æ").  This messes up copying and
  pasting and is, arguably, not terribly legible for a terminal.

  If you're using a font that supports ligatures, and you want to use them,
  you can enable them via the Custom CSS 'user-css-text' field:

    x-row {
      text-rendering: optimizeLegibility;
      font-variant-ligatures: normal;
    }

  For more details, check out this [Ligatures & Coding] article.

[ligatures]: https://en.wikipedia.org/wiki/Typographic_ligature
[Ligatures & Coding]: https://medium.com/larsenwork-andreas-larsen/ligatures-coding-fonts-5375ab47ef8e


### Can I quickly make temporarily changes to the font size?

  Yes.  The Ctrl+Plus, Ctrl+Minus and Ctrl+Zero keys can increase, decrease,
  or reset the current font size.  This zoomed size is not remembered the
  next time you start hterm.  See the previous question if you want something
  that will stick.

  It's useful to know that hterm has to handle font zooming on its own.
  Without interference from the browser's built-in zoom function.

  The browser zoom introduces rounding errors in pixel measurements that
  make it difficult (maybe impossible) for hterm to accurately position the
  cursor on the screen.  (It could do a little better than it does but
  probably not enough to be worth the effort.)

  To mitigate this, hterm will display a warning message when your browser
  zoom is not 100%.  In this mode the Ctrl+Plus, Ctrl+Minus and Ctrl+Zero
  keys are passed directly to the browser.  Just press Ctrl+Zero to reset your
  zoom and dismiss the warning.

  hterm should start handling Ctrl+Plus, Ctrl+Minus and Ctrl+Zero on its
  own once your zoom setting is fixed.


### Why do I get a warning about my browser zoom?

  Because hterm requires you to set your browser to 100%, or 1:1 zoom.
  Try Ctrl+Zero or the Wrench->Zoom menu to reset your browser zoom.  The
  warning should go away after you correct the zoom level.

  See the previous question for more information.


### How do I disable anti-aliasing?

  Manage your preferences under the [Secure Shell Options page](#options-page).
  It's under Terminal Settings -> Appearance -> Text font smoothing.

  This directly modifies the
  ['-webkit-font-smoothing' CSS property](https://developer.mozilla.org/en-US/docs/Web/CSS/font-smooth).
  As such, 'none', 'antialiased', and 'subpixel-antialiased' are all valid
  values.


### How do I customize the mouse pointer?

  Manage your preferences under the [Secure Shell Options page](#options-page).
  You can customize these via the 'user-css' or 'user-css-text' fields.

  There are two mouse styles you will encounter: text and pointer.
  The 'text' style is the one you'll see most of the time and is the "i-beam"
  by default.
  The 'pointer' style is used when the terminal is in "mouse mode".

  Here's an example to change them:

    :root {
      --hterm-mouse-cursor-text: url("https://developer.mozilla.org/files/3809/text.gif") 14 13, text;
      --hterm-mouse-cursor-pointer: url("https://developer.mozilla.org/@api/deki/files/3449/=pointer.gif") 14 13, pointer;
    }

  The two numbers after the `url(...)` are optional.
  They are pixel offsets to control the center/focus of the cursor.
  Feel free to adjust them until the mouse cursor feels natural.

  Remember to specify a fallback keyword (`text` and `pointer` in the example)
  when using `url(...)`, otherwise the browser will silently ignore the setting.

  For more details on the syntax, consult the
  [MDN documentation](https://developer.mozilla.org/en-US/docs/Web/CSS/cursor).


### How do I make the cursor blink?

  Manage your preferences under the [Secure Shell Options page](#options-page).
  It's under Terminal Settings -> Appearance -> Cursor blink.


### Why does hterm ignore the cursor blink escape sequence?

  Most terminals ignore attempts by the host to change the blink-state of the
  cursor.  This lets you choose between a blink/steady cursor via the
  cursor-blink preference, without having the host change your setting.

  By default, hterm also ignores this escape sequence.  To enable it,
  manage your preferences under the [Secure Shell Options page](#options-page).
  It's under Terminal Settings -> Miscellaneous.


### How do I change the TERM environment variable? {#options-env-term}

  Manage your preferences under the [Secure Shell Options page](#options-page).
  It's under Terminal Settings -> Miscellaneous -> Environment variables.

  Note that this is a JSON object with string keys & values.

  The default TERM value is 'xterm-256color'.  If you prefer to simulate a
  16 color xterm, try setting TERM to 'xterm'.  But you really shouldn't change
  this.

  You will have to reconnect for this setting to take effect.


### How do I enter accented characters?

  Manage your preferences under the [Secure Shell Options page](#options-page).
  It's under Terminal Settings -> Keyboard.

  That depends on your platform and which accented characters you want to
  enter.

  In xterm, you could use Alt+plus-a-letter-or-number to select from the
  upper 128 characters.  The palette of 128 characters was "hardcoded" and
  not dependent on your keyboard locale.  This is Alt key modifier set to
  '8-bit'.

  However, if you are on macOS and you prefer that Alt sends a character based
  on your keyboard locale, try setting Alt key modifier to 'browser-key'.

  Note that composed characters (those that require multiple keystrokes) are
  not currently supported by this mode.

  If you are running ChromeOS on a Chromebook you can select your keyboard
  locale from the system settings and just use the Right-Alt (the small one,
  on the right) to enter accented characters.  No need to change the
  'alt-sends-what' preference at all.

  The default value for 'alt-sends-what' is 'escape'.  This makes Alt work
  mostly like a traditional Meta key.

  If you really, really want Alt to be an alias for the Meta key in every
  sense, enable Alt key as Meta key.


### How do I make backspace send ^H?

  Manage your preferences under the [Secure Shell Options page](#options-page).
  It's under Terminal Settings -> Keyboard.

  By default, hterm sends a delete (DEL, '\x7f') character for the
  backspace key.  Sounds weird, but it tends to be the right thing for
  most people.  If you'd prefer it send the backspace (BS, '\x08', aka ^H)
  character, enable Backspace key behavior.


### How do I send Ctrl+W, Ctrl+N or Ctrl+T to the terminal?

  Chrome blocks tab contents from getting access to these (and a few other)
  shortcuts.  You can open Secure Shell in a dedicated window to get around
  this limitation.  The exact method depends on a few factors.

  If you're running the app ([not the extension](#app-vs-ext)), right-click on
  the Secure Shell icon and enable "Open as Window".  After that, any time you
  launch Secure Shell it will open in a new window and handle these directly.
  This feature is not available on macOS however (see below).

  If you're running the extension, Secure Shell opens as a window normally, and
  the shortcuts should be caught automatically.

  If you want to run Secure Shell in a tab, then unfortunately Chrome offers no
  option currently to capture these keystrokes.  See <https://crbug.com/671774>
  for more details.  You could run it in fullscreen mode (by pressing F11), but
  that isn't a great option if you want to leverage tabs.  You could press F11,
  then Ctrl+N, then F11 again, but that also is not great.

  If you want to open another Secure Shell session, use Ctrl+Shift+N.

  Bookmarks will open in a tab regardless of OS and any settings.  You can add
  `?openas=window` to the URI so Secure Shell will reopen itself as a window
  automatically.

  On macOS, most shortcuts are initiated via the Cmd key, so Ctrl shortcuts are
  passed regardless of the mode (window or tab), so this is generally less of an
  issue on this platform.  If you want to capture Cmd-W, etc..., then currently
  there is no way to do so.  If you're OK with changing system wide settings,
  there are some third party keyboard utilities that may help, or try searching
  for [changing keyboard shortcuts](https://www.google.com/search?q=macOS+changing+keyboard+shortcuts).

  If you want to launch Secure Shell directly from the command line (or an OS
  desktop shortcut), you can use the `--app=...` option.  For example:
  `chrome --app=chrome-extension://iodihamcpbpeioajjeobimgagajmlibd/html/nassh.html#profile-id:e431 ...`

### How do I make a desktop icon or shelf shortcut?

If you want to pin the extension to the shelf, taskbar, or dock, you can create
a shortcut for it. Unfortunately, Chrome does not provide a great flow for this.

Trying to pin the icon for an open window will instead open the extension
options window: https://crbug.com/1151809.

1.  Click the extension icon in the upper right of Chrome.
1.  Hold Ctrl while clicking "Connection Dialog" to open it in a tab.
1.  *(Optional)* Connect to a destination first to have the shortcut autoconnect
    instead of showing the connection dialog.  It does not need to succeed.
1.  Open Chrome's ⋮ menu in the upper right (Alt+F shortcut).
1.  Expand the "More tools" submenu.
1.  Select the "Create shortcut..." option.
1.  Check the "Open as window" option to automatically open it as a window.
1.  Click the "Create" button.

This will create a shortcut in the app launcher menu.
If it isn't automatically pinned to the relevant location, locate the new
shortcut in the app launcher, and select the relevant "pin" or "keep" option.
The exact phrasing depends on your OS as they are inconsistent: some call it a
shelf, or a taskbar, or a dock, or maybe something else entirely.

If you remove the pinned icon it will remain in the app launcher.

If you right click the shortcut and select the "Remove from Chrome" option, this
will only delete the shortcut, it *won't* uninstall the extension itself.
The prompt makes it sound like it will delete & reset everything, but it won't.

### How do I change input methods?

  In ChromeOS, Ctrl+Shift+Space and Ctrl+Space are used to cycle through
  keyboard input methods.  By default, hterm will capture these.  You can
  turn on the 'keybindings-os-defaults' setting, or add custom bindings for
  these in the 'keybindings' settings to pass them along to the OS instead.

     {
       "Ctrl+Shift+Space": "PASS",
       "Ctrl+Space": "PASS"
     }

  For more details, see the [Can I rebind keys/shortcuts](#keybindings)
  section below.


### How do I use ChromeOS window manager shortcuts?

  In ChromeOS, Alt+- & Alt+= & Alt+[ & Alt+] are used to move windows around.
  By default, hterm will capture these when using the Left Alt key.
  In recent ChromeOS versions, the Right Alt key is not captured.
  So you can use RightAlt+-/=/[/] keys even when running Secure Shell.

  If you really want to use the Left Alt key too, you can add custom bindings in
  the 'keybindings' settings to pass them along to the OS instead.
  We have to use the keyCode number though.

     {
       "Alt+187": "PASS",
       "Alt+189": "PASS",
       "Alt+219": "PASS",
       "Alt+221": "PASS"
     }

  For more details, see the [Can I rebind keys/shortcuts](#keybindings)
  section below.


### Why doesn't autorepeat work under macOS?

  In newer versions of macOS, holding down many keys (like `a`) won't repeat
  the key.  Instead, you'll get a pop up with an accent menu so you can select
  between à, á, â, ä, æ, etc...  This is a macOS feature that cannot be disabled
  on a per-application basis.

  If you don't like this behavior, you can disable it in Chrome by opening a
  terminal and running:

    defaults write com.google.Chrome ApplePressAndHoldEnabled -bool false

  Or disable it globally by running:

    defaults write -g ApplePressAndHoldEnabled -bool false

### Can I rebind keys/shortcuts? {#keybindings}

  Yes, all keys can be rebound.  Look for the 'keybindings' setting in the
  Secure Shell Options page under the Keyboard section.

  For more documentation on the format, see the [Keyboard Bindings] doc.


### How do I copy text from the terminal?

  By default, Secure Shell automatically copies your active selection to the
  clipboard.

  You can disable this by setting the 'copy-on-select' preference to false.
  If you disable it you'll need to use one of the following key sequences
  to copy to the clipboard...

  * Under Mac OS X the normal Command+C sequence works.

  * On other platforms Ctrl+C will perform a Copy only when text is selected.
    When there is no current selection Ctrl+C will send a "^C" to the host.

    Note that after copying text to the clipboard the active selection will be
    cleared.  If you happen to have text selected but want to send "^C",
    just hit Ctrl+C twice.

  * Under all platforms you can also use the "Copy" command from the Wrench
    menu, when running Secure Shell in a browser tab.


### How do I paste text to the terminal?

  By default, Shift+Insert pastes the clipboard on all platforms.  If you'd
  prefer to be able to send Shift+Insert to the host, set the
  'shift-insert-paste' preference to false.

  Also...

  * Under Mac OS X the normal Command+V sequence can be used to paste from
    the clipboard.

  * On other platforms use Ctrl+Shift+V to paste from the clipboard.

  * Under X11, you can use middle-mouse-click to paste from the X clipboard.

  * Under all platforms you can also use the "Paste" command from the Wrench
    menu.


### Why does the cursor blink in emacs?

  This answer only applies if you've set the 'enable-dec12' preference to true.

  Do you normally use Terminal.app or xterm?  Those terminals (and many others)
  ignore the "ESC [ ? 12 h" and "ESC [ ? 12 l" sequences (DEC Private Mode 12).
  Emacs uses these sequences (on purpose) to enable and disable cursor blink.

  If you prefer a steady cursor in emacs, set visible-cursor to nil as
  described in <https://hterm.org/x/ssh/faq>.


### Why does the color scheme look funny in emacs/vi/vim?

  hterm's default value for the TERM environment variable is
  'xterm-256color'.  This causes emacs, vi, and some other programs to
  use a different color palette than when TERM='xterm'.

  You may notice these programs use a font color that is difficult to read
  over a dark background (such as dark blue).

  You can fix vi with ':set bg=dark'.  Emacs can be started in "reverse
  video" mode with 'emacs -rv'.

  If you just want your old 16 color palette back, change your
  [`TERM` environment setting to `xterm`](#options-env-term).

  Then restart Secure Shell.


### Why do curses apps display x/q/etc... instead of "|" and "-" and other graphics?

  The default terminal encoding used by hterm is UTF-8.
  Historically, and in other terminals, it was [ISO 2022].
  That means support for changing character sets to e.g. graphics sets is
  disabled by default.
  This makes the terminal more robust as you no longer have to worry about
  accidentally running `cat` on a binary file corrupting your terminal output.

  Unfortunately, ncurses insists on using these legacy encodings by default
  instead of using modern UTF-8 in its output.
  So until ncurses fixes its behavior, things can easily get out of sync.

  One way to work around this is to instruct ncurses to stick to pure UTF-8
  output by adding to your shell's startup script (e.g. `~/.bashrc`):
  ```sh
  export NCURSES_NO_UTF8_ACS=1
  ```

  Another option is to change the terminal encoding on the fly via the standard
  [DOCS] escape sequence:
  ```sh
  printf '\x1b%%@'
  ```

  You could work around it by changing the default encoding back to [ISO 2022]
  in your preferences.
  Look for the `terminal-encoding` option and change it to `iso-2022`.

  For more technical details, check out the
  [mosh docs](https://mosh.org/#techinfo), Markus Kuhn's [UTF-8 terminal
  emulator issues](https://www.cl.cam.ac.uk/~mgk25/unicode.html#term), and
  hterm's [DOCS] and [SCS] documentation.


### Can I use my mouse?

  Sort of.  Both emacs and vi have mouse modes that are compatible with Secure
  Shell.

  In emacs, use `M-x xterm-mouse-mode` and `M-x mouse-wheel-mode`.  This will
  allow you to position the cursor with a mouse click, and use the wheel
  (or two-finger scroll) to scroll the buffer.

  In vi, use ":set mouse=a" to enable mouse mode.


### How do I make the mouse wheel always scroll the buffer?

  When using the alternative screen buffer, and DECCKM (Application Cursor Keys)
  is active, mouse wheel scroll events will emulate arrow keys.  That means when
  you scroll the wheel up, it will behave like you pressed the up arrow key a
  few times instead.

  This often shows up when using programs like pagers (less) or reading man
  pages or using text editors (vi/nano) or using screen/tmux (which you might
  see as scrolling through command history in the shell).

  You can disable this feature temporarily by holding the shift key.  This way
  you can scroll the buffer in some cases (like screen) while still supporting
  emulation in programs where it's more useful (like pagers and man).

  You can disable this feature permanently via the
  `scroll-wheel-may-send-arrow-keys` preference.


### Is OSC 52 (aka "clipboard operations") supported?

  Clipboard writing is allowed by default, but you can disable it if you're
  paranoid.  Set the 'enable-clipboard-write' preference to false to disable
  the control sequence.

  Clipboard read is not implemented.  Reading is a security hole you probably
  didn't want anyway.

  Clipboard writes are triggered by an escape sequence from the host.  Here's
  an example...

    $ printf "\033]52;c;Y29weXBhc3RhIQ==\a\n"

  The sequence `\003]52;` identifies this as a clipboard operation.  The `c;`
  option selects the system clipboard.  `Y29weXBhc3RhIQ==` is the base64 encoded
  value to place on the clipboard, in this case it's the string "copypasta!".
  Finally, `\a` terminates the sequence.

  If you execute this command when 'enable-clipboard-write' on you should see
  the "Selection Copied" message appear in the terminal, and your system
  clipboard should contain the text, "copypasta!".

  Note that the specification for OSC 52 mentions destinations other than
  the `c;` system clipboard.  Hterm treats them all as the system clipboard.

  There is an [osc52.sh] helper script available as well:

    $ echo "hello world" | osc52.sh


### Can I synchronize my emacs/vim selection with the system clipboard?

  Yes -- for Vim, see [osc52.vim]. For Emacs versions prior to Emacs 25, see
  [osc52.el] (newer Emacs versions have built-in OSC-52 support). osc52.vim
  works inside tmux and screen sessions.


### How do I talk to hterm from inside screen/tmux?

  Since screen/tmux create their own terminals to capture and process output
  even when you aren't connected, they end up processing all the control
  sequences and then mangling/passing on only the ones they understand.  That
  means if you try to use a sequence that only hterm understands, it will get
  silently swallowed/discarded.  However, these systems usually provide a way
  to pass thru content directly to the active terminal.

  Under [screen](https://www.gnu.org/software/screen/manual/html_node/Control-Sequences.html),
  you can use a DCS sequence (ESC+P).  Replace the `...` part with what you want
  to send (and remember to escape the escapes).

    # A DCS sequence terminated by a ST.
    $ printf '\033P...\033\\'
    # Send a notification straight to hterm.
    $ printf '\033P\033\033]777;notify;title;body\a\033\\'

  Under [tmux](https://github.com/tmux/tmux/blob/HEAD/tools/ansicode.txt),
  you can use a DCS sequence too, but using the `tmux` subcommand.  Replace
  the `...` part with what you want to send (and remember to escape the
  escapes).

    # A DCS sequence terminated by a ST.
    $ printf '\033Ptmux;...\033\\'
    # Send a notification straight to hterm.
    $ printf '\033Ptmux;\033\033]777;notify;title;body\a\033\\'

  There is an [hterm-notify.sh] helper script available as well:

    $ hterm-notify.sh "Some Title" "Lots of text here."

  The [osc52.sh] script has support for sending these DCS sequences
  automatically. However, on tmux 3.3a and newer, you'll also need to set
  `set -g allow-passthrough on` in your tmux.conf file.


### How do I view images?

  We support the iTerm2's OSC 1337 file transfer sequence.  The protocol is a
  little bit complicated, so there's a [hterm-show-file.sh] helper script for
  you.  iTerm2's "imgcat" script should also work.

  For more details on the options available, see the
  [specification](../../hterm/docs/ControlSequences.md#OSC-1337).


[DOCS]: ../../hterm/docs/ControlSequences.md#DOCS
[SCS]: ../../hterm/docs/ControlSequences.md#SCS
[Keyboard Bindings]: ../../hterm/docs/KeyboardBindings.md

[hterm-notify.sh]: ../../hterm/etc/hterm-notify.sh
[hterm-show-file.sh]: ../../hterm/etc/hterm-show-file.sh
[osc52.el]: ../../hterm/etc/osc52.el
[osc52.sh]: ../../hterm/etc/osc52.sh
[osc52.vim]: ../../hterm/etc/osc52.vim

[chromium-hterm mailing list]: https://goo.gl/RYHiK
[ISO 2022]: https://www.iso.org/standard/22747.html
[OpenSSH]: https://www.openssh.com/
[OpenSSH legacy options]: https://www.openssh.com/legacy.html
[OpenSSH 8.8]: https://www.openssh.com/txt/release-8.8
[Wayland]: https://wayland.freedesktop.org/
[X Window System]: https://en.wikipedia.org/wiki/X_Window_System
[XWayland]: https://wayland.freedesktop.org/xserver.html
