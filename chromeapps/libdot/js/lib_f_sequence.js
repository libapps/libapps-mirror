// Copyright (c) 2012 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

'use strict';

lib.rtdep('lib.f.getStack');

/**
 * A utility for managing sequences of asynchronous functions.
 *
 * This class takes an array of functions, and executes them in sequence.  Each
 * function must call a sequence-provided next() or error() function to advance
 * the sequence, or error out of it.
 *
 * A function that expects to perform a number of async calls can indicate how
 * many times it must call next() before the sequence advances.
 *
 * Here's an abbreviated example from wash_app.js:
 *
 *   var sequence = new lib.Sequence
 *   (this,
 *    [function filesystem(cx) {
 *       var initialDirs = [... array of strings ...];
 *       cx.expected = initialDirs.length;
 *
 *       initialDirs.forEach(function(path) {
 *         fs.link(path, new lib.wa.fs.Directory(),
 *                 cx.next, cx.error);
 *       });
 *     },
 *
 *     function commands() { ... },
 *
 *     ...
 *    ];
 *
 *   sequence.run(onSuccess, onError);
 *
 * (See the comments inside sequence.run() for details of the 'cx' object.)
 *
 * Here the 'filesystem' function must call next once for each entry in
 * initialDirs before the sequence advances to the 'commands' function.
 *
 * When the final function invokes next() the onSuccess function is called and
 * the sequence ends.  If anyone calls error() the sequence stops and the
 * onError function is called.
 *
 * @param {Object} bindObject The object to apply each sequence function to.
 * @param {Array<function(Object)>} ary The array of sequence functions.
 */
lib.f.Sequence = function(bindObject, ary) {
  this.ary = ary;
  this.bindObject = bindObject;

  /**
   * True to log the steps of the sequence to the js console.
   */
  this.verbose = false;
};

/**
 * Execute this sequence without side-effecting this sequence instance.
 *
 * You may call this method multiple times without waiting for the sequence
 * to complete.
 *
 * @param {function(Object)} onSuccess The function to invoke when the sequence
 *     ends without an error.  This is passed the same context object as the
 *     sequence functions.
 * @param {function(Object}) onError The function to invoke when the sequence
 *     ends with an error.
 * @param {*} opt_arg An optional value to include as cx.arg.
 */
lib.f.Sequence.prototype.run = function(onSuccess, onError, opt_arg) {
  var ary = this.ary;
  var step = 0;

  var bindObject = this.bindObject;

  var cx = {
    /**
     * The value of opt_arg.
     */
    arg: opt_arg,

    /**
     * The function to call to advance the sequence.
     *
     * If you set cx.expected to a number, then next() must be called that
     * many times before we advance.
     */
    next: function() {
      if (--cx.expected != 0) {
        if (this.verbose)
          console.log('sequence: ' + ary[step].name + ': wait: ' + cx.expected);
        return;
      }

      if (++step == ary.length) {
        onSuccess(opt_arg);
        return;
      }

      cx.expected = 1;

      if (this.verbose)
        console.log('sequence: ' + ary[step].name);
      ary[step].call(bindObject, cx);
    }.bind(this),

    /**
     * The function to call to abort the sequence.
     *
     * The onError handler will get any arguments you pass to this function.
     */
    error: function() {
      onError.apply(null, arguments)
    },

    /**
     * By default, cx.next only needs to be called once per step.
     */
    expected: 1
  };

  if (this.verbose)
    console.log('sequence: ' + ary[0].name);

  ary[0].call(bindObject, cx);
};
