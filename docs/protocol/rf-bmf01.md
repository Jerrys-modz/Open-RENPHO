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

_(empty)_
