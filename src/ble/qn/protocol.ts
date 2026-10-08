/**
 * Wire protocol for QN-series scales (RENPHO ES-CS20M and relatives).
 *
 * Pure frame parsing and command building, no BLE I/O.
 *
 * Ported from renpho-escs20m by Ron (MIT):
 *   https://github.com/ronnnnnnnnnnnnn/renpho-escs20m
 * See THIRD_PARTY_NOTICES.md.
 */

// GATT: the RENPHO ES-CS20M uses the FFF0 service. Other QN scales (e.g.
// Arboleaf CS20M) use FFE0; not supported yet.
export const SERVICE_FFF0 = '0000fff0-0000-1000-8000-00805f9b34fb';
export const NOTIFY_CHAR = '0000fff1-0000-1000-8000-00805f9b34fb';
export const COMMAND_CHAR = '0000fff2-0000-1000-8000-00805f9b34fb';

/** The scale's epoch: 2000-01-01 00:00:00 UTC, as a unix timestamp. */
const EPOCH_OFFSET = 946656000;

export const OP = {
  MEASUREMENT: 0x10,
  UNIT_REQUEST: 0x12,
  MEAS_INIT_REQUEST: 0x14,
  EXTENDED_METRICS_1: 0x15,
  EXTENDED_METRICS_2: 0x16,
  PRE_MEASUREMENT: 0x21,
  STORED_MEASUREMENT: 0x23,
  STORED_METRICS_1: 0x24,
  STORED_METRICS_2: 0x25,
  USER_PROFILE: 0xa0,
  PROFILE_ACK: 0xa1,
} as const;

/** Frame length (byte 1) selects the flavor on measurement frames. */
export const LEN = {
  EXTENDED_MEASUREMENT: 0x0e,
  EXTENDED_MEASUREMENT_LONG: 0x0f,
  BASIC_MEASUREMENT: 0x0b,
  EXTENDED_PRE_MEASUREMENT: 0x05,
  BASIC_PRE_MEASUREMENT: 0x04,
} as const;

/** Per-device byte at frame offset 2 (RENPHO's is 0xFF). */
export const DEFAULT_VENDOR_BYTE = 0xff;

export const EXT_STATUS = {
  UNSTABLE: 0,
  STABLE: 1,
  STABLE_WITH_METRICS: 2,
} as const;

export const BASIC_STATUS = {
  SETTLING: 0x00,
  BIA_RUNNING: 0x11,
  FINAL: 0x01,
} as const;

/** Guest-mode sentinels: the scale treats the session as ephemeral. */
export const GUEST_USER_ID = 0xfe;
export const UNASSIGNED_USER_ID = 0xf0;
const GUEST_PAD_HI = 0xff;
const GUEST_PAD_LO = 0xee;
const USER_PROFILE_TRAILER_TAIL = 0x02;

export const DEFAULT_ALGORITHM = 0x04;

export interface ScaleProfile {
  sex: 0 | 1; // 0 = male, 1 = female
  age: number;
  heightM: number;
  athlete: boolean;
  /** On-device body fat algorithm. 0x00 disables body fat calculation. */
  algorithm: number;
}

/** Sent when no real profile is known: the scale won't measure without one. */
export const BOOTSTRAP_PROFILE: ScaleProfile = {
  sex: 0,
  age: 0,
  heightM: 0,
  athlete: false,
  algorithm: 0x00,
};

const checksum = (bytes: ArrayLike<number>, end: number): number => {
  let sum = 0;
  for (let i = 0; i < end; i++) sum += bytes[i];
  return sum & 0xff;
};

const u16be = (b: Uint8Array, at: number): number => (b[at] << 8) | b[at + 1];

export function buildUnitUpdateCommand(vendorByte = DEFAULT_VENDOR_BYTE): Uint8Array {
  // Always kilograms (0x01); the app converts for display.
  const p = Uint8Array.from([0x13, 0x09, vendorByte, 0x01, 0x10, 0, 0, 0, 0]);
  p[8] = checksum(p, 8);
  return p;
}

export function buildMeasurementInitiationCommand(
  vendorByte = DEFAULT_VENDOR_BYTE,
  nowMs: number = Date.now(),
): Uint8Array {
  const cmd = new Uint8Array(8);
  cmd[0] = 0x20;
  cmd[1] = 0x08;
  cmd[2] = vendorByte;
  const ts = Math.floor(nowMs / 1000) - EPOCH_OFFSET;
  new DataView(cmd.buffer).setUint32(3, ts >>> 0, true);
  cmd[7] = checksum(cmd, 7);
  return cmd;
}

export function buildEndMeasurementCommand(vendorByte = DEFAULT_VENDOR_BYTE): Uint8Array {
  const p = Uint8Array.from([0x1f, 0x05, vendorByte, 0x10, 0]);
  p[4] = checksum(p, 4);
  return p;
}

export function buildUserProfileCommand(profile: ScaleProfile): Uint8Array {
  const heightMm = Math.round(profile.heightM * 1000);
  if (heightMm < 0 || heightMm > 0xffff) {
    throw new RangeError('profile height must be in the range 0..65535 mm');
  }
  const flag = (profile.algorithm + (profile.athlete ? 0x0a : 0)) & 0xff;
  const p = Uint8Array.from([
    OP.USER_PROFILE,
    0x0d,
    0x02,
    GUEST_USER_ID,
    GUEST_PAD_HI,
    GUEST_PAD_LO,
    profile.sex & 0xff,
    profile.age & 0xff,
    (heightMm >> 8) & 0xff,
    heightMm & 0xff,
    flag,
    USER_PROFILE_TRAILER_TAIL,
    0,
  ]);
  p[12] = checksum(p, 12);
  return p;
}

export interface ExtendedFrame {
  weightKg: number;
  status: number;
  bodyFat: number | null;
  resistance1: number | null;
  resistance2: number | null;
}

/** Live extended-flavor measurement (`10 0e`, 14 bytes; `10 0f` has one extra). */
export function parseExtendedMeasurement(b: Uint8Array): ExtendedFrame {
  const status = b[4];
  const weightKg = round(u16be(b, 5) / 100, 2);
  let bodyFat: number | null = null;
  let resistance1: number | null = null;
  let resistance2: number | null = null;
  if (status === EXT_STATUS.STABLE_WITH_METRICS && b.length >= 13) {
    const bf = u16be(b, 11);
    if (bf) bodyFat = round(bf / 10, 1);
    const r1 = u16be(b, 7);
    const r2 = u16be(b, 9);
    if (r1 || r2) {
      resistance1 = r1;
      resistance2 = r2;
    }
  }
  return { weightKg, status, bodyFat, resistance1, resistance2 };
}

export interface BasicFrame {
  weightKg: number;
  status: number;
  resistance1: number;
  resistance2: number;
}

/** Live basic-flavor measurement (`10 0b`, 11 bytes). */
export function parseBasicMeasurement(b: Uint8Array): BasicFrame {
  return {
    weightKg: round(u16be(b, 3) / 100, 2),
    status: b[5],
    resistance1: u16be(b, 6),
    resistance2: u16be(b, 8),
  };
}

export function round(x: number, digits: number): number {
  const s = 10 ** digits;
  return Math.floor(x * s + 0.5) / s;
}
