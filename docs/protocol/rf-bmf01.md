# RENPHO smart tape measure (RF-BMF01)

**Status: unknown.** No public protocol documentation found. This file is the
capture checklist; fill in the findings as you go and add fixtures to
`src/ble/tape/__tests__/`.

Related: DUC750 on CodeWithCJ/SparkyFitness is reverse-engineering the same
device. Coordinate on the issue before duplicating effort.

## Phase 0 checklist (iPhone, nRF Connect)

1. Install **nRF Connect** (Nordic). Close the RENPHO app and disconnect the tape from it (the tape usually accepts one connection).
2. Wake the tape (extend it) and scan. Record: advertised name, RSSI, manufacturer data (hex), advertised service UUIDs.
3. Connect. For every service, record each characteristic UUID and its properties (Read / Write / Write w/o response / Notify / Indicate).
4. Subscribe to every Notify/Indicate characteristic. Take a measurement (e.g. wrap it round something, lock the reading). Save all notification payloads (hex) with the true length in cm.
5. Repeat for several lengths (e.g. 10, 30, 60, 100 cm) and for inches vs cm mode if the tape has a unit toggle.
6. If nothing arrives on notify: the tape may need a handshake write first. Capture the official app instead:
   - iOS has no HCI snoop log by default. Options: Apple's *Bluetooth logging profile* + a Mac with Xcode "PacketLogger", or sniff with an nRF52 dongle + Wireshark.
7. Write down: unit encoding, byte offsets, checksum, whether a "stable"/"locked" flag exists, battery characteristic (0x2A19?).

## Findings

Captured with nRF Connect on iPhone, 2026-10-08.

**Advertisement**
- Local name `ES-Tape`; no advertised service UUIDs, so the app must match on the name.
- Manufacturer data, company ID `0x1A10`: `00 08 00 0A F0 2C 59 C3 0B F7 01 03`.
  Bytes 4..9 are the device MAC (forward order), matching the 0x55aa advert layout
  described in renpho-escs20m. Meaning of `00 08 00 0A` and `01 03` unknown.

**GATT** (besides Generic Access and Generic Attribute)
- Service `0783B03E-8535-B5A0-7140-A304D2495CB7`
  - `...CB8`: Notify (has a CCCD)
  - `...CBA`: Write Without Response (no commands needed so far)
- No Battery or Device Information service.
- The tape drops the connection after about 20-45 s of use.

**Data**
- Enabling notifications on `...CB8` is enough; no write is needed.
- Each notification is a 20-byte ASCII line: `*DDDDD;DDDDD;DDDDDPM\n`,
  e.g. `2A30 3230 3530 3B...` = `*02050;00000;0000PM`.
- Field 1 follows the live length (220, 720, 1580, ... 2050 while moving, 0 when retracted).
  All captured values are multiples of 10.
- Fields 2 and 3 were always 0. The suffix was `PM` with the tape in cm mode.
- A frame of 20 zero bytes arrives now and then, ~120 ms before a `*00000...` frame.
  Treated as an idle heartbeat.

**Unit (resolved, one inch-mode data point)**
- Field 1 is hundredths of a cm regardless of the tape's display unit.
  In inch mode the tape displayed 3.66 in while field 1 was `00930` and the suffix `PI`
  (9.30 cm / 2.54 = 3.661 in).
- Suffix = the tape's display unit: `PM` metric (cm), `PI` imperial (inches).

**Still unknown**
- What fields 2 and 3 are. Probably change when the tape's button is pressed (lock/hold).
- Only one inch-mode sample so far; a second length (e.g. a measured 30 cm) would confirm the scale.
