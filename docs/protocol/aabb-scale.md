# Broadcast-only ES-CS20M (FCC ID 2APXUES-CS20M)

Source: ported from [renpho-escs20m](https://github.com/ronnnnnnnnnnnnn/renpho-escs20m) (MIT).
The upstream author had captures from two scales but no live hardware, so this is
**experimental until verified on a real scale**.

## How to tell if you have this one

- The label says FCC ID `2APXUES-CS20M` (this revision has no HVIN suffix).
- The scale's MAC starts with `ED:67:39` or `ED:67:3B` (the captures came from `ed:67:39:c5:aa:0a`
  and `ed:67:3b:1a:aa:06`; the RENPHO app showed `ED:67:39:53:49:85` for the first test scale).
- In nRF Connect, while you step on it: the device is **not connectable**, advertises no services, and
  its manufacturer data begins `FFFF AABB` followed by its own MAC.

## Protocol

The scale never accepts a connection. It advertises, and the weight is in the manufacturer data
(company ID `0xFFFF`). CoreBluetooth returns it prefixed with the 2-byte company ID.

| Offset in payload | Meaning |
|---|---|
| `[0:2]` | magic `AA BB` |
| `[2:8]` | the scale's MAC, forward order |
| `[15]` | status. Bit 0 set = final reading. Bits 1-2 = display unit (1 kg, 2 lb) |
| `[17:19]` | weight, little-endian uint16, 0.01 kg. Always kg, whatever the display shows |

Status values seen: `0x02` settling (live weight), `0x03` with weight 0 = tare, `0x64` provisional/held
(stable bit but not final), `0x23` / `0x25` final (kg / lb display).

The scale repeats its final frame for a whole burst, so the app delivers one reading and ignores
repeats for 10 s (the real burst length is not known).

## No impedance

Nothing here carries impedance, so body composition cannot be measured. The app estimates body fat
with a typical 500 ohm: the open-source project found the result moves under 1 percentage point
across 300-900 ohm, and that 500 ohm matches the official RENPHO app closely. Treat it as an estimate;
BMI (from weight and your height) is exact.

## Verifying on your scale

1. nRF Connect (iPhone): scan while stepping on the scale. Expect a non-connectable device whose
   manufacturer data starts `FFFF AABB` plus its MAC.
2. Compare the weight the app shows with the scale's display.
3. If a connectable device with service `FFF0` shows up instead, you have the other revision; see
   `qn-scale.md`. The app handles both from the same Weigh in button.
