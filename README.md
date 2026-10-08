# Open RENPHO

An Expo (React Native) app that reads RENPHO Bluetooth devices locally, with no RENPHO cloud account, and syncs to Apple Health and SparkyFitness.

## Status

| Piece | State |
|---|---|
| ES-CS20M scale (QN protocol), TypeScript port | implemented, unit-tested against golden vectors; **not yet run on hardware** |
| Weigh-in screen | minimal (weight + impedance) |
| Body-composition profile / history / settings | planned |
| RF-BMF01 tape measure | protocol unknown, see `docs/protocol/rf-bmf01.md` |
| SparkyFitness sync | planned |
| Apple Health sync | planned |

## Running

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
