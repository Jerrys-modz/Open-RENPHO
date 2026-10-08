import {
  buildEndMeasurementCommand,
  buildMeasurementInitiationCommand,
  buildUnitUpdateCommand,
  buildUserProfileCommand,
  parseBasicMeasurement,
  parseExtendedMeasurement,
} from '../protocol';

const hex = (b: Uint8Array) => Buffer.from(b).toString('hex');
const bytes = (h: string) => new Uint8Array(Buffer.from(h, 'hex'));

describe('command builders', () => {
  it('end-measurement: 1f 05 ff 10 + checksum (0x133 & 0xff)', () => {
    expect(hex(buildEndMeasurementCommand())).toBe('1f05ff1033');
  });

  it('unit update: kilograms, checksum over first 8 bytes', () => {
    expect(hex(buildUnitUpdateCommand())).toBe('1309ff011000000000'.slice(0, 16) + '2c');
  });

  it('measurement initiation encodes seconds since 2000-01-01 little-endian', () => {
    // 2000-01-01T00:00:10Z
    const cmd = buildMeasurementInitiationCommand(0xff, (946656000 + 10) * 1000);
    expect(hex(cmd)).toBe('2008ff0a0000' + '00' + ((0x20 + 0x08 + 0xff + 0x0a) & 0xff).toString(16));
  });

  it('guest user profile frame layout', () => {
    const cmd = buildUserProfileCommand({ sex: 1, age: 30, heightM: 1.7, athlete: false, algorithm: 0x04 });
    expect(cmd.length).toBe(13);
    expect(Array.from(cmd.slice(0, 6))).toEqual([0xa0, 0x0d, 0x02, 0xfe, 0xff, 0xee]);
    expect(cmd[6]).toBe(1); // sex
    expect(cmd[7]).toBe(30); // age
    expect((cmd[8] << 8) | cmd[9]).toBe(1700); // height in mm
    expect(cmd[10]).toBe(0x04); // algorithm
    expect(cmd[11]).toBe(0x02);
    expect(cmd[12]).toBe(cmd.slice(0, 12).reduce((a, b) => a + b, 0) & 0xff);
  });

  it('athlete bit adds 0x0a to the flag byte', () => {
    const cmd = buildUserProfileCommand({ sex: 0, age: 40, heightM: 1.8, athlete: true, algorithm: 0x04 });
    expect(cmd[10]).toBe(0x0e);
  });

  it('rejects out-of-range heights', () => {
    expect(() =>
      buildUserProfileCommand({ sex: 0, age: 1, heightM: 70, athlete: false, algorithm: 4 }),
    ).toThrow(RangeError);
  });
});

describe('frame parsers (synthetic frames built from the documented layout)', () => {
  it('extended final frame: weight, resistances, on-device body fat', () => {
    // 10 0e ff fe | status=02 | weight=7495 (0x1d47) | r1=505 (0x01f9) r2=503 (0x01f7) | bf=210 (0x00d2) | csum
    const f = parseExtendedMeasurement(bytes('100efffe021d4701f901f700d200'));
    expect(f).toEqual({ weightKg: 74.95, status: 2, bodyFat: 21.0, resistance1: 505, resistance2: 503 });
  });

  it('extended unstable frame carries weight only', () => {
    const f = parseExtendedMeasurement(bytes('100efffe001d4700000000000000'));
    expect(f.weightKg).toBe(74.95);
    expect(f.bodyFat).toBeNull();
    expect(f.resistance1).toBeNull();
  });

  it('basic final frame: weight and impedance', () => {
    // 10 0b ff | weight=7495 | status=01 | r1=505 r2=503 | csum
    const f = parseBasicMeasurement(bytes('100bff1d4701' + '01f901f7' + '00'));
    expect(f).toEqual({ weightKg: 74.95, status: 1, resistance1: 505, resistance2: 503 });
  });
});
