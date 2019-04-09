# URI ssh:// links

You can create `ssh://` links that will automatically open Secure Shell.

`ssh://user[;option=value]@host[:port][@proxyhost[:proxyport]]`

Multiple option=value pairs are supported as long as they are delimited by
semi-colons.

[TOC]

## Supported Options

### Fingerprint

This is the remote server's key fingerprint.

Format: `fingerprint=<fingerprint value>`

*** note
This option is parsed out of the URI, but not currently used.
Star https://crbug.com/706536 for updates.
***

### Secure Shell arguments

Secure Shell specific arguments.

See [options](options.md) for more details.

Format: `-nassh-args=<parameters>`

*** note
This option is parsed out of the URI, but not currently used.
Star https://crbug.com/217785 for updates.
***

### SSH arguments

SSH command line arguments.
See [ssh(1)](https://man.openbsd.org/ssh.1) for details in general.

Format: `-nassh-ssh-args=<parameters>`

*** note
This option is parsed out of the URI, but not currently used.
Star https://crbug.com/217785 for updates.
***

## Future Work

See these bugs for future work in this area:
* [user](https://crbug.com/609303)

## References

We try to be compliant with these specifications:

* [IANA spec](https://www.iana.org/assignments/uri-schemes/prov/ssh)
* [Uniform Resource Identifier for Secure Shell](https://tools.ietf.org/html/draft-ietf-secsh-scp-sftp-ssh-uri-04)
