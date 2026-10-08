/**
 * RENPHO smart tape measure (RF-BMF01, advertises as "ES-Tape").
 *
 * Notifications on characteristic ...CB8 of service ...CB7 are 20-byte ASCII
 * lines, e.g. "*02050;00000;0000PM\n". Findings and open questions are in
 * docs/protocol/rf-bmf01.md. No handshake was needed: notifications start as
 * soon as they're enabled.
 *
 * Field 1 is the length in hundredths of a cm, whatever unit the tape is
 * displaying. Evidence: 00930 while the tape showed 3.66 in, and 03150 while it
 * showed 12.4 in (31.50 cm = 12.40 in).
 *
 * The two-letter suffix is [trigger][unit]:
 *  - trigger: "P" for normal streaming frames; "S" for ~0.4 s after the
 *    checkmark button is pressed (inferred "save"; one capture, two presses).
 *  - unit: "M" metric display, "I" imperial display.
 * The tape only notifies on change or button press, not continuously.
 *
 * The meaning of fields 2 and 3 is unconfirmed (always 0 so far), so the
 * parser also returns the raw integers.
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
      /** Two-letter suffix, e.g. "PM", "PI", "SI". */
      suffix: string;
      /** "save" when the checkmark button was just pressed ("S"), "live" otherwise ("P"). */
      trigger: 'live' | 'save' | 'unknown';
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
    trigger: m[4][0] === 'P' ? 'live' : m[4][0] === 'S' ? 'save' : 'unknown',
    displayUnit: m[4][1] === 'M' ? 'metric' : m[4][1] === 'I' ? 'imperial' : 'unknown',
  };
}

/** Length in cm for a reading frame (independent of the tape's display unit). */
export function lengthCm(frame: Extract<TapeFrame, { kind: 'reading' }>): number {
  return frame.primary / 100;
}
