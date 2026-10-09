/**
 * Drives one connection to a Beurer BF720. Transport-agnostic: feed it indication bytes and give it
 * a `writeControlPoint` function.
 *
 * The scale sends nothing until a client has registered or consented as a user, so the flow is:
 *   no stored pairing -> Register New User(code) -> slot index -> Consent(index, code)
 *   stored pairing    -> Consent(index, code)
 * After consent the scale delivers any stored readings once, then live weigh-ins as they happen.
 * A reading is a Weight frame followed by a Body Composition frame; the second has no timestamp or
 * user id, so the two are paired by order.
 */
import type { MeasurementType } from '@/domain/measurement';
import type { WeighIn } from '../qn/session';
import {
  UCP,
  UCP_RESULT,
  MAX_CONSENT_CODE,
  buildConsent,
  buildRegisterNewUser,
  describeUcpFailure,
  parseBodyCompositionMeasurement,
  parseUcpResponse,
  parseWeightMeasurement,
  type ScaleBodyFrame,
  type ScaleWeightFrame,
} from './protocol';

export interface BeurerPairing {
  userIndex: number;
  consentCode: number;
}

export interface BeurerSessionOptions {
  writeControlPoint: (bytes: Uint8Array) => void | Promise<void>;
  /** The slot and code from an earlier registration, if any. */
  pairing: BeurerPairing | null;
  /** Picks the code for a fresh registration. */
  newConsentCode?: () => number;
  /** A registration succeeded; persist this or the slot is lost. */
  onPaired: (p: BeurerPairing) => void;
  /** The scale accepted our consent: write the profile and tell the user to step on. */
  onConsented: (p: BeurerPairing) => void;
  onWeighIn: (w: WeighIn) => void;
  onStatus: (message: string) => void;
  onError: (message: string) => void;
  /** The stored code no longer works; the caller should forget it. */
  onPairingRejected?: () => void;
  /** How long to wait for the Body Composition half of a reading. */
  pairTimeoutMs?: number;
  setTimer?: (fn: () => void, ms: number) => unknown;
  clearTimer?: (handle: unknown) => void;
}

export const randomConsentCode = (): number => Math.floor(Math.random() * (MAX_CONSENT_CODE + 1));

export class BeurerSession {
  private pairing: BeurerPairing | null;
  private consented = false;
  private pendingCode: number | null = null;
  private pendingWeight: ScaleWeightFrame | null = null;
  private pendingBody: ScaleBodyFrame | null = null;
  private timer: unknown = null;

  constructor(private readonly opts: BeurerSessionOptions) {
    this.pairing = opts.pairing;
  }

  /** Call once every indication is subscribed (they must be, before consent). */
  begin(): void {
    if (this.pairing) {
      this.opts.onStatus('Connecting to your scale…');
      void this.opts.writeControlPoint(buildConsent(this.pairing.userIndex, this.pairing.consentCode));
    } else {
      const code = (this.opts.newConsentCode ?? randomConsentCode)();
      this.pendingCode = code;
      this.opts.onStatus('Setting up your scale…');
      void this.opts.writeControlPoint(buildRegisterNewUser(code));
    }
  }

  handleControlPoint(data: Uint8Array): void {
    const r = parseUcpResponse(data);
    if (!r) return;

    if (r.requestOpcode === UCP.REGISTER_NEW_USER) {
      if (r.result !== UCP_RESULT.SUCCESS || r.userIndex === null || this.pendingCode === null) {
        this.opts.onError(describeUcpFailure(r.requestOpcode, r.result));
        return;
      }
      this.pairing = { userIndex: r.userIndex, consentCode: this.pendingCode };
      this.pendingCode = null;
      this.opts.onPaired(this.pairing);
      void this.opts.writeControlPoint(buildConsent(this.pairing.userIndex, this.pairing.consentCode));
      return;
    }

    if (r.requestOpcode === UCP.CONSENT) {
      if (r.result === UCP_RESULT.SUCCESS && this.pairing) {
        this.consented = true;
        this.opts.onConsented(this.pairing);
        return;
      }
      if (r.result === UCP_RESULT.USER_NOT_AUTHORIZED || r.result === UCP_RESULT.INVALID_PARAMETER) {
        this.opts.onPairingRejected?.();
      }
      this.opts.onError(describeUcpFailure(r.requestOpcode, r.result));
    }
  }

  handleWeight(data: Uint8Array): void {
    const w = parseWeightMeasurement(data);
    if (!w || !this.isOurs(w.userIndex)) return;
    // A new weight while another is still waiting for its body half: ship the old one on its own.
    if (this.pendingWeight) this.flush();
    this.pendingWeight = w;
    if (this.pendingBody) {
      this.flush();
      return;
    }
    this.armTimer();
  }

  handleBodyComposition(data: Uint8Array): void {
    const b = parseBodyCompositionMeasurement(data);
    if (!b || !this.isOurs(b.userIndex)) return;
    this.pendingBody = b;
    if (this.pendingWeight) this.flush();
    else this.armTimer();
  }

  /** True once the scale has accepted our consent and will send readings. */
  get ready(): boolean {
    return this.consented;
  }

  destroy(): void {
    this.cancelTimer();
    this.pendingWeight = null;
    this.pendingBody = null;
  }

  private isOurs(userIndex: number | null): boolean {
    return userIndex === null || this.pairing === null || userIndex === this.pairing.userIndex;
  }

  private armTimer(): void {
    this.cancelTimer();
    const set = this.opts.setTimer ?? ((fn, ms) => setTimeout(fn, ms));
    this.timer = set(() => this.flush(), this.opts.pairTimeoutMs ?? 2500);
  }

  private cancelTimer(): void {
    if (this.timer === null) return;
    (this.opts.clearTimer ?? ((h) => clearTimeout(h as ReturnType<typeof setTimeout>)))(this.timer);
    this.timer = null;
  }

  private flush(): void {
    this.cancelTimer();
    const w = this.pendingWeight;
    const b = this.pendingBody;
    this.pendingWeight = null;
    this.pendingBody = null;
    // A body half with no weight is useless on its own, except that the frame repeats the weight.
    const weightKg = w?.weightKg ?? b?.weightKg ?? null;
    if (weightKg === null) return;

    const scaleMetrics: Partial<Record<MeasurementType, number>> = {};
    if (w?.bmi != null) scaleMetrics.bmi = w.bmi;
    if (b) {
      if (b.bmrKcal !== null) scaleMetrics.bmr = b.bmrKcal;
      if (b.musclePercent !== null) scaleMetrics.muscle_mass = round2((weightKg * b.musclePercent) / 100);
      if (b.fatFreeMassKg !== null) scaleMetrics.fat_free_mass = b.fatFreeMassKg;
      if (b.bodyWaterMassKg !== null) scaleMetrics.body_water = round1((b.bodyWaterMassKg / weightKg) * 100);
    }

    this.opts.onStatus('Done');
    this.opts.onWeighIn({
      flavor: 'beurer',
      weightKg,
      bodyFat: b?.bodyFatPercent ?? null,
      resistance1: b?.impedanceOhms ?? null,
      resistance2: null,
      takenAt: w?.takenAt ?? b?.takenAt ?? undefined,
      scaleMetrics,
    });
  }
}

const round1 = (v: number) => Math.round(v * 10) / 10;
const round2 = (v: number) => Math.round(v * 100) / 100;
