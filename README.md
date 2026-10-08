# Open RENPHO

An Expo (React Native) app that reads RENPHO Bluetooth devices locally, with no RENPHO cloud account, and syncs to Apple Health and SparkyFitness.

## Status

| Piece | State |
|---|---|
| ES-CS20M scale, TypeScript ports of both hardware variants (connectable QN, and broadcast-only for FCC ID 2APXUES-CS20M), tested against real captured frames | implemented; **not yet run on hardware** |
| Weigh-in screen | minimal (weight + impedance) |
| RF-BMF01 tape: protocol decoded, parser tested on real frames, live-length screen with save-on-checkmark | implemented; **not yet run in the app on hardware** |
| Body-composition profile / history / settings | planned |
| SparkyFitness sync | planned |
| Apple Health sync | planned |

## Running

To get a build on your iPhone without a Mac, see [docs/TESTFLIGHT.md](docs/TESTFLIGHT.md).

BLE needs native code, so **Expo Go will not work**. Use a development build on a real iPhone:

```bash
npm install
npx expo run:ios --device        # needs a Mac with Xcode, or:
npx eas-cli@latest build --profile development --platform ios
npm test                         # protocol + body-metrics tests, no hardware needed
npm run typecheck && npm run lint
```

Before building, check `ios.bundleIdentifier` in `app.json`; it is a placeholder.

## Layout

```
src/ble/qn/          scale protocol (pure TS), session state machine, body-composition math, BLE transport
src/ble/base64.ts    ble-plx value encoding
src/domain/          device-independent types (Measurement, UserProfile)
src/app/             expo-router screens
docs/protocol/       protocol notes and capture checklists
```

Credit: the scale protocol and body-fat math are ported from [renpho-escs20m](https://github.com/ronnnnnnnnnnnnn/renpho-escs20m) (MIT), see `THIRD_PARTY_NOTICES.md`. Not affiliated with RENPHO.
