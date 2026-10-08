/**
 * RENPHO smart tape measure (RF-BMF01, advertises as "ES-Tape").
 *
 * Notifications on characteristic ...CB8 of service ...CB7 are 20-byte ASCII
 * lines, e.g. "*02050;00000;0000PM\n". Findings and open questions are in
 * docs/protocol/rf-bmf01.md. No handshake was needed: notifications start as
 * soon as they're enabled.
 *
 * Field 1 is the live length in hundredths of a cm, whatever unit the tape is
 * displaying. Evidence: in inch mode the tape showed 3.66 in while field 1 was
 * 00930 (9.30 cm = 3.661 in). The suffix is the tape's display unit: "PM"
 * (metric, cm) and "PI" (imperial, inches). One inch-mode data point so far.
 * The meaning of fields 2 and 3 is unconfirmed, so the parser also returns the
 * raw integers.
 */

export const TAPE_SERVICE = '0783b03e-8535-b5a0-7140-a304d2495cb7';
export const TAPE_NOTIFY_CHAR = '0783b03e-8535-b5a0-7140-a304d2495cb8';
export const TAPE_WRITE_CHAR = '0783b03e-8535-b5a0-7140-a304d2495cba';
export const TAPE_LOCAL_NAME = 'ES-Tape';

export type TapeFrame =
  | {
      kind: 'reading';
      /** Live length, raw digits (always a multiple of 10 in captures). */
      primary: number;
      /** Second field; always 0 in captures so far. */
      secondary: number;
      /** Third field; always 0 in captures so far. */
      tertiary: number;
      /** Two-letter suffix: "PM" (metric display) or "PI" (imperial display). */
      suffix: string;
      /** The unit the tape's own display is set to. Does not change `primary`. */
      displayUnit: 'metric' | 'imperial' | 'unknown';
    }
  // 20 zero bytes, sent as a heartbeat between readings.
  | { kind: 'idle' };

const LINE = /^\*(\d{5});(\d{5});(\d{4})([A-Z]{2})\n?$/;

/** Returns null for anything that isn't a recognised tape frame. */
export function parseTapeFrame(bytes: Uint8Array): TapeFrame | null {
  if (bytes.length > 0 && bytes.every((b) => b === 0)) return { kind: 'idle' };
  let text = '';
  for (const b of bytes) text += String.fromCharCode(b);
  const m = LINE.exec(text);
  if (!m) return null;
  return {
    kind: 'reading',
    primary: Number(m[1]),
    secondary: Number(m[2]),
    tertiary: Number(m[3]),
    suffix: m[4],
    displayUnit: m[4] === 'PM' ? 'metric' : m[4] === 'PI' ? 'imperial' : 'unknown',
  };
}

/** Length in cm for a reading frame (independent of the tape's display unit). */
export function lengthCm(frame: Extract<TapeFrame, { kind: 'reading' }>): number {
  return frame.primary / 100;
}
