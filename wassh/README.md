# WASSH PoC

To experiment with local [test.c] with the limited direct syscalls, follow these
steps.  This mode can be helpful for quick testing and getting started.

1. Run `../ssh_client/build.sh` to get all the tools.  It'll be a while.
2. Run `../nassh/bin/mkdeps` to get all the JS deps.
3. Run `./build.sh` in this dir.
4. Run `npm start` in the nassh/ dir to create a web server.
5. Make sure `foreground = true` in [test.js].
6. Visit http://127.0.0.1:8080/wassh/test.html

For information on direct/foreground/background APIs, see the
[wasi-js-bindings documentation](../wasi-js-bindings).

More complicated syscalls do not work in foreground/direct mode.
In that case, your best bet is to switch to using the Secure Shell extension.
If you want to test out networking syscalls, those definitely only work inside
the extension since they're built off `chrome.sockets.*` APIs.

1.  Follow [nassh hacking documentation](../nassh/docs/hack.md) if you've never
    loaded Secure Shell locally before.
2.  If you want to test ssh programs, you should get a full build locally.
    `cd ../ssh_client && ./build.sh` will take care of that.
3.  With the extension loaded up, visit the test page:
    chrome-extension://algkcnfjnajfhgimadimbjhmpaeohhln/wassh/test.html
4.  Make changes to [test.js] to run different programs, and to [test.c] to
    write quick little manual tests.


[test.c]: ./test.c
[test.js]: ./test.js
