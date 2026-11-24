# Contributing to Keel

Thanks for helping. Keel is a small project that talks to Bluetooth devices, so the most valuable contributions are **device captures, bug reports with details, and tests**.

## Ways to help

- **Report a bug** using the *Bug report* issue template. For Bluetooth problems, include the device model and, for the RENPHO ES-CS20M, the HVIN or FCC ID on the label.
- **Request a device** with the *Support a new device* template. Captures make it possible; see [docs/adding-a-device.md](docs/adding-a-device.md).
- **Improve the docs** in `docs/guides`.
- **Send a pull request.** For anything larger than a small fix, open an issue first so we can agree on the approach.

## Setting up

```bash
npm install
npm test
npm run typecheck && npm run lint
npx expo-doctor
```

Bluetooth and HealthKit need native code, so the app does not run in Expo Go. Build a development app for a real iPhone as described in the [README](README.md#building). The unit tests need no hardware.

Use `npx expo install <package>` (not `npm install`) to add dependencies, so versions match the Expo SDK. Routes live in `src/app`; keep other code out of that folder. Do not hand-edit `ios/` or `android/` if they appear: they are generated from `app.json` and config plugins.

## Pull requests

- Keep them focused and fill in the [template](.github/pull_request_template.md).
- Typecheck, lint and tests must pass; CI also runs `expo-doctor`.
- Protocol changes need real captured frames in the tests and notes in `docs/protocol/`.
- UI changes: look at the `screenshots` artifact from the Screenshots workflow in light and dark mode.
- Say whether you tried it on real hardware. "Not tested on hardware" is fine when it is true.
- Please do not include health data, API keys or personal information in issues, commits or tests.

## Code of conduct

Be kind and assume good faith. Harassment and personal attacks are not welcome.

## Architecture

Start with [docs/architecture.md](docs/architecture.md). Device protocol notes are in [docs/protocol](docs/protocol).

## Security

Please report vulnerabilities privately; see [SECURITY.md](SECURITY.md).
