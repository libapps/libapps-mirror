# 6.0.0, 2020-04-29, Tons of linting cleanups.

* externs: Add/fix more APIs.
* closure: Update to latest v20200406.
* lit-element: Update to 2.3.1 to get live().
* closure: Update to v20200204.
* closure: Update to v20191027.
* jsdoc: Improve type information.
* chromeSupported: Fix return value.
* intl-segmenter: Clean up code a bit.
* colors: Fix implicit string->number coercion.
* preference_manager_tests: Workaround bad closure externs.
* polyfill: Drop Object.{values,enries}.
* externs: Avoid "const".
* i18n: Fallback to language if locale is not found.
* eslint: Enable no-throw-literal check.
* lint: Add missing dangling commas.
* eslint: Enable no-empty check.
* eslint: Enable prefer-rest-params check.
* mocha: Upgrade to v7.
* eslint: Enable no-var & prefer-const checks.
* node: Update to 12.14.1.
* closure: Update to v20190929.
* eslint: Disable l/I variable usage by default.
* lint: Convert var to let/const.
* fetch: Retry on connection failures.
* eslint: Enable arrow-parens checks.
* eslint: Enable one-var-declaration-per-line checks.
* eslint: Enable comma-dangle checks.
* eslint: Enable space-infix-ops checks.
* eslint: Enable comma-spacing checks.
* colors: hslx/hsla: New helpers.
* eslint: Enable no-useless-escape checks.
* lint: Clean up remaining opt_ usage.
* lint: Add missing braces everywhere per our style guide.
* wcwidth: Reformat range code style.
* MessageManager: Normalize message ids to uppercase.
* colors: luminance/contrastRatio: New helpers.

# 5.0.0, 2020-04-05, Unicode 13.0.0 update, and minor tooling improvements.

* wcwidth: Update to Unicode 13.0.0 release.
* colors: arrayToRGBA: Return rgb() when there's no alpha.
* i18n: Better resolve translations.
* minify-translations: Rename for reuse.
* bin: Improve timezone logging info.
* headless-chrome: Move unique logic out of common module.
* bin: Require Python 3.6+.
* colors: Add HSL helpers.
* MessageManager: Lookup en directly rather than en_US for messages.
* externs: bigint/chai: Add more prototypes.
* bin: Use UTF-8 encoding in more places.
* pylint: Include custom env for comments too.
* externs: browser: Add more prototypes.
* bin: Use sort_keys=True when dumping json.
* bin: unpack: Enable symlinks under Windows.
* bin: Use os.pathsep for portability.
* node: Add Windows support.
* eslint: Enable single quote checking.

# 4.0.0, 2019-11-28, Tons of tooling improvements & linting cleanups.

* bin: Log when/where we have an unpack cache hit.
* storage: Add terminal private storage.
* colors: Support hsla? css strings.
* colors: Convert transparent hex values to rgba and vice versa.
* bin: Drop mkzip & shell scripts.
* minify-translations: Add a --glob option.
* fs: Replace libdot.fs.FileReader with Blob.arrayBuffer/text.
* lint: Support skip-mkdeps flag.
* bin: Unify argument parsing & log setup in tools.
* lib: Remove lib.waitUntil API.
* PreferenceManager: Remove removeObserver API.
* lint: Add support for eslint --fix.
* eslint: Set max-len 80.
* bin: unpack: Fix portability issues for Windows.
* js: Rewrite code for jsdoc usage to avoid opt_ prefix.
* npm/eslint: Enable jsdoc plugin & tag naming.
* bin: logging: use colors with warning/error messages.
* lint: Fill out all gerrit comments fields.
* lint: Support generating deps before linting.
* pylint: Support kokoro gerrit format.
* mkdist: New helper for building our release.
* lint: Add third_party js files to default set.
* js: Clean up jsdoc more.
* externs: js compilation.
* bin: fetch: Fix portability issues for Windows.
* event: Rework to remove unused APIs.
* lint: Support kokoro gerrit format for closure.
* lib.PreferenceManager: Extract addObserver to a public function.
* fs: Migrate lib.fs.getOrCreateDirectory to Promises.
* fs: Migrate lib.fs.overwriteFile to Promises.
* fs: Migrate getOrCreateFile to Promises.
* lint: Improve gerrit comments output.
* fs: Migrate readFile to Promises.
* storage: Create common interface.
* bin: Dump stdout/stderr when commands fail.
* tests: Drop support for node testing.
* externs: Add APIs for closure.
* js: Clean up closure compilation.
* lib: Add lib.assert and lib.notNull to help JS compilation and tests.
* lint: Fix default filter.
* lint: Support kokoro gerrit format for eslint.
* lint: Fix chdir logic with default paths.
* lint: Have all packages specify closure args.
* pylint: Clean up various pylint issues in the code base.
* node: Rework code sharing.
* load_tests: Rework code sharing.
* concat: Rework code sharing.
* lint: Unify lint helper program.
* bin: Add machinery for importing our python programs.
* lib.MessageManager: Add Crlf mangling, internalize some members, and switch
  to Promise based API.
* eslint: Turn on more rules.
* js: Fix lint and closure-compile errors.
* bin: Drop Python 3.4 workaround.
* closure-compiler: New tool wrapper.

# 3.0.0, 2019-08-06, Few API improvements, and lots of test suite improvements.

* punycode: Drop our local copy & get from npm.
* load_tests: Tear down server on failures.
* load_tests: Add a --no-sandbox flag.
* load_tests: Move node tests out of package.json.
* libdot: Require Python 3.5+ in tooling.
* load_tests: Leverage mocha-headless-chrome for headless/CI.
* load_tests: Refactor mkdeps call.
* node_modules_create_bundle: Handle interrupted runs.
* fs: Add openFile helper.
* fs: readFile: Convert to Promises.
* load_tests: Support auto launching local node web server.
* f: getWhitespace: Drop helper for ES6 String.repeat.
* load_tests: Require node/npm (for chai/mocha).
* fetch: Leverage $DISTDIR cache.
* npm: Refresh bundled packages.
* pylint: Add libdot to search path.
* concat: Rework to support importing.

# 2.0.0, 2019-06-17, Significant API overhaul.

* load_tests: use DISPLAY=:0.
* lint: Rewrite helper in python.
* node/npm: Rewrite helpers in python.
* libdot.py: Hoist python helpers out of ssh_client.
* Update node to 10.15.3 & add update helper script.
* Add a python download helper.
* load_tests: Convert to python.
* concat: Replace arbitrary shell scripts with explicit commands.
* Start proper package.json packaging for npm.
* tests: Get them working under node.
* concat: Explicitly set file encoding to UTF-8.
* test_manager: Punt unused framework (for mocha).
* concat: Improve plain text resources.
* wcwidth: Update to Unicode 12.1.0 release.
* Update http:// to https:// URIs everywhere.
* tests: drop --allow-file-access-from-files.
* Add polyfill for Intl.Segmenter for breaking up Unicode graphemes.
* test: Support async preambles.
* Drop lib.f.Sequence APIs.
* test: Rework to catch early errors.
* fs: Convert lib.fs.readDirectory to Promises.
* array: Drop unused custom uint32 helpers.
* Drop lib.f.parseQuery for URLSearchParams.
* minify-translations: Sanity check placeholders.
* concat: Preserve whitespace in lines.
* tests: Drop setDefaults usage.
* mkzip: Also include css from third_party.
* Convert test suite to mocha.
* tests: Call chai asserts directly.
* Improve lib.f.openWindow tests.
* tests: Switch core to chai for asserts.
* npm: Add more test/dev packages (chai/mocha/jsdom).
* tests: Fix assert identity tests.
* colors: Clean up crackRGB return.
* Drop lib.f.alarm APIs.
* Drop lib.rtdep APIs.
* Drop lib.utf8 legacy APIs for Text{De,En}coder.
* tests: Allow tests to be selected via the URI.
* tests: Allow pass to not throw.
* Switch to ES6 Symbol.
* Import Text{De,En}coder polyfills.
* codec: Add performance notes wrt String.fromCharCode.apply.
* Add utf8 decoder tests.

# 1.26, 2019-01-19, openWindow & new codec helpers.

* test: Support comparing ArrayBuffer.
* concat: Fix date/version parsing again.
* minify-translations: Force utf-8 with messages.json.
* fs: Add a Promise wrapper for the FileReader API.
* codec: Allow stringToCodeUnitArray to create typed arrays.
* Speed up codec helpers.
* codec: New module for binary/UTF8/UTF16 helpers.
* tests: Switch to a dark theme.
* Add a lib.f.openWindow helper for noopener.

# 1.25, 2018-12-02, Minor improvements.

* prefs: Fix handling of null defaults.
* assertEQ: Handle typed arrays too.
* concat: Fix date/version swap.
* polyfill: Add Promise.finally.
* prefs: Coalesce writes when importing json files.
* pylint: Set 80 col limits.

# 1.24, 2018-10-24, Tool improvements for supporting nightly builds.

* concat: specify subprocess args
* concat: merge redundant strict directives
* mkzip: drop unused promote_version flag
* mkzip: add support for adding/removing version timestamps
* mkzip: add flag to disable plugin/manifest rewrite
* mkzip: improve manifest handling

# 1.23, 2018-08-29, Build improvements, i18n helpers, and npm support.

* mkzip: trim empty directories.
* build: push shflags usage to leaf scripts.
* readlink: convert to python.
* get_relative_path: convert to python.
* pylint: new helper.
* concat: convert to a python script.
* build: start a common libdot.py module.
* build: disable node download logic for crosh builds for now.
* build: add support for using npm in builds.
* stack: rewrite and add tests.
* MessageManager: prefer browser translations over local ones.
* i18n: move getMessage helper here.
* i18n: move replaceReferences helper here.
* i18n: start a new file to hold i18n/l10n related funcs.
* plugin-to-platform-specific: delete unused vars.

# 1.22, 2018-06-20, Unicode 11.0.0 updates and new helpers.

* Start a dedicated README file.
* lint: Add some linting script helpers.
* concat: Improve handling of escapes with string embedding.
* lib.f.lastError: New helper.
* readlink: Fix python-3 print func handling.
* lib.CredentialCache: New cache helper.
* wcwidth: Update lookup tables to Unicode 11.0.0.
* imgcrush: New helper script for crushing images.
* mkzip: Automatically minimize translations.

# 1.21, 2018-01-05, Minor fixes.

* Fix storage write callbacks with shallow prefs.
* Add helper script for filtering NaCl plugins for distribution.
* Set charset=utf-8 in html files.

# 1.20, 2017-12-13, Features & fixes.

* refactor ranges.py for better modularity
* add sanity check for empty test selection
* parseQuery: support arrays
* run replacements on default messages too
* fix loadMessages callback
* add a lib.f.getOs helper
* add a lib.f.getChromeMilestone helper

# 1.19, 2017-10-16, Bug fixes.

* Fix message lookup on non-Chrome browsers.
* Retry storage write failures like exceeding bandwidth quotas.

# 1.18, 2017-09-12, Unicode 10.0.0 updates.

* Add Object.values and Object.entries polyfills.
* wcwidth: Merge duplicate binary search funcs.
* wcwidth: Move east asian chars into a lookup table.
* wcwidth: Update lookup tables to Unicode 10.0.0.

# 1.17, 2017-09-01, Unicode fixes and array helpers.

* Start a lib.array API for low level array/bit operations.
* Tidy up code a bit to please linters.
* lib.wc.substr now includes leading combining characters.
* lib.wc.substr fix handling of surrogate pairs.
* Use arrow functions instead of "self" references.

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
