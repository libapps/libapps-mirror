// Copyright (c) 2012 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

'use strict';

/**
 * Constructor a new ConnectDialog instance.
 *
 * There should only be one of these, and it assumes the connect dialog is
 * the only thing in the current window.
 *
 * @param {MessagePort} messagePort The HTML5 message port we should use to
 *     communicate with the nassh instance.
 */
nassh.ConnectDialog = function(messagePort) {

  // Message port back to the terminal.
  this.messagePort_ = messagePort;
  this.messagePort_.onmessage = this.onMessage_.bind(this);
  this.messagePort_.start();

  // Turn off spellcheck everywhere.
  var ary = document.querySelectorAll('input[type="text"]');
  for (var i = 0; i < ary.length; i++) {
    ary[i].setAttribute('spellcheck', 'false');
  }

  // The Message Manager instance, null until the messages have loaded.
  this.mm_ = null;

  // The nassh global pref manager.
  this.prefs_ = new nassh.PreferenceManager();
  this.prefs_.readStorage(() => {
    this.syncProfiles_(this.onPreferencesReady_.bind(this));
  });

  // The profile we're currently displaying.
  this.currentProfileRecord_ = null;

  // The 'new' profile is special in that it doesn't have a real id or
  // prefs object until it is saved for the first time.
  this.emptyProfileRecord_ = new nassh.ConnectDialog.ProfileRecord(
      'new', null, '[New Connection]');

  // Map of id->nassh.ConnectDialog.ProfileRecord.
  this.profileMap_ = {};

  // Array of nassh.ConnectDialog.ProfileRecord instances in display order.
  this.profileList_ = [];

  // Cached DOM nodes.
  this.form_ = document.querySelector('form');
  this.mountButton_ = document.querySelector('#mount');
  this.unmountButton_ = document.querySelector('#unmount');
  this.sftpClientButton_ = document.querySelector('#sftp-client');
  this.connectButton_ = document.querySelector('#connect');
  this.deleteButton_ = document.querySelector('#delete');
  this.optionsButton_ = document.querySelector('#options');
};

/**
 * Global window message handler, uninstalled after proper handshake.
 */
nassh.ConnectDialog.onWindowMessage = function(e) {
  if (e.data.name != 'ipc-init') {
    console.warn('Unknown message from terminal:', e.data);
    return;
  }

  window.removeEventListener('message', nassh.ConnectDialog.onWindowMessage);

  lib.init(function() {
    window.dialog_ = new nassh.ConnectDialog(e.data.argv[0].messagePort);
  });
};

// Register the message listener.
window.addEventListener('message', nassh.ConnectDialog.onWindowMessage);

/**
 * Called by the preference manager when we've retrieved the current preference
 * values from storage.
 */
nassh.ConnectDialog.prototype.onPreferencesReady_ = function() {
  // Create and draw the shortcut list.
  this.shortcutList_ = new nassh.ColumnList(
      document.querySelector('#shortcut-list'), this.profileList_);

  // Install various (DOM and non-DOM) event handlers.
  this.installHandlers_();

  var profileIndex = 0;

  if (this.profileList_.length > 1) {
    chrome.storage.local.get('/nassh/connectDialog/lastProfileId', (items) => {
      var lastProfileId = items['/nassh/connectDialog/lastProfileId'];
      if (lastProfileId)
        profileIndex = Math.max(0, this.getProfileIndex_(lastProfileId));

      this.shortcutList_.setActiveIndex(profileIndex);
      this.setCurrentProfileRecord(this.profileList_[profileIndex]);
    });
  }

  this.shortcutList_.setActiveIndex(profileIndex);
  // The shortcut list will eventually do this async, but we want it now...
  this.setCurrentProfileRecord(this.profileList_[profileIndex]);

  nassh.getFileSystem().then(this.onFileSystemFound_.bind(this));
};

/**
 * Simple struct to collect data about a profile.
 */
nassh.ConnectDialog.ProfileRecord = function(id, prefs, opt_textContent) {
  this.id = id;
  this.prefs = prefs;
  this.textContent = opt_textContent || prefs.get('description');
};

/**
 * Get a localized message from the Message Manager.
 *
 * This converts all message name to UPPER_AND_UNDER format, since that's
 * pretty handy in the connect dialog.
 */
nassh.ConnectDialog.prototype.msg = function(name, opt_args) {
  if (!this.mm_)
    return 'loading...';

  return this.mm_.get(name.toUpperCase().replace(/-/g, '_'), opt_args);
};

/**
 * Align the bottom fields.
 *
 * We want a grid-like layout for these fields.  This is not easily done with
 * box layout, but since we're using a fixed width font it's a simple hack.
 */
nassh.ConnectDialog.prototype.alignLabels_ = function() {
  var labels = document.querySelectorAll('.aligned-dialog-labels');

  let maxWidth = 0;
  labels.forEach((el) => maxWidth = Math.max(maxWidth, el.clientWidth));
  labels.forEach((el) => el.style.width = `${maxWidth}px`);
};

/**
 * Install various event handlers.
 */
nassh.ConnectDialog.prototype.installHandlers_ = function() {
  // Small utility to connect DOM events.
  function addListeners(node, events, handler, var_args) {
    for (var i = 2; i < arguments.length; i++) {
      handler = arguments[i];
      for (var j = 0; j < events.length; j++) {
        node.addEventListener(events[j], handler);
      }
    }
  }

  // Observe global 'profile-ids' list so we can keep the ColumnList updated.
  this.prefs_.addObservers(null, {
      'profile-ids': this.onProfileListChanged_.bind(this)
    });

  // Same for the 'description' field of all known profiles.
  for (var i = 0; i < this.profileList_.length; i++) {
    var rec = this.profileList_[i];
    if (rec.prefs) {
      rec.prefs.addObservers(null, {
       description: this.onDescriptionChanged_.bind(this)
      });
    }
  }

  // Watch for keypresses sent anywhere in this frame.
  document.addEventListener('keydown', this.onDocumentKeyDown_.bind(this));

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

  // These fields interact with each-other's placeholder text.
  ['description', 'username', 'hostname', 'port'
  ].forEach((name) => {
      var field = this.$f(name);

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
      var field = this.$f(name);
      addListeners(field,
                   ['change', 'keypress', 'keyup'],
                   this.maybeDirty_.bind(this, name));
    });

  ['description', 'username', 'hostname', 'port', 'nassh-options',
   'identity', 'argstr', 'terminal-profile', 'mount-path',
  ].forEach((name) => {
      addListeners(this.$f(name), ['focus', 'blur'],
                   this.onFormFocusChange_.bind(this, name));
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

  var importLink = document.querySelector('#import-link');
  importLink.addEventListener('click', (e) => {
      this.importFileInput_.click();
      e.preventDefault();
    });
};

/**
 * Quick way to ask for a '#field-' element from the dom.
 */
nassh.ConnectDialog.prototype.$f = function(
    name, opt_attrName, opt_attrValue) {
  var node = document.querySelector('#field-' + name);
  if (!node)
    throw new Error('Can\'t find: #field-' + name);

  if (!opt_attrName)
    return node;

  if (typeof opt_attrValue == 'undefined')
    return node.getAttribute(opt_attrName);

  node.setAttribute(opt_attrName, opt_attrValue);
};

/**
 * Change the active profile.
 */
nassh.ConnectDialog.prototype.setCurrentProfileRecord = function(
    profileRecord) {
  if (!profileRecord)
    throw 'null profileRecord.';

  this.currentProfileRecord_ = profileRecord;
  this.syncForm_();

  // For console debugging.
  window.p_ = profileRecord;
};

/**
 * Change the enabled state of one of our <div role='button'> elements.
 *
 * Since they're not real <button> tags the don't react properly to the
 * disabled property.
 */
nassh.ConnectDialog.prototype.enableButton_ = function(button, state) {
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
 */
nassh.ConnectDialog.prototype.displayButton_ = function(
    button, state, style='inline') {
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
 */
nassh.ConnectDialog.prototype.displayMountButton_ = function(state) {
  this.displayButton_(document.querySelector('#mount-path'), state, 'flex');
  if (!state) {
    this.displayButton_(this.mountButton_, false);
    this.displayButton_(this.unmountButton_, false);
    return;
  }

  chrome.fileSystemProvider.getAll((fileSystems) => {
    for (var i in fileSystems) {
      if (fileSystems[i].fileSystemId == this.currentProfileRecord_.id) {
        this.displayButton_(this.mountButton_, false);
        this.displayButton_(this.unmountButton_, true);
        return;
      }
    }
    this.displayButton_(this.mountButton_, true);
    this.displayButton_(this.unmountButton_, false);
    this.enableButton_(this.mountButton_, this.form_.checkValidity());
  });
};

/**
 * Persist the current form to prefs, even if it's invalid.
 */
nassh.ConnectDialog.prototype.save = function() {
  if (!this.$f('description').value)
    return;

  var dirtyForm = false;
  var changedFields = {};

  var prefs = this.currentProfileRecord_.prefs;

  ['description', 'username', 'hostname', 'port', 'nassh-options',
   'identity', 'argstr', 'terminal-profile', 'mount-path',
  ].forEach((name) => {
       var value = this.$f(name).value;

       // Most fields don't make sense with leading or trailing whitespace, so
       // trim them automatically.  This could cause confusion in some fields
       // like the ssh argstr.  We leave it in username since it is technically
       // valid even if most users would get confused by it.
       if (name != 'username') {
         value = value.trim();
       }

       if (name == 'port') {
         value = parseInt(value);
         if (!value) {
           // If parsing failed for any reason, reset it to the default.
           value = null;
         }
       }

       if ((!prefs && !value) || (prefs && value == prefs.get(name)))
         return;

       dirtyForm = true;
       changedFields[name] = value;
     });

  if (dirtyForm) {
    if (!prefs) {
      var prefs = this.prefs_.createProfile();
      var rec = new nassh.ConnectDialog.ProfileRecord(
          prefs.id, prefs, changedFields['description']);
      this.currentProfileRecord_ = rec;

      prefs.addObservers(null, {
       description: this.onDescriptionChanged_.bind(this)
      });

      this.shortcutList_.afterNextRedraw(() => {
        this.shortcutList_.setActiveIndex(this.profileList_.length - 1);
      });
    }

    for (var name in changedFields) {
      this.currentProfileRecord_.prefs.set(name, changedFields[name]);
    }
  }
};

/**
 * Helper for starting a connection.
 *
 * @param {string} message The message to send to the main window to startup.
 * @param {string} protocol The URI schema to try and register.
 */
nassh.ConnectDialog.prototype.startup_ = function(message, proto) {
  this.maybeCopyPlaceholders_();
  this.save();

  // Since the user has initiated this connection, register the protocol.
  nassh.registerProtocolHandler(proto);

  var items = {
    '/nassh/connectDialog/lastProfileId': this.currentProfileRecord_.id
  };
  chrome.storage.local.set(items);

  if (this.form_.checkValidity()) {
    this.postMessage(message, [this.currentProfileRecord_.id]);
  }
};

/**
 * Mount the selected profile.
 */
nassh.ConnectDialog.prototype.mount = function() {
  this.startup_('mountProfile', 'ssh');
};

/**
 * Unmount the SFTP connection.
 */
nassh.ConnectDialog.prototype.unmount = function() {
  var options = {fileSystemId: this.currentProfileRecord_.id};
  // TODO: Turn this into an external message API.
  nassh.getBackgroundPage()
    .then((bg) => {
      bg.nassh.sftp.fsp.onUnmountRequested(
          options,
          (success) => this.displayMountButton_(true),
          (error) => { /* do nothing */ });
    });
};

/**
 * Start a SFTP session with the selected profile.
 */
nassh.ConnectDialog.prototype.sftpConnect = function() {
  this.startup_('sftpConnectToProfile', 'sftp');
};

/**
 * Connect to the selected profile.
 */
nassh.ConnectDialog.prototype.connect = function() {
  this.startup_('connectToProfile', 'ssh');
};

/**
 * Send a message back to the terminal.
 */
nassh.ConnectDialog.prototype.postMessage = function(name, argv) {
  this.messagePort_.postMessage({name: name, argv: argv || null});
};

/**
 * Set the profile's dirty bit if the given field has changed from it's current
 * pref value.
 */
nassh.ConnectDialog.prototype.maybeDirty_ = function(fieldName) {
  if (this.currentProfileRecord_.prefs) {
    if (this.$f(fieldName).value !=
        this.currentProfileRecord_.prefs.get(fieldName)) {
      this.currentProfileRecord_.dirty = true;
    }
  } else {
    if (this.$f(fieldName).value)
      this.currentProfileRecord_.dirty = true;
  }
};

/**
 * Invoke the maybeCopyPlaceholder_ method for the fields we're willing
 * to bulk-default.
 */
nassh.ConnectDialog.prototype.maybeCopyPlaceholders_ = function() {
  ['description', 'username', 'hostname', 'port', 'nassh-options',
  ].forEach(this.maybeCopyPlaceholder_.bind(this));
  this.syncButtons_();
};

/**
 * If the field is empty and the current placeholder isn't the default,
 * then initialize the field to the placeholder.
 */
nassh.ConnectDialog.prototype.maybeCopyPlaceholder_ = function(fieldName) {
  var field = this.$f(fieldName);
  var placeholder = field.getAttribute('placeholder');
  if (!field.value && placeholder != this.msg('FIELD_' + fieldName +
                                              '_PLACEHOLDER')) {
    field.value = placeholder;
  }
};

/**
 * Compute the placeholder text for a given field.
 */
nassh.ConnectDialog.prototype.updatePlaceholders_ = function(fieldName) {
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
nassh.ConnectDialog.prototype.updateDetailPlaceholders_ = function() {
  // Try to split the description up into the sub-fields.
  // This supports basic user[@hostname[:port]] strings, and the hostname match
  // is a best effort will remaining simple.
  var ary = this.$f('description').value.match(
      /^([^@]+)@([^:@\s]+)?(?:(?::)(\d+))?/);

  // Set a blank array if the match failed.
  ary = ary || [];

  // Remove element 0, the "full match" string.
  ary.shift();

  // Copy the remaining match elements into the appropriate placeholder
  // attribute.  Set the default placeholder text from this.str.placeholders
  // for any field that was not matched.
  ['username', 'hostname', 'port'
  ].forEach((name) => {
    var value = ary.shift();
    if (!value) {
      value = this.msg('FIELD_' + name + '_PLACEHOLDER');
    }

    this.$f(name, 'placeholder', value);
  });
};

/**
 * Update the nassh-options placeholder.
 */
nassh.ConnectDialog.prototype.updateNasshOptionsPlaceholder_ = function() {
  // Google-specific relay hack.  This feels dirty.  We can revert this once
  // we support managed default configs.  http://b/28205376 & related docs.
  let value = this.msg('FIELD_NASSH_OPTIONS_PLACEHOLDER');
  if (!this.$f('nassh-options').value) {
    let hostname = this.$f('hostname').value;
    if (!hostname)
      hostname = this.$f('hostname').placeholder;

    const googleHostRegexp = new RegExp(
        '\.(' +
        'corp\.google\.com|' +
        'c\.googlers\.com|' +
        'cloud\.googlecorp\.com|' +
        '(internal|proxy)\.gcpnode\.com' +
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
nassh.ConnectDialog.prototype.updateDescriptionPlaceholder_ = function() {
  var username = this.$f('username').value;
  var hostname = this.$f('hostname').value;

  var placeholder;

  if (username && hostname) {
    placeholder = username + '@' + hostname;

    var v = this.$f('port').value;
    if (v)
      placeholder += ':' + v;
  } else {
    placeholder = this.msg('FIELD_DESCRIPTION_PLACEHOLDER');
  }

  this.$f('description', 'placeholder', placeholder);
};

/**
 * Sync the form with the current profile record.
 */
nassh.ConnectDialog.prototype.syncForm_ = function() {
  ['description', 'username', 'hostname', 'port', 'argstr', 'nassh-options',
   'identity', 'terminal-profile', 'mount-path',
  ].forEach((n) => {
      var emptyValue = '';

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
 */
nassh.ConnectDialog.prototype.checkMountable_ = function() {
  return chrome.fileSystemProvider !== undefined;
};

/**
 * Sync the states of the buttons.
 */
nassh.ConnectDialog.prototype.syncButtons_ = function() {
  this.enableButton_(
      this.deleteButton_,
      document.activeElement.getAttribute('id') == 'shortcut-list');

  const validForm = this.form_.checkValidity();
  this.enableButton_(this.connectButton_, validForm);
  this.enableButton_(this.sftpClientButton_, validForm);
  this.displayMountButton_(this.checkMountable_());
};

/**
 * Sync the identity dropdown box with the filesystem.
 */
nassh.ConnectDialog.prototype.syncIdentityDropdown_ = function(opt_onSuccess) {
  const keyfileNames = new Set();
  var identitySelect = this.$f('identity');

  var selectedName;
  if (this.currentProfileRecord_.prefs) {
    selectedName = this.currentProfileRecord_.prefs.get('identity');
  } else {
    selectedName = identitySelect.value;
  }

  var onReadError = () => {
    var option = document.createElement('option');
    option.textContent = 'Error!';
    identitySelect.appendChild(option);
  };

  var onReadSuccess = (entries) => {
    // Create a set of the filenames which is all we care about.
    const fileNames = new Set(entries.map((entry) => entry.name));
    fileNames.forEach((name) => {
      const ary = name.match(/^(.*)\.pub/);
      if (ary && fileNames.has(ary[1])) {
        keyfileNames.add(ary[1]);
      } else if (name.startsWith('id_') && !name.endsWith('.pub')) {
        keyfileNames.add(name);
      }
    });
  };

  const onFinalLoad = () => {
    // Reset the list with the current set of keys.
    while (identitySelect.firstChild) {
      identitySelect.removeChild(identitySelect.firstChild);
    }

    var option = document.createElement('option');
    option.textContent = '[default]';
    option.value = '';
    identitySelect.appendChild(option);

    Array.from(keyfileNames).sort().forEach((keyfileName) => {
      var option = document.createElement('option');
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

    if (opt_onSuccess)
      opt_onSuccess();
  };

  return Promise.all([
    // Load legacy/filtered keys from /.ssh/.
    // TODO: Delete this at some point after Aug 2019.  Jan 2021 should be long
    // enough for users to migrate.
    lib.fs.readDirectory(this.fileSystem_.root, '/.ssh/')
      .then(onReadSuccess),

    // Load new keys from /.ssh/identity/.
    lib.fs.readDirectory(this.fileSystem_.root, '/.ssh/identity/')
      .then((entries) => {
        entries.forEach((entry) => keyfileNames.add(entry.name));
      }),
  ])
  .catch((e) => console.error('Loading keys failed', e))
  .finally(onFinalLoad);
};

/**
 * Delete one a pair of identity files from the html5 filesystem.
 */
nassh.ConnectDialog.prototype.deleteIdentity_ = function(identityName) {
  const removeFile = (file) => new Promise((resolve) => {
    // We resolve in the error path because we try to delete paths that are
    // often not there (e.g. missing .pub file).
    lib.fs.removeFile(this.fileSystem_.root, file, resolve, resolve);
  });

  const files = [
    // Delete the private & public key halves for this identity from the .ssh/
    // and .ssh/identity/ dirs.  We used to require importing the pub file in
    // order to update the display, but that's no longer required.  We used to
    // import keys into .ssh/, but that made enumeration messy.  To migrate from
    // the old world state to the new world state, delete all the files!  We can
    // delete after Jan 2021.
    `/.ssh/${identityName}`,
    `/.ssh/${identityName}.pub`,
    `/.ssh/identity/${identityName}`,
    `/.ssh/identity/${identityName}.pub`,
  ];
  return Promise.all(files.map(removeFile))
    .finally(() => this.syncIdentityDropdown_());
};

nassh.ConnectDialog.prototype.deleteProfile_ = function(deadID) {
  if (this.currentProfileRecord_.id == deadID) {
    // The actual profile removal and list-updating will happen async.
    // Rather than come up with a fancy hack to update the selection when
    // it's done, we just move it before the delete.
    var currentIndex = this.shortcutList_.activeIndex;
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
 * Returns -1 if the id is not found.
 */
nassh.ConnectDialog.prototype.getProfileIndex_ = function(id) {
  for (var i = 0; i < this.profileList_.length; i++) {
    if (this.profileList_[i].id == id)
      return i;
  }

  return -1;
};

/**
 * Sync the ColumnList with the known profiles.
 */
nassh.ConnectDialog.prototype.syncProfiles_ = function(opt_callback) {
  var ids = this.prefs_.get('profile-ids');

  this.profileList_.length = 0;
  var currentProfileExists = false;
  var emptyProfileExists = false;

  var deadProfiles = Object.keys(this.profileMap_);

  for (var i = 0; i < ids.length; i++) {
    var id = ids[i];
    var p;

    if (this.currentProfileRecord_ && id == this.currentProfileRecord_.id)
      currentProfileExists = true;

    if (id == this.emptyProfileRecord_.id) {
      emptyProfileExists = true;
      p = this.emptyProfileRecord_;
    } else {
      p = this.profileMap_[id];
    }

    deadProfiles.splice(deadProfiles.indexOf(id), 1);

    if (!p) {
      p = this.profileMap_[id] = new nassh.ConnectDialog.ProfileRecord(
          id, this.prefs_.getProfile(id));
    } else if (p.prefs) {
      p.textContent = p.prefs.get('description');
    }

    this.profileList_.push(p);
  }

  for (var i = 0; i < deadProfiles.length; i++) {
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
    if (opt_callback)
      opt_callback();
  }

  // Start at 1 for the "[New Connection]" profile.
  var initialized = 1;

  var onRead = function(profile) {
    profile.textContent = profile.prefs.get('description');

    if ((++initialized == this.profileList_.length) && opt_callback)
        opt_callback();
  };

  this.profileList_.forEach((profile) => {
    if (profile.prefs)
      profile.prefs.readStorage(onRead.bind(this, profile));
  });
};

/**
 * Success callback for lib.fs.getFileSystem().
 *
 * Kick off the "Identity" dropdown now that we have access to the filesystem.
 */
nassh.ConnectDialog.prototype.onFileSystemFound_ = function(
    fileSystem, sshDirectoryEntry) {
  this.fileSystem_ = fileSystem;
  this.sshDirectoryEntry_ = sshDirectoryEntry;
  this.syncIdentityDropdown_();

  // Tell the parent we're ready to roll.
  this.postMessage('ipc-init-ok');
};

/**
 * User initiated file import.
 *
 * This is the onChange handler for the `input type="file"`
 * (aka this.importFileInput_) control.
 */
nassh.ConnectDialog.prototype.onImportFiles_ = function(e) {
  const promises = [];
  const input = this.importFileInput_;

  // Create promises for all the file imports.
  for (let i = 0; i < input.files.length; ++i) {
    promises.push(new Promise((resolve, reject) => {
      const file = input.files[i];

      // Skip pub key halves as we don't need/use them.
      if (file.name.endsWith('.pub')) {
        resolve();
        return;
      }

      const targetPath = `/.ssh/identity/${file.name}`;
      lib.fs.overwriteFile(
          this.fileSystem_.root, targetPath, file,
          lib.fs.log(`Imported: ${targetPath}`, resolve),
          lib.fs.err(`Error importing: ${targetPath}`, reject));
    }));
  }

  // Resolve all the imports before syncing the UI.
  Promise.all(promises)
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
      });
    });

  return false;
};

/**
 * Keydown event anywhere in this frame.
 *
 * @param {KeyboardEvent} e The user keydown event to process.
 * @return {bool} Whether to keep processing the event.
 */
nassh.ConnectDialog.prototype.onDocumentKeyDown_ = function(e) {
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
      if (e.ctrlKey && !e.altKey && !e.metaKey)
        cancel = true;
      break;

    // Shortcuts where we only kill non-shift variants (and allow shift).
    case 'j':  // Downloads.
    case 'h':  // History.
    case 's':  // Save.
    case 'u':  // View source.
      if (e.ctrlKey && !e.altKey && !e.metaKey && !e.shiftKey)
        cancel = true;
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
 */
nassh.ConnectDialog.prototype.onShortcutListKeyDown_ = function(e) {
  var isNewConnection = this.currentProfileRecord_ == this.emptyProfileRecord_;
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

nassh.ConnectDialog.prototype.onShortcutListDblClick_ = function(e) {
  this.onConnectClick_();
};

/**
 * Called when the ColumnList says the active profile changed.
 */
nassh.ConnectDialog.prototype.onProfileIndexChanged = function(e) {
  this.setCurrentProfileRecord(this.profileList_[e.now]);
  this.syncButtons_();
};

/**
 * Key press while a button has focus.
 */
nassh.ConnectDialog.prototype.onButtonKeypress_ = function(e) {
  if (e.charCode == 13 || e.charCode == 32)
    e.srcElement.click();
};

/**
 * Someone clicked on the mount button.
 */
nassh.ConnectDialog.prototype.onMountClick_ = function(e) {
  this.mount();
};

/**
 * Someone clicked on the unmount button.
 */
nassh.ConnectDialog.prototype.onUnmountClick_ = function(e) {
  this.unmount();
};

/**
 * Someone clicked on the connect button.
 */
nassh.ConnectDialog.prototype.onConnectClick_ = function(e) {
  if (this.connectButton_.getAttribute('disabled'))
    return;

  this.connect();
};

/**
 * Someone clicked on the sftp client button.
 */
nassh.ConnectDialog.prototype.onSftpClientClick_ = function(e) {
  if (this.sftpClientButton_.getAttribute('disabled'))
    return;

  this.sftpConnect();
};

/**
 * Someone clicked on the delete button.
 */
nassh.ConnectDialog.prototype.onDeleteClick_ = function(e) {
  if (this.deleteButton_.getAttribute('disabled'))
    return;

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
nassh.ConnectDialog.prototype.onOptionsClick_ = nassh.openOptionsPage;

/**
 * KeyUp on the form element.
 */
nassh.ConnectDialog.prototype.onFormKeyUp_ = function(e) {
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
 */
nassh.ConnectDialog.prototype.onFormFocusChange_ = function(e) {
  this.syncButtons_();
  this.save();
};

/**
 * Pref callback invoked when the global 'profile-ids' changed.
 */
nassh.ConnectDialog.prototype.onProfileListChanged_ = function() {
  this.syncProfiles_(() => { this.shortcutList_.redraw(); });
};

/**
 * Pref callback invoked when a profile's description has changed.
 */
nassh.ConnectDialog.prototype.onDescriptionChanged_ = function(
    value, name, prefs) {
  if (this.profileMap_[prefs.id]) {
    this.profileMap_[prefs.id].textContent = value;
    this.shortcutList_.scheduleRedraw();
  }
};

/**
 * Handle a message from the terminal.
 */
nassh.ConnectDialog.prototype.onMessage_ = function(e) {
  if (e.data.name in this.onMessageName_) {
    this.onMessageName_[e.data.name].apply(this, e.data.argv);
  } else {
    console.warn('Unhandled message: ' + e.data.name, e.data);
  }
};

/**
 * Terminal message handlers.
 */
nassh.ConnectDialog.prototype.onMessageName_ = {};

/**
 * terminal-info: The terminal introduces itself.
 */
nassh.ConnectDialog.prototype.onMessageName_['terminal-info'] = function(info) {
  this.mm_ = new lib.MessageManager(info.acceptLanguages);
  this.mm_.processI18nAttributes(document.body);
  this.updateDetailPlaceholders_();
  this.updateDescriptionPlaceholder_();

  document.body.style.fontFamily = info.fontFamily;
  document.body.style.fontSize = info.fontSize + 'px';

  var fg = lib.colors.normalizeCSS(info.foregroundColor);
  var bg = lib.colors.normalizeCSS(info.backgroundColor);
  var cursor = lib.colors.normalizeCSS(info.cursorColor);

  var vars = {
    '--nassh-bg-color': bg,
    '--nassh-fg-color': fg,
    '--nassh-cursor-color': cursor,
  };

  for (var i = 10; i < 100; i += 5) {
    vars['--nassh-bg-color-' + i] = lib.colors.setAlpha(bg, i / 100);
    vars['--nassh-fg-color-' + i] = lib.colors.setAlpha(fg, i / 100);
    vars['--nassh-cursor-color-' + i] = lib.colors.setAlpha(cursor, i / 100);
  }

  for (var key in vars)
    if (key.startsWith('--nassh-'))
      document.documentElement.style.setProperty(key, vars[key]);

  // Tell the parent we've finished loading all the terminal details.
  this.postMessage('terminal-info-ok');
};

/**
 * We're now visible, so do all the things that require visibility.
 */
nassh.ConnectDialog.prototype.onMessageName_['visible'] = function() {
  // Focus the connection dialog.
  if (this.profileList_.length == 1) {
    // Just one profile record?  It's the "New..." profile, focus the form.
    this.$f('description').focus();
  } else {
    this.shortcutList_.focus();
  }

  // Now that we're visible and can calculate font metrics, align the labels.
  this.alignLabels_();
};
