# External API

The extension provides an external API to allow other apps/extensions make
requests using the [Chrome messaging API].

[TOC]

## General

The nassh background page adds a listener for
[`chrome.runtime.onMessage`] (internal) and [`chrome.runtime.onMessageExternal`]
(external) which can be invoked by other apps / extensions by calling
[`chrome.runtime.sendMessage`].
The possible messages are documented in the next sections, but they all must
have the `command` field set to select the right function.

The API will then respond with an object of the form:

| Field name     | Type    | Description |
|----------------|---------|-------------|
| `error`        | bool    | Whether the request succeeded. |
| `message`      | !string | A short message providing more details. |
| `stack`        | ?string | A JavaScript stack trace for errors. |

## Example

External callers can make requests like:

```js
// Extension id for stable Secure Shell app.
const id = 'pnhechapfaindjhompbnflcldabbghjo';

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

### Crosh

On Chrome OS, open a new [crosh] session.

| Field name     | Type    | Description |
|----------------|---------|-------------|
| `command`      | !string | Must be `crosh`. |
| `height`       | number= | The height of the new window. |
| `width`        | number= | The width of the new window. |


[Chrome messaging API]: https://developer.chrome.com/apps/messaging
[crosh]: chromeos-crosh.md
[`chrome.runtime.onMessage`]: https://developer.chrome.com/apps/runtime#event-onMessage
[`chrome.runtime.onMessageExternal`]: https://developer.chrome.com/apps/runtime#event-onMessageExternal
[`chrome.runtime.sendMessage`]: https://developer.chrome.com/extensions/runtime#method-sendMessage
