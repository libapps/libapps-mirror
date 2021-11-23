// Copyright 2019 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * Mock Event.
 *
 * @extends {Event}
 * @constructor
 */
function MockEvent() {
  /**
   * @private {!Array<?EventListener|function(!Event)>}
   */
  this.listeners_ = [];
}

/** @param {?EventListener|function(!Event)} listener */
MockEvent.prototype.addListener = function(listener) {
  this.listeners_.push(listener);
};

/** @param {?EventListener|function(!Event)} listener */
MockEvent.prototype.removeListener = function(listener) {
  this.listeners_ = this.listeners_.filter((x) => x != listener);
};

/**
 * Dispatch to all listeners async.
 *
 * @param {...*} args
 * @return {!Promise<void>}
 */
MockEvent.prototype.dispatch = function(...args) {
  return new Promise((resolve) => {
    setTimeout(() => {
      for (const listener of this.listeners_) {
        listener.apply(null, args);
      }
      resolve();
    }, 0);
  });
};

/**
 * Mock for chrome.terminalPrivate.
 * https://cs.chromium.org/chromium/src/chrome/common/extensions/api/terminal_private.json.
 *
 * @private
 * @constructor
 */
export function MockTerminalPrivate() {
  /**
   * @private {!Object<string, !Array<function(...*)>>}
   * @const
   */
  this.observers_ = {};
  this.onProcessOutput = new MockEvent();
  this.onA11yStatusChanged = new MockEvent();

  /** @type {string} */
  this.openVmshellProcessId = '';
  this.croshSettings = {};
  this.a11yStatus = false;
}

/**
 * Controls the currently installed MockTerminalPrivate.
 *
 * @private
 * @constructor
 */
MockTerminalPrivate.Controller = function() {
  /**
   * @private
   * @const
   */
  this.origTerminalPrivate_ = chrome.terminalPrivate;
  /**
   * @suppress {constantProperty} Reassigning to chrome.terminalPrivate.
   * @suppress {checkTypes} The mock is not an exact match.
   */
  chrome.terminalPrivate = this.instance = new MockTerminalPrivate();
};

/**
 * Callback will be invoked when chrome.terminalPrivate.<fnName> is called.
 *
 * @param {string} fnName Name of the function to observe.
 * @param {function(...*)} callback Invoked with arguments from function.
 */
MockTerminalPrivate.Controller.prototype.addObserver = function(
    fnName, callback) {
  this.instance.observers_[fnName] = this.instance.observers_[fnName] || [];
  this.instance.observers_[fnName].push(callback);
};

/**
 * Remove observer.
 *
 * @param {string} fnName Name of the function to remove observer for.
 * @param {function(...*)} callback Observer to remove.
 */
MockTerminalPrivate.Controller.prototype.removeObserver = function(
    fnName, callback) {
  if (this.instance.observers_[fnName]) {
    this.instance.observers_[fnName] =
        this.instance.observers_[fnName].filter((o) => o != callback);
  }
};

/**
 * Returns promise which resolves with args of fnName after it is next invoked.
 *
 * @param {string} fnName Name of the function to observe.
 * @return {!Promise<!Array<*>>} Arguments from function.
 */
MockTerminalPrivate.Controller.prototype.on = function(fnName) {
  return new Promise((resolve) => {
    const observer = (...args) => {
      this.removeObserver(fnName, observer);
      resolve(args);
    };
    this.addObserver(fnName, observer);
  });
};

/**
 * Stop the mock.
 */
MockTerminalPrivate.Controller.prototype.stop = function() {
  /** @suppress {constantProperty} Reassigning to chrome.terminalPrivate. */
  chrome.terminalPrivate = this.origTerminalPrivate_;
};

/**
 * Start the mock and install it at chrome.terminalPrivate.
 *
 * @return {!MockTerminalPrivate.Controller}
 */
MockTerminalPrivate.start = function() {
  return new MockTerminalPrivate.Controller();
};

/**
 * Notify all observers that a chrome.terminalPrivate function has been called.
 *
 * @param {string} fnName Name of the function called.
 * @param {!Object=} args arguments function was called with.
 * @private
 */
MockTerminalPrivate.prototype.notifyObservers_ = function(fnName, args) {
  for (const fn of this.observers_[fnName] || []) {
    fn.apply(null, args);
  }
};

/**
 * Starts new vmshell process.
 *
 * @param {!Array<string>} args Command line arguments to pass to the process.
 * @param {function(string)} callback Returns id of the launched process. If no
 *     process was launched returns -1.
 */
MockTerminalPrivate.prototype.openVmshellProcess = function(args, callback) {
  setTimeout(() => {
    callback(this.openVmshellProcessId);
    this.notifyObservers_('openVmshellProcess', [args, callback]);
  }, 0);
};

/**
 * Closes previously opened process.
 *
 * @param {string} id Unique id of the process we want to close.
 * @param {function(boolean)} callback Function that gets called when close
 *     operation is started for the process. Returns success of the function.
 */
MockTerminalPrivate.prototype.closeTerminalProcess = function(id, callback) {
  setTimeout(() => {
    callback(true);
    this.notifyObservers_('closeTerminalProcess', [id, callback]);
  }, 0);
};

/**
 * Sends input that will be routed to stdin of the process with the specified
 * id.
 *
 * @param {string} id The id of the process to which we want to send input.
 * @param {string} input Input we are sending to the process.
 * @param {function(boolean)} callback Callback that will be called when
 *     sendInput method ends. Returns success.
 */
MockTerminalPrivate.prototype.sendInput = function(id, input, callback) {
  setTimeout(() => {
    callback(true);
    this.notifyObservers_('sendInput', [id, input, callback]);
  }, 0);
};

/**
 * Notify the process with the id id that terminal window size has changed.
 *
 * @param {string} id The id of the process.
 * @param {number} width New window width (as column count).
 * @param {number} height New window height (as row count).
 * @param {function(boolean)} callback Callback that will be called when
 *     onTerminalResize method ends. Returns success.
 */
MockTerminalPrivate.prototype.onTerminalResize = function(
    id, width, height, callback) {
  setTimeout(() => {
    callback(true);
    this.notifyObservers_('onTerminalResize', [id, width, height, callback]);
  }, 0);
};

/**
 * Returns the current a11y status.
 *
 * @param {function(boolean)} callback Callback that will be called
 *     with the current a11y status.
 */
MockTerminalPrivate.prototype.getA11yStatus = function(callback) {
  setTimeout(() => {
    callback(this.a11yStatus);
    this.notifyObservers_('getA11yStatus', [callback]);
  }, 0);
};

/**
 * Open the Terminal Settings page.
 *
 * @param {function()} callback Callback that will be called when complete.
 */
MockTerminalPrivate.prototype.openOptionsPage = function(callback) {
  setTimeout(() => {
    callback();
    this.notifyObservers_('openOptionsPage', [callback]);
  }, 0);
};

/**
 * Open the Terminal tabbed window.
 *
 * @param {!Object=} data
 */
MockTerminalPrivate.prototype.openWindow = function(data) {
  setTimeout(() => {
    this.notifyObservers_('openWindow', [data]);
  }, 0);
};

/**
 * Mock Window.
 *
 * @extends {Window}
 * @constructor
 */
function MockWindow() {
  /** @type {{hash: string}} */
  this.location = {hash: '#'};

  /** @type {!Object<string, !MockEvent>} */
  this.events = new Proxy({}, {
    get: function(obj, prop) {
      if (!obj.hasOwnProperty(prop)) {
        obj[prop] = new MockEvent();
      }
      return obj[prop];
    },
  });
}

/**
 * Add event listener.  Listeners can be registered and then invoked with:
 *   mockWindow.addEventListener('mytype', listenerFunc);
 *   mockWindow.events['mytype'].dispatch(args);
 *
 * @param {string} type Event type.
 * @param {?EventListener|function(!Event)} listener Listener function.
 * @override
 */
MockWindow.prototype.addEventListener = function(type, listener) {
  this.events[type].addListener(listener);
};

/**
 * Remove event listener.
 *
 * @param {string} type Event type.
 * @param {?EventListener|function(!Event)} listener Listener function.
 * @override
 */
MockWindow.prototype.removeEventListener = function(type, listener) {
  this.events[type].removeListener(listener);
};

/**
 * Mock Location.
 *
 * @extends {Location}
 */
class MockLocation {
  /** @param {!URL} url */
  constructor(url) { this.url = url; }

  /** @override */
  get hash() { return this.url.hash; }

  /** @override */
  set hash(hash) { this.url.hash = hash; }

  /** @override */
  get href() { return this.url.href; }
}

/** @override */
MockLocation.prototype.replace = function(url) {
  this.url = new URL(`${url}`, this.url);
};

/**
 * A controller for mocking chrome.tabs.
 */
export class MockTabsController {
  constructor() {
    this.origTabs_ = chrome.tabs;

    this.currentTab = {
      id: 123,
      active: true,
      windowId: 456,
    };

    this.mockTabs = {
      onActivated: new MockEvent(),
      getCurrent: (callback) => setTimeout(callback, 0, this.currentTab),
    };
  }

  /**
   * Start mocking.
   *
   * @suppress {constantProperty} Reassigning to chrome.tabs.
   * @suppress {checkTypes} The mock is not an exact match.
   */
  start() {
    chrome.tabs = this.mockTabs;
  }

  /**
   * Stop mocking.
   *
   * @suppress {constantProperty} Reassigning to chrome.tabs.
   */
  stop() {
    chrome.tabs = this.origTabs_;
  }
}

/**
 * Mock an object. Note that the instance itself does not mock the properties
 * and methods. Instead, the "proxy" object does that. See the following
 * example:
 *
 *     const baseObj = {a: 123, b: () => 456};
 *     const mock = new MockObject(baseObj);
 *     const proxy = mock.proxy;
 *
 *     // Access properties of baseObj.
 *     assert.equal(proxy.a, 123);
 *     assert.equal(proxy.b(), 456);
 *
 *     // Set properties.
 *     proxy.a = proxy.c = 789;
 *     assert.equal(proxy.a, 789);
 *     assert.equal(proxy.c, 789);
 *
 *     // Anything not in `baseObj` are mocked as methods, and the calls are
 *     // recorded.
 *     proxy.foo(10, 'hello');
 *     proxy.foo(20, 'world');
 *     assert.deepEqual(mock.getMethodHistory('foo'),
 *         [[10, 'hello'], [20, 'world']]);
 */
export class MockObject {
  /**
   * @param {!Object=} baseObj See the getter `proxy` for details.
   */
  constructor(baseObj) {
    if (baseObj === undefined) {
      baseObj = {};
    }

    this.perMethodHistory_ = new Map();
    this.proxy_ = new Proxy(baseObj, {
      get: (baseObj, prop) => {
        if (baseObj.hasOwnProperty(prop)) {
          return baseObj[prop];
        }
        // If the property is not in the baseObj, we mock it as a method.
        return (...args) => {
          this.methodCalled(prop, args);
        };
      },

      set: (baseObj, prop, value) => {
        baseObj[prop] = value;
        return true;
      },
    });
  }

  /**
   * Return a proxy object.
   *
   * `this.proxy.foo` will return `baseObj.foo` if it exists, where `baseObj` is
   * the argument passed to the constructor. Otherwise, `this.proxy.foo` will
   * return a function. Calls to the function will be recorded, and you can
   * access the call history from, for example, `this.getMethodHistory()`.
   *
   * `this.proxy.foo = x` will always set `baseObj.foo = x`.
   *
   * @return {*} The proxy. Note that we annotate the type as '*' to allow the
   *     user to cast it to any type they want.
   */
  get proxy() {
    return this.proxy_;
  }

  /**
   * (Manually) record a call to a method.
   *
   * @param {string} methodName
   * @param {!Array} args
   */
  methodCalled(methodName, args) {
    if (!this.perMethodHistory_.has(methodName)) {
      this.perMethodHistory_.set(methodName, []);
    }
    this.perMethodHistory_.get(methodName).push(args);
  }

  /**
   * Return the call history of a method.
   *
   * @param {string} methodName
   * @return {!Array<!Array>} The list of arguments. One entry per call.
   */
  getMethodHistory(methodName) {
    if (this.perMethodHistory_.has(methodName)) {
      return this.perMethodHistory_.get(methodName);
    }
    return [];
  }

  /**
   * Return the arguments of the last call to the method.
   *
   * @param {string} methodName
   * @return {!Array}
   */
  getMethodLastArgs(methodName) {
    const argList = this.getMethodHistory(methodName);
    if (argList.length === 0) {
      throw new Error(`method ${methodName} hasn't been called`);
    }
    return argList[argList.length - 1];
  }
}
