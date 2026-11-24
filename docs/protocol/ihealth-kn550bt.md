# iHealth KN-550BT blood-pressure cuff

Local Bluetooth LE only. No iHealth account or cloud. Source: NickLD/hass-ihealth-bp (MIT).
**Not yet run against hardware in this app.** Only the current firmware (service `com.jiuan.dev`) is implemented; the older
`com.jiuan.BPAV21`/`BPAV10` firmware uses a different framing and is not supported.

## GATT
- Service `636f6d2e-6a69-7561-6e2e-646576000000` ("com.jiuan.dev", shared with other iHealth products: check model 0x2A24 = `KN-550BT`).
- Write (no response, 20-byte pieces): `7265632e-…`. Notify: `7365642e-…` (same tail as the service UUID).
- The cuff advertises for ~10 s after a measurement or a press of its Bluetooth button.

## Framing
- Command: `B0 len 00 seq A1 cmd args… sum`, `len = 2 + len(A1 cmd args…)`, `sum` = low byte of the sum of bytes after `len`. `seq` starts at 1, +2 per frame.
- Reply: `A0 len flag seq A1 cmd data… sum`, total `len + 3`. A byte stream across notifications; reassemble.

## Handshake
1. Send `A1 FA` + R1 (16 random bytes, 0..127).
2. Cuff replies `FB` with 52 bytes: R2[16] E[20] S[16].
3. `Ka = xxtea2_encrypt(S, KEY)`; `xxtea2_decrypt(E, Ka)` must equal R1.
4. Send `A1 FC` + `xxtea2_encrypt(R2, Ka)`. Cuff answers `FD` (ok) or `FE`.
KEY = `19 01 07 96 f2 23 1a 68 8b 54 34 62 8c 57 eb 19`. Verified against a captured exchange the cuff accepted.

XXTEA2: little-endian words, the plaintext length appended as an extra word, `6 + 52/n` rounds, delta `0x9E3779B9`.

## Commands
| cmd | args | reply |
|---|---|---|
| 21 | YY MM DD hh mm ss (local, year-2000) | capabilities; also sets the clock |
| 20 | 00 00 00 | battery % |
| 40 | 01 00 00 | `01 count …` stored readings |
| 4A | 01 00 00 | `01 more records…`; repeat while `more != 0` |
| 47 | 00 00 00 | **permanently deletes** downloaded readings |
| 38 | | error code (13 low battery, 17 arm movement, 32 measuring…) |

## Record (11 bytes)
`YY MM DD hh mm ss (sys−dia) dia pulse scheme flags`. systolic = (sys−dia) + dia. flags bit 7 = irregular pulse, bit 4 = body movement. Time is naive cuff-local.

## Safety
We only send `47` when the download was complete (all pages, whole records, at least the announced count) **and** the readings are already saved, and only if the user turned on "Clear the cuff after importing".

## First-run checklist (hardware)
- Does the model string read `KN-550BT`? Does auth return `FD`?
- Does the reading count match the cuff display? Do systolic/diastolic/pulse match the last reading?
- Is the timestamp right after the clock set (DST)?
- Does a second sync add no duplicates?
