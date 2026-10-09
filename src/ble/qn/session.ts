/**
 * Drives one weigh-in with a QN scale. Transport-agnostic: feed it
 * notification bytes and give it a `write` function.
 *
 * Flavors (see docs/protocol/qn-scale.md):
 *  - extended (HVIN ESCS20MA2): scale asks for a profile, computes body fat
 *    on-device.
 *  - basic (HVIN ESCS20MN): scale streams weight + raw impedance; we compute
 *    body fat ourselves.
 */
import type { MeasurementType } from '@/domain/measurement';
import {
  BASIC_STATUS,
  BOOTSTRAP_PROFILE,
  DEFAULT_VENDOR_BYTE,
  EXT_STATUS,
  LEN,
  OP,
  buildEndMeasurementCommand,
  buildMeasurementInitiationCommand,
  buildUnitUpdateCommand,
  buildUserProfileCommand,
  parseBasicMeasurement,
  parseExtendedMeasurement,
  type ScaleProfile,
} from './protocol';

export type Flavor = 'extended' | 'basic' | 'broadcast' | 'beurer';

export interface WeighIn {
  flavor: Flavor;
  weightKg: number;
  /** On-device body fat (extended flavor only). */
  bodyFat: number | null;
  resistance1: number | null;
  resistance2: number | null;
  /** Unix ms from the scale's own clock, when it has one (stored readings arrive late). */
  takenAt?: number;
  /** Other metrics the scale computed itself; these win over our estimates. */
  scaleMetrics?: Partial<Record<MeasurementType, number>>;
}

export interface QnSessionOptions {
  write: (bytes: Uint8Array) => void | Promise<void>;
  onWeighIn: (w: WeighIn) => void;
  /** Called for every in-progress weight reading, for a live display. */
  onLiveWeight?: (kg: number) => void;
  /** Profile sent to an extended-flavor scale. Defaults to "no body fat". */
  profile?: ScaleProfile;
  onWarning?: (msg: string) => void;
}

export class QnSession {
  private vendorByte = DEFAULT_VENDOR_BYTE;
  private unitSent = false;
  private initSent = false;
  private profileSent = false;
  private done = false;

  constructor(private readonly opts: QnSessionOptions) {}

  handleNotification(data: Uint8Array): void {
    if (data.length < 2) return;
    const opcode = data[0];
    const length = data[1];

    if (
      data.length >= 3 &&
      (opcode === OP.MEASUREMENT ||
        opcode === OP.UNIT_REQUEST ||
        opcode === OP.MEAS_INIT_REQUEST ||
        opcode === OP.PRE_MEASUREMENT ||
        opcode === OP.STORED_MEASUREMENT)
    ) {
      this.vendorByte = data[2];
    }

    switch (opcode) {
      case OP.UNIT_REQUEST:
        if (!this.unitSent) {
          this.unitSent = true;
          this.send(buildUnitUpdateCommand(this.vendorByte));
        }
        break;
      case OP.MEAS_INIT_REQUEST:
        if (!this.initSent) {
          this.initSent = true;
          this.send(buildMeasurementInitiationCommand(this.vendorByte));
        }
        break;
      case OP.PRE_MEASUREMENT:
        // An extended scale won't start measuring until it gets a profile.
        if (
          length >= LEN.EXTENDED_PRE_MEASUREMENT &&
          this.vendorByte === DEFAULT_VENDOR_BYTE &&
          !this.profileSent
        ) {
          this.profileSent = true;
          this.send(buildUserProfileCommand(this.opts.profile ?? BOOTSTRAP_PROFILE));
        }
        break;
      case OP.MEASUREMENT:
        if (
          length === LEN.EXTENDED_MEASUREMENT ||
          length === LEN.EXTENDED_MEASUREMENT_LONG
        ) {
          this.onExtended(data);
        } else if (length === LEN.BASIC_MEASUREMENT) {
          this.onBasic(data);
        }
        break;
      default:
        // Profile ack, stored records and metrics panels are ignored in v1.
        break;
    }
  }

  private onExtended(data: Uint8Array): void {
    if (data.length < LEN.EXTENDED_MEASUREMENT) return;
    const f = parseExtendedMeasurement(data);
    if (f.status === EXT_STATUS.UNSTABLE) {
      this.opts.onLiveWeight?.(f.weightKg);
      return;
    }
    if (f.status === EXT_STATUS.STABLE) {
      this.opts.onLiveWeight?.(f.weightKg);
      return;
    }
    if (f.status === EXT_STATUS.STABLE_WITH_METRICS) {
      if (this.done) return;
      this.done = true;
      this.send(buildEndMeasurementCommand(this.vendorByte));
      this.opts.onWeighIn({
        flavor: 'extended',
        weightKg: f.weightKg,
        bodyFat: f.bodyFat,
        resistance1: f.resistance1,
        resistance2: f.resistance2,
      });
      return;
    }
    this.opts.onWarning?.(`unknown extended measurement status ${f.status}`);
  }

  private onBasic(data: Uint8Array): void {
    const f = parseBasicMeasurement(data);
    if (f.status === BASIC_STATUS.SETTLING || f.status === BASIC_STATUS.BIA_RUNNING) {
      this.opts.onLiveWeight?.(f.weightKg);
      return;
    }
    if (f.status !== BASIC_STATUS.FINAL) {
      this.opts.onWarning?.(`unexpected basic status 0x${f.status.toString(16)}`);
      return;
    }
    if (this.done) return;
    this.done = true;
    this.send(buildEndMeasurementCommand(this.vendorByte));
    this.opts.onWeighIn({
      flavor: 'basic',
      weightKg: f.weightKg,
      bodyFat: null,
      resistance1: f.resistance1 || null,
      resistance2: f.resistance2 || null,
    });
  }

  private send(bytes: Uint8Array): void {
    void Promise.resolve(this.opts.write(bytes)).catch((e) =>
      this.opts.onWarning?.(`write failed: ${String(e)}`),
    );
  }
}
