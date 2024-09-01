// Copyright 2012 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview The connection dialog.
 * @suppress {moduleLoad}
 */

import {lib} from '../../libdot/index.js';

import {hterm} from '../../hterm/index.js';

import {cleanupChromeSockets} from '../wassh/js/sockets.js';

import {
  getSyncStorage, loadWebFonts, localize, openOptionsPage,
  registerProtocolHandler, runtimeSendMessage, sendFeedback, setupForWebApp,
} from './nassh.js';
import {ColumnList} from './nassh_column_list.js';
import {
  deleteIdentityFiles, getIdentityFileNames, getIndexeddbFileSystem,
  importIdentityFiles,
} from './nassh_fs.js';
import {
  LocalPreferenceManager, PreferenceManager,
} from './nassh_preference_manager.js';

/**
 * Constructor a new ConnectDialog instance.
 *
 * There should only be one of these, and it assumes the connect dialog is
 * the only thing in the current window.
 *
 * @constructor
 */
function ConnectDialog() {
  this.location_ = document.location;
  this.sessionStorage_ = globalThis.sessionStorage;

  // The nassh global pref manager.
  const storage = getSyncStorage();
  this.prefs_ = new PreferenceManager(storage);
  this.localPrefs_ = new LocalPreferenceManager();
  this.prefs_.readStorage().then(() => {
    this.syncProfiles_(() => {
      this.localPrefs_.readStorage().then(() => {
        this.localPrefs_.syncProfiles(this.prefs_);
        this.onPreferencesReady_();
      });
    });
  });

  // The profile we're currently displaying.
  this.currentProfileRecord_ = null;

  // The 'new' profile is special in that it doesn't have a real id or
  // prefs object until it is saved for the first time.
  this.emptyProfileRecord_ = new ConnectDialog.ProfileRecord(
      'new', null, '[New Connection]');

  // Map of id->ConnectDialog.ProfileRecord.
  this.profileMap_ = {};

  // Array of ConnectDialog.ProfileRecord instances in display order.
  this.profileList_ = [];

  // Cached DOM nodes.
  this.form_ = lib.notNull(document.querySelector('form'));
  this.moshButton_ = lib.notNull(document.querySelector('#mosh'));
  this.mountButton_ = lib.notNull(document.querySelector('#mount'));
  this.unmountButton_ = lib.notNull(document.querySelector('#unmount'));
  this.sftpClientButton_ = lib.notNull(document.querySelector('#sftp-client'));
  this.connectButton_ = lib.notNull(document.querySelector('#connect'));
  this.deleteButton_ = lib.notNull(document.querySelector('#delete'));
  this.optionsButton_ = lib.notNull(document.querySelector('#options'));
  this.feedbackButton_ = lib.notNull(document.querySelector('#feedback'));
}

/**
 * Global window startup.
 */
ConnectDialog.onWindowStartup = async function() {
  cleanupChromeSockets();
  await setupForWebApp();
  const dialog = new ConnectDialog();

  hterm.messageManager.processI18nAttributes(document);
  dialog.updateDetailPlaceholders_();
  dialog.updateDescriptionPlaceholder_();

  const sendVisible = () => {
    if (!dialog.shortcutList_) {
      setTimeout(sendVisible, 1);
      return;
    }

    // Focus the connection dialog.
    if (dialog.profileList_.length == 1) {
      // Just one profile record?  It's the "New..." profile, focus the form.
      dialog.$f('description').focus();
    } else {
      dialog.shortcutList_.focus();
    }
  };
  sendVisible();

  // Make available for debugging.
  globalThis.dialog_ = dialog;
  loadWebFonts(document);
};

globalThis.addEventListener('DOMContentLoaded', ConnectDialog.onWindowStartup);

/**
 * Called by the preference manager when we've retrieved the current preference
 * values from storage.
 */
ConnectDialog.prototype.onPreferencesReady_ = function() {
  // Create and draw the shortcut list.
  this.shortcutList_ = new ColumnList(
      lib.notNull(document.querySelector('#shortcut-list')),
      this.profileList_);

  // Install various (DOM and non-DOM) event handlers.
  this.installHandlers_();

  const lastProfileId = /** @type {string} */ (
      this.localPrefs_.get('connectDialog/lastProfileId'));
  const profileIndex = lib.f.clamp(
      this.getProfileIndex_(lastProfileId), 0, this.profileList_.length);

  // Make sure the buttons initial state is correct if we don't switch profiles
  // (which refreshes the UI for us).
  if (profileIndex === 0) {
    this.syncButtons_();
  }
  this.shortcutList_.setActiveIndex(profileIndex);
  // The shortcut list will eventually do this async, but we want it now...
  this.setCurrentProfileRecord(this.profileList_[profileIndex]);

  getIndexeddbFileSystem().then(this.onFileSystemFound_.bind(this));
};

/**
 * Simple struct to collect data about a profile.
 *
 * @this {ConnectDialog}
 * @param {string} id
 * @param {?lib.PreferenceManager} prefs
 * @param {string=} textContent
 * @constructor
 */
ConnectDialog.ProfileRecord = function(id, prefs, textContent) {
  this.id = id;
  this.prefs = prefs;
  this.textContent = textContent || prefs.get('description');
};

/**
 * Get a localized message from the Message Manager.
 *
 * This converts all message name to UPPER_AND_UNDER format, since that's
 * pretty handy in the connect dialog.
 *
 * @param {string} name The name of the message to return.
 * @return {string}
 */
ConnectDialog.prototype.msg = function(name) {
  return localize(name.toUpperCase().replace(/-/g, '_'));
};

/**
 * Install various event handlers.
 */
ConnectDialog.prototype.installHandlers_ = function() {
  /**
   * Small utility to connect DOM events.
   *
   * @param {!Element} node
   * @param {!Array<string>} events
   * @param {...function(!Event)} handlers
   */
  function addListeners(node, events, ...handlers) {
    for (const handler of handlers) {
      for (const e of events) {
        node.addEventListener(e, handler);
      }
    }
  }

  // Observe global 'profile-ids' list so we can keep the ColumnList updated.
  this.prefs_.addObservers(null, {
      'profile-ids': this.onProfileListChanged_.bind(this),
    });

  // Same for the 'description' field of all known profiles.
  for (let i = 0; i < this.profileList_.length; i++) {
    const rec = this.profileList_[i];
    if (rec.prefs) {
      rec.prefs.addObservers(null, {
       description: this.onDescriptionChanged_.bind(this),
      });
    }
  }

  // Watch for keypresses sent anywhere in this frame.
  document.addEventListener('keydown',
      /** @type {!EventListener} */ (this.onDocumentKeyDown_.bind(this)));

  // Watch for selection changes on the ColumnList so we can keep the
  // 'billboard' updated.
  this.shortcutList_.onActiveIndexChanged =
      this.onProfileIndexChanged.bind(this);

  // Register for keyboard shortcuts on the column list.
  this.shortcutList_.addEventListener('keydown',
                                      this.onShortcutListKeyDown_.bind(this));

  this.shortcutList_.addEventListener('dblclick',
                                      this.onShortcutListDblClick_.bind(this));

  this.form_.addEventListener('keyup', this.onFormKeyUp_.bind(this));

  this.connectButton_.addEventListener('keypress',
                                       this.onButtonKeypress_.bind(this));
  this.deleteButton_.addEventListener('keypress',
                                      this.onButtonKeypress_.bind(this));

  this.moshButton_.addEventListener('click',
                                    this.onMoshClick_.bind(this));
  this.mountButton_.addEventListener('click',
                                     this.onMountClick_.bind(this));
  this.unmountButton_.addEventListener('click',
                                     this.onUnmountClick_.bind(this));
  this.connectButton_.addEventListener('click',
                                       this.onConnectClick_.bind(this));
  this.sftpClientButton_.addEventListener('click',
                                          this.onSftpClientClick_.bind(this));
  this.deleteButton_.addEventListener('click',
                                      this.onDeleteClick_.bind(this));
  this.optionsButton_.addEventListener('click',
                                       this.onOptionsClick_.bind(this));
  this.feedbackButton_.addEventListener('click',
                                        this.onFeedbackClick_.bind(this));

  // These fields interact with each-other's placeholder text.
  ['description', 'username', 'hostname', 'port',
  ].forEach((name) => {
      const field = /** @type {!Element} */ (this.$f(name));

      // Alter description or detail placeholders, and commit the pref.
      addListeners(field, ['change', 'keypress', 'keyup'],
                   this.updatePlaceholders_.bind(this, name),
                   this.maybeDirty_.bind(this, name));

      addListeners(field, ['focus'],
                   this.maybeCopyPlaceholder_.bind(this, name));
    });

  this.$f('description').addEventListener(
      'blur', this.maybeCopyPlaceholders_.bind(this));

  // These fields are plain text with no fancy properties.
  ['argstr', 'terminal-profile', 'mount-path',
  ].forEach((name) => {
      addListeners(/** @type {!Element} */ (this.$f(name)),
                   ['change', 'keypress', 'keyup'],
                   this.maybeDirty_.bind(this, name));
    });

  ['description', 'username', 'hostname', 'port', 'nassh-options',
   'identity', 'argstr', 'terminal-profile', 'mount-path',
  ].forEach((name) => {
      addListeners(/** @type {!Element} */ (this.$f(name)), ['focus', 'blur'],
                   this.onFormFocusChange_.bind(this));
    });

  // Listen for DEL on the identity select box.
  this.$f('identity').addEventListener('keyup', (e) => {
      if (e.keyCode == 46 && e.target.selectedIndex != 0) {
        this.deleteIdentity_(e.target.value);
      }
    });

  this.importFileInput_ = document.querySelector('#import-file-input');
  this.importFileInput_.addEventListener(
      'change', this.onImportFiles_.bind(this));

  const importLink = document.querySelector('#import-link');
  importLink.addEventListener('click', (e) => {
      this.importFileInput_.click();
      e.preventDefault();
    });
};

/**
 * Quick way to ask for a '#field-' element from the dom.
 *
 * @param {string} name
 * @param {string=} attrName
 * @param {string=} attrValue
 * @return {!Element|string|undefined}
 */
ConnectDialog.prototype.$f = function(name, attrName, attrValue) {
  const node = document.querySelector('#field-' + name);
  if (!node) {
    throw new Error('Can\'t find: #field-' + name);
  }

  if (!attrName) {
    return node;
  }

  if (typeof attrValue == 'undefined') {
    return node.getAttribute(attrName);
  }

  node.setAttribute(attrName, attrValue);
};

/**
 * Change the active profile.
 *
 * @param {?ConnectDialog.ProfileRecord} profileRecord
 */
ConnectDialog.prototype.setCurrentProfileRecord = function(profileRecord) {
  if (!profileRecord) {
    throw new Error('null profileRecord.');
  }

  this.currentProfileRecord_ = profileRecord;
  this.syncForm_();

  // For console debugging.
  globalThis.p_ = profileRecord;
};

/**
 * Change the enabled state of one of our <div role='button'> elements.
 *
 * Since they're not real <button> tags the don't react properly to the
 * disabled property.
 *
 * @param {!Element} button
 * @param {boolean} state
 */
ConnectDialog.prototype.enableButton_ = function(button, state) {
  if (state) {
    button.removeAttribute('disabled');
    button.setAttribute('tabindex', '0');
  } else {
    button.setAttribute('disabled', 'disabled');
    button.setAttribute('tabindex', '-1');
  }
};

/**
 * Change the display state of one of our <div role='button'> elements.
 *
 * @param {!Element} button
 * @param {boolean} state
 * @param {string=} style
 */
ConnectDialog.prototype.displayButton_ = function(
    button, state, style = 'inline') {
  if (state) {
    button.style.display = style;
    button.setAttribute('tabindex', '0');
  } else {
    button.style.display = 'none';
    button.setAttribute('tabindex', '-1');
  }
};

/**
 * Change the mounted state of the mount button.
 *
 * @param {boolean} state
 */
ConnectDialog.prototype.displayMountButton_ = function(state) {
  this.displayButton_(
      lib.notNull(document.querySelector('#mount-path')),
      state,
      'revert');
  if (!state) {
    this.displayButton_(this.mountButton_, false);
    this.displayButton_(this.unmountButton_, false);
    return;
  }

  chrome.fileSystemProvider.getAll((fileSystems) => {
    for (const fs of fileSystems) {
      if (fs.fileSystemId == this.currentProfileRecord_.id) {
        this.displayButton_(this.mountButton_, false);
        this.displayButton_(this.unmountButton_, true);
        return;
      }
    }
    this.displayButton_(this.mountButton_, true);
    this.displayButton_(this.unmountButton_, false);
  });
};

/**
 * Persist the current form to prefs, even if it's invalid.
 */
ConnectDialog.prototype.save = function() {
  if (!this.$f('description').value) {
    return;
  }

  let dirtyForm = false;
  const changedFields = {};

  let prefs = this.currentProfileRecord_.prefs;

  ['description', 'username', 'hostname', 'port', 'nassh-options',
   'identity', 'argstr', 'terminal-profile', 'mount-path',
  ].forEach((name) => {
       let value = this.$f(name).value;

       // Most fields don't make sense with leading or trailing whitespace, so
       // trim them automatically.  This could cause confusion in some fields
       // like the ssh argstr.  We leave it in username since it is technically
       // valid even if most users would get confused by it.
       if (name != 'username') {
         value = value.trim();
       }

       if (name == 'port') {
         value = parseInt(value, 10);
         if (!value) {
           // If parsing failed for any reason, reset it to the default.
           value = null;
         }
       }

       if ((!prefs && !value) || (prefs && value == prefs.get(name))) {
         return;
       }

       dirtyForm = true;
       changedFields[name] = value;
     });

  if (dirtyForm) {
    if (!prefs) {
      prefs = this.prefs_.createProfile();
      this.localPrefs_.createProfile(prefs.id);
      const rec = new ConnectDialog.ProfileRecord(
          prefs.id, prefs, changedFields['description']);
      this.currentProfileRecord_ = rec;

      prefs.addObservers(null, {
       description: this.onDescriptionChanged_.bind(this),
      });

      this.shortcutList_.afterNextRedraw(() => {
        this.shortcutList_.setActiveIndex(this.profileList_.length - 1);
      });
    }

    for (const name in changedFields) {
      this.currentProfileRecord_.prefs.set(name, changedFields[name]);
    }
  }
};

/**
 * Helper for starting a connection.
 *
 * @param {string} proto The URI schema to try and register.
 */
ConnectDialog.prototype.startup_ = function(proto) {
  this.maybeCopyPlaceholders_();
  this.save();

  // Since the user has initiated this connection, register the protocol.
  registerProtocolHandler(proto);

  const id = this.currentProfileRecord_.id;
  this.localPrefs_.set('connectDialog/lastProfileId', id);

  if (this.form_.checkValidity()) {
    const uri = lib.f.getURL('/html/nassh.html');
    this.location_.replace(`${uri}?profile-id=${id}`);
  } else {
    this.form_.reportValidity();
  }
};

/**
 * Switch to mosh mode.
 */
ConnectDialog.prototype.mosh = function() {
  this.location_.replace('/plugin/mosh/mosh_client.html');
};

/**
 * Mount the selected profile.
 */
ConnectDialog.prototype.mount = function() {
  this.sessionStorage_.setItem('nassh.isMount', 'true');
  this.sessionStorage_.setItem('nassh.isSftp', 'true');
  this.startup_('ssh');
};

/**
 * Unmount the SFTP connection.
 */
ConnectDialog.prototype.unmount = function() {
  runtimeSendMessage({
    command: 'unmount', fileSystemId: this.currentProfileRecord_.id,
  })
    .then(({error, message}) => {
      if (error) {
        console.warn(message);
      }
      // Always refresh button display if internal state changed.
      this.displayMountButton_(true);
    });
};

/**
 * Start a SFTP session with the selected profile.
 */
ConnectDialog.prototype.sftpConnect = function() {
  this.sessionStorage_.setItem('nassh.isSftp', 'true');
  this.startup_('sftp');
};

/**
 * Connect to the selected profile.
 */
ConnectDialog.prototype.connect = function() {
  this.startup_('ssh');
};

/**
 * Set the profile's dirty bit if the given field has changed from it's current
 * pref value.
 *
 * @param {string} fieldName
 */
ConnectDialog.prototype.maybeDirty_ = function(fieldName) {
  if (this.currentProfileRecord_.prefs) {
    if (this.$f(fieldName).value !=
        this.currentProfileRecord_.prefs.get(fieldName)) {
      this.currentProfileRecord_.dirty = true;
    }
  } else {
    if (this.$f(fieldName).value) {
      this.currentProfileRecord_.dirty = true;
    }
  }
};

/**
 * Invoke the maybeCopyPlaceholder_ method for the fields we're willing
 * to bulk-default.
 */
ConnectDialog.prototype.maybeCopyPlaceholders_ = function() {
  ['description', 'username', 'hostname', 'port', 'nassh-options',
  ].forEach(this.maybeCopyPlaceholder_.bind(this));
  this.syncButtons_();
};

/**
 * If the field is empty and the current placeholder isn't the default,
 * then initialize the field to the placeholder.
 *
 * @param {string} fieldName
 */
ConnectDialog.prototype.maybeCopyPlaceholder_ = function(fieldName) {
  const field = this.$f(fieldName);
  const placeholder = field.getAttribute('placeholder');
  if (!field.value &&
      placeholder != this.msg(`FIELD_${fieldName}_PLACEHOLDER`)) {
    field.value = placeholder;
  }
};

/**
 * Compute the placeholder text for a given field.
 *
 * @param {string} fieldName
 */
ConnectDialog.prototype.updatePlaceholders_ = function(fieldName) {
  if (fieldName == 'description') {
    // If the description changed, update the username/host/etc placeholders.
    this.updateDetailPlaceholders_();
  } else {
    // Otherwise update the description placeholder.
    this.updateDescriptionPlaceholder_();
  }

  // In either case, the hostname might have changed, so cascade updates into
  // the nassh options.
  this.updateNasshOptionsPlaceholder_();
};

/**
 * Update the placeholders in the detail (username, hostname, etc) fields.
 */
ConnectDialog.prototype.updateDetailPlaceholders_ = function() {
  // Try to split the description up into the sub-fields.
  // This supports basic user[@hostname[:port]] strings, and the hostname match
  // is a best effort will remaining simple.
  let ary = this.$f('description').value.match(
      /^([^@]+)@([^:@\s]+)?(?:(?::)(\d+))?/);

  // Set a blank array if the match failed.
  ary = ary || [];

  // Remove element 0, the "full match" string.
  ary.shift();

  // Copy the remaining match elements into the appropriate placeholder
  // attribute.  Set the default placeholder text from this.str.placeholders
  // for any field that was not matched.
  ['username', 'hostname', 'port',
  ].forEach((name) => {
    let value = ary.shift();
    if (!value) {
      value = this.msg(`FIELD_${name}_PLACEHOLDER`);
    }

    this.$f(name, 'placeholder', value);
  });
};

/**
 * Update the nassh-options placeholder.
 */
ConnectDialog.prototype.updateNasshOptionsPlaceholder_ = function() {
  // Google-specific relay hack.  This feels dirty.  We can revert this once
  // we support managed default configs.  http://b/28205376 & related docs.
  let value = this.msg('FIELD_NASSH_OPTIONS_PLACEHOLDER');
  if (!this.$f('nassh-options').value) {
    let hostname = this.$f('hostname').value;
    if (!hostname) {
      hostname = this.$f('hostname').placeholder;
    }

    const googleHostRegexp = new RegExp(
        '\\.(' +
        'corp\\.google\\.com|' +
        'c\\.googlers\\.com|' +
        'cloud\\.googlecorp\\.com|' +
        '(internal|proxy)\\.gcpnode\\.com' +
        ')$');
    if (hostname.match(googleHostRegexp)) {
      value = '--config=google';
    }
  }
  this.$f('nassh-options', 'placeholder', value);
};

/**
 * Update the description placeholder.
 */
ConnectDialog.prototype.updateDescriptionPlaceholder_ = function() {
  const username = this.$f('username').value;
  const hostname = this.$f('hostname').value;

  let placeholder;

  if (username && hostname) {
    placeholder = username + '@' + hostname;

    const v = this.$f('port').value;
    if (v) {
      placeholder += ':' + v;
    }
  } else {
    placeholder = this.msg('FIELD_DESCRIPTION_PLACEHOLDER');
  }

  this.$f('description', 'placeholder', placeholder);
};

/**
 * Sync the form with the current profile record.
 */
ConnectDialog.prototype.syncForm_ = function() {
  ['description', 'username', 'hostname', 'port', 'argstr', 'nassh-options',
   'identity', 'terminal-profile', 'mount-path',
  ].forEach((n) => {
      const emptyValue = '';

      if (this.currentProfileRecord_.prefs) {
        this.$f(n).value =
            this.currentProfileRecord_.prefs.get(n) || emptyValue;
      } else {
        this.$f(n).value = emptyValue;
      }
    });

  // If the profile settings point to a key that no longer exists, reset it.
  if (this.$f('identity').selectedIndex == -1) {
    this.$f('identity').selectedIndex = 0;
  }

  this.updateDetailPlaceholders_();
  this.updateDescriptionPlaceholder_();
};

/**
 * Checks whether the current machine can use the File System Provider API, and
 * thus be able to be mounted.
 *
 * @return {boolean}
 */
ConnectDialog.prototype.checkMountable_ = function() {
  return chrome.fileSystemProvider !== undefined;
};

/**
 * Sync the states of the buttons.
 */
ConnectDialog.prototype.syncButtons_ = function() {
  this.enableButton_(
      this.deleteButton_,
      this.shortcutList_.activeIndex != 0);

  this.displayMountButton_(this.checkMountable_());
};

/**
 * Sync the identity dropdown box with the filesystem.
 *
 * @param {function()=} onSuccess
 * @return {!Promise}
 */
ConnectDialog.prototype.syncIdentityDropdown_ = async function(onSuccess) {
  const identitySelect = this.$f('identity');

  let selectedName;
  if (this.currentProfileRecord_.prefs) {
    selectedName = this.currentProfileRecord_.prefs.get('identity');
  } else {
    selectedName = identitySelect.value;
  }

  let keyfileNames = [];
  try {
    keyfileNames = await getIdentityFileNames(this.fileSystem_);
  } catch (e) {
    console.error('Loading keys failed', e);
  }

  // Reset the list with the current set of keys.
  while (identitySelect.firstChild) {
    identitySelect.removeChild(identitySelect.firstChild);
  }

  const option = document.createElement('option');
  option.textContent = '[default]';
  option.value = '';
  identitySelect.appendChild(option);

  keyfileNames.sort().forEach((keyfileName) => {
    const option = document.createElement('option');
    const idx = keyfileName.lastIndexOf('/');
    const key = keyfileName.substr(idx + 1);
    option.textContent = key;
    option.value = keyfileName;
    identitySelect.appendChild(option);
    if (keyfileName == selectedName) {
      identitySelect.selectedIndex = identitySelect.length - 1;
    }
  });

  this.syncForm_();

  if (onSuccess) {
    onSuccess();
  }
};

/**
 * Delete one a pair of identity files from the html5 filesystem.
 *
 * @param {string} identityName
 * @return {!Promise}
 */
ConnectDialog.prototype.deleteIdentity_ = function(identityName) {
  return deleteIdentityFiles(this.fileSystem_, identityName)
    .finally(() => this.syncIdentityDropdown_());
};

/**
 * Delete a profile.
 *
 * @param {string} deadID ID of profile to delete.
 */
ConnectDialog.prototype.deleteProfile_ = function(deadID) {
  if (this.currentProfileRecord_.id == deadID) {
    // The actual profile removal and list-updating will happen async.
    // Rather than come up with a fancy hack to update the selection when
    // it's done, we just move it before the delete.
    const currentIndex = this.shortcutList_.activeIndex;
    if (currentIndex == this.profileList_.length - 1) {
      // User is deleting the last (non-new) profile, select the one before
      // it.
      this.shortcutList_.setActiveIndex(this.profileList_.length - 2);
    } else {
      this.shortcutList_.setActiveIndex(currentIndex + 1);
    }
  }

  this.prefs_.removeProfile(deadID);
};

/**
 * Return the index into this.profileList_ for a given profile id.
 *
 * @param {string} id
 * @return {number} -1 if the id is not found.
 */
ConnectDialog.prototype.getProfileIndex_ = function(id) {
  for (let i = 0; i < this.profileList_.length; i++) {
    if (this.profileList_[i].id == id) {
      return i;
    }
  }

  return -1;
};

/**
 * Sync the ColumnList with the known profiles.
 *
 * @param {function()=} callback
 */
ConnectDialog.prototype.syncProfiles_ = function(callback) {
  const ids = this.prefs_.get('profile-ids');

  this.profileList_.length = 0;
  let currentProfileExists = false;
  let emptyProfileExists = false;

  const deadProfiles = Object.keys(this.profileMap_);

  for (let i = 0; i < ids.length; i++) {
    const id = ids[i];
    let p;

    if (this.currentProfileRecord_ && id == this.currentProfileRecord_.id) {
      currentProfileExists = true;
    }

    if (id == this.emptyProfileRecord_.id) {
      emptyProfileExists = true;
      p = this.emptyProfileRecord_;
    } else {
      p = this.profileMap_[id];
    }

    deadProfiles.splice(deadProfiles.indexOf(id), 1);

    if (!p) {
      p = this.profileMap_[id] = new ConnectDialog.ProfileRecord(
          id, this.prefs_.getProfile(id));
    } else if (p.prefs) {
      p.textContent = p.prefs.get('description');
    }

    this.profileList_.push(p);
  }

  for (let i = 0; i < deadProfiles.length; i++) {
    delete this.profileMap_[deadProfiles[i]];
  }

  if (!currentProfileExists) {
    this.setCurrentProfileRecord(this.emptyProfileRecord_);
  }

  if (!emptyProfileExists) {
    this.profileList_.unshift(this.emptyProfileRecord_);
    this.profileMap_[this.emptyProfileRecord_.id] = this.emptyProfileRecord_;
  }

  if (this.profileList_.length == 1) {
    if (callback) {
      callback();
    }
  }

  // Start at 1 for the "[New Connection]" profile.
  let initialized = 1;

  const onRead = function(profile) {
    profile.textContent = profile.prefs.get('description');

    if ((++initialized == this.profileList_.length) && callback) {
      callback();
    }
  };

  this.profileList_.forEach((profile) => {
    if (profile.prefs) {
      profile.prefs.readStorage().then(onRead.bind(this, profile));
    }
  });
};

/**
 * Success callback for getIndexeddbFileSystem().
 *
 * Kick off the "Identity" dropdown now that we have access to the filesystem.
 *
 * @param {!IndexeddbFs} fileSystem
 */
ConnectDialog.prototype.onFileSystemFound_ = function(fileSystem) {
  this.fileSystem_ = fileSystem;
  this.syncIdentityDropdown_();
};

/**
 * User initiated file import.
 *
 * This is the onChange handler for the `input type="file"`
 * (aka this.importFileInput_) control.
 *
 * @param {!Event} e
 * @return {boolean}
 */
ConnectDialog.prototype.onImportFiles_ = function(e) {
  const input = this.importFileInput_;

  // Resolve all the imports before syncing the UI.
  importIdentityFiles(this.fileSystem_, input.files)
    .finally(() => {
      // If the import doesn't fully work (skip files/etc...), reset the UI
      // back to whatever the user has currently selected.
      const select = this.$f('identity');
      const selectedIndex = select.selectedIndex;

      this.syncIdentityDropdown_(() => {
        // Walk all the files the user imported and pick the first valid match.
        for (let i = 0; i < input.files.length; ++i) {
          select.value = input.files[i].name;
          if (select.selectedIndex != -1) {
            this.save();
            break;
          }
        }

        // Couldn't find anything, so restore the previous value.
        if (select.selectedIndex == -1) {
          select.selectedIndex = selectedIndex;
        }

        // Clear the files list so the next import always works.
        input.value = '';
      });
    });

  return false;
};

/**
 * Keydown event anywhere in this frame.
 *
 * @param {!KeyboardEvent} e The user keydown event to process.
 * @return {boolean} Whether to keep processing the event.
 */
ConnectDialog.prototype.onDocumentKeyDown_ = function(e) {
  const key = String.fromCharCode(e.keyCode);
  const lowerKey = key.toLowerCase();
  let cancel = false;

  // Swallow common shortcuts that don't make sense in this app.
  switch (lowerKey) {
    // Shortcuts where we kill both the non-shift and shift variants.
    case 'n':  // New window (!shift) and new incognito window (shift).
    case 'p':  // Chrome print (!shift) and OS print (shift).
    case 'o':  // Open (!shift) and bookmark manager (shift).
    case 't':  // New tab (!shift) and new incognito tab (shift).
      // macOS puts these shortcuts behind the command (meta) key.
      if (((hterm.os !== 'mac' && e.ctrlKey && !e.metaKey) ||
           (hterm.os === 'mac' && !e.ctrlKey && e.metaKey)) &&
          !e.altKey) {
        cancel = true;
      }
      break;

    // Shortcuts where we only kill non-shift variants (and allow shift).
    case 'j':  // Downloads.
    case 'h':  // History.
    case 's':  // Save.
    case 'u':  // View source.
      // These are the shortcuts on most platforms, but not macOS.  Since the
      // macOS versions are much more complicated, don't bother trying to block
      // them as it's much less likely they pressed them by accident.
      if (hterm.os !== 'mac' && e.ctrlKey &&
          !e.altKey && !e.metaKey && !e.shiftKey) {
        cancel = true;
      }
      break;
  }

  if (cancel) {
    e.preventDefault();
    e.stopPropagation();
    return false;
  }

  return true;
};

/**
 * Keydown event on the shortcut list.
 *
 * @param {!Event} e
 */
ConnectDialog.prototype.onShortcutListKeyDown_ = function(e) {
  const isNewConnection =
      this.currentProfileRecord_ == this.emptyProfileRecord_;
  if (e.keyCode == 46) {
    // DEL delete the profile.
    if (!isNewConnection) {
      this.deleteProfile_(this.currentProfileRecord_.id);
    } else {
      // Otherwise the user is deleting the placeholder profile.  All we
      // do here is reset the form.
      this.syncForm_();
      this.$f('description').focus();
    }

  } else if (e.keyCode == 13) {
    if (isNewConnection) {
      this.$f('description').focus();
    } else {
      this.onConnectClick_();
    }
  }
};

/** @param {!Event} e */
ConnectDialog.prototype.onShortcutListDblClick_ = function(e) {
  this.onConnectClick_();
};

/**
 * Called when the ColumnList says the active profile changed.
 *
 * @param {!ColumnList.ActiveIndexChangedEvent} e
 */
ConnectDialog.prototype.onProfileIndexChanged = function(e) {
  this.setCurrentProfileRecord(this.profileList_[e.now]);
  this.syncButtons_();
};

/**
 * Key press while a button has focus.
 *
 * @param {!Event} e
 */
ConnectDialog.prototype.onButtonKeypress_ = function(e) {
  if (e.charCode == 13 || e.charCode == 32) {
    e.srcElement.click();
  }
};

/**
 * Someone clicked on the mosh button.
 */
ConnectDialog.prototype.onMoshClick_ = function() {
  this.mosh();
};

/**
 * Someone clicked on the mount button.
 */
ConnectDialog.prototype.onMountClick_ = function() {
  this.mount();
};

/**
 * Someone clicked on the unmount button.
 */
ConnectDialog.prototype.onUnmountClick_ = function() {
  this.unmount();
};

/**
 * Someone clicked on the connect button.
 */
ConnectDialog.prototype.onConnectClick_ = function() {
  if (this.connectButton_.getAttribute('disabled')) {
    return;
  }

  this.connect();
};

/**
 * Someone clicked on the sftp client button.
 *
 * @param {!Event} e
 */
ConnectDialog.prototype.onSftpClientClick_ = function(e) {
  if (this.sftpClientButton_.getAttribute('disabled')) {
    return;
  }

  this.sftpConnect();
};

/**
 * Someone clicked on the delete button.
 *
 * @param {!Event} e
 */
ConnectDialog.prototype.onDeleteClick_ = function(e) {
  if (this.deleteButton_.getAttribute('disabled')) {
    return;
  }

  if (document.activeElement.getAttribute('id') == 'field-identity') {
    this.deleteIdentity_(e.target.value);
  } else {
    this.deleteProfile_(this.currentProfileRecord_.id);
    this.shortcutList_.focus();
  }
};

/**
 * Someone clicked on the options button.
 */
ConnectDialog.prototype.onOptionsClick_ = function() {
  openOptionsPage();
};

/**
 * Someone clicked on the feedback button.
 */
ConnectDialog.prototype.onFeedbackClick_ = sendFeedback;

/**
 * KeyUp on the form element.
 *
 * @param {!Event} e
 */
ConnectDialog.prototype.onFormKeyUp_ = function(e) {
  if (e.keyCode == 13) {  // ENTER
    this.connect();
  } else if (e.keyCode == 27) {  // ESC
    this.syncForm_();
    this.shortcutList_.focus();
  }
};

/**
 * Focus change on the form element.
 *
 * This handler is registered to every form element's focus and blur events.
 * Keep in mind that for change in focus from one input to another will invoke
 * this twice.
 *
 * @param {!Event} e
 */
ConnectDialog.prototype.onFormFocusChange_ = function(e) {
  this.syncButtons_();
  this.save();
};

/**
 * Pref callback invoked when the global 'profile-ids' changed.
 */
ConnectDialog.prototype.onProfileListChanged_ = function() {
  this.syncProfiles_(() => this.shortcutList_.redraw());
};

/**
 * Pref callback invoked when a profile's description has changed.
 *
 * @param {*} value
 * @param {string} name
 * @param {!Object} prefs
 */
ConnectDialog.prototype.onDescriptionChanged_ = function(value, name, prefs) {
  if (this.profileMap_[prefs.id]) {
    this.profileMap_[prefs.id].textContent = value;
    this.shortcutList_.scheduleRedraw();
  }
};
