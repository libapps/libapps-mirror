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


### How do Secure Shell and hterm relate to the "crosh" (Ctrl-Alt-T) command in Chrome OS?

  See [chromeos-crosh.md](chromeos-crosh.md) in this directory for the details.

  TL;DR - Don't use crosh for ssh any more, use the Secure Shell app instead.
  The crosh shell will use the newer terminal emulator from Secure Shell when
  possible.


### How do hterm and Secure Shell differ from existing web terminals?

  hterm stands out from many existing web terminals in that it was built from
  the start to match the performance and correctness of "native" terminals such
  as xterm and Terminal.app.

  It can handle large bursts of text quickly, support very large scrollback
  buffers, and it closely matches xterm's behavior.  The keyboard even mostly
  works.  (ha!  See the note about how to get Ctrl-W below.)

  The Secure Shell app is different because it does not require a proxy or
  relay server to function.  Secure Shell can make a direct connection to
  a standard sshd server on any port of the destination machine.  Other
  web terminals require a proxy server in the middle.  In some cases you
  are even required to hand the proxy your credentials in plain text.


### What should I do if I notice a bug?

  First, please continue reading this FAQ to make sure your issue isn't
  mentioned.  Then check the bug list at <https://goo.gl/VkasRC>.

  If you don't see the issue there, you can search the archives of the
  [chromium-hterm mailing list].

  If all else fails then join the [chromium-hterm mailing list] and post
  about what you've found.

  To file an actual report, you can use <https://goo.gl/vb94JY>.  This will
  route to the right people.

  If your bug involves some mis-interpreted escape sequence and you want
  to file a really useful bug report, then add in a recording of the
  session.  For bonus points, track down the troublesome sequence and
  include the offset into the log file.  For more information about how to
  do this, see the "Debugging escape sequences" section in the
  [hack.md](hack.md) file in this directory.


### Is there a mailing list to discuss hterm or Secure Shell?

  Yes, there is a public [chromium-hterm mailing list] anyone can join!


### Is there a way to try early releases of Secure Shell?

  Yes.  First, you need to subscribe to the [chromium-hterm mailing list].
  Subscribers have access to the "Dev" version in the Chrome Web Store, which
  is located here: <https://goo.gl/cFZlv>.  Note: You'll also need to sign in
  to the Chrome Web Store using the same account that joined the mailing list.
  Otherwise, the link will result in a 404 error.

  Please keep in mind that the Dev version has gone through significantly less
  testing than the Beta.  Fortunately, you can install both and switch back
  to Beta if you have trouble with Dev.


### Where is the source code?

  The hterm source is here: <https://goo.gl/8qndhN>.  This includes the
  front-end code for Secure Shell.

  The Native Client wrapper around ssh is here: <https://goo.gl/4tZCMI>.

### Is there a changelog?

  Yes.  Look under the doc/ directory for each project.

  There is [one for hterm](../../hterm/doc/ChangeLog.md) and
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

  However, you're free to build one that works the same way.  There should be
  enough documentation in [nassh_google_relay.js](../js/nassh_google_relay.js)
  to reverse engineer a compatible relay.

  The good news is that someone has built an
  [open source relay](https://github.com/zyclonite/nassh-relay).  It is not
  supported by us though, so please take any questions/concerns about it to
  the author.


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


### Can I use my `~/.ssh/config` file?

  Probably.  It depends on what it does.  See the answer to the previous
  question for more details.


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


### Are legacy v00 cert formats supported?

  Not anymore.  You'll need to use a different client to connect if those are
  the only ciphers your server supports.


### Are blowfish-cbc, cast128-cbc, arcfour variants, the rijndael-cbc AES aliases, and 3des-cbc ciphers supported?

  Not anymore.  You'll need to use a different client to connect if those are
  the only ciphers your server supports.


### Are RSA keys smaller than 1024 bits supported?

  Not anymore.  Keys smaller than 1024 bits are insecure.  You'll need to
  generate new keys and use those instead.

  If you still need to connect to such a system, you'll have to use a different
  client to connect.


### Are MD5-based HMAC algorithms supported?

  Not anymore.  You'll need to use a different client to connect if those are
  the only ciphers your server supports.


### How do I remove a key?

  From the connection dialog, select an identity from the dropdown and press
  the DELETE key.  This will remove both the private and public key files from
  the HTML5 filesystem.


### How do I remove ALL keys?

  Open the JavaScript console and type...

    term_.command.removeDirectory('/.ssh/')

  This will remove any non-key files you may have uploaded as well.  It will
  *not* affect your preferences.


### Is there support for keychains?

  Sorry, not yet.  This is a bit of a technical challenge given the nature
  of the NaCl sandbox.  We have a few options that we're exploring.  Feel
  free to post your ideas to the [chromium-hterm mailing list].

  (And yes, we're already considering integrating with the Chrome NSS
  certificate store.)


### Is IPv6 supported?

  Mostly.  You can connect to hostnames that resolve to IPv6 addresses, and
  you can connect directly IPv6 addresses.  Enter them in the connection
  manager like any other hostname or IPv4 address.

  When using links (see the next section), you'll need to use the standard
  bracket style such as `[::1]`.

  However, [zone ids](https://tools.ietf.org/html/rfc4007#section-11) are not
  yet supported.


### Can I create bookmarks to specific sites?

  Mostly.  You can create a few types of bookmarks:
  1. A connection specifying a user & host (and optionally a port).
  2. A profile connection (which you already created/set up).
  3. A `ssh://` URL.

*** aside
If you're using the dev version of Secure Shell, you'll want to use the
extension id `okddffdblfhhnmhodogpojmfkjmhinfp` in the examples below
instead of `pnhechapfaindjhompbnflcldabbghjo`.
***

#### Direct links

  The first one takes the form of:

  `chrome-extension://pnhechapfaindjhompbnflcldabbghjo/html/nassh.html#user@host[:port][@proxyhost[:proxyport]]`

  The `user` and `host` fields are mandatory, but you can omit the `:port` if
  you like (as well as the proxy settings).  There is no way to customize any
  other field/connection property.

  Here is an example for connecting to the server `cowfarm` as user `milkman`:

  `chrome-extension://pnhechapfaindjhompbnflcldabbghjo/html/nassh.html#milkman@cowfarm`

  And on port `2222`:

  `chrome-extension://pnhechapfaindjhompbnflcldabbghjo/html/nassh.html#milkman@cowfarm:2222`

#### Profile links

  The second method requires you to first create a new connection in the
  connection dialog, and then you can bookmark that connection directly.
  It then takes the form of:

  `chrome-extension://pnhechapfaindjhompbnflcldabbghjo/html/nassh.html#profile-id:ID`

  The `ID` part will need to be changed to match the unique id assigned to each
  connection.  You can find it by loading Secure Shell into a tab, connecting
  to the profile, then looking at the URL box.
  This allows you to fully control the ssh parameters though: you may add
  arguments or change the command line or relay settings.

#### ssh:// links

  You can create `ssh://` links that will automatically open Secure Shell.
  They take the same form as Direct links above.

  `ssh://user@host[:port][@proxyhost[:proxyport]]`

  This is mostly compliant with the [IANA spec](https://www.iana.org/assignments/uri-schemes/prov/ssh).
  Future work ([user](https://crbug.com/609303) & [fingerprint](https://crbug.com/706536))
  might bring this more into compliance.

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

  You can open it in the existing tab by hitting enter, or opening it in a new
  window by hitting alt+enter.


### How do I disable omnibox integration?

  When trying to search for "ssh" via the omnibox, it might trigger the app
  when you actually want to perform a search.  Here are some alternatives:

  * Instead of pressing Ctrl-L to select the omnibox, press Ctrl-K.
    That'll force a search every time regardless of other omnibox integration.
  * Prefix your query with an explicit `?` to force a search.
    i.e. Use `?ssh ...` instead of `ssh ...`.

  If you want to always disable this integration, you can do so in the standard
  search engine management page.  It'll be at the very bottom under "Search
  engines added by extensions".
  See the [Google Chrome Help](https://support.google.com/chrome/answer/95426)
  page for more details.


### Can I forward ports?

  Yes.  Enter your port forwarding options in the "SSH Arguments" field of
  the connect dialog.  The port forward will be active for the duration of
  the Secure Shell session.


### How do I remove a known host fingerprint (aka known_hosts) entry?

  If you know the index of the offending host entry (it's usually reported
  by ssh if the connection fails) you can open the JavaScript console and
  type...

     term_.command.removeKnownHostByIndex(index)

  Replace index with the numeric, one-based host index.

  If you don't know the index, or you'd like to clear all known hosts,
  type...

     term_.command.removeAllKnownHosts()


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


### How do I set terminal preferences?

  You should manage your preferences under the Secure Shell Options page.
  Just right click the app in Chrome, select Options, and see the Appearance
  section.  The documentation below is meant for people hacking on the source
  directly.

  In general, you open the JavaScript console and type something like...

     term_.prefs_.set('pref-name', 'pref-value')

  Preferences are saved in your local storage, so they're remembered the
  next time you launch Secure Shell.

  If you want to check the current value of a preference, type this...

     term_.prefs_.get('pref-name')

  To reset a single preference to its default state, type this...

     term_.prefs_.reset('pref-name')

  To reset all preferences to their default state, type this...

     localStorage.clear()

  Most preference changes take effect immediately, in all open instances of
  Secure Shell.  The exception is the 'environment' setting, which won't
  take effect until the next time you reconnect.

  Some common preferences are listed in questions that follow.  For the full
  list, you'll have to read through the "definePreferences" call in
  hterm_preference_manager.js.  It's here: <https://goo.gl/xZa38d>, around line
  130.


### How do I change the audible bell sound?

  You should manage your preferences under the Secure Shell Options page.
  Just right click the app in Chrome, select Options, and see the Sounds
  section.  The documentation below is meant for people hacking on the source
  directly.

  Open the JavaScript console and type...

     term_.prefs_.set('audible-bell-sound', 'http://example.com/bell.ogg')

  Change the example url to point to the sound file you want to use.
  Unfortunately, local file: urls are not supported at this time.  If you
  want to get fancy you could construct a data: url, but the details of
  that are beyond the scope of this FAQ.


### How do I disable the audible bell?

  You should manage your preferences under the Secure Shell Options page.
  Just right click the app in Chrome, select Options, and see the Sounds
  section.  The documentation below is meant for people hacking on the source
  directly.

  Open the JavaScript console and type...

     term_.prefs_.set('audible-bell-sound', '')


### How do I change the color scheme?

  You should manage your preferences under the Secure Shell Options page.
  Just right click the app in Chrome, select Options, and see the Appearance
  section.  The documentation below is meant for people hacking on the source
  directly.

  You can change the foreground, background or cursor color preferences from
  the JavaScript console like this...

     term_.prefs_.set('background-color', 'wheat')
     term_.prefs_.set('foreground-color', '#533300')
     term_.prefs_.set('cursor-color', 'rgba(100, 100, 10, 0.5)')

  You can use any valid CSS color value for any of these colors.  You need
  to use a semi-transparent color (the fourth parameter in the rgba value)
  for the cursor if you want to be able to see the character behind it.


### How do I change the font face?

  You should manage your preferences under the Secure Shell Options page.
  Just right click the app in Chrome, select Options, and see the Appearance
  section.  The documentation below is meant for people hacking on the source
  directly.

  Open the JavaScript console and type...

     term_.prefs_.set('font-family', 'Lucida Console')

  Replace 'Lucida Console' with your favorite monospace font.

  Keep in mind that some fonts, especially on Mac OS X systems, have bold
  characters that are larger than the non-bold version.  hterm will print a
  warning to the JS console if it detects that you've selected a font like
  this.  It will also disable "real" bold characters, using only bright
  colors to indicate bold.


### How do I change the default font size?

  You should manage your preferences under the Secure Shell Options page.
  Just right click the app in Chrome, select Options, and see the Appearance
  section.  The documentation below is meant for people hacking on the source
  directly.

  Open the JavaScript console and type...

     term_.prefs_.set('font-size', 15)

  Replace 15 with your desired font size in pixels.  15 is the default, so
  you'll have to pick a different number to have any effect at all.


### How do I use web fonts?

  You can define it in the CSS file loaded via the 'user-css' field, or you can
  inline the content in 'user-css-text'.

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

  By default, we disable [ligatures].  Some fonts actively enable them like
  macOS's Menlo (e.g. "ae" is rendered as "æ").  This messes up copying and
  pasting and is, arguably, not terribly legible for a terminal.

  If you're using a font that supports ligatures, and you want to use them,
  you can enable them via the 'user-css-text' field:

    x-row {
      text-rendering: optimizeLegibility;
      font-variant-ligatures: normal;
    }

  For more details, check out this [Ligatures & Coding] article.

[ligatures]: https://en.wikipedia.org/wiki/Typographic_ligature
[Ligatures & Coding]: https://medium.com/larsenwork-andreas-larsen/ligatures-coding-fonts-5375ab47ef8e


### Can I quickly make temporarily changes to the font size?

  Yes.  The Ctrl-Plus, Ctrl-Minus and Ctrl-Zero keys can increase, decrease,
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
  zoom is not 100%.  In this mode the Ctrl-Plus, Ctrl-Minus and Ctrl-Zero
  keys are passed directly to the browser.  Just press Ctrl-Zero to reset your
  zoom and dismiss the warning.

  hterm should start handling Ctrl-Plus, Ctrl-Minus and Ctrl-Zero on its
  own once your zoom setting is fixed.


### Why do I get a warning about my browser zoom?

  Because hterm requires you to set your browser to 100%, or 1:1 zoom.
  Try Ctrl-Zero or the Wrench->Zoom menu to reset your browser zoom.  The
  warning should go away after you correct the zoom level.

  See the previous question for more information.


### How do I disable anti-aliasing?

  You should manage your preferences under the Secure Shell Options page.
  Just right click the app in Chrome, select Options, and see the Appearance
  section.  The documentation below is meant for people hacking on the source
  directly.

  Open the JavaScript console and type...

     term_.prefs_.set('font-smoothing', 'none')

  This directly modifies the '-webkit-font-smoothing' CSS property for the
  terminal.  As such, 'none', 'antialiased', and 'subpixel-antialiased' are
  all valid values.

  The default setting is 'antialiased'.


### How do I make the cursor blink?

  You should manage your preferences under the Secure Shell Options page.
  Just right click the app in Chrome, select Options, and see the Appearance
  section.  The documentation below is meant for people hacking on the source
  directly.

  Open the JavaScript console and type...

     term_.prefs_.set('cursor-blink', true)

  Notice that true is NOT in quotes.  This is especially important if you try
  to turn blinking back off, with...

     term_.prefs_.set('cursor-blink', false)

  or you could just revert to the default value of false with...

     term_.prefs_.reset('cursor-blink')


### Why does hterm ignore the cursor blink escape sequence?

  Most terminals ignore attempts by the host to change the blink-state of the
  cursor.  This lets you choose between a blink/steady cursor via the
  cursor-blink preference, without having the host change your setting.

  By default, hterm also ignores this escape sequence.  To enable it, set the
  'enable-dec12' preference to true.

     term_.prefs_.set('enable-dec12', true)

### How do I change the TERM environment variable?

  You should manage your preferences under the Secure Shell Options page.
  Just right click the app in Chrome, select Options, and see the Misc
  section.  The documentation below is meant for people hacking on the source
  directly.

  Open the JavaScript console and type...

     term_.prefs_.set('environment', {TERM: 'hterm'})

  Notice that only 'hterm' is quoted, not the entire value.  You can replace
  'hterm' with whichever value you prefer.

  The default TERM value is 'xterm-256color'.  If you prefer to simulate a
  16 color xterm, try setting TERM to 'xterm'.

  You will have to reconnect for this setting to take effect.


### How do I enter accented characters?

  You should manage your preferences under the Secure Shell Options page.
  Just right click the app in Chrome, select Options, and see the Keyboard
  section.  The documentation below is meant for people hacking on the source
  directly.

  That depends on your platform and which accented characters you want to
  enter.

  In xterm, you could use Alt-plus-a-letter-or-number to select from the
  upper 128 characters.  The palette of 128 characters was "hardcoded" and
  not dependent on your keyboard locale.  You can set hterm to do the same
  thing by opening the JavaScript console and typing...

     term_.prefs_.set('alt-sends-what', '8-bit')

  However, if you are on Mac OS X and you prefer that Alt sends a character
  based on your keyboard locale, try this instead...

     term_.prefs_.set('alt-sends-what', 'browser-key')

  Note that composed characters (those that require multiple keystrokes) are
  not currently supported by this mode.

  If you are running Chrome OS on a Chromebook you can select your keyboard
  locale from the system settings and just use the Right-Alt (the small one,
  on the right) to enter accented characters.  No need to change the
  'alt-sends-what' preference at all.

  The default value for 'alt-sends-what' is 'escape'.  This makes Alt work
  mostly like a traditional Meta key.

  If you really, really want Alt to be an alias for the Meta key in every
  sense, use...

     term_.prefs_.set('alt-is-meta', true)


### How do I make backspace send ^H?

  You should manage your preferences under the Secure Shell Options page.
  Just right click the app in Chrome, select Options, and see the Keyboard
  section.  The documentation below is meant for people hacking on the source
  directly.

  By default, hterm sends a delete (DEL, '\x7f') character for the
  backspace key.  Sounds crazy, but it tends to be the right thing for
  most people.  If you'd prefer it send the backspace (BS, '\x08', aka ^H)
  character, then open the JavaScript console and type...

     term_.prefs_.set('backspace-sends-backspace', true)


### How do I send Ctrl-W, Ctrl-N or Ctrl-T to the terminal?

*** note
  This section does not apply to macOS.  That platform has no "Open as Window"
  option, but macOS also does not capture any Ctrl based shortcuts.  If want to
  capture Cmd-W, etc..., then unfortunately there currently is no way of doing
  that.  Sorry.
***

  Chrome blocks tab contents from getting access to these (and a few other)
  keys.  You can open Secure Shell in a dedicated window to get around
  this limitation.  Just right-click on the Secure Shell icon and enable
  "Open as Window".

  After that, any time you launch Secure Shell it will open in a new window
  and respond properly to these accelerator keys.

  Note that the "Open as Window" option is not available on the Mac.  However,
  Mac keyboards typically have distinct Control, Alt, and Command keys, so it's
  less of an issue on that platform.  Secure Shell cannot treat Command as
  Control or Meta, but there are some third party keyboard utilities that may
  provide a solution.


### How do I change input methods?

  In Chrome OS, Ctrl-Shift-Space and Ctrl-Space are used to cycle through
  keyboard input methods.  By default, hterm will capture these.  You can
  add custom bindings for these in the 'keybindings' settings to pass them
  along to the OS instead.

     {
       "Ctrl-Shift-Space": "PASS",
       "Ctrl-Space": "PASS"
     }

  For more details, see the [Can I rebind keys/shortcuts](#keybindings)
  section below.


### Why doesn't autorepeat work under macOS?

  In newer versions of macOS, holding down many keys (like `a`) won't repeat
  the key.  Instead, you'll get a pop up with an accent menu so you can select
  between à, á, â, ä, æ, etc...  This is a macOS feature that cannot be disabled
  on a per-application basis.

  If you don't like this behavior, you can disable it globally by opening a
  terminal and running:

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

  * Under Mac OS X the normal Command-C sequence works.

  * On other platforms Ctrl-C will perform a Copy only when text is selected.
    When there is no current selection Ctrl-C will send a "^C" to the host.

    Note that after copying text to the clipboard the active selection will be
    cleared.  If you happen to have text selected but want to send "^C",
    just hit Ctrl-C twice.

  * Under all platforms you can also use the "Copy" command from the Wrench
    menu, when running Secure Shell in a browser tab.


### How do I paste text to the terminal?

  By default, Shift-Insert pastes the clipboard on all platforms.  If you'd
  prefer to be able to send Shift-Insert to the host, set the
  'shift-insert-paste' preference to false.

  Also...

  * Under Mac OS X the normal Command-V sequence can be used to paste from
    the clipboard.

  * On other platforms use Ctrl-Shift-V to paste from the clipboard.

  * Under X11, you can use middle-mouse-click to paste from the X clipboard.

  * Under all platforms you can also use the "Paste" command from the Wrench
    menu.


### Why does the cursor blink in emacs?

  This answer only applies if you've set the 'enable-dec12' preference to true.

  Do you normally use Terminal.app or xterm?  Those terminals (and many others)
  ignore the "ESC [ ? 12 h" and "ESC [ ? 12 l" sequences (DEC Private Mode 12).
  Emacs uses these sequences (on purpose) to enable and disable cursor blink.

  If you prefer a steady cursor in emacs, set visible-cursor to nil as
  described in <https://goo.gl/muppJj>.


### Why does the color scheme look funny in emacs/vi/vim?

  hterm's default value for the TERM environment variable is
  'xterm-256color'.  This causes emacs, vi, and some other programs to
  use a different color palette than when TERM='xterm'.

  You may notice these programs use a font color that is difficult to read
  over a dark background (such as dark blue).

  You can fix vi with ':set bg=dark'.  Emacs can be started in "reverse
  video" mode with 'emacs -rv'.

  If you just want your old 16 color palette back, open the JavaScript
  console and type...

     term_.prefs_.set('environment', {TERM: 'xterm'})

  Then restart Secure Shell.


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

  Yes, as long as you're not using tmux.  For Emacs, see [osc52.el], and for
  vim, see [osc52.vim].


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

  Under [tmux](https://github.com/tmux/tmux/blob/master/tools/ansicode.txt),
  you can use a DCS sequence too, but using the `tmux` subcommand.  Replace
  the `...` part with what you want to send (and remember to escape the
  escapes).

    # A DCS sequence terminated by a ST.
    $ printf '\033Ptmux;...\033\\'
    # Send a notification straight to hterm.
    $ printf '\033Ptmux;\033\033]777;notify;title;body\a\033\\'

  There is an [hterm-notify.sh] helper script available as well:

    $ hterm-notify.sh "Some Title" "Lots of text here."


[hterm-notify.sh]: ../../hterm/etc/hterm-notify.sh
[osc52.el]: ../../hterm/etc/osc52.el
[osc52.sh]: ../../hterm/etc/osc52.sh
[osc52.vim]: ../../hterm/etc/osc52.vim
[chromium-hterm mailing list]: https://goo.gl/RYHiK
[OpenSSH legacy options]: https://www.openssh.com/legacy.html
[Keyboard Bindings]: ../../hterm/doc/KeyboardBindings.md
