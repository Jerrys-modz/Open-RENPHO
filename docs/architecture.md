# Architecture

Keel is an Expo (React Native) app using Expo Router. Everything runs on the phone; the only network call is the optional SparkyFitness sync.

## Layers

```
screens (src/app)  ->  storage / sync (src/storage, src/sync)  ->  domain (src/domain)
        \                                                          ^
         `-> BLE drivers (src/ble/*) ---------------------------- /
```

**Domain** (`src/domain`) has no I/O. `Measurement` is the one shape every device produces: a `type`, a `value` in fixed units (kg, cm, %, mmHg, bpm), a `takenAt` timestamp in Unix ms, a `source` string such as `qn-scale`, `beurer-bf720`, `rf-bmf01` or `ihealth-kn550bt`, and an optional `site` for tape readings. Everything else is built from lists of these. `bloodPressure.ts` assembles blood-pressure measurements into readings, classifies them and averages them. `profile.ts` holds the user profile.

**BLE drivers** (`src/ble/<device>`) are split three ways so the hard part can be tested without hardware:

1. `protocol.ts`: pure functions that build and parse frames. No timers, no Bluetooth. Tested against real captured bytes.
2. `session.ts`: a state machine that takes incoming bytes and a `write` function and drives the conversation (handshake, reading, saving). Also transport-agnostic and tested with scripted fakes.
3. `transport.ts`: the `react-native-ble-plx` glue that scans, connects, subscribes and writes. This is the only part that needs a phone.

`src/ble/scale/connection.ts` is the single entry point for "weigh in": one scan watches for the broadcast scale, QN scales and the Beurer scale and hands over to the right driver.

**Storage** (`src/storage`) keeps measurements in one JSON file in the app's documents folder, with an in-memory copy shared by every screen through `useSyncExternalStore`. Pure helpers (`measurements.ts`) do grouping, de-duplication (same source, type, site and time) and deleting. Settings and sync state are small JSON files next to it. When the phone has more than one person, every measurement can carry a `person` id (readings without one belong to the first person, so older data is untouched), and the profile, goals and Beurer pairing each live in a per-person file (the first person keeps the original file names). Screens read the active person's readings; sync reads only the first person's. The SparkyFitness API key is the one thing kept in the keychain.

**Sync** (`src/sync`) maps measurements to each target and remembers what was sent. `appleHealthMapping.ts` and `sparkyMapping.ts` are pure and tested; `appleHealth.ts` and `sparkyClient.ts` do the I/O. `index.ts` runs each target at most once at a time. HealthKit is imported lazily so tests and non-iOS builds never load it.

**UI** (`src/ui`) has the theme, shared components, the charts and the blood-pressure summary card. Screens in `src/app` are Expo Router routes; non-route code stays out of that folder.

## Units

Storage is always kg, cm and mmHg. Display units (`src/util/units.ts`) convert at the edge: lb/in, and kPa for pressure. Sync targets and CSV export use storage units.

## Demo mode

The simulator has no Bluetooth. If a `demo-mode` file exists in the app's documents folder, the app seeds sample data and opens the named screen (`src/demo.ts`). The Screenshots workflow uses this to produce light and dark screenshots.

## Continuous integration

`ci.yml` runs typecheck, lint, tests and `expo-doctor` on pull requests and on pushes to main. `screenshots.yml` builds for the iOS simulator on a macOS runner and uploads screenshots. `eas-build.yml` is a manual cloud build. Dependabot keeps the GitHub Actions current; npm packages are updated together with the Expo SDK (`npx expo install --fix`).
