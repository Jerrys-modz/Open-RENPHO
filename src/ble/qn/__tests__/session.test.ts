import { QnSession, type WeighIn } from '../session';

const bytes = (h: string) => new Uint8Array(Buffer.from(h, 'hex'));
const hex = (b: Uint8Array) => Buffer.from(b).toString('hex');

function setup(profile?: ConstructorParameters<typeof QnSession>[0]['profile']) {
  const writes: string[] = [];
  const weighIns: WeighIn[] = [];
  const live: number[] = [];
  const session = new QnSession({
    write: (b) => void writes.push(hex(b)),
    onWeighIn: (w) => weighIns.push(w),
    onLiveWeight: (k) => live.push(k),
    profile,
  });
  return { session, writes, weighIns, live };
}

describe('QnSession handshake', () => {
  it('answers unit and init requests once each', () => {
    const { session, writes } = setup();
    session.handleNotification(bytes('1209ff00'));
    session.handleNotification(bytes('1209ff00'));
    session.handleNotification(bytes('1405ff00'));
    expect(writes).toHaveLength(2);
    expect(writes[0].startsWith('1309ff01')).toBe(true);
    expect(writes[1].startsWith('2008ff')).toBe(true);
  });

  it('answers an extended pre-measurement request with a profile, once', () => {
    const { session, writes } = setup({ sex: 0, age: 30, heightM: 1.8, athlete: false, algorithm: 4 });
    session.handleNotification(bytes('2105ff00'));
    session.handleNotification(bytes('2105ff00'));
    expect(writes).toHaveLength(1);
    expect(writes[0].startsWith('a00d02feffee')).toBe(true);
  });

  it('does not send a profile to a basic-flavor scale', () => {
    const { session, writes } = setup();
    session.handleNotification(bytes('2104ff00'));
    expect(writes).toHaveLength(0);
  });
});

describe('QnSession weigh-in', () => {
  it('extended flavor: live weights, then one final reading and end command', () => {
    const { session, writes, weighIns, live } = setup();
    session.handleNotification(bytes('100efffe001d4700000000000000'));
    session.handleNotification(bytes('100efffe011d4700000000000000'));
    session.handleNotification(bytes('100efffe021d4701f901f700d200'));
    session.handleNotification(bytes('100efffe021d4701f901f700d200')); // duplicate
    expect(live).toEqual([74.95, 74.95]);
    expect(weighIns).toHaveLength(1);
    expect(weighIns[0]).toMatchObject({ flavor: 'extended', weightKg: 74.95, bodyFat: 21, resistance1: 505 });
    expect(writes).toEqual(['1f05ff1033']);
  });

  it('basic flavor: waits for the 0x01 final frame, which carries impedance', () => {
    const { session, weighIns, live } = setup();
    session.handleNotification(bytes('100bff1d470000000000' + '00'));
    session.handleNotification(bytes('100bff1d471100000000' + '00'));
    expect(weighIns).toHaveLength(0);
    session.handleNotification(bytes('100bff1d470101f901f700'));
    expect(live).toHaveLength(2);
    expect(weighIns).toHaveLength(1);
    expect(weighIns[0]).toMatchObject({ flavor: 'basic', weightKg: 74.95, bodyFat: null, resistance1: 505 });
  });

  it('ignores garbage and unknown opcodes', () => {
    const { session, writes, weighIns } = setup();
    session.handleNotification(bytes('00'));
    session.handleNotification(bytes('ee05ff0000'));
    expect(writes).toHaveLength(0);
    expect(weighIns).toHaveLength(0);
  });
});
