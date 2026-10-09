# Broadcast-only ES-CS20M (FCC ID 2APXUES-CS20M)

Source: ported from [renpho-escs20m](https://github.com/ronnnnnnnnnnnnn/renpho-escs20m) (MIT).
The upstream author had captures from two scales but no live hardware, so this is
**now verified on the project owner's own scale** (see below).

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
| `[8:10]` | a 1 Hz clock (little-endian, counts seconds since power-up; verified against wall time) |
| `[10:12]` | constant `C8 6A` across all captures (possibly a model/pairing id; it was `C7 6A` once, before the first weigh-in of the first session) |
| `[12:15]` | `FF FF FF` normally; different (`19 23 9B`) in one wake/tare event frame (status `05`). Reported elsewhere to be a phone-pairing field |
| `[15]` | status. Bit 0 set = final reading. Bits 1-2 = display unit (1 kg, 2 lb). `0x04` idle/settling (lb), `0x05` wake/tare event, `0x25` final (lb) |
| `[16]` | flags: `0x00` in the nothing-on-scale and barefoot captures, **`0x10` for the whole socks capture** (see Open question) |
| `[17:19]` | weight, little-endian uint16, 0.01 kg. Always kg, whatever the display shows |
| `[19:22]` | constant `4B 05 03` in every capture, with nothing on the scale, barefoot or socks. **Not impedance** |
| `[22:24]` | frame sequence counter (little-endian; 5005 to 5083 over the three captures) |

Status values seen: `0x02` settling (live weight), `0x03` with weight 0 = tare, `0x64` provisional/held
(stable bit but not final), `0x23` / `0x25` final (kg / lb display).

The scale repeats its final frame for a whole burst, so the app delivers one reading and ignores
repeats for 10 s (the real burst length is not known), or until a zero-weight frame shows you stepped
off (the scale returns to status `0x04`, weight 0, and the display shows 0).

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

## Verified on real hardware

Captured with nRF Connect from an ES-CS20M with FCC ID `2APXUES-CS20M`, MAC `ED:67:39:53:49:85`, display set to lb:

| Situation | Payload (from `AA BB`) | Decoded |
|---|---|---|
| Nothing on the scale | `aabbed6739534985 fcffc76a ffffff04 0000004b 05037312` | status `0x04`, weight 0 |
| Brief touch | `aabbed6739534985 d6ffc76a ffffff04 0060044b 05032812` | status `0x04`, 11.20 kg |
| Standing on it, locked | `aabbed6739534985 9100c86a ffffff25 00762a4b 05030313` | status `0x25`, **108.70 kg** = 239.64 lb; the display read 239.6 |

Observations: the scale advertises continuously while idle (about every 130 ms, weak at -70 to -91 dBm, so
keep the phone close); it is not connectable; bytes 8-9 and 22-23 change between packets (counters).
Status `0x25` is final with lb display; `0x23` is the kg equivalent.

## Barefoot vs socks vs nothing (capture screen, 2026-10-08)

Three recordings of 10-13 s each from the owner's scale: 58, 45 and 32 packets.

- The scale takes about **7 to 9 seconds to lock** after you step on (status `04` while the weight settles,
  `25` on the locked frame). The app waits for the locked frame.
- Bytes `[19:22]` = `4B 05 03` never change, in any condition. No impedance there.
- Barefoot and socks locked at the identical 109.10 kg.
- The only byte that reacted to the condition is `[16]`: `0x10` in every frame of the socks capture,
  `0x00` in the others.

### Open question

Does `[16]` follow the *current* foot contact, or is it left over from the *previous* weigh-in? The three
captures were taken in the order nothing, barefoot, socks, so both explanations fit. Distinguishing test:
record **Barefoot, Barefoot, Socks, Socks** in that order, each with a real weigh-in.
 - Follows current contact: `00, 00, 10, 10`.
 - Left over from the previous weigh-in: the second barefoot (or the second socks) would differ from the first.

Even if `[16]` follows contact, it is a single flag byte, not an impedance value.
