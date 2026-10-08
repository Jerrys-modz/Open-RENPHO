import type { WeighIn } from '@/ble/qn/session';
import { COMPANY_ID, decodeDisplayUnit, parseBroadcast, splitManufacturerData } from '../protocol';
import { AabbSession } from '../session';

const bytes = (h: string) => new Uint8Array(Buffer.from(h, 'hex'));

// Real advertisement payloads captured from two scales (renpho-escs20m tests), from the aa bb prefix.
const KG_FINAL = bytes('aabbed6739c5aa0a6d3e236a948b1f23008e214c0903f33e'); // 85.90 kg, MAC ed:67:39:c5:aa:0a
const KG_SETTLING = bytes('aabbed6739c5aa0a6d3e236a948b1f0200a7214c0903ef3e');
const KG_TARE = bytes('aabbed6739c5aa0a5b3e236a948b1f030000004c0903ec3e');
const LB_FINAL = bytes('aabbed673b1aaa067986066a40b64b2500931c4c4403691f'); // 73.15 kg, display in lb
const LB_PROVISIONAL = bytes('aabbed673b1aaa061387066a40b64b6422841c4c44030620');

// Captured from the project owner's own scale (MAC ed:67:39:53:49:85, display set to lb) with nRF Connect.
const OWN_IDLE = bytes('aabbed6739534985fcffc76affffff0400' + '0000004b05037312'); // nothing on the scale
const OWN_BLIP = bytes('aabbed6739534985d6ffc76affffff04' + '0060044b05032812'); // brief 11.20 kg touch
const OWN_FINAL = bytes('aabbed67395349859100c86affffff25' + '00762a4b05030313'); // standing on it; display showed 239.6 lb

/** Prefixes the company ID the way ble-plx returns manufacturer data. */
const withCompany = (payload: Uint8Array) => Uint8Array.from([0xff, 0xff, ...payload]);

describe('parseBroadcast', () => {
  it('decodes a final kg frame', () => {
    expect(parseBroadcast(COMPANY_ID, KG_FINAL)).toEqual({
      mac: 'ed:67:39:c5:aa:0a',
      weightKg: 85.9,
      final: true,
      displayUnit: 'kg',
      status: 0x23,
    });
  });

  it('weight is kg even when the scale displays lb', () => {
    const f = parseBroadcast(COMPANY_ID, LB_FINAL);
    expect(f).toMatchObject({ weightKg: 73.15, final: true, displayUnit: 'lb', mac: 'ed:67:3b:1a:aa:06' });
  });

  it('settling and provisional frames are not final but carry a live weight', () => {
    expect(parseBroadcast(COMPANY_ID, KG_SETTLING)).toMatchObject({ final: false, weightKg: 86.15 });
    expect(parseBroadcast(COMPANY_ID, LB_PROVISIONAL)).toMatchObject({ final: false, weightKg: 73 });
  });

  it('a tare frame (weight 0) is never a reading', () => {
    expect(parseBroadcast(COMPANY_ID, KG_TARE)).toMatchObject({ final: false, weightKg: 0 });
  });

  it('rejects other company IDs, wrong magic and short payloads', () => {
    expect(parseBroadcast(0x004c, KG_FINAL)).toBeNull();
    const bad = Uint8Array.from(KG_FINAL);
    bad[0] = 0xcc;
    expect(parseBroadcast(COMPANY_ID, bad)).toBeNull();
    expect(parseBroadcast(COMPANY_ID, KG_FINAL.subarray(0, 10))).toBeNull();
  });
});

describe('real frames from the owner\'s scale', () => {
  it('idle: weight 0, not final, lb display', () => {
    expect(parseBroadcast(COMPANY_ID, OWN_IDLE)).toEqual({
      mac: 'ed:67:39:53:49:85',
      weightKg: 0,
      final: false,
      displayUnit: 'lb',
      status: 0x04,
    });
  });

  it('a brief touch is a live weight, not a reading', () => {
    expect(parseBroadcast(COMPANY_ID, OWN_BLIP)).toMatchObject({ weightKg: 11.2, final: false });
  });

  it('locked frame: 108.70 kg, which is the 239.6 lb the scale displayed', () => {
    const f = parseBroadcast(COMPANY_ID, OWN_FINAL);
    expect(f).toMatchObject({ weightKg: 108.7, final: true, displayUnit: 'lb', status: 0x25 });
    expect(f!.weightKg * 2.2046226).toBeCloseTo(239.6, 1);
  });

  it('the session produces exactly one reading from idle then final frames', () => {
    const readings: number[] = [];
    const s = new AabbSession({ onWeighIn: (w) => readings.push(w.weightKg) });
    for (const f of [OWN_IDLE, OWN_FINAL, OWN_FINAL, OWN_IDLE]) s.handleManufacturerData(withCompany(f));
    expect(readings).toEqual([108.7]);
  });
});

describe('helpers', () => {
  it('splits company ID (little-endian) from the payload', () => {
    const s = splitManufacturerData(withCompany(KG_FINAL));
    expect(s?.companyId).toBe(0xffff);
    expect(Array.from(s!.payload.subarray(0, 2))).toEqual([0xaa, 0xbb]);
    expect(splitManufacturerData(new Uint8Array(1))).toBeNull();
  });

  it('decodes the display unit from status bits 1-2', () => {
    expect(decodeDisplayUnit(0x23)).toBe('kg');
    expect(decodeDisplayUnit(0x25)).toBe('lb');
    expect(decodeDisplayUnit(0x00)).toBeNull();
  });
});

describe('AabbSession', () => {
  function setup() {
    let t = 1_000_000;
    const weighIns: WeighIn[] = [];
    const live: number[] = [];
    const session = new AabbSession({
      onWeighIn: (w) => weighIns.push(w),
      onLiveWeight: (k) => live.push(k),
      now: () => t,
    });
    return { session, weighIns, live, advance: (ms: number) => (t += ms) };
  }

  it('reports live weight while settling, then one reading on the final frame', () => {
    const { session, weighIns, live } = setup();
    session.handleManufacturerData(withCompany(KG_SETTLING));
    session.handleManufacturerData(withCompany(KG_FINAL));
    expect(live).toEqual([86.15]);
    expect(weighIns).toEqual([{ flavor: 'broadcast', weightKg: 85.9, bodyFat: null, resistance1: null, resistance2: null }]);
  });

  it('delivers one reading per burst but a new one after the cooldown', () => {
    const { session, weighIns, advance } = setup();
    for (let i = 0; i < 5; i++) {
      session.handleManufacturerData(withCompany(KG_FINAL));
      advance(500);
    }
    expect(weighIns).toHaveLength(1);
    advance(10_000);
    session.handleManufacturerData(withCompany(KG_FINAL));
    expect(weighIns).toHaveLength(2);
  });

  it('locks onto the first scale and ignores a second one', () => {
    const { session, weighIns } = setup();
    session.handleManufacturerData(withCompany(KG_SETTLING));
    session.handleManufacturerData(withCompany(LB_FINAL)); // different MAC
    expect(weighIns).toHaveLength(0);
  });

  it('stepping off (zero weight) allows a new reading well before the cooldown ends', () => {
    const { session, weighIns, advance } = setup();
    session.handleManufacturerData(withCompany(OWN_FINAL));
    advance(3_000);
    session.handleManufacturerData(withCompany(OWN_IDLE)); // stepped off
    advance(1_000);
    session.handleManufacturerData(withCompany(OWN_FINAL)); // stepped back on, 4 s after the first
    expect(weighIns).toHaveLength(2);
  });

  it('a zero-weight frame right after a reading does not re-arm it (guards against a glitch mid-burst)', () => {
    const { session, weighIns, advance } = setup();
    session.handleManufacturerData(withCompany(OWN_FINAL));
    advance(500);
    session.handleManufacturerData(withCompany(OWN_IDLE));
    session.handleManufacturerData(withCompany(OWN_FINAL));
    expect(weighIns).toHaveLength(1);
  });

  it('ignores advertisements that are not from this kind of scale', () => {
    const { session, weighIns } = setup();
    expect(session.handleManufacturerData(Uint8Array.from([0x4c, 0x00, 0x01, 0x02]))).toBe(false);
    expect(session.handleManufacturerData(withCompany(KG_FINAL))).toBe(true);
    expect(weighIns).toHaveLength(1);
  });
});
