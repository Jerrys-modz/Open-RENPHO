/**
 * Drives one sync with a KN-550BT: authenticate, set the clock, download stored readings, and
 * (only if asked, and only after the caller has saved them) delete them from the cuff.
 * Transport-agnostic: feed `handleNotification` and supply `write`.
 */
import {
  CMD,
  ERRORS,
  RECORD_SIZE,
  StreamParser,
  buildFrame,
  chunk,
  cmd,
  functionInfoPayload,
  identifyAnswer,
  identifyPayload,
  makeChallenge,
  parseRecords,
  type CuffReading,
  type Packet,
} from './protocol';

export interface Download {
  readings: CuffReading[];
  /** True only when every page arrived and the count matches what the cuff said it held. */
  complete: boolean;
  expected: number;
}

export interface IHealthSessionOptions {
  write: (bytes: Uint8Array) => Promise<void>;
  random: (n: number) => Uint8Array;
  now?: () => Date;
  timeoutMs?: number;
  setTimer?: (fn: () => void, ms: number) => unknown;
  clearTimer?: (h: unknown) => void;
}

export class IHealthError extends Error {
  constructor(
    readonly stage: string,
    message: string,
  ) {
    super(`${stage}: ${message}`);
  }
}

const MAX_PAGES = 128;

interface Waiter {
  accept: (p: Packet) => boolean;
  resolve: (p: Packet) => void;
  reject: (e: Error) => void;
  timer: unknown;
}

export class IHealthSession {
  private parser = new StreamParser();
  private seq = 1;
  private waiter: Waiter | null = null;
  private queue: Packet[] = [];

  constructor(private readonly o: IHealthSessionOptions) {}

  handleNotification(bytes: Uint8Array): void {
    for (const p of this.parser.feed(bytes)) {
      if (this.waiter?.accept(p)) {
        const w = this.waiter;
        this.waiter = null;
        (this.o.clearTimer ?? clearTimeout)(w.timer as never);
        w.resolve(p);
      } else if (p.command === CMD.error && this.waiter) {
        const w = this.waiter;
        this.waiter = null;
        (this.o.clearTimer ?? clearTimeout)(w.timer as never);
        w.reject(new Error(ERRORS[p.data[0]] ?? `cuff error ${p.data[0]}`));
      } else {
        this.queue.push(p);
      }
    }
  }

  private async send(payload: Uint8Array): Promise<void> {
    const frame = buildFrame(this.seq, payload);
    this.seq = (this.seq + 2) & 0xff;
    for (const c of chunk(frame)) await this.o.write(c);
  }

  private expect(command: number, stage: string): Promise<Packet> {
    return this.waitAny([command], stage);
  }

  private async request(payload: Uint8Array, reply: number, stage: string): Promise<Packet> {
    await this.send(payload);
    return this.expect(reply, stage);
  }

  /** Mutual challenge-response. Throws if the cuff fails to prove itself or rejects our answer. */
  async authenticate(): Promise<void> {
    const r1 = makeChallenge(this.o.random);
    const challenge = await this.request(identifyPayload(r1), CMD.identifyChallenge, 'auth');
    const answer = identifyAnswer(challenge.data, r1);
    if (!answer) throw new IHealthError('auth', 'this does not look like a KN-550BT');
    await this.send(answer);
    const ok = await this.waitAny([CMD.identifyOk, CMD.identifyFail], 'auth');
    if (ok.command !== CMD.identifyOk) throw new IHealthError('auth', 'the cuff rejected the handshake');
  }

  private async waitAny(commands: number[], stage: string): Promise<Packet> {
    const queued = this.queue.findIndex((p) => commands.includes(p.command));
    if (queued >= 0) return this.queue.splice(queued, 1)[0];
    return new Promise<Packet>((resolve, reject) => {
      const timer = (this.o.setTimer ?? setTimeout)(() => {
        this.waiter = null;
        reject(new IHealthError(stage, 'the cuff did not answer'));
      }, this.o.timeoutMs ?? 8000);
      this.waiter = {
        accept: (p) => commands.includes(p.command),
        resolve,
        reject: (e) => reject(new IHealthError(stage, e.message)),
        timer,
      };
    });
  }

  async setClock(): Promise<void> {
    await this.request(functionInfoPayload((this.o.now ?? (() => new Date()))()), CMD.functionInfo, 'clock');
  }

  async battery(): Promise<number> {
    const p = await this.request(cmd(CMD.battery, 0, 0, 0), CMD.battery, 'battery');
    return p.data[0];
  }

  async readReadings(): Promise<Download> {
    const count = await this.request(cmd(CMD.offlineCount, 1, 0, 0), CMD.offlineCount, 'readings');
    const expected = count.data[1] ?? 0;
    if (expected === 0) return { readings: [], complete: true, expected: 0 };

    const buf: number[] = [];
    let finished = false;
    for (let page = 0; page < MAX_PAGES && !finished; page++) {
      const p = await this.request(cmd(CMD.offlineData, 1, 0, 0), CMD.offlineData, 'readings');
      buf.push(...p.data.subarray(2));
      finished = p.data[1] === 0;
    }
    const readings = parseRecords(Uint8Array.from(buf));
    const whole = buf.length % RECORD_SIZE === 0;
    return { readings, complete: finished && whole && buf.length / RECORD_SIZE >= expected, expected };
  }

  /** Permanently clears the cuff's memory. Only call this once the readings are safely saved. */
  async deleteReadings(): Promise<void> {
    await this.request(cmd(CMD.offlineDataOver, 0, 0, 0), CMD.offlineDataOver, 'delete');
  }
}
