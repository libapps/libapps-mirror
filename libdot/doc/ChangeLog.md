# 1.16, 2017-08-16, Improve Unicode handling.

* lib.TestManager.Log completely rewritten for better capturing & use.
* Add a bin/load_tests.sh helper for quickly launching the tests.
* New lib.f.randomInt helper for integer ranges.
* lib.wc.substr now includes trailing combining characters.

# 1.15, 2017-06-29, Standards improvements.

* Drop old String.prototype.codePointAt polyfill.
* Drop lib.f.{l,r}pad in favor of String.pad{Start,End}.
  API breakage warning: Users of these funcs will need to update to use the
  new funcs, and include the new libdot polyfill library.

# 1.14, 2017-05-30, Standards cleanup.

* Add a lib.f.createEnum helper (largely for linting purposes).
* Move from non-standard __proto__ to standard Object.create/prototype.

# 1.13, 2017-05-18, IDN support.

* Relocate wcwidth module to third_party/ to follow Google practices.
* Integrate punycode.js for IDN support.
* Add MessageManager tests!
* Allow i18n attributes to re-use themselves.
* Use ES6 String.repeat & startsWith & endsWith helpers.
* Add a lib.f.rpad helper for right padding strings.

# 1.12, 2017-05-03, Window pref sharing fix.

* Fix notification of other windows when preferences are reset.
* Allow mkzip to do channel & version promotion independently.
* Update the test UI by showing progress in the title bar.

# 1.11, 2017-04-17, Test improvements.

* Added a bunch more tests, and improve the UI.
* Added support for legacy X11 RGB color encoding (#rrrrggggbbbb).

# 1.10, 2017-03-01, Overdue release.

* Since Chrome 53, the FileError interface has been removed.
  All FS functions work with DOMError objects now.
* Fix lib.colors.hexToRGB handling of FF fields.
* Add Strings.prototype.codePointAt polyfill.
* Improve surrogate pairs handling in lib.wc.strWidth.
* Fix lib.colors.mix return value.
* Fix lib.colors.rgbToHex handling of red values below 16.
* Add lib.f.smartFloorDivide helper.
* Update lib.f.getURL with newer Chrome versions.
* Fix lib.rtdep behavior under Safari.
* Add support for East Asian Ambiguous characters in lib.wc.

# 1.9, 2014-05-27, Add "@eval" directive to bin/concat.sh

* Add an "@eval" directive which evaluates its operand with bash's eval
  builtin, and appends the result to the concat output.

# 1.8, 2014-04-05, Remove option parameter from result.pass()

* lib.TestManager.Result.prototype.pass took an optional parameter, a message
  to log, which was never used, and made it awkward to use
  result.pass.bind(result) as the value of an onSuccess callback, since any
  parameter passed to the callback would show up in the test log.

# 1.7, 2014-04-28, Firefox compatibility

* Fix if `(chrome...)` tests to be `if (window.chrome...)`.
* Fix TextComplete exception detection.

# 1.6, 2014-02-24, lib.PreferenceManager fixes.

* diff() and onStorageChanged had issues dealing with boolean prefs
  and the change-to-default-value case.  The upshot was that
  set(name, true/false/DEFAULT_VALUE) caused the notifyChange to be called
  twice.

# 1.5, 2014-01-09, Switch from BlobBuilder to Blob constructor.

* BlobBuilder has been deprecated.  Switch over to the blob constructor instead.

# 1.4, 2013-07-17, Add test harness.

* Add lib_test.html test harness.
* Modify shell scripts to work on BSD.

# 1.3, 2013-04-30, Fix concat.sh append_string

* Fix append_string to work with multi-line strings.

# 1.2, 2013-04-02, Add export/import methods to lib.PreferenceManager.

* Add lib.PreferenceManager..exportAsJson/importFromJson methods to facilitate
  backup or migration of preferences.

# 1.1, 2013-03-14, Grab bag of changes.

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
