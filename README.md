# Keel

An Expo (React Native) iPhone app that reads Bluetooth scales, a tape measure and a blood-pressure cuff locally, with no manufacturer cloud account, keeps your history on the phone, and syncs to Apple Health and SparkyFitness.

Not affiliated with RENPHO, Beurer or iHealth.

## Status

| Piece | State |
|---|---|
| RENPHO ES-CS20M scale, both hardware variants (connectable QN, and broadcast-only for FCC ID 2APXUES-CS20M) | works; tested on hardware |
| Beurer BF720 scale (standard Bluetooth profiles, real impedance, user-slot pairing) | works; tested on hardware |
| RENPHO RF-BMF01 tape measure (live length, save on checkmark) | works; tested on hardware |
| Body-composition profile (BMI, water, muscle, bone, protein, BMR derived from your sex, age and height) | works; tested |
| Overview, trend charts, History (delete, CSV export), units (lb/in or kg/cm, mmHg or kPa) | works; tested |
| Apple Health sync (weight, body fat, lean mass, BMI, waist, blood pressure, heart rate; write only, no duplicates) | works; tested on a device |
| SparkyFitness sync (own server, API key in the keychain, partial-failure aware) | works; tested against a live server |
| iHealth KN-550BT blood-pressure cuff: stored-reading import, category and averages, flags | implemented, tested on real captured frames; **not yet run on the cuff** |

The cuff is the only piece that hasn't been tried on real hardware. Its first-run checklist is at the end of [docs/protocol/ihealth-kn550bt.md](docs/protocol/ihealth-kn550bt.md).

## What it does

- **Weigh in:** weight and impedance from the scale, with body fat and the other metrics derived from your profile.
- **Measure:** tape-measure readings for waist, hips, chest, neck, bicep, thigh and calf.
- **Blood pressure:** syncs stored readings from an iHealth KN-550BT (systolic, diastolic, pulse, irregular-pulse and movement flags). The card shows the latest reading with its ACC/AHA category and 7 and 30 day averages. For information only, not medical advice. Clearing the cuff after import is optional and only happens after a complete, saved download.
- **History:** every saved reading, deletable, exportable as CSV (always in kg, cm and mmHg).
- **Sync:** Apple Health and SparkyFitness, each on its own screen, with "already sent" tracking so nothing is written twice. Blood pressure goes to Apple Health as one entry and to SparkyFitness as custom measurements.
- **Units:** lb/in or kg/cm, and mmHg or kPa. These change the display only; everything is stored in kg, cm and mmHg.

Data stays on your phone. The only network traffic is the sync to a SparkyFitness server you point it at.

## Running

BLE and HealthKit need native code, so **Expo Go will not work**. Use a development build on a real iPhone:

```bash
npm install
npx expo run:ios --device        # needs a Mac with Xcode, or:
npx eas-cli@latest build --profile development --platform ios   # cloud build, no Mac needed
npm test                         # protocol, session and maths tests, no hardware needed
npm run typecheck && npm run lint
```

`ios.bundleIdentifier` in `app.json` is still `com.jerrysmodz.openrenpho`; change it before building under your own Apple account. Cloud builds use the profiles in `eas.json` (`npm run build:device`, `npm run build:testflight`, `npm run submit:testflight`), and the "EAS build (manual)" workflow needs an `EXPO_TOKEN` repository secret.

CI runs typecheck, lint, tests and `expo-doctor` on every PR. A separate workflow builds the app for the simulator and uploads light and dark screenshots (it uses demo data, since the simulator has no Bluetooth).

## Layout

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

See `THIRD_PARTY_NOTICES.md`.
