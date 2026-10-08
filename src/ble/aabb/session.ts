import type { WeighIn } from '@/ble/qn/session';
import { parseBroadcast, splitManufacturerData } from './protocol';

export interface AabbSessionOptions {
  onWeighIn: (w: WeighIn) => void;
  onLiveWeight?: (kg: number) => void;
  /**
   * The scale repeats its final frame for a whole advertising burst; ignore repeats for this
   * long so one weigh-in gives one reading. The real burst length is not known yet, so err long.
   */
  cooldownMs?: number;
  now?: () => number;
}

/** Turns a stream of advertisements into weigh-ins. Locks onto the first scale it sees. */
export class AabbSession {
  private mac: string | null = null;
  private lastDeliveredAt = -Infinity;
  private readonly cooldownMs: number;
  private readonly now: () => number;

  constructor(private readonly opts: AabbSessionOptions) {
    this.cooldownMs = opts.cooldownMs ?? 10_000;
    this.now = opts.now ?? Date.now;
  }

  /** Feed the raw manufacturer data of one advertisement. Returns true if it was one of ours. */
  handleManufacturerData(raw: Uint8Array): boolean {
    const split = splitManufacturerData(raw);
    if (!split) return false;
    const frame = parseBroadcast(split.companyId, split.payload);
    if (!frame) return false;

    // A neighbour's scale (or a second one of yours) would otherwise mix into the reading.
    if (this.mac === null) this.mac = frame.mac;
    else if (frame.mac !== this.mac) return true;

    if (frame.final) {
      const t = this.now();
      if (t - this.lastDeliveredAt >= this.cooldownMs) {
        this.lastDeliveredAt = t;
        this.opts.onWeighIn({
          flavor: 'broadcast',
          weightKg: frame.weightKg,
          bodyFat: null,
          resistance1: null,
          resistance2: null,
        });
      }
    } else if (frame.weightKg > 0) {
      this.opts.onLiveWeight?.(frame.weightKg);
    }
    return true;
  }
}
