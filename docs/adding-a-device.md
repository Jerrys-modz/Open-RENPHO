# Adding a device

Every supported device follows the same recipe. The rule that matters most: **work from real captured Bluetooth data**, and put those bytes in the tests.

## 1. Capture and write it down

Use nRF Connect on an iPhone (or another sniffer) to record:

- the advertised name, service UUIDs and manufacturer data,
- every service and characteristic with its properties,
- the notification payloads for known values, with the real number shown on the device (for example weights of 60.0, 75.5 and 90.0 kg).

Write the findings in `docs/protocol/<device>.md`: what is confirmed, what is guessed, and what is unknown. Existing notes (`qn-scale.md`, `beurer-bf720.md`, `ihealth-kn550bt.md`, `rf-bmf01.md`) show the format. Say plainly which parts have been run on hardware.

## 2. Protocol (pure TypeScript)

Add `src/ble/<device>/protocol.ts` with frame builders and parsers, with no Bluetooth or timers. Add tests in `__tests__/` that feed in the captured bytes and check the exact result. If the device has a handshake, include a captured exchange the device accepted and check that your code reproduces the answer byte for byte.

## 3. Session

If the device needs a conversation (handshake, pairing, paging), add `session.ts`: a state machine that takes incoming bytes and a `write` function. Test it with a scripted fake device, including the failure cases (rejected handshake, silence, partial data).

## 4. Transport

Add `transport.ts` with the `react-native-ble-plx` glue. Keep it thin: scan, connect, subscribe, write, hand bytes to the session. Reuse `src/ble/manager.ts` (there must be one `BleManager`) and `src/ble/base64.ts`.

## 5. Measurements

- Add any new `MeasurementType` values to `src/domain/measurement.ts` in fixed storage units.
- Write a mapper from your reading to `Measurement[]` with a new `source` string (see `src/ble/ihealth/measurements.ts`).
- Check the type is handled in grouping (`src/storage/measurements.ts`), history (`src/app/history.tsx`), the CSV unit table (`src/util/csv.ts`), and the metric list (`src/ui/metrics.ts`).

## 6. Screen and routes

Add a route in `src/app` and a `Stack.Screen` entry in `_layout.tsx`. After saving, call `syncAll()` from `@/sync` so readings reach Apple Health and SparkyFitness.

## 7. Sync mappings

If the new data has a home in Apple Health or SparkyFitness, add it to `appleHealthMapping.ts` and `sparkyMapping.ts` with tests. Update `docs/protocol/sparkyfitness.md` and the text on the sync screen so it states what is sent.

## 8. Before the pull request

- `npm run typecheck`, `npm run lint`, `npm test`, `npx expo-doctor` all pass.
- Add a few sample readings to `src/demo.ts` if the screen should appear in screenshots.
- Fill in the pull request template honestly, including "not tested on hardware" where that is true.
- Add the source to `THIRD_PARTY_NOTICES.md` if you ported code, and respect its license.
