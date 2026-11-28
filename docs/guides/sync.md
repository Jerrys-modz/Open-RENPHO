# Syncing to Apple Health and SparkyFitness

Open the sync screen with the circular-arrows button at the top right of the overview. Both targets are optional and independent. Each reading is sent once, and Keel remembers what it sent, so turning a target off and on again does not create duplicates.

## Apple Health

1. Turn on **Send readings to Apple Health** and approve the permission sheet.
2. New readings are written automatically after each save. **Sync now** sends anything still pending.

Keel only **writes** to Health and never reads from it. Sent: weight, body fat, lean (fat-free) mass, BMI, waist, blood pressure (as one entry with systolic and diastolic) and the cuff's pulse as heart rate. Water, bone mass, protein, BMR and the other tape sites have no Apple Health type, so they stay in Keel.

**Arm and position.** Apple Health has no blood-pressure field for which arm or what position, and the Health app does not show them. Keel still attaches them to the entry as metadata that other apps and exports can read: Apple's own `HKDevicePlacementSide` key (left or right) and two Keel keys, `KeelBloodPressureArm` and `KeelBodyPosition`. If HealthKit ever refuses them, the reading is saved without them, so a reading never fails to sync because of this. Health entries cannot be edited, so correcting a reading's arm in History afterwards does not change an entry already sent. Set your usual arm and position before the first sync, or correct readings before they sync. Notes are not sent to Apple Health.

If nothing appears in Health, check *Health → Sharing → Apps → Keel* and make sure the data types are on.

## SparkyFitness

You need your own [SparkyFitness](https://github.com/CodeWithCJ/SparkyFitness) server and an API key that has the `health_data_write` permission.

1. Enter the server address. Use `https://`: iOS blocks plain `http://` to non-local hosts.
2. Paste the API key. It is stored in the iOS keychain, not in Keel's files.
3. Tap **Connect**, which checks the key. After that, readings are sent automatically after each save, or tap **Sync now**.
4. **Disconnect** removes the key and stops sending. Your readings in Keel are unchanged.

What is sent:

- weight, body fat, muscle mass, bone mass, water %, BMR, and waist, hips and neck go to Sparky's built-in fields. Other tape sites go as custom measurements.
- **Blood pressure** goes through SparkyFitness's blood-pressure sync (systolic, diastolic, pulse, and the arm, position and note you recorded), so it needs a SparkyFitness version with blood-pressure support. Readings Keel sent earlier stay in Sparky as the custom measurements `Blood Pressure Systolic`, `Blood Pressure Diastolic` and `Pulse (cuff)`. Sparky keeps the first arm and position it receives for a reading, so correcting them in Keel afterwards does not change an already-sent reading.
- With **Also send extra metrics** on, BMI, fat-free mass, skeletal muscle, protein and impedance are sent as custom measurements too.

SparkyFitness keeps **one value per day** in its built-in fields, so the last weigh-in of a day wins there. Custom measurements such as blood pressure keep their time, so each cuff reading is kept.

If Sparky reports a problem (for example a rejected record), it is shown under the buttons. Technical details are in [docs/protocol/sparkyfitness.md](../protocol/sparkyfitness.md).

## If both are on

If your SparkyFitness server also imports from Apple Health, a reading can reach Sparky twice, once through each route. If you see duplicates, turn off one of the two paths.
