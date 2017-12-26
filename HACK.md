
# Getting the source

The official copy of this repository is located on chromium.googlesource.com.
Use `git clone https://chromium.googlesource.com/apps/libapps` to create a
local copy.

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

# Submitting patches

This repository only accepts commits that are submitted through "Gerrit", the
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
review.  Add one or more reviewers using the "Add Reviewer" button on that web
page.

If the official repository changes, you can fetch the new commits using...

    # This command only affects your local repository files, you can run it
    # regardless of which branch you're currently on.
    $ git fetch

And then re-base any branches with work-in-progress.

    $ git checkout hterm_stuff
    $ git rebase origin/master

Sometimes this rebase will fail due to merge conflicts which will have to be
resolved by hand.

[chromium-hterm mailing list]: https://groups.google.com/a/chromium.org/forum/?fromgroups#!forum/chromium-hterm
