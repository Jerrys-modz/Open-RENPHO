import type { WeighIn } from '../../qn/session';
import { BeurerSession, type BeurerPairing } from '../session';

const bytes = (h: string) => new Uint8Array(Buffer.from(h, 'hex'));
const hex = (b: Uint8Array) => Buffer.from(b).toString('hex');

const WEIGHT = '0ef446ea070816103301023a01a406'; // user 2, 90.82 kg
const WEIGHT_OTHER_USER = '0ef446ea070816103301033a01a406'; // user 3
const BODY = '9803a6017a1a30015826e01c1211';

function setup(pairing: BeurerPairing | null = null) {
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
    onStatus: () => {},
    onError: (m) => errors.push(m),
    onPairingRejected: () => void rejected++,
  });
  return { session, writes, weighIns, paired, consented, errors, rejected: () => rejected };
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
