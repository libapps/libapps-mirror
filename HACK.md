[TOC]

# Getting the source

The official copy of this repository is located on chromium.googlesource.com.
You can create a local copy by running:
```
git clone https://chromium.googlesource.com/apps/libapps
```

# Before Contributing

## CLAs

Before we can use your code, you must sign the
[Google Individual Contributor License Agreement](https://developers.google.com/open-source/cla/individual?csw=1)
(CLA), which you can do online.  The CLA is necessary mainly because you own the
copyright to your changes, even after your contribution becomes part of our
codebase, so we need your permission to use and distribute your code.  We also
need to be sure of various other things -- for instance that you'll tell us if
you know that your code infringes on other people's patents.

## Coordination

Before you start working on a larger contribution, you should get in touch with
us first through the [chromium-hterm mailing list] with your idea so that we can
help out and possibly guide you.  Coordinating up front makes it much easier to
avoid frustration later on.

# Coding Style

We follow the [Chromium style guide] (which in turn follows the
[Google style guide]).  You might find code in the tree that doesn't follow
those, but it's most likely due to lack of tools automatically checking and
enforcing rather than being done on purpose.

[Chromium style guide]: https://chromium.googlesource.com/chromium/src/+/HEAD/styleguide/web/web.md#JavaScript
[Google style guide]: https://google.github.io/styleguide/jsguide.html

* Do not one-line if statements.
* When wrapping function arguments, wrap them all, or keep them aligned.

## Automatic Formatting

If you want to see suggestions for how to format your code, you can use the
`clang-format` tool.  Note that clang-format can sometimes reformat code that
is acceptable according to the style guide, and it cannot catch everything!
Make sure to use your best judgment when going through its proposed changes.

```
# Write the formatted output to stdout.
$ clang-format -style=file foo.js

# Update the file in-place.
$ clang-format -i -style=file foo.js
```

## Linting

You can use [eslint](https://eslint.org/) to quickly check code, or
[closure compiler](https://developers.google.com/closure/compiler/).

The [bin/lint](./libdot/bin/lint) helper script will run both for you.

The [.eslintrc.js](./.eslintrc.js) was based on the
[Chromium project](https://chromium.googlesource.com/chromium/src/+/HEAD/.eslintrc.js).

For build tools written in Python, you can use [bin/pylint](./libdot/bin/pylint)
to run [pylint](https://www.pylint.org/) with the right settings.

## Console Logging

The `console.log` functions have a variety of function signatures.  We like to
stick to a few forms though.

* A single string when we expect everything to be strings:

      console.log('The field "' + name + '" is invalid: ' + val);

* A string followed by objects when dealing with more than strings, and we want
  to be able to easily explore the object in the debugging console:

      console.log('The field "' + name + '" is invalid:', val);

* Or you can use ES6 template literals/strings:

      console.log(`The field "${name}" is invalid: ${val}`);
      console.log(`The field "${name}" is invalid:`, val);

## Minification

We follow the recommendations listed at
[PageSpeed Insights](https://developers.google.com/speed/docs/insights/MinifyResources).

### JavaScript

We don't currently minify our JavaScript files.
Research is on going to support this either via the [Closure Compiler] or
[UglifyJS] tools.

We need to make sure live debugging in Secure Shell is still smooth.

[Closure Compiler]: https://developers.google.com/closure/compiler/
[UglifyJS]: http://lisperator.net/uglifyjs/

### CSS

We don't have a lot of CSS files in these projects, and they tend to be small
already, so we don't need a perfect solution.

We go with [csso] because the installed footprint (in node_modules/) is slightly
smaller, and the CLI usage is simpler than [cssnano].

Otherwise, we want support for source maps and generally smaller files.

[csso]: https://github.com/css/csso
[cssnano]: https://cssnano.co/

### Images

When adding images, make sure to crush them first.
You can use [libdot/bin/imgcrush](./libdot/bin/imgcrush) to do so losslessly.

# Node/npm Usage

We bundle our own node/npm binaries and sets of node_modules so that we do not
rely on the respective infrastructures being up, as well as the various npm
packages being unchanged (e.g. deleting versions, changing their contents,
etc...).
We want our builds to be as hermetic as possible.

For node/npm, we use the versions the Chromium project snapshots in their
gs://chromium-nodejs/ bucket.
See the node/npm scripts in [libdot/bin/](./libdot/bin/) for more details.

Using these tools are all transparent to libdot users -- the libdot/bin/node
and libdot/bin/npm wrappers take care of downloading everything and setting
up the $PATH to include the tools.

## node_modules

We roll our own tarballs of the node_modules directory (rather than re-use
the one Chromium creates) since we have our own set of packages we care about.

Our dependencies are maintained in the top level [package.json](./package.json).

The tarball can be created with the libdot/bin/node_modules_create_bundle script
and then uploaded to the gs://chromeos-localmirror/secureshell/distfiles/ site.
Then update the NODE_MODULES_HASH setting in libdot/bin/node.

For example, to update it, run the script and follow its directions.
You'll want to create & upload a new gerrit commit for the node file too.
```sh
# Create the bundle.  This will also prune & upgrade modules.
$ ./libdot/bin/node_modules_create_bundle
-*- Removing modules not listed in package.json
...
-*- Updating modules from package.json
...
-*- Creating tarball
-*- Compressing tarball
7.4M    node_modules-bef2e594c44731d96ba28d0ce1df789a4611b5bbae70666cbef13f069155a44b.tar.xz
-*- To update the hash, run:
sed -i "/^NODE_MODULES_HASH=/s:=.*:='bef2e594c44731d96ba28d0ce1df789a4611b5bbae70666cbef13f069155a44b':" './libdot/bin/node'
-*- To upload the new modules:
gsutil cp -a public-read node_modules-bef2e594c44731d96ba28d0ce1df789a4611b5bbae70666cbef13f069155a44b.tar.xz gs://chromeos-localmirror/secureshell/distfiles/
```

# Submitting patches

This repository only accepts commits that are submitted through [Gerrit], the
code-review software.  In order to submit a patch through Gerrit, you'll need
to do a one-time setup to get things ready.

1. Create an account on https://chromium-review.googlesource.com/.  (You can use
   OAuth for this, no need for yet-another-password.)

2. From the root of your libapps/ repo, run the command:

        $ curl -Lo `git rev-parse --git-dir`/hooks/commit-msg https://gerrit-review.googlesource.com/tools/hooks/commit-msg ; chmod +x `git rev-parse --git-dir`/hooks/commit-msg

   This will copy a commit-msg hook necessary for Gerrit.  The hook annotates
   your commit messages with Change-Id's.  It's important to leave these intact,
   as it's how commits are mapped to code reviews.

Now you're free to start working.  Create a branch to hold your changes...

    $ git checkout -b hterm_stuff

Then start hacking and commit your changes.  When you're ready to submit, push
with...

    $ git push origin HEAD:refs/for/main

This will push the current branch to Gerrit for review.  Once the change has
passed review it will be cherry-picked onto the latest branch of the official
repository.

The output of this command should include a url to Gerrit web page for the
review.  From there, review largely happens via the web interface.

## Review Flow

Once the CL (ChangeList, aka patch or git commit) has been uploaded, the review
process starts.

### Getting Code-Review+2 (LGTM+Approval)

If you want to get feedback from other developers, look through the recent git
log to find some people who are likely to help.  Then click the "REPLY" button
and type their names/e-mail addresses under the "Reviewers" field.  Finally
click the "SEND" button to save/publish your changes.

The developers will then provide feedback and eventually you should end up
with a Code-Review+2 tag.  This is an approval.  You might see Code-Review+1
in which case the reviewer is OK with the code, but would rather have someone
else give the actual approval.

### Getting Verified+1

At this point, it's not yet ready for submitting until it's been marked
Verified+1.  We let the automated kokoro CI system run its checks to make sure
the code passes all linting & unittests.  This is activated as soon as someone
has Code-Review+2 the CL, so you just have to wait.  It normally doesn't take
too long for it to start or finish (i.e. O(minutes)).

If kokoro doesn't pass, it will provide links to its logs.  If you're unable
to access them, feel free to ask the developer who provided the Code-Review+2
to take a look.

Some tips in case things are still failing:
*    Make sure your commit is based on the latest tree state.
     *   Try clicking the "Rebase" button to get onto the latest tree easily.
*    If kokoro's build flaked, post the message "kokoro rerun" to retry.

### Merging

The final merge into the tree is often left to the developer who approved the
CL, although this isn't strictly required.

If in doubt about any of these steps, feel free to ask on the CL/review itself.

## Keeping In Sync

If the official repository changes, you can fetch the new commits using...

    # This command only affects your local repository files, you can run it
    # regardless of which branch you're currently on.
    $ git fetch

And then re-base any branches with work-in-progress.

    $ git checkout hterm_stuff
    $ git rebase origin/main

Sometimes this rebase will fail due to merge conflicts which will have to be
resolved by hand.

[Gerrit]: https://www.gerritcodereview.com/
[chromium-hterm mailing list]: https://groups.google.com/a/chromium.org/forum/?fromgroups#!forum/chromium-hterm
