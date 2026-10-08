# Beurer BF720

Connectable scale using the standard Bluetooth SIG profiles. **Not yet verified on hardware by this
project.** Everything below comes from another developer's captures of a real BF720
([bascule](https://github.com/bearyjd/bascule), `docs/prp/03-hardware-validation.md`) plus the SIG
specifications. The decoders are tested against those captured bytes
(`src/ble/beurer/__tests__`).

## Services

| Service | Characteristic | Use |
|---|---|---|
| User Data `0x181C` | `0x2A9F` User Control Point (write + indicate) | register / consent |
| User Data `0x181C` | `0x2A85` DOB, `0x2A8C` gender, `0x2A8E` height | profile the scale uses for body fat (written best effort after consent) |
| Weight Scale `0x181D` | `0x2A9D` (indicate) | weight, timestamp, user id, BMI, height |
| Body Composition `0x181B` | `0x2A9C` (indicate) | body fat, BMR, muscle %, water, **impedance** |
| Current Time `0x1805` | `0x2A2B` (write) | set the scale's clock |

Advertised name `BF720`, advertising service `0x181D`.

## Handshake

The scale sends nothing until a client has identified itself, and the link must be encrypted
(iOS shows its pairing prompt on first access).

1. Subscribe to indications on `0x2A9F`, `0x2A9D`, `0x2A9C` **before** consent.
2. First time: write `01 <code u16 LE>` (Register New User). Response `20 01 01 <slot>`. The code is any
   0-9999 number we pick; the app stores `{slot, code}` in `beurer-pairing.json`. Registering burns one of
   the scale's 8 slots until a factory reset.
3. Write `02 <slot> <code u16 LE>` (Consent). Response `20 02 01` = accepted. Other results: `04` no free
   slot (register), `05` user not authorized (wrong code).
4. Stored readings arrive once, right after consent; live readings arrive as they happen. The scale only
   reports live to a connected phone and drops an idle link after several minutes.

## Frames

Little-endian. Weight Measurement (15 bytes in captures), flags `0x0E`: weight `u16 x 0.005 kg`, timestamp
(7 bytes), user id, BMI `u16 x 0.1`, height `u16 x 0.001 m`.

Body Composition (14 bytes), flags `0x0398`: body fat `u16 x 0.1 %`, BMR `u16 kJ`, muscle `u16 x 0.1 %`,
soft lean mass and body water mass `u16 x 0.005 kg`, **impedance `u16 x 0.1 ohm`**. No timestamp or user id,
so it is paired with the preceding Weight frame by order.

Captured values: 437.0 and 435.0 ohm (two sessions weeks apart). The Feature characteristic suggests 0.01 kg
mass resolution, but the captured soft-lean and water values only match 0.005 kg, which is what we use.

## What is mapped

Weight, body fat, impedance, BMR (kJ to kcal), BMI, muscle mass (weight x muscle %), body water % (water
mass / weight) come from the scale. Bone mass, protein and skeletal muscle % are not sent; they stay
estimates from body fat, as with the RENPHO scales.

## Unverified

- Whether writing DOB / gender / height to the standard characteristics changes the scale's body fat (the
  scale also has a proprietary profile record store at `0xFFFF` that we do not use).
- Exact behaviour when the Beurer app already holds slots.
- How the consent flow behaves on iOS when bonding is interrupted.
