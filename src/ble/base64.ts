// react-native-ble-plx exchanges characteristic values as base64 strings.
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

export function bytesToBase64(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i];
    const b1 = bytes[i + 1];
    const b2 = bytes[i + 2];
    out += ALPHABET[b0 >> 2];
    out += ALPHABET[((b0 & 3) << 4) | ((b1 ?? 0) >> 4)];
    out += b1 === undefined ? '=' : ALPHABET[((b1 & 15) << 2) | ((b2 ?? 0) >> 6)];
    out += b2 === undefined ? '=' : ALPHABET[b2 & 63];
  }
  return out;
}

export function base64ToBytes(b64: string): Uint8Array {
  const clean = b64.replace(/=+$/, '');
  const out = new Uint8Array(Math.floor((clean.length * 3) / 4));
  let o = 0;
  for (let i = 0; i < clean.length; i += 4) {
    const c = [0, 1, 2, 3].map((k) => (i + k < clean.length ? ALPHABET.indexOf(clean[i + k]) : 0));
    out[o++] = (c[0] << 2) | (c[1] >> 4);
    if (i + 2 < clean.length) out[o++] = ((c[1] & 15) << 4) | (c[2] >> 2);
    if (i + 3 < clean.length) out[o++] = ((c[2] & 3) << 6) | c[3];
  }
  return out;
}
