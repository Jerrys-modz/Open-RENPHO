# Keel

**Your scale, tape measure and blood-pressure cuff, without the manufacturer's cloud.**

Keel is an iPhone app that talks to your Bluetooth health devices directly, keeps your history on your phone, and can copy it to Apple Health and your own SparkyFitness server. No account, no ads, no analytics.

## Features

- **Weigh in** with a RENPHO or Beurer scale: weight, plus body fat, water, muscle, bone, protein, BMI and BMR.
- **Measure** with a RENPHO tape: waist, hips, chest, neck, bicep, thigh and calf.
- **Blood pressure** from an iHealth KN-550BT cuff: systolic, diastolic and pulse, with the cuff's irregular-pulse and movement flags, a category for the latest reading and 7 and 30 day averages.
- **Trends:** colour-coded charts for every metric. Press and drag a chart to read a value and its date.
- **History:** every saved reading, deletable, and exportable as a CSV file.
- **Sync** to Apple Health and to a self-hosted [SparkyFitness](https://github.com/CodeWithCJ/SparkyFitness) server. Each reading is sent once, never twice.
- **Units:** lb/in or kg/cm, and mmHg or kPa for blood pressure. Light and dark mode.

## Supported devices

| Device | Notes |
|---|---|
| **RENPHO ES-CS20M** scale | Both hardware revisions that can be read: the connectable one (HVIN `ESCS20MA2`, or no suffix) and the broadcast-only one (FCC ID `2APXUES-CS20M`, weight only). The `ESCS20MB1`/`B2` revisions are not supported. |
| **Beurer BF720** scale | Real impedance. Registers a user slot on the scale, or links an existing one by slot number and PIN. |
| **RENPHO RF-BMF01** tape measure | Live length on screen; press the checkmark on the tape to save. |
| **iHealth KN-550BT** blood-pressure cuff | **New, not yet field-tested.** Current firmware only. Reads the readings stored on the cuff. |

Other scales and cuffs are not supported. Keel is not affiliated with RENPHO, Beurer or iHealth, and uses no code or servers from them.

## Privacy

- Your readings and profile are stored on your phone only. There is no Keel account or server.
- Apple Health access is **write only**: Keel saves measurements and never reads your health data.
- The only network traffic is the optional SparkyFitness sync, to the server address you enter. Its API key is kept in the iOS keychain.
- Bluetooth is used only to talk to your devices.

## Getting started

1. **Install** the app (see [Building](#building) below).
2. **Profile:** open the profile screen (top right) and enter your sex, birth date and height. Without it Keel can show weight but cannot work out body fat and the other body metrics. Pick your units here too.
3. **Weigh in:** open *Weigh in*, then step on the scale. The scale only advertises while someone is standing on it.
4. **Tape:** open *Measure*, choose the body site, and press the checkmark on the tape to save.
5. **Blood pressure:** take a measurement, press the cuff's Bluetooth button and tap *Sync from cuff* within about ten seconds. The cuff keeps up to 99 readings; repeats are never saved twice. There is an optional switch to clear the cuff after importing, which only acts after every reading has been downloaded and saved.
6. **Sync (optional):** open the sync screen (top right). Turn on Apple Health and approve the permission sheet, or enter your SparkyFitness server address and an API key with the `health_data_write` permission. Use an HTTPS address, since iOS blocks plain `http://` to non-local hosts.

### Good to know

- **Body composition is partly estimated.** Where your scale sends body fat or impedance, Keel uses it. Otherwise it estimates from weight and your profile. These numbers can differ from the manufacturer's app and are not a medical measurement.
- **Blood-pressure categories** follow the 2017 ACC/AHA adult guidelines and are for information only. Keel is not a medical device and does not give medical advice. Talk to a doctor about your readings.
- **Apple Health** receives weight, body fat, lean mass, BMI, waist, blood pressure (as one entry) and heart rate (the cuff's pulse). Other metrics have no home in Health.
- **SparkyFitness** receives its built-in fields where they exist, and blood pressure and cuff pulse as custom measurements. Details are in [docs/protocol/sparkyfitness.md](docs/protocol/sparkyfitness.md).
- **Exported CSV files** are always in kg, cm and mmHg, whichever display units you choose.

## Building

Keel needs native Bluetooth and HealthKit code, so it does **not** run in Expo Go. You need a development build on a real iPhone (Bluetooth does not work in the simulator).

```bash
npm install
npx expo run:ios --device                                      # needs a Mac with Xcode
npx eas-cli@latest build --profile development --platform ios  # or a cloud build, no Mac needed
```

Change `ios.bundleIdentifier` in `app.json` (currently `com.jerrysmodz.openrenpho`) to one that is yours before building under your own Apple developer account. Cloud builds use the profiles in `eas.json` (`npm run build:device`, `npm run build:testflight`, `npm run submit:testflight`); the "EAS build (manual)" GitHub workflow needs an `EXPO_TOKEN` repository secret.

## Documentation

- [Using your devices](docs/guides/devices.md), [syncing](docs/guides/sync.md) and [troubleshooting](docs/guides/troubleshooting.md)
- [Privacy policy](PRIVACY.md)
- [Contributing](CONTRIBUTING.md), [architecture](docs/architecture.md), [adding a device](docs/adding-a-device.md) and [security policy](SECURITY.md)
- [Protocol notes](docs/protocol/) for every supported device

## Development

```bash
npm test                          # protocol, session and maths tests, no hardware needed
npm run typecheck && npm run lint
```

CI runs typecheck, lint, tests and `expo-doctor` on every pull request. A separate workflow builds the app for the iOS simulator and uploads light and dark screenshots (it uses demo data, since the simulator has no Bluetooth).

Protocol changes should come with real captured frames in the tests and notes in `docs/protocol/`. The pull request template has the checklist.

```
src/app/             expo-router screens (overview, scale, tape, bp, history, profile, sync, capture)
src/ble/qn/          RENPHO scale protocol (pure TS), session state machine, body-composition maths
src/ble/aabb/        broadcast-only scale variant and the capture recorder
src/ble/beurer/      Beurer BF720: standard-profile parser, user-slot handshake
src/ble/tape/        RF-BMF01 tape measure
src/ble/ihealth/     iHealth KN-550BT cuff: XXTEA handshake, framing, records, session
src/domain/          device-independent types and logic (Measurement, UserProfile, blood pressure)
src/storage/         local JSON storage, settings, sync state, keychain
src/sync/            Apple Health and SparkyFitness mapping and clients
src/ui/              shared components, theme, charts
docs/protocol/       protocol notes, one per device, and the SparkyFitness API notes
```

## Credits

- The RENPHO scale protocol and body-fat maths are ported from [renpho-escs20m](https://github.com/ronnnnnnnnnnnnn/renpho-escs20m) (MIT).
- The iHealth cuff protocol is ported from [hass-ihealth-bp](https://github.com/NickLD/hass-ihealth-bp) (MIT).
- The Beurer decoders were checked against another developer's captures of a real BF720 ([bascule](https://github.com/bearyjd/bascule)).

Full notices are in `THIRD_PARTY_NOTICES.md`.

RENPHO, Beurer, iHealth and Apple Health are trademarks of their respective owners. Keel is an independent project and is not affiliated with or endorsed by them.

## License

See [LICENSE](LICENSE). Privacy: see [PRIVACY.md](PRIVACY.md).
