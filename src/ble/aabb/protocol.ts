/**
 * Broadcast-only ES-CS20M variant (FCC ID 2APXUES-CS20M), "0xaabb" protocol.
 *
 * The scale does not accept connections. It puts the weight in its Bluetooth advertisements
 * (manufacturer data, company ID 0xFFFF), so we only listen. There is no impedance, so no
 * body composition comes from the scale itself.
 *
 * Ported from renpho-escs20m by Ron (MIT); the test frames are real captures from that
 * project. See THIRD_PARTY_NOTICES.md. Not yet verified on this app's hardware.
 */

export const COMPANY_ID = 0xffff;

const MAGIC_0 = 0xaa;
const MAGIC_1 = 0xbb;
/** Bytes up to index 18 (weight high byte) must exist. */
const MIN_PAYLOAD_LEN = 19;
const FINAL_BIT = 0x01;

export type DisplayUnit = 'kg' | 'lb';

export interface BroadcastFrame {
  /** Device MAC from the payload (bytes 2-7), lower-case, colon separated. */
  mac: string;
  /** Always kilograms on the wire, whatever the scale's LCD shows. */
  weightKg: number;
  /** True for the settled, committed reading. */
  final: boolean;
  /** What the scale's display is set to. Informational. */
  displayUnit: DisplayUnit | null;
  status: number;
}

/** Splits raw manufacturer data (as ble-plx returns it) into company ID and payload. */
export function splitManufacturerData(bytes: Uint8Array): { companyId: number; payload: Uint8Array } | null {
  if (bytes.length < 2) return null;
  return { companyId: bytes[0] | (bytes[1] << 8), payload: bytes.subarray(2) };
}

export function decodeDisplayUnit(status: number): DisplayUnit | null {
  const code = (status >> 1) & 0x07;
  return code === 1 ? 'kg' : code === 2 ? 'lb' : null;
}

const hex2 = (n: number) => n.toString(16).padStart(2, '0');

/** Null for anything that is not a frame of this protocol. */
export function parseBroadcast(companyId: number, payload: Uint8Array): BroadcastFrame | null {
  if (companyId !== COMPANY_ID) return null;
  if (payload.length < MIN_PAYLOAD_LEN) return null;
  if (payload[0] !== MAGIC_0 || payload[1] !== MAGIC_1) return null;

  const status = payload[15];
  const weightKg = Math.round(payload[17] | (payload[18] << 8)) / 100;
  return {
    mac: Array.from(payload.subarray(2, 8), hex2).join(':'),
    weightKg,
    // A tare frame is "final"-flagged with a weight of 0; that is not a reading.
    final: (status & FINAL_BIT) === FINAL_BIT && weightKg > 0,
    displayUnit: decodeDisplayUnit(status),
    status,
  };
}
