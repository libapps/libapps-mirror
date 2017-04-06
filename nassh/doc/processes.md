[TOC]

# Processes

Here we document the various release processes and other boring topics.

## Creating a (dev) Release

All new releases first go through the dev version of the extension.  This way
we can get early feedback from testers on obvious issues without breaking the
(much larger) stable user base.

https://chrome.google.com/webstore/developer/detail/okddffdblfhhnmhodogpojmfkjmhinfp

### Updating Dependencies

Now would be a good time to go through and do sub-releases of other projects.
e.g. See if hterm or libdot has had any changes.  If so, update their respective
ChangeLog files and create a new git tag for each of them.

If you look at the ChangeLogs and `git tag -l`, it should be obvious how to do
this.  If you're still unsure, consult these as examples:

* hterm: commit [118578e0fe18c18cea5a5c2da61cc05cd0ce5038] and tag [hterm-1.62]
* libdot: commit [17eba88e555c7e2478c9cac2689af4d2e993e915] and tag [libdot-1.11]

Don't forget to push the tags once you've created them locally!

We don't currently use signed tags.

[118578e0fe18c18cea5a5c2da61cc05cd0ce5038]: https://chromium.googlesource.com/apps/libapps/+/118578e0fe18c18cea5a5c2da61cc05cd0ce5038^!
[17eba88e555c7e2478c9cac2689af4d2e993e915]: https://chromium.googlesource.com/apps/libapps/+/17eba88e555c7e2478c9cac2689af4d2e993e915^!
[hterm-1.62]: https://chromium.googlesource.com/apps/libapps/+/hterm-1.62
[libdot-1.11]: https://chromium.googlesource.com/apps/libapps/+/libdot-1.11

### Source Prepare

Update the [ChangeLog.md](./ChangeLog.md) file with any relevant details since
the last release, and update the version in the
[manifest.json](../manifest.json).  Add any significant changes to
concat/release-highlights.txt.

See commit [6b11740fa3eb500ea07efc684af7e75543ea3448] and tag [nassh-0.8.36.2]
as examples.

Don't forget to push the tag once you've created it locally!

We don't currently use signed tags.

[6b11740fa3eb500ea07efc684af7e75543ea3448]: https://chromium.googlesource.com/apps/libapps/+/6b11740fa3eb500ea07efc684af7e75543ea3448^!
[nassh-0.8.36.2]: https://chromium.googlesource.com/apps/libapps/+/nassh-0.8.36.2

### Check ssh_client (plugins/)

You will need to make sure you have the current ssh_client release files under
the plugins/ directory.  Consult the [hack.md](./hack.md) document for details
on acquiring those files.

### Making the ZIP

The [bin/mkzip.sh](../bin/mkzip.sh) helper script is used to create the zip
file for uploading to the [CWS].  It operates on the current checked out repo,
so make sure it's clean!

### Upload the (dev) Release

Visit the [CWS] dashboard to upload the new zip file:<br>
https://chrome.google.com/webstore/developer/edit/okddffdblfhhnmhodogpojmfkjmhinfp

### Announce! {#announce}

Send an e-mail to the public [chromium-hterm group] announcing the new release.
Here's an example posting:<br>
https://groups.google.com/a/chromium.org/d/msg/chromium-hterm/_AcmwvdGFCc/Cne7Q8B3CQAJ

Then forward that to the internal [chrome-hterm group].

[chromium-hterm group]: https://groups.google.com/a/chromium.org/forum/?fromgroups#!forum/chromium-hterm
[chrome-hterm group]: http://g/chrome-hterm

## Promoting a Stable Release

After some time, life will be great and everyone loves the new version.  That
means it's time to promote the dev version to stable.  The process basically
takes the existing dev CRX, updating the manifest.json slightly, and then
uploading it to the stable version.

### Get Existing Release

If you still have the ZIP file that you uploaded previously, you can use that.
Otherwise, it'll be easiest to just download the CRX directly from the [CWS].
You can use this extension:<br>
https://chrome.google.com/webstore/detail/dijpllakibenlejkbajahncialkbdkjc

Then visit the dev page:<br>
https://chrome.google.com/webstore/detail/okddffdblfhhnmhodogpojmfkjmhinfp

Then download the CRX using that extension.

### Update the Manifest

You can run the `promote.sh` script to do the channel promotion for you.
```
$ ./bin/promote.sh ./SecureShell-dev-0.8.36.2.zip
-*- Name "Secure Shell (dev)" promoted to "Secure Shell"
-*- Zip directory: dist/zip/tmp/SecureShell-0.8.36.2.zip.d
-*- Unzipping from: SecureShell-dev-0.8.36.2.zip
-*- Rewrite dist/zip/tmp/SecureShell-0.8.36.2.zip.d/manifest.json
-*- New name: Secure Shell
-*- New version: 0.8.36.2
-*- Creating: dist/zip/SecureShell-0.8.36.2.zip
-*- Done: 161 files, 3.5M
```

Now the zip file under `dist/zip/` is ready for release.

### Upload the (stable) Release

Visit the [CWS] dashboard to upload your new zip file:<br>
https://chrome.google.com/webstore/developer/edit/pnhechapfaindjhompbnflcldabbghjo

### Announce!

This is the same as [announcing the dev release](#announce).

### Reset Release Highlights

Now that we've promoted a stable version, you should refresh the
concat/release-highlights.txt file to drop older entries.

## Branches

We don't currently have any.  We strive to keep the master branch stable.
You should too!

## Updating Translations

*** note
This process is meant for Googlers who are making new releases.
***

Once `_locales/en/messages.json` has updates that need translating:

* Go into `//depot/google3/googleclient/chrome/extensions/samples/tc/hterm/`.
* Make sure the locale list in `BUILD` is up to date.
* Open `i18n_messages.js` for editing.
* Run `../convert_json_messages.py < .../nassh/_locales/en/messages.json > i18n_messages.js`.
* Upload & land the CL.
  * If you need JavaScript readability approval, add readtome-javascript@.
* If you want to make other changes, check with [CWS oncall](http://oncall/chrome-webstore-eng).
* Talk to your TC contact about scheduling another run.
  * Visit http://go/l10npms and use product "Chrome OS".
* Wait for the translators to finish.
* The updated files are at `//depot/google3/googledata/transconsole/xtb/ChromeExtensions/*.xtb`
  but you won't use them directly.
* Convert the xtb files to JS files (while under the `hterm` dir mentioned above):
  `blaze build messages_fileset`
* In the root of the checkout, the new JSON files will be under
  `blaze-bin/googleclient/chrome/extensions/samples/tc/hterm/messages_fs/_locales/`.
* Use the [import-translations.sh](../bin/import-translations.sh) script to import:
  `.../nassh/bin/import-translations.sh .../google3/blaze-bin/googleclient/chrome/extensions/samples/tc/hterm/messages_fs/_locales/`
* Upload & land the CL.

See the [TC](http://tc/) page for more details.

## Calendar

We don't have one.  Releases are made as changes roll in.

## Launch Bugs

* https://docs.google.com/document/d/13O6lLu8Acyd2JhuulUaivDbHVSRe2_ECM8z3NMirqE4/edit: PRD (Product Requirements Document)
* https://crbug.com/205752: Main launch bug.
* https://crbug.com/211243: Security review launch bug.
* https://crbug.com/200406: Tracker bug for initial SSH NaCl client.


[CWS]: https://chrome.google.com/webstore
