import { CMD, KEY, StreamParser, buildFrame, chunk, type Packet } from '../protocol';
import { xxtea2Decrypt, xxtea2Encrypt } from '../xxtea';
import { IHealthSession } from '../session';

const rec = (min: number, sys = 125, dia = 64, pulse = 69) => [26, 10, 21, 14, min, 0, sys - dia, dia, pulse, 0, 0];

/** A scripted cuff: answers the handshake properly and serves `records` in pages. */
function fakeCuff(opts: { records?: number[][]; pageSize?: number; count?: number; acceptAuth?: boolean; mute?: boolean }) {
  const records = opts.records ?? [];
  const pageSize = opts.pageSize ?? 20;
  const parser = new StreamParser();
  const received: Packet[] = [];
  let seq = 1;
  let page = 0;
  let deleted = false;
  let session!: IHealthSession;

  const reply = (command: number, data: number[]) => {
    const body = [0xa1, command, ...data];
    const f = buildFrame(seq, Uint8Array.from(body));
    seq += 2;
    f[0] = 0xa0;
    f[2] = 0x00;
    // recompute checksum after changing the header byte (sum covers bytes after len)
    f[f.length - 1] = f.slice(2, -1).reduce((a, b) => (a + b) & 0xff, 0);
    // A0 frames carry len = body+2 like B0, then flag, seq
    for (const c of chunk(f)) session.handleNotification(c);
  };

  let pending: number[] = [];
  const onWrite = async (bytes: Uint8Array) => {
    pending.push(...bytes);
    if (pending.length < pending[1] + 3) return; // wait for the rest of the frame
    const frame = Uint8Array.from(pending);
    pending = [];
    frame[0] = 0xa0; // our B0 commands parse with the same layout as the cuff's A0 replies
    for (const p of parser.feed(frame)) {
      received.push(p);
      if (opts.mute) return;
      switch (p.command) {
        case CMD.identify: {
          const r1 = p.data.slice(0, 16);
          const r2 = new Uint8Array(16).fill(7);
          const seed = new Uint8Array(16).fill(9);
          const ka = xxtea2Encrypt(seed, KEY);
          reply(CMD.identifyChallenge, [...r2, ...xxtea2Encrypt(r1, ka), ...seed]);
          break;
        }
        case CMD.identifyResponse: {
          const ka = xxtea2Encrypt(new Uint8Array(16).fill(9), KEY);
          const ok = Buffer.from(xxtea2Decrypt(p.data, ka) ?? []).equals(Buffer.alloc(16, 7));
          reply(opts.acceptAuth === false || !ok ? CMD.identifyFail : CMD.identifyOk, []);
          break;
        }
        case CMD.functionInfo:
          reply(CMD.functionInfo, [0, 0, 1, 0, 0, 0, 0, 0, 3]);
          break;
        case CMD.battery:
          reply(CMD.battery, [100, 0, 0]);
          break;
        case CMD.offlineCount:
          reply(CMD.offlineCount, [1, opts.count ?? records.length, 0, 0]);
          break;
        case CMD.offlineData: {
          const slice = records.slice(page * pageSize, (page + 1) * pageSize);
          page++;
          const more = page * pageSize < records.length ? 1 : 0;
          reply(CMD.offlineData, [1, more, ...slice.flat()]);
          break;
        }
        case CMD.offlineDataOver:
          deleted = true;
          reply(CMD.offlineDataOver, [0, 0, 0]);
          break;
      }
    }
  };

  session = new IHealthSession({
    write: onWrite,
    random: (n) => new Uint8Array(n).map((_, i) => (i * 7 + 3) & 0xff),
    now: () => new Date(2026, 9, 21, 15, 9, 5),
    timeoutMs: 50,
  });
  return { session, received, wasDeleted: () => deleted };
}

describe('IHealthSession', () => {
  it('authenticates, sets the clock and downloads every reading', async () => {
    const { session, received } = fakeCuff({ records: [rec(52), rec(53, 121, 71, 68)] });
    await session.authenticate();
    await session.setClock();
    expect(await session.battery()).toBe(100);
    const d = await session.readReadings();
    expect(d.complete).toBe(true);
    expect(d.readings.map((r) => [r.systolic, r.diastolic, r.pulse])).toEqual([
      [125, 64, 69],
      [121, 71, 68],
    ]);
    expect(received.some((p) => p.command === CMD.offlineDataOver)).toBe(false);
  });

  it('follows multiple pages', async () => {
    const records = Array.from({ length: 45 }, (_, i) => rec(i));
    const { session } = fakeCuff({ records, pageSize: 10 });
    await session.authenticate();
    const d = await session.readReadings();
    expect(d.readings).toHaveLength(45);
    expect(d.complete).toBe(true);
  });

  it('reports an empty cuff as complete with nothing to import', async () => {
    const { session } = fakeCuff({});
    await session.authenticate();
    expect(await session.readReadings()).toEqual({ readings: [], complete: true, expected: 0 });
  });

  it('flags a download with fewer records than the cuff announced as incomplete', async () => {
    const { session } = fakeCuff({ records: [rec(1), rec(2)], count: 5 });
    await session.authenticate();
    const d = await session.readReadings();
    expect(d.readings).toHaveLength(2);
    expect(d.complete).toBe(false);
  });

  it('only deletes when asked', async () => {
    const { session, wasDeleted } = fakeCuff({ records: [rec(1)] });
    await session.authenticate();
    await session.readReadings();
    expect(wasDeleted()).toBe(false);
    await session.deleteReadings();
    expect(wasDeleted()).toBe(true);
  });

  it('fails authentication when the cuff rejects us, and when it stays silent', async () => {
    await expect(fakeCuff({ acceptAuth: false }).session.authenticate()).rejects.toThrow(/auth/);
    await expect(fakeCuff({ mute: true }).session.authenticate()).rejects.toThrow(/did not answer/);
  });
});
