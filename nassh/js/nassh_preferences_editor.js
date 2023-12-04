// Copyright 2012 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import {lib} from '../../libdot/index.js';

import {hterm} from '../../hterm/index.js';

import {
  getManifest, getSyncStorage, loadWebFonts, localize,
  runtimeSendMessage, sendFeedback, setupForWebApp,
} from './nassh.js';

/**
 * CSP means that we can't kick off the initialization from the html file,
 * so we do it like this instead.
 */
globalThis.addEventListener('DOMContentLoaded', async (event) => {
  await setupForWebApp();

  // Support multiple settings subpages.
  document.querySelectorAll('.navigation > .menu > li > a').forEach((ele) => {
    ele.addEventListener('click', PreferencesEditor.onSettingsPageClick);
  });

  function setupPreferences() {
    const manifest = getManifest();
    const storage = getSyncStorage();

    const params = new URLSearchParams(globalThis.location.search);
    const profileId = params.get('profileId') ??
        localize('FIELD_TERMINAL_PROFILE_PLACEHOLDER');

    // Create a local hterm instance so people can see their changes live.
    const term = new hterm.Terminal({profileId, storage});
    term.onTerminalReady = function() {
        loadWebFonts(term.getDocument());
        const io = term.io.push();
        io.onVTKeystroke = io.print;
        io.sendString = io.print;
        io.println('# ' + localize('WELCOME_VERSION',
                                    [manifest.name, manifest.version]));
        io.print('$ ./configure && make && make install');
        term.setCursorVisible(true);
      };
    term.decorate(lib.notNull(document.querySelector('#terminal')));
    term.installKeyboard();
    term.contextMenu.setItems([
      {name: localize('TERMINAL_CLEAR_MENU_LABEL'),
       action: function() { term.wipeContents(); }},
      {name: localize('TERMINAL_RESET_MENU_LABEL'),
       action: function() { term.reset(); }},
    ]);

    // Useful for console debugging.
    globalThis.term_ = term;

    const prefsEditor = new PreferencesEditor(storage, profileId);

    let a = document.querySelector('#backup');
    a.download = localize('PREF_BACKUP_FILENAME');
    a.onclick = prefsEditor.onBackupClick.bind(prefsEditor);
    prefsEditor.updateBackupLink();

    a = document.querySelector('#restore');
    a.onclick = prefsEditor.onRestoreClick.bind(prefsEditor);

    a = document.querySelector('#feedback');
    a.onclick = prefsEditor.onFeedbackClick.bind(prefsEditor);

    // Set up labels.
    document.querySelector('#manifest-name').textContent = manifest.name;
    hterm.messageManager.processI18nAttributes(document);

    // Set up icon on the left side.
    // Start with 128px, but if it's not available, scale the highest available.
    const icon = document.getElementById('icon');
    let size = '128';
    icon.style.width = `${size}px`;
    if (!manifest.icons.hasOwnProperty(size)) {
      // Sort the keys in descending numeric order.
      const keys = Object.keys(manifest.icons).map((x) => parseInt(x, 10)).sort(
          (a, b) => a < b ? 1 : -1);
      size = keys[0];
    }
    icon.src = lib.f.getURL(`${manifest.icons[size]}`);

    // Set up reset button.
    document.getElementById('reset').onclick = function() {
        prefsEditor.resetAll();
      };

    // Set up profile selection field.
    const profile = lib.notNull(document.getElementById('profile'));
    profile.oninput = function() {
        PreferencesEditor.debounce(profile, function(input) {
            prefsEditor.notify(localize('LOADING_LABEL'), 500);
            if (input.value.length) {
              prefsEditor.selectProfile(input.value);
            }
          });
      };
    profile.value = profileId;

    // Allow people to reset individual fields by pressing escape.
    document.onkeyup = function(e) {
        if (document.activeElement.name == 'settings' && e.keyCode == 27) {
          prefsEditor.reset(document.activeElement);
        }
      };

    // If the user wants a specific page, navigate to it now.
    const page = globalThis.location.hash;
    if (page) {
      PreferencesEditor.switchSettingsPage(page.substr(1));
    }
  }

  setupPreferences();
});

/**
 * Class for editing hterm profiles.
 *
 * @param {!lib.Storage} storage Where to store preferences.
 * @param {string=} profileId Profile name to read settings from.
 * @constructor
 */
function PreferencesEditor(
    storage, profileId = hterm.Terminal.DEFAULT_PROFILE_ID) {
  this.storage_ = storage;
  this.selectProfile(profileId);
}

/**
 * Helper for switching between settings panes.
 *
 * @param {string} page The new page to display.
 */
PreferencesEditor.switchSettingsPage = function(page) {
  const scrollTo = () => {
    const header = document.querySelector('.mainview > .selected > header');
    const anchor = document.querySelector(`a[name="${page}"]`);
    document.scrollingElement.scrollTo(
        0, anchor ? anchor.offsetTop - header.clientHeight : 0);
  };

  const hash = `#${page.split('_')[0]}`;
  const selected = 'selected';

  // Make sure it's a valid/known menu.
  const currMenuLink = document.querySelector(`.menu a[href="${hash}"]`);
  if (!currMenuLink) {
    console.warn(`Settings page "${page}" is unknown`);
    return;
  }

  // If clicking the same page, don't hide/show it to avoid flashing.
  const oldMenu = document.querySelector('.menu > li.selected');
  const newMenu = currMenuLink.parentNode;
  if (oldMenu === newMenu) {
    scrollTo();
    return;
  }

  // Deselect the current settings section & hide the content.
  oldMenu.classList.remove(selected);
  const oldSection = document.querySelector('.mainview > .selected');
  oldSection.classList.remove(selected);
  oldSection.style.display = 'none';

  // Select the new settings section & show the content.
  newMenu.classList.add(selected);
  const newSection = document.querySelector(hash);
  // Delay the selection to help with the fancy UI transition.
  setTimeout(() => {
    newSection.classList.add(selected);
    scrollTo();
  }, 0);
  newSection.style.display = 'block';
};

/**
 * Helper for switching between settings panes.
 *
 * @param {!Event} e The event triggering the switch.
 */
PreferencesEditor.onSettingsPageClick = function(e) {
  e.preventDefault();
  const url = new URL(e.currentTarget.href);
  PreferencesEditor.switchSettingsPage(url.hash.substr(1));
};

/**
 * Debounce action on input element.
 *
 * This way people can type up a setting before seeing an update.
 * Useful with settings such as font names or sizes.
 *
 * @param {!Element} input An HTML input element to pass down to
 *     callback.
 * @param {function(!Element)} callback Function to call after
 *     debouncing while passing it the input object.
 * @param {number=} timeout Optional how long to debounce.
 */
PreferencesEditor.debounce = function(input, callback, timeout = 500) {
  clearTimeout(input.timeout);
  input.timeout = setTimeout(function() {
      callback(input);
      input.timeout = null;
    }, timeout);
};

/**
 * Select a profile for editing.
 *
 * This will load the settings and update the HTML display.
 *
 * @param {string} profileId The profile name to read settings from.
 */
PreferencesEditor.prototype.selectProfile = function(profileId) {
  globalThis.term_.setProfile(profileId);
  const prefs = new hterm.PreferenceManager(this.storage_, profileId);
  this.prefs_ = prefs;
  prefs.readStorage().then(() => {
    prefs.notifyAll();
    this.syncPage();
  });
};

/**
 * Attached to the onclick handler of the "Send Feedback" link.
 *
 * @param {?Event} e
 */
PreferencesEditor.prototype.onFeedbackClick = function(e) {
  sendFeedback();

  e.preventDefault();
};

/**
 * Attached to the onclick handler of the "Save Backup" link.
 *
 * A click generated by the user causes us to update the href attribute of this
 * anchor tag.  This happens asynchronously because we have to read prefs from
 * chrome.storage.sync (via the PreferenceManager.)  We cancel the user's
 * original click but generate a synthetic click once the preferences are known
 * to us.
 *
 * @param {?Event} e
 */
PreferencesEditor.prototype.onBackupClick = async function(e) {
  // If we generated this event, just let it happen.
  if (!e || e.synthetic) {
    return;
  }

  e.preventDefault();

  await this.updateBackupLink();
  const event = new MouseEvent(e.type, e);
  event.synthetic = true;
  e.target.dispatchEvent(event);
};

/**
 * Attached to the onclick handler of the "Restore Backup" link.
 *
 * This presents a file chooser dialog to let the user select an appropriate
 * backup to restore.  Invalid backups fail silently.  Successful restores
 * cause the page to reload with the restored preference values.  Any open
 * nassh windows should immediately reflect the new preference values.
 *
 * @param {?Event} e
 */
PreferencesEditor.prototype.onRestoreClick = function(e) {
  if (e) {
    e.preventDefault();
  }
  const input = document.querySelector('input.restore');
  input.onchange = async () => {
    if (input.files.length != 1) {
      return;
    }

    const prefs = await input.files[0].text();
    await runtimeSendMessage({
      command: 'prefsImport',
      asJson: true,
      prefs: prefs,
    });
    globalThis.location.reload();
  };

  input.click();
};

/**
 * Update the backup link content.
 */
PreferencesEditor.prototype.updateBackupLink = async function() {
  const a = document.querySelector('#backup');
  if (a.href.startsWith('blob:')) {
    // Revoke any previous URLs created from these blobs.
    URL.revokeObjectURL(a.href);
  }

  const result = await runtimeSendMessage({
    command: 'prefsExport',
    asJson: true,
  });
  const blob = new Blob([result.prefs], {type: 'text/json'});
  a.href = URL.createObjectURL(blob);
};

/**
 * Save the HTML color state to the preferences.
 *
 * Since the HTML5 color picker does not support alpha, we have to split
 * the rgb and alpha information across two input objects.
 *
 * @param {string} key The HTML input.id to use to locate the color input
 *     object.  By appending ':alpha' to the key name, we can also locate
 *     the range input object.
 */
PreferencesEditor.prototype.colorSave = function(key) {
  const cinput = document.getElementById(key);
  const ainput = document.getElementById(key + ':alpha');
  const rgb = lib.colors.hexToRGB(cinput.value);
  this.prefs_.set(key, lib.colors.setAlpha(
      lib.notNull(rgb), ainput.value / 100));
};

/**
 * Save the HTML state to the preferences.
 *
 * @param {!Element} input An HTML input element to update the corresponding
 *     preferences key.  Uses input.id to locate relevant preference.
 */
PreferencesEditor.prototype.save = function(input) {
  // Skip ones we don't yet handle.
  if (input.disabled) {
    return;
  }

  const keys = input.id.split(':');
  const key = keys[0];
  const prefs = this.prefs_;

  switch (this.getPreferenceType(key)) {
    case 'bool':
      prefs.set(key, input.checked);
      break;

    case 'int':
      prefs.set(key, input.value);
      break;

    case 'enum':
      prefs.set(key, JSON.parse(input.value));
      break;

    case 'tristate':
      prefs.set(key, JSON.parse(input.value));
      break;

    case 'string':
    case 'multiline-string':
      prefs.set(key, input.value);
      break;

    case 'color':
      this.colorSave(key);
      break;

    case 'url':
      prefs.set(key, input.value);
      break;

    case 'value':
    default: {
      let value = input.value || 'null';
      try {
        value = JSON.parse(value);
      } catch (err) {
        this.notify(localize('JSON_PARSE_ERROR', [key, err]), 5000);
        value = prefs.get(key);
      }
      prefs.set(key, value);
      break;
    }
  }

  console.log('New pref value for ' + key + ': ', prefs.get(key));
  this.updateBackupLink();
};

/**
 * Sync the preferences state to the HTML color objects.
 *
 * @param {string} key The HTML input.id to use to locate the color input
 *     object.  By appending ':alpha' to the key name, we can also locate
 *     the range input object.
 * @param {string} pref The preference object to get the current state from.
 * @return {?string} The rgba color information.
 */
PreferencesEditor.prototype.colorSync = function(key, pref) {
  const cinput = lib.notNull(document.getElementById(key));
  const ainput = lib.notNull(document.getElementById(key + ':alpha'));

  const rgba = lib.colors.normalizeCSS(pref);

  if (rgba) {
    const ary = lib.colors.crackRGB(rgba);
    cinput.value = lib.colors.rgbToHex(lib.colors.arrayToRGBA(ary.slice(0, 3)));
    ainput.value = parseFloat(ary[3]) * 100;
  } else {
    // If pref could not be normalized, then reset.
    this.reset(cinput);
    this.reset(ainput);
  }

  return rgba;
};

/**
 * Sync the preferences state to the HTML object.
 *
 * @param {!Element} input An HTML input element to update the
 *     corresponding preferences key.  Uses input.id to locate relevant
 *     preference.
 */
PreferencesEditor.prototype.sync = function(input) {
  const keys = input.id.split(':');
  const key = keys[0];
  const prefValue = this.prefs_.get(key);
  switch (this.getPreferenceType(key)) {
    case 'bool':
      input.checked = prefValue;
      break;

    case 'int':
      input.value = prefValue;
      break;

    case 'enum':
      input.value = JSON.stringify(prefValue);
      break;

    case 'tristate':
      input.value = JSON.stringify(prefValue);
      break;

    case 'string':
    case 'multiline-string':
      if (prefValue == null) {
        input.value = '';
      } else {
        input.value = prefValue;
      }
      break;

    case 'color':
      this.colorSync(key, prefValue);
      break;

    case 'url':
      if (prefValue == null) {
        input.value = '';
      } else {
        input.value = prefValue;
      }
      break;

    case 'value':
    default:
      // Use an indent for the stringify so the output is formatted somewhat
      // nicely.  Otherwise, the default output packs everything into a single
      // line and strips out all whitespace making it an unreadable mess.
      if (prefValue == null) {
        input.value = '';
      } else {
        // Replace raw DEL characters with Unicode escapes.  We expect the
        // conversion later on when saving the value will turn it back into
        // the DEL character.  This is because Chrome will insert an actual
        // DEL character into the text field which tends to be invisible.
        input.value = JSON.stringify(prefValue, null, '  ').replace(
            '\x7f', '\\u007f');
      }
      break;
  }
};

/**
 * Update preferences from HTML input objects when the input changes.
 *
 * This is a helper that should be used in an event handler (e.g. onchange).
 * Should work with any input type.
 *
 * @param {!Element} input An HTML input element to update from.
 */
PreferencesEditor.prototype.onInputChange = function(input) {
  this.save(input);
  this.sync(input);
};

/**
 * Update the preferences page to reflect current preference object.
 *
 * Will basically rewrite the displayed HTML code on the fly.
 */
PreferencesEditor.prototype.syncPage = function() {
  const menu = document.getElementById('options-settings-menu');
  const eles = document.getElementById('settings');

  /** @param {?Element} parent The node to clear out. */
  const deleteChildren = (parent) => {
    while (parent.hasChildNodes()) {
      parent.removeChild(parent.firstChild);
    }
  };

  // Clear out previously generated nodes.
  deleteChildren(menu);
  deleteChildren(eles);

  // Create the table of settings.
  for (let i = 0; i < hterm.PreferenceManager.categoryDefinitions.length; i++) {
    const categoryDefinition = hterm.PreferenceManager.categoryDefinitions[i];

    const elem = this.addCategoryRow(categoryDefinition, eles, menu);

    const category = categoryDefinition.id;
    for (const key in this.prefs_.prefRecords_) {
      if (this.getPreferenceCategory(key) == category) {
        this.addInputRow(key, elem);
      }
    }
  }
};

/**
 * Add a series of HTML elements to allow inputting the value of the given
 * preference option.
 *
 * @param {!Object} categoryDef The hterm preference category object.
 * @param {?Element} parent The node to attach the new category to.
 * @param {?Element} menu The menu to add linkage to.
 * @return {!Element} The new category section.
 */
PreferencesEditor.prototype.addCategoryRow =
    function(categoryDef, parent, menu) {
  const details = document.createElement('section');
  details.className = 'category-details';

  const anchor = document.createElement('a');
  anchor.name = `options_${categoryDef.id}`;
  details.appendChild(anchor);

  const desc = this.getCategoryDescription(categoryDef);

  const summary = document.createElement('h3');
  summary.innerText = desc;

  details.appendChild(summary);
  parent.appendChild(details);

  // Generate the menu sidebar link.
  const li = document.createElement('li');
  const a = document.createElement('a');
  a.textContent = desc;
  a.href = `#${anchor.name}`;
  a.addEventListener('click', PreferencesEditor.onSettingsPageClick);
  li.appendChild(a);
  menu.appendChild(li);

  return details;
};

/**
 * Add a series of HTML elements to allow inputting the value of the given
 * preference option.
 *
 * @param {string} key
 * @param {!Element} parent
 */
PreferencesEditor.prototype.addInputRow = function(key, parent) {
  const input = this.createInput(key);

  // We want this element structure when we're done:
  // <div class='text'>
  //  <label>
  //    <span class='setting-label'>this-preference-setting-name</span>
  //    <span class='setting-ui'>
  //      <input ...>
  //    </span>
  //  </label>
  // </div>
  const div = document.createElement('div');
  const label = document.createElement('label');
  const span_text = document.createElement('span');
  const span_input = document.createElement('span');

  label.title = this.getPreferenceDescription(key);
  label.setAttribute('tabindex', '0');
  label.className = 'hflex';
  div.className = 'setting-container ' + input.type;
  span_text.className = 'setting-label';
  span_text.innerText = this.getPreferenceName(key);
  span_input.className = 'setting-ui';

  div.appendChild(label);
  span_input.appendChild(input);
  label.appendChild(span_text);
  label.appendChild(span_input);
  parent.appendChild(div);

  if (input.type == 'color') {
    const alabel = document.createElement('label');
    alabel.innerText = 'Alpha';
    alabel.className = 'alpha-text';
    alabel.setAttribute('tabindex', '0');
    span_input.appendChild(alabel);

    // Since the HTML5 color picker does not support alpha,
    // we have to create a dedicated slider for it.
    const ainput = document.createElement('input');
    ainput.type = 'range';
    ainput.id = key + ':alpha';
    ainput.min = '0';
    ainput.max = '100';
    ainput.name = 'settings';
    ainput.onchange = input.onchange;
    ainput.oninput = input.oninput;
    span_input.appendChild(ainput);
  }

  this.sync(input);
};

/**
 * @param {string} key
 * @return {!Element}
 */
PreferencesEditor.prototype.createInput = function(key) {
  const onchangeCursorReset = (event) => {
    PreferencesEditor.debounce(event.target, (input) => {
      // Chrome has a bug where it resets cursor position on us when
      // we debounce the input.  So manually save & restore cursor.
      const i = input.selectionStart;
      this.onInputChange(input);
      if (document.activeElement === input) {
        input.setSelectionRange(i, i);
      }
    });
  };
  let onchange = (event) => {
    PreferencesEditor.debounce(event.target, (input) => {
      this.onInputChange(input);
    });
  };
  let oninput = null;

  const addOption = (parent, value) => {
    const option = document.createElement('option');
    option.value = JSON.stringify(value);
    option.innerText = (value === null ? 'auto' : value);
    parent.appendChild(option);
  };

  let input = document.createElement('input');
  switch (this.getPreferenceType(key)) {
    case 'bool':
      input.type = 'checkbox';
      break;

    case 'int':
      input.type = 'number';
      break;

    case 'enum': {
      input = document.createElement('select');
      const prefValues = this.getPreferenceEnumValues(key);
      for (let i = 0; i < prefValues.length; i++) {
        addOption(input, prefValues[i]);
      }
      oninput = onchange;
      onchange = null;
      break;
    }

    case 'tristate':
      input = document.createElement('select');
      [null, true, false].forEach(function(value) {
        addOption(input, value);
      });
      oninput = onchange;
      onchange = null;
      break;

    case 'string':
      input.type = 'text';
      input.size = 50;
      // Save simple strings immediately.
      oninput = onchangeCursorReset;
      onchange = null;
      break;

    case 'multiline-string':
      input = document.createElement('textarea');
      input.setAttribute('autocomplete', 'off');
      input.setAttribute('spellcheck', 'false');
      // Save simple strings immediately.
      oninput = onchangeCursorReset;
      onchange = null;
      break;

    case 'color':
      input.type = 'color';
      break;

    case 'url':
      input.type = 'url';
      input.size = 50;
      input.placeholder = 'https://example.com/some/file';
      break;

    case 'value':
    default:
      // We'll use JSON to go between object/user text.
      input = document.createElement('textarea');
      input.setAttribute('autocomplete', 'off');
      input.setAttribute('spellcheck', 'false');
      input.data = 'JSON';
      onchange = onchangeCursorReset;
      break;
  }

  input.name = 'settings';
  input.id = key;
  input.onchange = onchange;
  input.oninput = oninput;

  return input;
};

/**
 * @param {string} key
 * @return {string}
 */
PreferencesEditor.prototype.getPreferenceDescription = function(key) {
  const entry = hterm.PreferenceManager.defaultPreferences[key];
  if (entry === undefined) {
    return '';
  }

  const id = 'PREF_' + key.replace(/-/g, '_').toUpperCase();
  return hterm.msg(id, [], entry['help']);
};

/**
 * Get the translated hterm preference name.
 *
 * @param {string} key The hterm preference category object.
 * @return {string} The translated category text.
 */
PreferencesEditor.prototype.getPreferenceName = function(key) {
  const entry = hterm.PreferenceManager.defaultPreferences[key];
  if (entry === undefined) {
    return '';
  }

  const id = 'NAME_PREF_' + key.replace(/-/g, '_').toUpperCase();
  return hterm.msg(id, [], entry['name'] || key);
};

/**
 * Get the translated hterm category.
 *
 * @param {!Object} def The hterm preference category object.
 * @return {string} The translated category text.
 */
PreferencesEditor.prototype.getCategoryDescription = function(def) {
  const id = `TITLE_PREF_${def.id.toUpperCase()}`;
  return hterm.msg(id, [], def.text);
};

/**
 * @param {string} key
 * @return {string}
 */
PreferencesEditor.prototype.getPreferenceType = function(key) {
  const entry = hterm.PreferenceManager.defaultPreferences[key];
  if (entry) {
    const prefType = entry['type'];
    if (Array.isArray(prefType)) {
      return 'enum';
    }
    return prefType;
  }

  switch (typeof this.prefs_.get(key)) {
    case 'boolean': return 'bool';
    case 'string': return 'string';
    case 'object': return 'value';
    case 'number': return 'int';
    default: return 'value';
  }
};

/**
 * @param {string} key
 * @return {!Array<string>}
 */
PreferencesEditor.prototype.getPreferenceEnumValues = function(key) {
  const entry = hterm.PreferenceManager.defaultPreferences[key];
  if (entry) {
    const prefType = entry['type'];
    if (Array.isArray(prefType)) {
      return prefType;
    }
  }

  console.warn('Pref. is not an enum', key);
  return [];
};

/**
 * @param {string} key
 * @return {string}
 */
PreferencesEditor.prototype.getPreferenceCategory = function(key) {
  const entry = hterm.PreferenceManager.defaultPreferences[key];
  if (entry) {
    return entry['category'];
  }

  return hterm.PreferenceManager.Categories.Miscellaneous;
};

/**
 * Reset all preferences to their default state and update the HTML objects.
 */
PreferencesEditor.prototype.resetAll = function() {
  const settings = document.getElementsByName('settings');

  this.prefs_.resetAll();
  for (let i = 0; i < settings.length; ++i) {
    this.sync(settings[i]);
  }
  this.notify(localize('PREFERENCES_RESET'));
};

/**
 * Reset specified preference to its default state.
 *
 * @param {!Element} input An HTML input element to reset.
 */
PreferencesEditor.prototype.reset = function(input) {
  const keys = input.id.split(':');
  const key = keys[0];
  this.prefs_.reset(key);
  this.sync(input);
};

/**
 * Display a message to the user.
 *
 * @param {string} msg The string to show to the user.
 * @param {number=} timeout Optional how long to show the message.
 */
PreferencesEditor.prototype.notify = function(msg, timeout = 1000) {
  // Update status to let user know options were updated.
  clearTimeout(this.notifyTimeout_);
  const status = document.getElementById('label_status');
  status.innerText = msg;
  this.notifyTimeout_ = setTimeout(function() {
      status.innerText = '\u00A0';
    }, timeout);
};
