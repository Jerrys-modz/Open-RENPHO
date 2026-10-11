/**
 * Beurer BF720 (and relatives) speak the standard Bluetooth SIG profiles: Weight Scale (0x181D),
 * Body Composition (0x181B) and User Data (0x181C). Pure frame parsing and command building.
 *
 * Byte layouts follow the SIG specs and were checked against real BF720 captures published by the
 * bascule project (https://github.com/bearyjd/bascule, docs/prp/03-hardware-validation.md). See
 * docs/protocol/beurer-bf720.md.
 */

const sig = (id: string) => `0000${id}-0000-1000-8000-00805f9b34fb`;

export const SERVICE_WEIGHT_SCALE = sig('181d');
export const SERVICE_BODY_COMPOSITION = sig('181b');
export const SERVICE_USER_DATA = sig('181c');
export const SERVICE_CURRENT_TIME = sig('1805');

export const CHAR_WEIGHT_MEASUREMENT = sig('2a9d');
export const CHAR_BODY_COMPOSITION_MEASUREMENT = sig('2a9c');
export const CHAR_USER_CONTROL_POINT = sig('2a9f');
export const CHAR_CURRENT_TIME = sig('2a2b');
export const CHAR_DATE_OF_BIRTH = sig('2a85');
export const CHAR_GENDER = sig('2a8c');
export const CHAR_HEIGHT = sig('2a8e');

/** Resolution of masses and weights in SI mode (kg) and imperial mode (lb). */
const KG_STEP = 0.005;
const LB_STEP = 0.01;
const LB_TO_KG = 0.45359237;
const KJ_PER_KCAL = 4.184;

class Reader {
  private pos = 0;
  constructor(private readonly b: Uint8Array) {}
  has(n: number): boolean {
    return this.pos + n <= this.b.length;
  }
  u8(): number {
    return this.b[this.pos++];
  }
  u16(): number {
    const v = this.b[this.pos] | (this.b[this.pos + 1] << 8);
    this.pos += 2;
    return v;
  }
  /** The 7-byte SIG date_time, read as local time. Returns Unix ms. */
  dateTime(): number {
    const year = this.u16();
    const month = this.u8();
    const day = this.u8();
    const hour = this.u8();
    const minute = this.u8();
    const second = this.u8();
    return new Date(year, month - 1, day, hour, minute, second).getTime();
  }
}

export interface ScaleWeightFrame {
  weightKg: number;
  /** Unix ms, from the scale's clock (local time). */
  takenAt: number | null;
  userIndex: number | null;
  bmi: number | null;
  heightM: number | null;
}

/** Weight Measurement (0x2A9D). Returns null for a frame that is too short or reports a failure. */
export function parseWeightMeasurement(data: Uint8Array): ScaleWeightFrame | null {
  if (data.length < 3) return null;
  const r = new Reader(data);
  const flags = r.u8();
  const imperial = (flags & 0x01) !== 0;
  const raw = r.u16();
  // 0xFFFF means "measurement unsuccessful".
  if (raw === 0xffff) return null;
  const weightKg = imperial ? raw * LB_STEP * LB_TO_KG : raw * KG_STEP;

  let takenAt: number | null = null;
  let userIndex: number | null = null;
  let bmi: number | null = null;
  let heightM: number | null = null;
  if (flags & 0x02) {
    if (!r.has(7)) return null;
    takenAt = r.dateTime();
  }
  if (flags & 0x04) {
    if (!r.has(1)) return null;
    const u = r.u8();
    userIndex = u === 0xff ? null : u;
  }
  if (flags & 0x08) {
    if (!r.has(4)) return null;
    bmi = r.u16() * 0.1;
    const h = r.u16();
    heightM = imperial ? h * 0.1 * 0.0254 : h * 0.001;
  }
  return { weightKg: round(weightKg, 3), takenAt, userIndex, bmi: bmi === null ? null : round(bmi, 1), heightM };
}

export interface ScaleBodyFrame {
  bodyFatPercent: number | null;
  takenAt: number | null;
  userIndex: number | null;
  bmrKcal: number | null;
  musclePercent: number | null;
  muscleMassKg: number | null;
  fatFreeMassKg: number | null;
  softLeanMassKg: number | null;
  bodyWaterMassKg: number | null;
  impedanceOhms: number | null;
  weightKg: number | null;
}

/** Body Composition Measurement (0x2A9C). Absent fields are null. */
export function parseBodyCompositionMeasurement(data: Uint8Array): ScaleBodyFrame | null {
  if (data.length < 4) return null;
  const r = new Reader(data);
  const flags = r.u16();
  const imperial = (flags & 0x0001) !== 0;
  const mass = (raw: number) => round(imperial ? raw * LB_STEP * LB_TO_KG : raw * KG_STEP, 3);

  const fat = r.u16();
  const out: ScaleBodyFrame = {
    bodyFatPercent: fat === 0xffff ? null : round(fat * 0.1, 1),
    takenAt: null,
    userIndex: null,
    bmrKcal: null,
    musclePercent: null,
    muscleMassKg: null,
    fatFreeMassKg: null,
    softLeanMassKg: null,
    bodyWaterMassKg: null,
    impedanceOhms: null,
    weightKg: null,
  };
  // Optional fields appear in flag-bit order; stop if the frame is shorter than its flags claim.
  const u16 = (bit: number, set: (v: number) => void): boolean => {
    if (!(flags & bit)) return true;
    if (!r.has(2)) return false;
    set(r.u16());
    return true;
  };
  if (flags & 0x0002) {
    if (!r.has(7)) return null;
    out.takenAt = r.dateTime();
  }
  if (flags & 0x0004) {
    if (!r.has(1)) return null;
    const u = r.u8();
    out.userIndex = u === 0xff ? null : u;
  }
  const ok =
    u16(0x0008, (v) => (out.bmrKcal = Math.round(v / KJ_PER_KCAL))) &&
    u16(0x0010, (v) => (out.musclePercent = round(v * 0.1, 1))) &&
    u16(0x0020, (v) => (out.muscleMassKg = mass(v))) &&
    u16(0x0040, (v) => (out.fatFreeMassKg = mass(v))) &&
    u16(0x0080, (v) => (out.softLeanMassKg = mass(v))) &&
    u16(0x0100, (v) => (out.bodyWaterMassKg = mass(v))) &&
    u16(0x0200, (v) => (out.impedanceOhms = round(v * 0.1, 1))) &&
    u16(0x0400, (v) => (out.weightKg = mass(v)));
  return ok ? out : null;
}

// ---- User Control Point (0x2A9F) -----------------------------------------------------------

export const UCP = {
  REGISTER_NEW_USER: 0x01,
  CONSENT: 0x02,
  DELETE_USER_DATA: 0x03,
  RESPONSE: 0x20,
} as const;

export const UCP_RESULT = {
  SUCCESS: 0x01,
  NOT_SUPPORTED: 0x02,
  INVALID_PARAMETER: 0x03,
  OPERATION_FAILED: 0x04,
  USER_NOT_AUTHORIZED: 0x05,
} as const;

/** The consent code is a 16-bit number; the Beurer app uses 4 decimal digits. */
export const MAX_CONSENT_CODE = 9999;

const le16 = (v: number): [number, number] => [v & 0xff, (v >> 8) & 0xff];

export function buildRegisterNewUser(consentCode: number): Uint8Array {
  return Uint8Array.from([UCP.REGISTER_NEW_USER, ...le16(consentCode)]);
}

export function buildConsent(userIndex: number, consentCode: number): Uint8Array {
  return Uint8Array.from([UCP.CONSENT, userIndex, ...le16(consentCode)]);
}

export interface UcpResponse {
  requestOpcode: number;
  result: number;
  /** For Register New User, the index of the slot the scale assigned. */
  userIndex: number | null;
}

export function parseUcpResponse(data: Uint8Array): UcpResponse | null {
  if (data.length < 3 || data[0] !== UCP.RESPONSE) return null;
  const requestOpcode = data[1];
  const result = data[2];
  const userIndex =
    requestOpcode === UCP.REGISTER_NEW_USER && result === UCP_RESULT.SUCCESS && data.length >= 4 ? data[3] : null;
  return { requestOpcode, result, userIndex };
}

export function describeUcpFailure(requestOpcode: number, result: number): string {
  if (requestOpcode === UCP.REGISTER_NEW_USER) {
    return result === UCP_RESULT.OPERATION_FAILED
      ? 'The scale has no free user slot. Remove one in the Beurer app or factory-reset the scale.'
      : `The scale refused to register a new user (code ${result}).`;
  }
  if (requestOpcode === UCP.CONSENT) {
    return result === UCP_RESULT.USER_NOT_AUTHORIZED || result === UCP_RESULT.INVALID_PARAMETER
      ? 'The scale did not accept the stored user code. Reset the Beurer pairing in settings.'
      : `The scale refused the user code (code ${result}).`;
  }
  return `The scale reported an error (code ${result}).`;
}

// ---- Profile and clock writes ---------------------------------------------------------------

/** Current Time (0x2A2B): 10 bytes, local time. */
export function buildCurrentTime(d: Date): Uint8Array {
  const dow = d.getDay() === 0 ? 7 : d.getDay(); // 1 = Monday .. 7 = Sunday
  return Uint8Array.from([
    ...le16(d.getFullYear()),
    d.getMonth() + 1,
    d.getDate(),
    d.getHours(),
    d.getMinutes(),
    d.getSeconds(),
    dow,
    0, // fractions256
    0, // adjust reason
  ]);
}

/** Date of Birth (0x2A85): year u16, month, day. */
export function buildDateOfBirth(isoDate: string): Uint8Array | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
  if (!m) return null;
  return Uint8Array.from([...le16(Number(m[1])), Number(m[2]), Number(m[3])]);
}

/** Gender (0x2A8C): 0 male, 1 female. */
export const buildGender = (sex: 'male' | 'female'): Uint8Array => Uint8Array.from([sex === 'female' ? 1 : 0]);

/** Height (0x2A8E): whole centimetres, u16. */
export const buildHeight = (heightCm: number): Uint8Array => Uint8Array.from(le16(Math.round(heightCm)));

export const MAX_USER_SLOT = 8;

export type SlotLink = { ok: true; userIndex: number; consentCode: number } | { ok: false; error: string };

/** Checks a slot number and PIN typed from the Beurer app. The scale has 8 slots; the PIN is up to 4 digits. */
export function parseSlotLink(slotText: string, pinText: string): SlotLink {
  const slot = slotText.trim();
  const pin = pinText.trim();
  if (!/^\d+$/.test(slot) || Number(slot) < 1 || Number(slot) > MAX_USER_SLOT) {
    return { ok: false, error: `The user number is 1 to ${MAX_USER_SLOT}.` };
  }
  if (!/^\d{1,4}$/.test(pin)) return { ok: false, error: 'The PIN is up to 4 digits.' };
  return { ok: true, userIndex: Number(slot), consentCode: Number(pin) };
}

function round(v: number, digits: number): number {
  const f = 10 ** digits;
  return Math.round(v * f) / f;
}
