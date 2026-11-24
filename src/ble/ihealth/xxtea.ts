/**
 * XXTEA variant used by the iHealth KN-550BT's current firmware. Ported from NickLD/hass-ihealth-bp
 * (MIT), see THIRD_PARTY_NOTICES.md. Little-endian words, and encryption appends the plaintext
 * length as an extra word so the receiver can strip padding.
 */
const DELTA = 0x9e3779b9;

function mx(s: number, y: number, z: number, p: number, e: number, k: Uint32Array): number {
  const a = (((z >>> 5) ^ (y << 2)) + ((y >>> 3) ^ (z << 4))) >>> 0;
  const b = ((s ^ y) + (k[(p & 3) ^ e] ^ z)) >>> 0;
  return (a ^ b) >>> 0;
}

const rounds = (n: number) => 6 + Math.floor(52 / n);

function toWords(bytes: Uint8Array, count: number): Uint32Array {
  const w = new Uint32Array(count);
  for (let i = 0; i < bytes.length; i++) w[i >> 2] |= bytes[i] << ((i & 3) * 8);
  return w.map((x) => x >>> 0);
}

function fromWords(w: Uint32Array): Uint8Array {
  const out = new Uint8Array(w.length * 4);
  for (let i = 0; i < out.length; i++) out[i] = (w[i >> 2] >>> ((i & 3) * 8)) & 0xff;
  return out;
}

function keyWords(key: Uint8Array): Uint32Array {
  return toWords(key.subarray(0, 16), 4);
}

function encryptWords(v: Uint32Array, k: Uint32Array): void {
  const n = v.length - 1;
  let z = v[n];
  let s = 0;
  for (let r = rounds(v.length); r > 0; r--) {
    s = (s + DELTA) >>> 0;
    const e = (s >>> 2) & 3;
    let y: number;
    for (let p = 0; p < n; p++) {
      y = v[p + 1];
      z = v[p] = (v[p] + mx(s, y, z, p, e, k)) >>> 0;
    }
    y = v[0];
    z = v[n] = (v[n] + mx(s, y, z, n, e, k)) >>> 0;
  }
}

function decryptWords(v: Uint32Array, k: Uint32Array): void {
  const n = v.length - 1;
  let y = v[0];
  let s = Math.imul(rounds(v.length), DELTA) >>> 0;
  while (s !== 0) {
    const e = (s >>> 2) & 3;
    let z: number;
    for (let p = n; p > 0; p--) {
      z = v[p - 1];
      y = v[p] = (v[p] - mx(s, y, z, p, e, k)) >>> 0;
    }
    z = v[n];
    y = v[0] = (v[0] - mx(s, y, z, 0, e, k)) >>> 0;
    s = (s - DELTA) >>> 0;
  }
}

/** Output is the input padded to 4 bytes, plus 4 for the length word. */
export function xxtea2Encrypt(data: Uint8Array, key: Uint8Array): Uint8Array {
  if (data.length === 0) return new Uint8Array(0);
  const words = Math.ceil(data.length / 4) + 1;
  const v = toWords(data, words);
  v[words - 1] = data.length;
  encryptWords(v, keyWords(key));
  return fromWords(v);
}

/** Returns null when the data is not a valid ciphertext for this key (wrong length word). */
export function xxtea2Decrypt(data: Uint8Array, key: Uint8Array): Uint8Array | null {
  if (data.length === 0) return new Uint8Array(0);
  if (data.length % 4 !== 0 || data.length < 8) return null;
  const v = toWords(data, data.length / 4);
  decryptWords(v, keyWords(key));
  const n = v[v.length - 1];
  if (n < 4 * v.length - 7 || n > 4 * v.length - 4) return null;
  return fromWords(v).subarray(0, n);
}
