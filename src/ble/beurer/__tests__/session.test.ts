import type { WeighIn } from '../../qn/session';
import { BeurerSession, type BeurerPairing } from '../session';

const bytes = (h: string) => new Uint8Array(Buffer.from(h, 'hex'));
const hex = (b: Uint8Array) => Buffer.from(b).toString('hex');

const WEIGHT = '0ef446ea070816103301023a01a406'; // user 2, 90.82 kg
const WEIGHT_OTHER_USER = '0ef446ea070816103301033a01a406'; // user 3
const BODY = '9803a6017a1a30015826e01c1211';

function setup(pairing: BeurerPairing | null = null, acceptAny = false) {
  const statuses: string[] = [];
  const debug: string[] = [];
  const writes: string[] = [];
  const weighIns: WeighIn[] = [];
  const paired: BeurerPairing[] = [];
  const consented: BeurerPairing[] = [];
  const errors: string[] = [];
  let rejected = 0;
  const session = new BeurerSession({
    pairing,
    newConsentCode: () => 3907,
    writeControlPoint: (b) => void writes.push(hex(b)),
    onPaired: (p) => paired.push(p),
    onConsented: (p) => consented.push(p),
    onWeighIn: (w) => weighIns.push(w),
    onStatus: (m) => void statuses.push(m),
    acceptAnyUser: () => acceptAny,
    onDebug: (l) => void debug.push(l),
    onError: (m) => errors.push(m),
    onPairingRejected: () => void rejected++,
  });
  return { session, writes, weighIns, paired, consented, errors, statuses, debug, rejected: () => rejected };
}

describe('BeurerSession pairing', () => {
  it('registers a new user, stores the slot, then consents with it', () => {
    const { session, writes, paired, consented } = setup();
    session.begin();
    expect(writes).toEqual(['01430f']);
    session.handleControlPoint(bytes('20010103')); // success, slot 3
    expect(paired).toEqual([{ userIndex: 3, consentCode: 3907 }]);
    expect(writes[1]).toBe('0203430f');
    expect(session.ready).toBe(false);
    session.handleControlPoint(bytes('200201'));
    expect(consented).toEqual([{ userIndex: 3, consentCode: 3907 }]);
    expect(session.ready).toBe(true);
  });

  it('consents straight away when a slot is already stored', () => {
    const { session, writes, paired } = setup({ userIndex: 1, consentCode: 3907 });
    session.begin();
    expect(writes).toEqual(['0201430f']);
    expect(paired).toEqual([]);
  });

  it('explains a full scale', () => {
    const { session, errors, paired } = setup();
    session.begin();
    session.handleControlPoint(bytes('200104'));
    expect(paired).toEqual([]);
    expect(errors[0]).toMatch(/no free user slot/);
  });

  it('asks to forget a code the scale rejects', () => {
    const { session, errors, rejected } = setup({ userIndex: 1, consentCode: 1 });
    session.begin();
    session.handleControlPoint(bytes('200205'));
    expect(rejected()).toBe(1);
    expect(errors[0]).toMatch(/Reset the Beurer pairing/);
  });
});

describe('BeurerSession linked slots', () => {
  it('keeps a linked slot when the scale refuses the PIN, instead of registering another', () => {
    const { session, errors, rejected } = setup({ userIndex: 1, consentCode: 1, linked: true });
    session.begin();
    session.handleControlPoint(bytes('200205'));
    expect(rejected()).toBe(0);
    expect(errors[0]).toMatch(/PIN for user 1/);
  });

  it('consents with the linked slot and PIN', () => {
    const { session, writes, paired } = setup({ userIndex: 1, consentCode: 3907, linked: true });
    session.begin();
    expect(writes).toEqual(['0201430f']);
    expect(paired).toEqual([]);
  });
});

describe('BeurerSession readings', () => {
  const paired = { userIndex: 2, consentCode: 1234 };

  it('pairs a weight frame with the body frame that follows', () => {
    const { session, weighIns } = setup(paired);
    session.handleWeight(bytes(WEIGHT));
    expect(weighIns).toHaveLength(0);
    session.handleBodyComposition(bytes(BODY));
    expect(weighIns).toHaveLength(1);
    const w = weighIns[0];
    expect(w.flavor).toBe('beurer');
    expect(w.weightKg).toBeCloseTo(90.82, 3);
    expect(w.bodyFat).toBe(42.2);
    expect(w.resistance1).toBe(437);
    expect(w.scaleMetrics?.bmr).toBe(1620);
    expect(w.scaleMetrics?.bmi).toBe(31.4);
    expect(w.scaleMetrics?.body_water).toBeCloseTo(40.7, 1); // 36.96 / 90.82
    expect(w.scaleMetrics?.muscle_percent).toBe(30.4);
    expect(w.scaleMetrics?.soft_lean_mass).toBeCloseTo(49.08, 2);
    expect(w.scaleMetrics?.body_water_mass).toBeCloseTo(36.96, 2);
    expect(w.takenAt).toBeGreaterThan(0);
    session.destroy();
  });

  it('accepts the body frame arriving first', () => {
    const { session, weighIns } = setup(paired);
    session.handleBodyComposition(bytes(BODY));
    session.handleWeight(bytes(WEIGHT));
    expect(weighIns).toHaveLength(1);
    expect(weighIns[0].bodyFat).toBe(42.2);
    session.destroy();
  });

  it('delivers weight alone if the body frame never arrives', () => {
    jest.useFakeTimers();
    try {
      const { session, weighIns } = setup(paired);
      session.handleWeight(bytes(WEIGHT));
      jest.advanceTimersByTime(3000);
      expect(weighIns).toHaveLength(1);
      expect(weighIns[0].bodyFat).toBeNull();
      expect(weighIns[0].resistance1).toBeNull();
    } finally {
      jest.useRealTimers();
    }
  });

  it('ignores readings that belong to another user slot', () => {
    jest.useFakeTimers();
    try {
      const { session, weighIns } = setup(paired);
      session.handleWeight(bytes(WEIGHT_OTHER_USER));
      jest.advanceTimersByTime(3000);
      expect(weighIns).toHaveLength(0);
    } finally {
      jest.useRealTimers();
    }
  });

  it('tells the user when the scale files a reading under another user', () => {
    const { session, weighIns, statuses, debug } = setup(paired);
    session.handleWeight(bytes(WEIGHT_OTHER_USER));
    expect(weighIns).toHaveLength(0);
    expect(statuses.at(-1)).toMatch(/user 3, not you \(user 2\)/);
    expect(debug[0]).toMatch(/scale user 3/);
  });

  it('takes another user\'s reading when asked to accept any user', () => {
    const { session, weighIns } = setup(paired, true);
    session.handleWeight(bytes(WEIGHT_OTHER_USER));
    session.handleBodyComposition(bytes(BODY));
    expect(weighIns).toHaveLength(1);
    expect(weighIns[0].bodyFat).toBe(42.2);
    session.destroy();
  });

  it('logs control point and body frames for the debug view', () => {
    const { session, debug } = setup(paired);
    session.handleControlPoint(bytes('200201'));
    session.handleBodyComposition(bytes(BODY));
    expect(debug).toEqual(['control point 20 02 01', 'body fat 42.2%, impedance 437 ohm, scale user none']);
    session.destroy();
  });

  it('keeps two stored readings separate', () => {
    const { session, weighIns } = setup(paired);
    session.handleWeight(bytes(WEIGHT));
    session.handleBodyComposition(bytes(BODY));
    session.handleWeight(bytes(WEIGHT));
    session.handleBodyComposition(bytes(BODY));
    expect(weighIns).toHaveLength(2);
    session.destroy();
  });
});
