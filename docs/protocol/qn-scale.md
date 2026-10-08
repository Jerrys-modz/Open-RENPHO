# QN-series scale protocol (RENPHO ES-CS20M)

Source: ported from [renpho-escs20m](https://github.com/ronnnnnnnnnnnnn/renpho-escs20m) (MIT).
Not yet verified against our own scale. Verify with the capture steps below.

## Which hardware revision do I have?

The protocol varies with the HVIN printed on the scale's underside label (or FCC ID):

| HVIN / FCC ID | Protocol | Supported here |
|---|---|---|
| `ESCS20MA2` | QN extended (body fat computed on-device) | yes |
| `ESCS20MN`, no suffix | QN basic (weight + raw impedance) | yes |
| `ESCS20MB1` / `ESCS20MB2` | 0x55aa (service 0x1A10) | **no**, experimental upstream |
| FCC `2APXUES-CS20M` | 0xaabb, broadcast only, weight only | **no** |

## GATT

- Service `FFF0`, notify `FFF1`, command write `FFF2`.
- (Other QN scales use `FFE0`/`FFE1..4`. Not supported.)
- The scale advertises only while someone is on it. Manufacturer data (company ID 0xFFFF) carries the MAC in bytes 5..10 (little-endian); CoreBluetooth hides the real MAC, so on iOS we identify by peripheral UUID.

## Frames

All frames: `opcode, length, vendor(0xFF for RENPHO), …, checksum` where checksum = sum of preceding bytes & 0xFF. Multi-byte weight/impedance fields are big-endian; the init timestamp is little-endian seconds since 2000-01-01 UTC.

| Dir | Opcode | Meaning | Our reply |
|---|---|---|---|
| ← | `0x12` | unit request | `13 09 ff 01 10 … cs` (kg) |
| ← | `0x14` | measurement-init request | `20 08 ff <ts LE32> cs` |
| ← | `0x21` len ≥5 | extended: profile request | `a0 0d 02 fe ff ee <sex> <age> <h_mm BE16> <algo+athlete> 02 cs` |
| ← | `0x21` len 4 | basic: no reply needed | none |
| ← | `0x10` len `0x0e`/`0x0f` | extended measurement; byte 4 = status (0 unstable, 1 stable, 2 final+metrics) | on final: `1f 05 ff 10 cs` |
| ← | `0x10` len `0x0b` | basic measurement; byte 5 = status (0x00 settling, 0x11 BIA running, 0x01 final) | on final: `1f 05 ff 10 cs` |

Extended final frame: weight `[5..6]` /100 kg, resistance1 `[7..8]`, resistance2 `[9..10]`, body fat `[11..12]` /10 %.
Basic final frame: weight `[3..4]` /100 kg, resistance1 `[6..7]`, resistance2 `[8..9]`.

The scale will not start measuring without a profile reply. We always reply in guest mode (`fe` user id), so users registered in the official RENPHO app are untouched. With no profile configured we send `algorithm=0x00` (no on-device body fat).

## Not implemented in v1

- Stored offline readings (`0x22` query / `0x23..0x25` records). Readings taken without the app open stay on the scale.
- Metrics panels `0x15`/`0x16` (sent by other models such as the R-MSB01, not documented for the ES-CS20M).
- Other QN GATT layout (`FFE0`).

## Verifying on your own scale

1. nRF Connect (iOS): scan while standing on the scale; connect; confirm service `FFF0` with `FFF1`/`FFF2`. If the scale advertises a different service, or doesn't connect, it's one of the unsupported revisions above.
2. Enable notifications on `FFF1`, step on and off, and save the log. Compare frames to the table above.
3. Run the app and compare weight and impedance to the RENPHO app.
