# Security policy

## Reporting a vulnerability

Please report security problems **privately**, not in a public issue: open the repository's **Security** tab and choose **Report a vulnerability**. Include what you found, how to reproduce it, and which version or commit you tested. You should get a reply within a few days.

## What matters here

Keel keeps health data on the phone and talks to the network only for the optional SparkyFitness sync. Reports in these areas are the most useful:

- the SparkyFitness API key leaking from the keychain, logs or exports,
- readings or profile data being sent anywhere other than the configured server,
- a malicious Bluetooth device being able to crash the app or inject data through the protocol parsers (`src/ble`),
- anything that writes to Apple Health beyond what the user approved.

## Known and by design

- The iHealth KN-550BT handshake uses a key that is the same for every unit and is published in open-source projects. It is a protocol constant, not a secret.
- Bluetooth scales and the cuff do not authenticate the phone beyond their own handshakes. Anyone close enough to a device can talk to it.
