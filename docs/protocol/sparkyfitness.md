# SparkyFitness sync

The app pushes readings to a self-hosted [SparkyFitness](https://github.com/CodeWithCJ/SparkyFitness) server
with `POST {server}/api/health-data`. Sources: the
[API reference](https://codewithcj.github.io/SparkyFitness/developer/api-reference/) and the server code
(`SparkyFitnessServer/services/healthDataHandlers.ts`). Tested against a live server.

## Request

- Header `Authorization: Bearer <key>`. The key needs the `health_data_write` permission (401 = missing or
  invalid, 403 = no permission). It is stored in the iOS keychain (`expo-secure-store`), never in the JSON
  files.
- Body: a JSON array of `{ type, value, date: "YYYY-MM-DD", timestamp?: ISO 8601, unit? }`. `date` is the
  user's local calendar date. `unit` is only read for custom measurements.
- Response: **200 even when some records fail.** `errors` lists rejected records and the rest were saved. 400
  is only for a malformed body.

## Type mapping

`type` is exact and case-sensitive. Anything the server does not know becomes a custom measurement.

| App metric | Sparky `type` | Unit |
|---|---|---|
| weight | `weight` | kg (the server does no conversion; **unit unconfirmed**, assumed kg) |
| body fat | `body_fat` | 0-100 % |
| muscle mass | `muscle_mass_kg` | kg |
| bone mass | `bone_mass_kg` | kg |
| body water | `body_water_percentage` | 0-100 % |
| BMR | `bmr` | kcal (server rejects values outside its plausible range) |
| waist, hips, neck | `waist`, `hips`, `neck` | cm |
| other tape sites | `Chest`, `Bicep`, ... (custom) | cm |
| blood pressure | `blood_pressure_systolic`, `blood_pressure_diastolic` (always sent; see below) | mmHg |
| BMI, fat-free mass, skeletal muscle, protein, impedance | custom; only if "extra metrics" is on | kg / % / ohm |

Notes from the server code: `LeanBodyMass`, `body_water` and `BodyFat` are *not* built in (they become custom),
which is why we use `body_water_percentage` and `body_fat`.

## Blood pressure

Needs a SparkyFitness server with blood-pressure support (the `blood_pressure_systolic` and
`blood_pressure_diastolic` sync types, which write to `vitals_entries`). Each half is its own record, and the
server pairs the halves by `source` and the exact `timestamp`, so both carry the same two. Keel sends, on
**both** halves:

```json
{ "type": "blood_pressure_systolic", "value": 125, "date": "2026-10-21", "timestamp": "2026-10-21T18:52:00.000Z",
  "unit": "mmHg", "source": "keel", "pulse_bpm": 69, "arm": "left", "body_position": "sitting" }
```

(and `blood_pressure_diastolic` with its own `value`.) `pulse_bpm` (20 to 300), `arm` (`left` or `right`) and
`body_position` (`sitting`, `standing`, `lying` or `reclining`) are optional and left out when not recorded.
The server drops any other value without an error. Keel has no `reclining` or note field yet.

- `source` is `keel`. It is what the server normalises into the reading's provider, so it must be the same on both halves.
- The server keeps the **first** arm, position and note stored for a reading, so correcting an arm in Keel after
  the reading was sent does not change it in Sparky (Keel does not resend sent readings anyway).
- Pulse has no type of its own: it travels on the blood-pressure records.
- Readings sent before Keel switched to these types stay in Sparky as the custom measurements
  `Blood Pressure Systolic`, `Blood Pressure Diastolic` and `Pulse (cuff)`.

## Behaviour

- Check-in fields hold **one value per day**; the later record wins. Custom measurements (blood pressure, pulse, tape sites) are
  sent with their timestamp so each cuff reading is kept. Readings are sent oldest first so the
  last weigh-in of a day is the one kept.
- Sent readings are remembered by key (`type|site|time`) in `sync.json`, so nothing is sent twice.
- A batch (100 records) counts as sent when the server answers 200. Rejected records are shown on the Sync
  screen instead of being retried forever. Network, auth and 5xx errors leave the batch to retry next time.
- "Save and test" posts an empty array: 401/403 mean a bad key or permission; 200 or 400 both mean the key got
  past authentication.
- iOS blocks plain `http://` to non-local hosts, so use an HTTPS address.
