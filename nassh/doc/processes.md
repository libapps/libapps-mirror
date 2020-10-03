# Processes

Here we document the various release processes and other boring topics.

[TOC]

## Creating a (nightly dev) Release

All new releases first go through the dev version of the extension.  This way
we can get early feedback from testers on obvious issues without breaking the
(much larger) stable user base.

https://chrome.google.com/webstore/developer/detail/okddffdblfhhnmhodogpojmfkjmhinfp<br>
https://chrome.google.com/webstore/developer/detail/algkcnfjnajfhgimadimbjhmpaeohhln

### Nightly Build Process

New developer builds are created and signed automatically by internal Google
tools from the latest git revisions in the tree.
That means the actual creation of the CRX archive is not run by local developers
(anymore) as the [CWS] will block unsigned archives.

### Getting the CRX

Googlers use `mpm` to download the CRX files.

Locate the CRX from the [mpm browser].
Drill down into the `app-dev` and `extension-dev` packages.
Find a version id like `1-146602e4_5ab126a6_44d22cda_e4a5aa8c_570775fd`.
It will be different for each package.

With those versions in hand, run something like:

```sh
$ cd ~
$ mpm fetch -v 1-40368fdb_e541d43a_d1d0bd16_daf53a44_69d74102 security/nassh/app-dev app
$ cp app.mpm/versions/*/extension.crx ./app.crx
$ mpm fetch -v 1-2d440ada_27f741e4_ef8b2b81_719b289e_79809584 security/nassh/extension-dev ext
$ cp ext.mpm/versions/*/extension.crx ./ext.crx
$ rm -rf app.mpm ext.mpm
```

Now you'll have the `app.crx` and `ext.crx` archives to upload to the [CWS].

### CWS Access

You'll need to be part of the [chrome-secure-shell-publishers group] in order to
manage things via the [CWS].

### Upload the (dev) Release

Visit the [CWS] dashboard to upload the new CRX archives:<br>
https://chrome.google.com/webstore/developer/edit/okddffdblfhhnmhodogpojmfkjmhinfp<br>
https://chrome.google.com/webstore/developer/edit/algkcnfjnajfhgimadimbjhmpaeohhln

We no longer announce dev releases since we switched to automated builds.

## Preparing a Stable Release

Since the dev release process is less formal now, the flow for preparing a
stable release requires a bit more effort.

### Updating Dependencies

Now would be a good time to go through and do sub-releases of other projects.
e.g. See if hterm or libdot have had any changes.
If so, update their respective ChangeLog files and create a new git tag for each
of them.

If you look at the ChangeLogs and `git tag -l`, it should be obvious how to do
this.  If you're still unsure, consult these examples:

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
the last release.

Add any significant changes to concat/release-highlights.txt, and prune any old
entries in here (see the comments in the file for details).

See commit [e992bb2c819188421b010a7c4fdc96cfae48db31] and tag [nassh-0.9] as
examples, but don't create a tag yet!

The version should remain unchanged in the `manifest_*.json` files as we'll
update that after we create a git tag.

[e992bb2c819188421b010a7c4fdc96cfae48db31]: https://chromium.googlesource.com/apps/libapps/+/e992bb2c819188421b010a7c4fdc96cfae48db31^!
[nassh-0.9]: https://chromium.googlesource.com/apps/libapps/+/nassh-0.9

### Wait For Dev Release

Once all the release files look OK, we wait for the internal builders to produce
the signed CRX files which we upload again.
Then we do a sanity check to make sure the release works in the dev channel.

If there's a problem, go through the steps above again (landing fixes and
updating ChangeLogs) until the dev CRX is stable.

### Tag the Release

Now that we have a commit we want to actually promote to stable, it's time to
create a git tag and push it to the server.

We don't currently use signed tags.

### Update the manifest.json Versions

Now that we've tagged the release and pushed it out, the version should be
updated in the `manifest_*.json` files to point to the next one.

See commit [ddb21ccd39010f4c537da2a104f1a8869fe1ee6c] as an example.

[ddb21ccd39010f4c537da2a104f1a8869fe1ee6c]: https://chromium.googlesource.com/apps/libapps/+/ddb21ccd39010f4c537da2a104f1a8869fe1ee6c^!

## Promoting a Stable Release

After some time, life will be great and everyone loves the new version.
That means it's time to promote the dev version to stable.
The process basically grabs the stable CRX already created at the same time as
the dev CRX by our infrastructure.

There are only minimal differences between the dev & stable CRX's -- settings
in the `manifest.json` like the version, name, and icon paths.
That's why we can use the dev CRX to validate before taking the stable CRX and
uploading it directly to the [CWS] without explicitly testing it first.

### Get Existing Release

Visit the [mpm browser] again, but this time look at the `app-stable` and
`extension-stable` packages.
Use the same `mpm` flow as the dev step above to pull out the stable CRX's.

### Upload the (stable) Release for Googlers

Visit the [CWS] dashboard to upload the new CRX archives:<br>
https://chrome.google.com/webstore/developer/edit/pnhechapfaindjhompbnflcldabbghjo<br>
https://chrome.google.com/webstore/developer/edit/iodihamcpbpeioajjeobimgagajmlibd

Look for "Upload Dogfood Version".  This will post the update only for Googlers
to get some last minute feedback before releasing to the world.  If you want to
control the release more, you can set the percentage field, but usually we leave
it unset (i.e. 100%).

### Internal Announce!

Send an e-mail to the internal [chrome-hterm group] announcing the new release.
Here's an example posting:<br>
https://groups.google.com/a/chromium.org/d/msg/chromium-hterm/_AcmwvdGFCc/Cne7Q8B3CQAJ

### Upload the (stable) Release for Everyone

Visit the [CWS] dashboard to upload the new CRX file:<br>
https://chrome.google.com/webstore/developer/edit/pnhechapfaindjhompbnflcldabbghjo<br>
https://chrome.google.com/webstore/developer/edit/iodihamcpbpeioajjeobimgagajmlibd

This time use the "Upload Updated Package" option.  Once that's done, use
"Remove" on the dogfood version so the display doesn't get confusing.

### Public Announce!

Send the same announcement as before but to the the public
[chromium-hterm group].

## Branches

We don't currently have any.  We strive to keep the latest tree stable.
You should too!

## Translations

Once `_locales/en/messages.json` has updates that need translating, follow the
directions/guidelines in the [Translations documentation](./translations.md).

## Calendar

We don't have one.  Releases are made as changes roll in.

We try to release on Mon-Wed to line up with normal working hours.
The [CWS] delays all publishing currently, so we assume changes will go live
before Friday.

Similarly, try to follow:
* Avoid US holidays (and large international ones if possible).
* Follow the normal Google production freeze schedule.

## Launch Bugs

* https://goto.google.com/chrome-secure-shell-prd: PRD (Product Requirements Document)
* https://goto.google.com/chrome-secure-shell-pdd: PDD (Privacy Design Document)
* https://crbug.com/205752: Main launch bug.
* https://crbug.com/211243: Security review launch bug.
* https://crbug.com/200406: Tracker bug for initial SSH NaCl client.


[CWS]: https://chrome.google.com/webstore
[chrome-hterm group]: http://g/chrome-hterm
[chrome-secure-shell-publishers group]: http://g/chrome-secure-shell-publishers
[chromium-hterm group]: https://groups.google.com/a/chromium.org/forum/?fromgroups#!forum/chromium-hterm
[mpm browser]: https://mpmbrowse.corp.google.com/packagez?package=security%2Fnassh
