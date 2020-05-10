# Using smart cards and hardware tokens with Secure Shell

This guide explains how to use an OpenPGP-enabled hardware token or smart card
for SSH authentication with [Secure Shell]. Any device with an OpenPGP applet
based on the [OpenPGP card specification] should be supported, which includes
at least the following:

* [OpenPGP Card V2.1](https://g10code.com/p-card.html)
* [Nitrokey](https://www.nitrokey.com/)
* [Yubico YubiKeys](https://www.yubico.com/products/yubikey-hardware/)

## Setup

1. Ensure that your smart card/hardware token is properly set up and loaded
   with at least an authentication key.

   The initial setup cannot be carried out under Chrome OS and does take some
   time. There are plenty of guides available covering the process, among
   them the ones by
   [Yubico](https://www.yubico.com/support/knowledge-base/categories/articles/use-yubikey-openpgp/),
   [ageis](https://gist.github.com/ageis/14adc308087859e199912b4c79c4aaa4) and
   [drduh](https://github.com/drduh/YubiKey-Guide). The key generation part
   should not depend on the particular brand of smart card or hardware token.

2. Install the [Smart Card Connector app] from the Chrome Web Store.

   This app implements the [PC/SC API] that is used to communicate with the
   OpenPGP applet. Other apps and extensions can connect to it and request
   permission to access the card or token, which has to be granted on first use.

3. Launch [Secure Shell], add a new connection to your server and set the SSH
   relay server options to `--ssh-agent=gsc`.

   If you want to be able to use the key on the card or token also on the
   server, you can enable agent forwarding as usual by adding `-A` to the SSH
   arguments. **Note:** Only forward SSH agents to trusted servers.

4. If `~/.ssh/authorized_keys` on your server does not yet contain the public
   key associated with the authentication key on the card or token, add a new
   line to it with the key in OpenSSH format.

   Under Linux, you can retrieve the public key in the correct format from the
   card via:
   ```console
   $ ssh-add -L
   ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAACAQDHuUmPhKRpI2fHHyikgpW
   yLHckziThJXQ7UDupl7k3pw5Ue9qXjmuMRJJ5moGOtjSB3EnCFvve6Ym6J1
   ...
   qQ== cardno:000601234567
   ```

   Secure Shell also prints the public keys of all connected cards and tokens
   to the console when you connect to a server. To see the key, click on
   'Connect' and wait for an error to be shown because the key has not been
   added yet. Then, press Ctrl+Shift+J to bring up the developer tools and
   navigate to the 'Console' tab, where the public key will be shown.

6. Click on 'Connect' (or press 'R' to reconnect if you already clicked
   'Connect' in the previous step) and enter your smart card PIN when asked.
   PIN entry works as in any other terminal (no characters shown while typing,
   copy & paste supported).

   If you use the smart card SSH agent for the first time, Smart Card Connector
   will show a dialog asking you whether to grant Secure Shell access to the
   Smart Card Connector app. Accept and you should get logged in to the server.

## Caching the smart card PIN (optional)

After the correct smart card PIN is entered for the first time during an SSH
session, the user has the option to cache it. The PIN will remain in the cache
until either the SSH session is disconnected or the screen is locked.

As the PIN will not be preserved through reconnects, this feature is mostly
meant to make agent forwarding (SSH Arguments: `-A`) a more pleasant experience.
Note however that using agent forwarding with a smart card that does not require
physical confirmation for every connection attempt may pose a security risk when
connected to a malicious server.

The PIN cache is encrypted with a random [WebCrypto] AES key that is marked as
non-extractable. While this might mean that it cannot be exfiltrated by e.g.
an arbitrary read vulnerability on machines with hardware-backed WebCrypto key
storage, the nature of JavaScript makes it so that no definite security
guarantees can be given. If in doubt, do not use this feature.

[OpenPGP card specification]: https://gnupg.org/ftp/specs/OpenPGP-smart-card-application-2.0.pdf
[PC/SC API]: https://en.wikipedia.org/wiki/PC/SC
[Secure Shell]: https://chrome.google.com/webstore/detail/iodihamcpbpeioajjeobimgagajmlibd
[Smart Card Connector app]: https://chrome.google.com/webstore/detail/khpfeaanjngmcnplbdlpegiifgpfgdco
[Yubico]: https://www.yubico.com/support/knowledge-base/categories/articles/use-yubikey-openpgp/
[WebCrypto]: https://en.wikipedia.org/wiki/Web_cryptography_API
