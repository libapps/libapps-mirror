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

[Chromium style guide]: https://chromium.googlesource.com/chromium/src/+/master/styleguide/web/web.md#JavaScript
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

The [bin/lint.sh](./libdot/bin/lint.sh) helper script will run both for you.

The [.eslintrc.js](./.eslintrc.js) is copied from the
[Chromium project](https://chromium.googlesource.com/chromium/src/+/master/.eslintrc.js).

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

    $ git push origin HEAD:refs/for/master

This will push the current branch to Gerrit for review.  Once the change has
passed review it will be cherry-picked onto the master branch of the official
repository.

The output of this command should include a url to Gerrit web page for the
review.  From there, review largely happens via the web interface.

## Review Flow

Once the CL (ChangeList, aka patch or git commit) has been uploaded, the review
process starts.

If you want to get feedback from other developers, look through the recent git
log to find some people who are likely to help.  Then click the "REPLY" button
and type their names/e-mail addresses under the "Reviewers" field.  Finally
click the "SEND" button to save/publish your changes.

The developers will then provide feedback and eventually you should end up
with a Code-Review+2 tag.  This is an approval.  You might see Code-Review+1
in which case the reviewer is OK with the code, but would rather have someone
else give the actual approval.

At this point, it's not yet ready for submitting until it's been marked
Verified+1.  This is typically left up to the person uploading the CL to add
to indicate they've finished testing.

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
    $ git rebase origin/master

Sometimes this rebase will fail due to merge conflicts which will have to be
resolved by hand.

[Gerrit]: https://www.gerritcodereview.com/
[chromium-hterm mailing list]: https://groups.google.com/a/chromium.org/forum/?fromgroups#!forum/chromium-hterm
