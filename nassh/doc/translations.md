# Translations

*** note
**Warning: This document is old & has moved.  Please update any links:**<br>
https://chromium.googlesource.com/apps/libapps/+/HEAD/nassh/docs/translations.md
***

The project has translations for many languages.
This covers all the details of that process for people.

For a general overview of localizing code, see the [Chrome i18n] documentation.
We won't cover general Chrome/web platform logic here.

For Googlers, see the [Translation Console Overview].

[TOC]

## Overview

The nassh & hterm code use `nassh.msg` & `hterm.msg` to lookup messages.

The [en/messages.json] file contains all the original messages.
We maintain this file directly in this repository.

The [en/messages.json] file is periodically & automatically copied to internal
Google systems (using [copybara]) into the [hterm_messages] directory.
CLs will be generated that developers have to manually approve, but everything
else is automatic.

It is periodically & automatically imported into the [Translation Console] by
converting the [messages.json] format to [XMB] (XML Message Bundle) under the
[transconsole/xtb] tree (see [en.xmb]).
Then it is automatically flagged for translation updates.
Developers do not need to trigger this flow.

Translations are periodically & automatically exported internally using the
[XTB] (XML Translation Bundle) format under the [transconsole/xtb] tree.
Developers do not need to trigger this flow.

Finally, the [XTB] files are converted back into [messages.json] before being
merged back into this repository.
This step is currently run manually by Google developers, although see the
[Automatic Updates] section below for more info.

Sometimes, usually when new messages are added, translators will ask for
clarification and [file localization queries].
The Google l10n team will triage & assign to Googlers as needed.
Googlers will then address feedback & update the [en/messages.json] or answer
their questions directly as makes sense.

## Translating HTML

When writing HTML pages, use the `i18n` attribute on elements, and then
[lib.MessageManager.processI18nAttribute] API will take care of inserting
the right translations at runtime.

## Updating Translations {#updating-translations}

*   Check on the current status of translations by looking at [tc/nassh].
    *   The [View Translation Percentage] page gives an overview.
    *   We don't need 100% coverage before refreshing/importing messages as our
        [import-translations] helper handles that.
*   Go into [//security/nassh/translations/].
*   Make sure the locale list in `BUILD` is up to date.
*   Run `blaze build msg_roundtrip_test` to verify the entire cycle.
    *   This generates the [en.xmb] from the [hterm_messages].
    *   It also generates the translated [messages.json] files.
*   In the root of the client, the new [messages.json] files will be under
    `blaze-bin/security/nassh/translations/messages_fs/_locales/`.
*   Use the [import-translations] to import:
    `.../nassh/bin/import-translations .../google3/blaze-bin/security/nassh/translations/messages_fs/_locales/`
*   Upload & land the CL in our git repository.

See the [TC](http://tc/) page for more details.

### Automatic Updates {#automatic-updates}

Our official build/release pipeline will automatically dump the latest
translations and integrate them into the releases.
Unfortunately, this means the official releases will always be up-to-date, but
not the open source code or releases.
This impacts our integration into CrOS with the crosh and Terminal projects.
So [periodic manual exports][Updating Translations] are still required.

## FAQ

### Do I have to translate messages myself?

Nope, we don't write any of the translations ourselves.
We only maintain the [en/messages.json] source messages.
Everything is handled for developers.

### How do I fix a translation?

We accept [bug reports][new-bug] for bad translations, but we don't accept
changes from contributors as they'll be automatically overwritten.

So feel free to [file bugs][new-bug] for us, and we'll take care of sending
that feedback to our translators for fixing things.

For Googlers, at this point the process is:
*   Go to the project's [messages list].
*   Find the string that needs fixing.
    *   Click the message id to open the message-specific page.
*   Find the language that needs updating.
    *   Click the language name to open the language-specific page.
*   Find the "Make a suggestion" link at the bottom.
*   Fill out the form details and submit it.
    *   Include the original report (bug or forums) if available.


[Automatic Updates]: #automatic-updates
[Updating Translations]: #updating-translations

[new-bug]: https://goo.gl/vb94JY
[Chrome i18n]: https://developer.chrome.com/extensions/i18n
[copybara]: http://go/copybara
[hterm_messages]: http://source/piper///depot/google3/third_party/javascript/hterm_messages/
[en/messages.json]: ../_locales/en/messages.json
[en.xmb]: http://source/piper///depot/google3/googledata/transconsole/xtb/nassh/en.xmb
[file localization queries]: http://b/issues?q=componentid:425688%20status:open%201522709
[import-translations]: ../bin/import-translations
[lib.MessageManager.processI18nAttribute]: /libdot/js/lib_message_manager.js
[messages.json]: https://developer.chrome.com/extensions/i18n-messages
[messages list]: http://tc/btviewer/searchresult?ProjectsSelected=nassh
[tc/nassh]: http://tc/project/edit?id=nassh
[transconsole/xtb]: http://source/piper///depot/google3/googledata/transconsole/xtb/nassh/
[Translation Console]: http://tc/
[Translation Console Overview]: http://go/transconsole
[View Translation Percentage]: http://tc/btviewer/translationPercentage?project=nassh
[XMB]: http://cldr.unicode.org/development/development-process/design-proposals/xmb
[XTB]: http://cldr.unicode.org/development/development-process/design-proposals/xmb
[//security/nassh/translations/]: http://source/piper///depot/google3/security/nassh/translations/
