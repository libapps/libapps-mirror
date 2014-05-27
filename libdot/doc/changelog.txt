1.9, 2014-05-27, Add "@eval" directive to bin/concat.sh

* Add an "@eval" directive which evaluates its operand with bash's eval
  builtin, and appends the result to the concat output.

1.8, 2014-04-05, Remove option parameter from result.pass()

* lib.TestManager.Result.prototype.pass took an optional parameter, a message
  to log, which was never used, and made it awkward to use
  result.pass.bind(result) as the value of an onSuccess callback, since any
  parameter passed to the callback would show up in the test log.

1.7, 2014-04-28, Firefox compatibility

* Fix if `(chrome...)` tests to be `if (window.chrome...)`.
* Fix TextComplete exception detection.

1.6, 2014-02-24, lib.PreferenceManager fixes.

* diff() and onStorageChanged had issues dealing with boolean prefs
  and the change-to-default-value case.  The upshot was that
  set(name, true/false/DEFAULT_VALUE) caused the notifyChange to be called
  twice.

1.5, 2014-01-09, Switch from BlobBuilder to Blob constructor.

* BlobBuilder has been deprecated.  Switch over to the blob constructor instead.

1.4, 2013-07-17, Add test harness.

* Add lib_test.html test harness.
* Modify shell scripts to work on BSD.

1.3, 2013-04-30, Fix concat.sh append_string

* Fix append_string to work with multi-line strings.

1.2, 2013-04-02, Add export/import methods to lib.PreferenceManager.

* Add lib.PreferenceManager..exportAsJson/importFromJson methods to facilitate
  backup or migration of preferences.

1.1, 2013-03-14, Grab bag of changes.

* Initial add of libdot changelog.
* Fix file selection in libdot/bin/mkzip.sh.  rsync selection wasn't working
  properly and I couldn't figure out how to fix it.  Instead, we build a file
  list using patterns passed to the `find` utility, and feed the resulting
  list to rsync.
* Move echo_changelog function from hterm/bin into libdot/bin/common.sh so that
  any concat script has access to it.
* Remove base64 magic from bin/concat.sh, since bash can't handle the binary
  data properly anyway.  Concat files need to manually encode to base64 when
  appropriate.
* Switch concat.sh line wrapping to awk, since the bash implementation was
  super slow.
* Allow line continuations with trailing "\" character in concat files.
* Echo a bell character after rerunning "concat --forever" to indicate that
  the concat is done.
* lib.PreferenceManager..set() - Re-add the notifyChange_() call.
* lib.PreferenceManager..onStorageChange_() - Fixed.
