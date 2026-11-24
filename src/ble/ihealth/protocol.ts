/**
 * iHealth KN-550BT blood-pressure cuff, current firmware (service "com.jiuan.dev"). Pure TypeScript,
 * no I/O. Ported from NickLD/hass-ihealth-bp (MIT), see THIRD_PARTY_NOTICES.md and
 * docs/protocol/ihealth-kn550bt.md.
 */
import { xxtea2Decrypt, xxtea2Encrypt } from './xxtea';

export const SERVICE_UUID = '636f6d2e-6a69-7561-6e2e-646576000000'; // "com.jiuan.dev"
/** "rec." + the rest of the service UUID: we write commands here. */
export const WRITE_UUID = '7265632e-6a69-7561-6e2e-646576000000';
/** "sed." + the rest of the service UUID: the cuff notifies here. */
export const NOTIFY_UUID = '7365642e-6a69-7561-6e2e-646576000000';
export const MODEL_UUID = '00002a24-0000-1000-8000-00805f9b34fb';
export const EXPECTED_MODEL = 'KN-550BT';

export const MTU_CHUNK = 20;
export const RECORD_SIZE = 11;

export const DEVICE_TYPE = 0xa1;
export const CMD = {
  battery: 0x20,
  functionInfo: 0x21, // also sets the clock
  error: 0x38,
  offlineCount: 0x40,
  offlineData: 0x4a,
  offlineDataOver: 0x47, // deletes the downloaded readings from the cuff
  identify: 0xfa,
  identifyChallenge: 0xfb,
  identifyResponse: 0xfc,
  identifyOk: 0xfd,
  identifyFail: 0xfe,
} as const;

/** IdentifyIns2 key shared by every KN-550BT. */
export const KEY = new Uint8Array([25, 1, 7, 150, 242, 35, 26, 104, 139, 84, 52, 98, 140, 87, 235, 25]);

export const ERRORS: Record<number, string> = {
  1: 'Systolic pressure not found',
  2: 'Diastolic pressure not found',
  3: 'Inflation too fast',
  4: 'Inflation too slow',
  5: 'Pressure exceeded 300 mmHg',
  6: 'Pressure stayed above 15 mmHg for too long',
  13: 'Low battery',
  14: 'Reading above upper limit',
  16: 'Reading below lower limit',
  17: 'Arm movement during measurement',
  32: 'The cuff is measuring',
};

export interface Packet {
  command: number;
  /** Everything after the command byte, without the checksum. */
  data: Uint8Array;
}

const sum8 = (b: ArrayLike<number>, from: number, to: number): number => {
  let s = 0;
  for (let i = from; i < to; i++) s += b[i];
  return s & 0xff;
};

export const cmd = (command: number, ...args: number[]): Uint8Array => new Uint8Array([DEVICE_TYPE, command, ...args]);

/** B0 len 00 seq <payload> sum(bytes after len). */
export function buildFrame(seq: number, payload: Uint8Array): Uint8Array {
  const f = new Uint8Array(payload.length + 5);
  f[0] = 0xb0;
  f[1] = payload.length + 2;
  f[2] = 0x00;
  f[3] = seq & 0xff;
  f.set(payload, 4);
  f[f.length - 1] = sum8(f, 2, f.length - 1);
  return f;
}

export function chunk(frame: Uint8Array): Uint8Array[] {
  const out: Uint8Array[] = [];
  for (let i = 0; i < frame.length; i += MTU_CHUNK) out.push(frame.subarray(i, i + MTU_CHUNK));
  return out;
}

/** Reassembles `A0 len flag seq A1 cmd data… sum` frames from a byte stream split across notifications. */
export class StreamParser {
  private buf: number[] = [];

  feed(bytes: Uint8Array): Packet[] {
    this.buf.push(...bytes);
    const out: Packet[] = [];
    for (;;) {
      const start = this.buf.indexOf(0xa0);
      if (start < 0) {
        this.buf = [];
        return out;
      }
      if (start > 0) this.buf.splice(0, start);
      if (this.buf.length < 2) return out;
      const total = this.buf[1] + 3;
      if (this.buf.length < total) return out;
      const frame = this.buf.splice(0, total);
      if (total <= 6 || sum8(frame, 2, total - 1) !== frame[total - 1]) continue;
      out.push({ command: frame[5], data: Uint8Array.from(frame.slice(6, total - 1)) });
    }
  }
}

/** Every byte 0..127, as the app does. */
export function makeChallenge(random: (n: number) => Uint8Array): Uint8Array {
  return random(16).map((b) => b & 0x7f);
}

export const identifyPayload = (r1: Uint8Array): Uint8Array => new Uint8Array([DEVICE_TYPE, CMD.identify, ...r1]);

/**
 * Answers the cuff's 52-byte challenge (R2[16] E[20] S[16]). Returns null if the cuff fails to prove
 * it knows the key (E must decrypt to our R1).
 */
export function identifyAnswer(challenge: Uint8Array, r1: Uint8Array, key: Uint8Array = KEY): Uint8Array | null {
  if (challenge.length !== 52) return null;
  const r2 = challenge.subarray(0, 16);
  const rEnc = challenge.subarray(16, 36);
  const seed = challenge.subarray(36, 52);
  const ka = xxtea2Encrypt(seed, key);
  const back = xxtea2Decrypt(rEnc, ka);
  if (!back || back.length !== r1.length || back.some((b, i) => b !== r1[i])) return null;
  return new Uint8Array([DEVICE_TYPE, CMD.identifyResponse, ...xxtea2Encrypt(r2, ka)]);
}

/** Set-clock payload. The cuff stores naive local time. */
export function functionInfoPayload(now: Date): Uint8Array {
  return cmd(
    CMD.functionInfo,
    Math.max(now.getFullYear() - 2000, 0),
    now.getMonth() + 1,
    now.getDate(),
    now.getHours(),
    now.getMinutes(),
    now.getSeconds(),
  );
}

export interface CuffReading {
  /** Unix ms, from the cuff's local clock. */
  takenAt: number;
  systolic: number;
  diastolic: number;
  pulse: number;
  irregularPulse: boolean;
  bodyMovement: boolean;
}

/** 11-byte records: YY MM DD hh mm ss (sys-dia) dia pulse scheme flags. Invalid records are skipped. */
export function parseRecords(buf: Uint8Array): CuffReading[] {
  const out: CuffReading[] = [];
  for (let i = 0; i + RECORD_SIZE <= buf.length; i += RECORD_SIZE) {
    const [y, mo, d, h, mi, s, diff, dia, pulse, , flags] = buf.subarray(i, i + RECORD_SIZE);
    const date = new Date(2000 + y, mo - 1, d, h, mi, s);
    const valid =
      mo >= 1 && mo <= 12 && d >= 1 && d <= 31 && h < 24 && mi < 60 && s < 60 && date.getMonth() === mo - 1;
    if (!valid) continue;
    out.push({
      takenAt: date.getTime(),
      systolic: diff + dia,
      diastolic: dia,
      pulse,
      irregularPulse: (flags & 0x80) !== 0,
      bodyMovement: (flags & 0x10) !== 0,
    });
  }
  return out;
}
