# Hello

This is lib_wam.  It's not fully baked.

lib_wam is a "Web Application Messaging" library that includes two parts:

1. A base layer that adds multiple reply and bidirectional reply conventions
   to existing JSON message passing options.

2. An application layer that adds filesystem-like functionality on top of
   that.

## WAM base layer.

* `lib_wam.js` - Namespace and common utilities.
* `lib_wam_direct_transport.js` - Transport for apps that want to talk
    to themselves.  The terminal window uses this to run `wash` and,
    wash uses it to run `readline`, for example.
* `lib_wam_chrome_port_transport.js` - Transport to connect to other
    chrome apps and extensions.
* `lib_wam_channel.js` - Communication layer over the transport that provides
    reply tracking and stuff.
* `lib_wam_message.js` - Message implementation.

### WAM filesystem layer.

* `lib_wam_fs.js` - Namespace, error definitions, etc.
* `lib_wam_fs_entry.js` - Base class for things that can appear in a
    filesystem.
* `lib_wam_fs_directory.js` - A container for other lib.wa.fs.Entry objects.
* `lib_wam_fs_executable.js` - An entry which can be executed.
* `lib_wam_fs_remote.js` - An entry whose actual value lives on the other side
    of a `lib.wam.Channel`.
