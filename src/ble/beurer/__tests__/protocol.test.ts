import {
  UCP_RESULT,
  buildConsent,
  buildCurrentTime,
  buildDateOfBirth,
  buildGender,
  buildHeight,
  buildRegisterNewUser,
  parseSlotLink,
  parseBodyCompositionMeasurement,
  parseUcpResponse,
  parseWeightMeasurement,
} from '../protocol';

const bytes = (h: string) => new Uint8Array(Buffer.from(h, 'hex'));

// Real BF720 captures from https://github.com/bearyjd/bascule (docs/prp/03-hardware-validation.md).
const WEIGHT_1 = '0ef446ea07081610330102 3a01a406'.replace(' ', '');
const BODY_1 = '9803a6017a1a30015826e01c1211';
const WEIGHT_2 = '0e0a45ea0709130818130231 01a406'.replace(' ', '');
const BODY_2 = '9803960116 1a35015e26ca1cfe10'.replace(' ', '');

describe('parseWeightMeasurement', () => {
  it('decodes session 1', () => {
    const w = parseWeightMeasurement(bytes(WEIGHT_1))!;
    expect(w.weightKg).toBeCloseTo(90.82, 3);
    expect(w.userIndex).toBe(2);
    expect(w.bmi).toBe(31.4);
    expect(w.heightM).toBeCloseTo(1.7, 3);
    expect(new Date(w.takenAt!).getFullYear()).toBe(2026);
    expect(new Date(w.takenAt!).getHours()).toBe(16);
    expect(new Date(w.takenAt!).getSeconds()).toBe(1);
  });

  it('decodes session 2', () => {
    const w = parseWeightMeasurement(bytes(WEIGHT_2))!;
    expect(w.weightKg).toBeCloseTo(88.37, 3);
    expect(w.bmi).toBe(30.5);
  });

  it('rejects an unsuccessful measurement and short frames', () => {
    expect(parseWeightMeasurement(bytes('00ffff'))).toBeNull();
    expect(parseWeightMeasurement(bytes('0e'))).toBeNull();
    expect(parseWeightMeasurement(bytes('0ef446ea07'))).toBeNull(); // timestamp cut off
  });

  it('converts imperial frames to kg', () => {
    // flags 0x01 (lb), 200.00 lb
    const w = parseWeightMeasurement(bytes('01 204e'.replace(' ', '')))!;
    expect(w.weightKg).toBeCloseTo(90.718, 2);
  });
});

describe('parseBodyCompositionMeasurement', () => {
  it('decodes session 1 including real impedance', () => {
    const b = parseBodyCompositionMeasurement(bytes(BODY_1))!;
    expect(b.bodyFatPercent).toBe(42.2);
    expect(b.bmrKcal).toBe(1620);
    expect(b.musclePercent).toBe(30.4);
    expect(b.softLeanMassKg).toBeCloseTo(49.08, 3);
    expect(b.bodyWaterMassKg).toBeCloseTo(36.96, 3);
    expect(b.impedanceOhms).toBe(437);
    expect(b.userIndex).toBeNull();
    expect(b.takenAt).toBeNull();
  });

  it('decodes session 2', () => {
    const b = parseBodyCompositionMeasurement(bytes(BODY_2))!;
    expect(b.bodyFatPercent).toBe(40.6);
    expect(b.impedanceOhms).toBe(435);
    expect(b.musclePercent).toBe(30.9);
  });

  it('treats 0xFFFF body fat as unavailable', () => {
    const b = parseBodyCompositionMeasurement(bytes('0000ffff'))!;
    expect(b.bodyFatPercent).toBeNull();
  });

  it('rejects a frame shorter than its flags claim', () => {
    expect(parseBodyCompositionMeasurement(bytes('9803a601'))).toBeNull();
    expect(parseBodyCompositionMeasurement(bytes('98'))).toBeNull();
  });
});

describe('User Control Point', () => {
  it('builds register and consent commands little-endian', () => {
    expect(Buffer.from(buildRegisterNewUser(3907)).toString('hex')).toBe('01430f');
    expect(Buffer.from(buildConsent(1, 3907)).toString('hex')).toBe('0201430f');
    expect(Buffer.from(buildConsent(2, 1234)).toString('hex')).toBe('0202d204');
  });

  it('parses the captured consent acceptance', () => {
    expect(parseUcpResponse(bytes('200201'))).toEqual({
      requestOpcode: 2,
      result: UCP_RESULT.SUCCESS,
      userIndex: null,
    });
  });

  it('reads the assigned slot from a successful registration', () => {
    expect(parseUcpResponse(bytes('20010103'))?.userIndex).toBe(3);
    expect(parseUcpResponse(bytes('20010403'))?.userIndex).toBeNull();
  });

  it('ignores frames that are not responses', () => {
    expect(parseUcpResponse(bytes('0102'))).toBeNull();
  });
});

describe('profile and clock writes', () => {
  it('builds a 10-byte current time', () => {
    const t = buildCurrentTime(new Date(2026, 8, 19, 8, 24, 19)); // Saturday
    expect(Buffer.from(t).toString('hex')).toBe('ea0709130818130600 00'.replace(' ', ''));
  });

  it('builds date of birth, gender and height', () => {
    expect(Buffer.from(buildDateOfBirth('1988-02-01')!).toString('hex')).toBe('c4070201');
    expect(buildDateOfBirth('nope')).toBeNull();
    expect(Array.from(buildGender('female'))).toEqual([1]);
    expect(Array.from(buildGender('male'))).toEqual([0]);
    expect(Buffer.from(buildHeight(170.4)).toString('hex')).toBe('aa00');
  });
});

describe('parseSlotLink', () => {
  it('accepts a slot 1-8 and a PIN of up to 4 digits', () => {
    expect(parseSlotLink('1', '3907')).toEqual({ ok: true, userIndex: 1, consentCode: 3907 });
    expect(parseSlotLink(' 8 ', '0042')).toEqual({ ok: true, userIndex: 8, consentCode: 42 });
  });

  it('rejects anything else with a reason', () => {
    for (const [slot, pin] of [['0', '1234'], ['9', '1234'], ['a', '1234'], ['', '1234'], ['1', ''], ['1', '12345'], ['1', '12a4']]) {
      expect(parseSlotLink(slot, pin).ok).toBe(false);
    }
  });
});
