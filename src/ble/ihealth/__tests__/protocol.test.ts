import {
  CMD,
  KEY,
  StreamParser,
  buildFrame,
  chunk,
  cmd,
  functionInfoPayload,
  identifyAnswer,
  identifyPayload,
  parseRecords,
} from '../protocol';
import { xxtea2Decrypt, xxtea2Encrypt } from '../xxtea';

const hex = (s: string) => Uint8Array.from(s.match(/../g)!.map((b) => parseInt(b, 16)));
const toHex = (b: Uint8Array) => Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');

// Frames captured from a real KN-550BT (fw 303) by hass-ihealth-bp, 2026-10-21. The cuff accepted the answer.
const IDENTIFY_TX = hex('b0140001a1fa521c404e220e63526b59592f457226751b');
const CHALLENGE_RX = hex(
  'a0380001a1fb33127bb4abdd515b0c31002074320020d97e105b3a56ee0eca48e2e21a4c91aebd9bc5ed004d32650e8900000000000000000000b6',
);
const ANSWER_TX = hex('b0180003a1fc8ab2cd0157412a6c83143694495a0a3d5823077318');
const OFFLINE_RX = hex('a0110009a14a01001a0a150e341f3d4045000051');

describe('framing', () => {
  it('rebuilds the captured identify frame and a battery request', () => {
    expect(toHex(buildFrame(1, identifyPayload(IDENTIFY_TX.subarray(6, 22))))).toBe(toHex(IDENTIFY_TX));
    expect(toHex(buildFrame(5, cmd(CMD.battery, 0, 0, 0)))).toBe('b0070005a120000000c6');
  });

  it('splits frames into 20-byte writes', () => {
    expect(chunk(IDENTIFY_TX).map((c) => c.length)).toEqual([20, 3]);
  });

  it('reassembles a reply split across notifications and ignores a bad checksum', () => {
    const p = new StreamParser();
    expect(p.feed(CHALLENGE_RX.subarray(0, 20))).toEqual([]);
    expect(p.feed(CHALLENGE_RX.subarray(20, 40))).toEqual([]);
    const tail = new Uint8Array([...CHALLENGE_RX.subarray(40), ...hex('a0040003a1fda1')]);
    const [challenge, ok] = p.feed(tail);
    expect(challenge.command).toBe(CMD.identifyChallenge);
    expect(challenge.data.length).toBe(52);
    expect(ok.command).toBe(CMD.identifyOk);
    expect(new StreamParser().feed(hex('a0040003a1fda2'))).toEqual([]);
  });

  it('sets the clock from local time', () => {
    expect(Array.from(functionInfoPayload(new Date(2026, 9, 21, 15, 9, 5)))).toEqual([0xa1, 0x21, 26, 10, 21, 15, 9, 5]);
  });
});

describe('authentication', () => {
  const r1 = IDENTIFY_TX.subarray(6, 22);
  const [challenge] = new StreamParser().feed(CHALLENGE_RX);

  it('produces exactly the answer the real cuff accepted', () => {
    const answer = identifyAnswer(challenge.data, r1)!;
    expect(toHex(buildFrame(3, answer))).toBe(toHex(ANSWER_TX));
  });

  it('refuses a cuff that cannot decrypt our challenge', () => {
    expect(identifyAnswer(challenge.data, new Uint8Array(16))).toBeNull();
    expect(identifyAnswer(new Uint8Array(10), r1)).toBeNull();
  });

  it('round-trips xxtea2 and rejects a wrong key', () => {
    const data = hex('00112233445566778899aabbccddeeff');
    const enc = xxtea2Encrypt(data, KEY);
    expect(enc.length).toBe(20);
    expect(toHex(xxtea2Decrypt(enc, KEY)!)).toBe(toHex(data));
    expect(xxtea2Decrypt(enc, new Uint8Array(16))).toBeNull();
    expect(toHex(xxtea2Decrypt(xxtea2Encrypt(hex('010203'), KEY), KEY)!)).toBe('010203');
  });
});

describe('readings', () => {
  it('parses the captured record', () => {
    const [pkt] = new StreamParser().feed(OFFLINE_RX);
    expect(pkt.command).toBe(CMD.offlineData);
    expect(pkt.data[1]).toBe(0); // no more pages
    const [r] = parseRecords(pkt.data.subarray(2));
    expect(r).toMatchObject({ systolic: 125, diastolic: 64, pulse: 69, irregularPulse: false, bodyMovement: false });
    expect(r.takenAt).toBe(new Date(2026, 9, 21, 14, 52, 31).getTime());
  });

  it('reads the flag bits and skips impossible dates', () => {
    const good = [26, 10, 21, 14, 52, 31, 61, 64, 69, 0, 0x90];
    const bad = [26, 0, 21, 14, 52, 31, 61, 64, 69, 0, 0];
    const feb30 = [26, 2, 30, 1, 1, 1, 40, 80, 60, 0, 0];
    const rs = parseRecords(Uint8Array.from([...bad, ...good, ...feb30]));
    expect(rs).toHaveLength(1);
    expect(rs[0]).toMatchObject({ irregularPulse: true, bodyMovement: true });
  });
});
