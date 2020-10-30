# External API

The extension provides an external API to allow other apps/extensions make
requests using the [Chrome messaging API].

There are simple one-time messages (with a single response) APIs, as well as
some longer-lived connection-based APIs.

[TOC]

# General

All API responses take the basic form (some commands might contain more fields):

| Field name     | Type    | Description |
|----------------|---------|-------------|
| `error`        | bool    | Whether the request succeeded. |
| `message`      | !string | A short message providing more details. |
| `stack`        | ?string | A JavaScript stack trace for errors. |

# Messages

These APIs are simple one-time messages: you send a single request and get back
a single response.

The nassh background page adds a listener for
[`chrome.runtime.onMessage`] (internal) and [`chrome.runtime.onMessageExternal`]
(external) which can be invoked by other apps / extensions by calling
[`chrome.runtime.sendMessage`].
The possible messages are documented in the next sections, but they all must
have the `command` field set to select the right function.

## Example

External callers can make requests like:

```js
// Extension id for stable Secure Shell.
const id = 'iodihamcpbpeioajjeobimgagajmlibd';

// Open a new crosh window.
const msg = {
  'command': 'crosh',
};

// Send the request and wait for a response.
chrome.runtime.sendMessage(id, msg, null, (response) => {
  if (chrome.runtime.lastError) {
    console.log(`Extension doesn't exist: ${chrome.runtime.lastError.message}`);
    //onError();
  } else {
    if (response.error) {
      console.log(`Remote failed:`, response);
      //onError();
    } else {
      console.log(`Remote worked:`, response);
      //onSuccess();
    }
  }
});
```

Internal callers use the same form but omit `id` as it'll automatically go to
the right background page.

## API

### Hello

This is a simple stub message to help with debugging.
It will respond with some basic messaging details.

| Field name     | Type    | Description |
|----------------|---------|-------------|
| `command`      | !string | Must be `hello`. |

The response will have these additional fields:

| Field name     | Type    | Description |
|----------------|---------|-------------|
| `message`      | !string | Will be `hello`. |
| `internal`     | bool    | Whether the sender is the same extension. |
| `id`           | string  | The extension id of the sender. |

### Mount

On Chrome OS, trigger a SFTP filesystem mount with the Files app.

| Field name     | Type    | Description |
|----------------|---------|-------------|
| `command`      | !string | Must be `mount`. |
| `knownHosts`   | !string | File contents of known_hosts to be used for connection.  e.g. output from `ssh-keyscan <ssh-server>` |
| `identityFile` | !string | File contents of private key identity_file (e.g. contents of id_rsa file `-----BEGIN RSA PRIVATE KEY----- ...`) |
| `username`     | !string | Username for connection |
| `hostname`     | !string | Hostname or IP address for connection |
| `port`         | number= | Port, default is 22 |
| `fileSystemId` | !string | ID used for Chrome OS mounted filesystem |
| `displayName`  | !string | Display name in Chrome OS Files.app for mounted filesystem |

### Unmount

On Chrome OS, unmount an existing SFTP filesystem mount.

| Field name     | Type    | Description |
|----------------|---------|-------------|
| `command`      | !string | Must be `unmount`. |
| `fileSystemId` | !string | ID used for Chrome OS mounted filesystem. |

### Get Mount Info

On Chrome OS, return information about a particular mount.

On success, the information will be returned in the `data` field.

| Field name     | Type    | Description |
|----------------|---------|-------------|
| `command`      | !string | Must be `getMountInfo`. |
| `fileSystemId` | !string | ID used for Chrome OS mounted filesystem. |

The response will have these additional fields:

| Field name     | Type    | Description |
|----------------|---------|-------------|
| `info`         | ?Object | The mount information. |

### Set Mount Info

On Chrome OS, update configuration for a particular mount.
Note: Not all fields are configurable.

| Field name     | Type    | Description |
|----------------|---------|-------------|
| `command`      | !string | Must be `setMountInfo`. |
| `fileSystemId` | !string | ID used for Chrome OS mounted filesystem. |
| `info`         | !Object | New settings to use. |

### Crosh

On Chrome OS, open a new [crosh] session.

| Field name     | Type    | Description |
|----------------|---------|-------------|
| `command`      | !string | Must be `crosh`. |
| `height`       | number= | The height of the new window. |
| `width`        | number= | The width of the new window. |

### Nassh

Open a new ssh session.

| Field name     | Type    | Description |
|----------------|---------|-------------|
| `command`      | !string | Must be `nassh`. |
| `height`       | number= | The height of the new window. |
| `width`        | number= | The width of the new window. |
| `url`          | string= | *(internal)* URL to open instead for specific profiles. |

### Import Preferences

*** note
**NB**: This is only available to Secure Shell itself.
***

Import saved preferences for nassh & hterm.

| Field name     | Type    | Description |
|----------------|---------|-------------|
| `command`      | !string | Must be `prefsImport`. |
| `prefs`        | !Object | The preferences to import. |
| `asJson`       | bool=   | Whether the prefs are a JSON string. |

### Export Preferences

*** note
**NB**: This is only available to Secure Shell itself.
***

Export saved preferences for nassh & hterm.

| Field name     | Type    | Description |
|----------------|---------|-------------|
| `command`      | !string | Must be `prefsExport`. |
| `asJson`       | bool=   | Whether the prefs will be a JSON string. |

The response will have these additional fields:

| Field name     | Type    | Description |
|----------------|---------|-------------|
| `prefs`        | !Object | The exported preferences as JSON or an object. |

### Protocol Registration

Open a dedicated page for registering protocol handlers (e.g. `ssh://`).
The web platform does not allow us to register handlers without user intent,
so this provides a simple/clear UI for users to manually trigger.

| Field name     | Type    | Description |
|----------------|---------|-------------|
| `command`      | !string | Must be `openProtoReg`. |

# Connections

These APIs are more complicated: they create a bidirection channel for sending
& receiving multiple messages.

The nassh background page adds a listener for
[`chrome.runtime.onConnect`] (internal) and [`chrome.runtime.onConnectExternal`]
(external) which can be invoked by other apps / extensions by calling
[`chrome.runtime.connect`].
The possible endpoints are documented in the next sections.
The `name` field from the initial connect call is used to select the endpoint.

Unknown requests will usually result in an immediate error and the channel
being closed, so make sure to listen for `onDisconnect` events!

## Example

External callers can make requests like:

```js
// Extension id for stable Secure Shell.
const id = 'iodihamcpbpeioajjeobimgagajmlibd';

// Connect to the 'hello' endpoint.
const port = chrome.runtime.connect(id, {name: 'hello'});

// Listen for new messages from Secure Shell.
port.onMessage((msg) => {
  console.log('Received message:', msg);
});

// Listen for disconnect events.
port.onDisconnect(() => {
  if (chrome.runtime.lastError) {
    console.log(`Connection aborted: ${chrome.runtime.lastError.message}`);
    //onError();
  } else {
    console.log('Connection finished');
  }
});

// Send some messages over the channel.
// NB: Responses will be handled via the event listener above, not here.
port.postMessage('hello');
port.postMessage('hi');
// Secure Shell will close the channel after this message.
port.postMessage('bye');
```

Internal callers use the same form but omit `id` as it'll automatically go to
the right background page.

## API

### Hello

This is a simple stub endpoint to help with debugging.

The input message will be a simple string.

It will respond with some basic messaging details.

```js
port.postMessage('hello');
port.postMessage('hi');
port.postMessage('bye');
```

The response will have these additional fields:

| Field name     | Type    | Description |
|----------------|---------|-------------|
| `message`      | !string | A random friendly response. |
| `internal`     | bool    | Whether the sender is the same extension. |
| `id`           | string  | The extension id of the sender. |


[Chrome messaging API]: https://developer.chrome.com/extensions/messaging
[crosh]: chromeos-crosh.md
[`chrome.runtime.onConnect`]: https://developer.chrome.com/extensions/runtime#event-onConnect
[`chrome.runtime.onConnectExternal`]: https://developer.chrome.com/extensions/runtime#event-onConnectExternal
[`chrome.runtime.connect`]: https://developer.chrome.com/extensions/runtime#method-connect
[`chrome.runtime.onMessage`]: https://developer.chrome.com/extensions/runtime#event-onMessage
[`chrome.runtime.onMessageExternal`]: https://developer.chrome.com/extensions/runtime#event-onMessageExternal
[`chrome.runtime.sendMessage`]: https://developer.chrome.com/extensions/runtime#method-sendMessage
