/**
 * Body-composition math for QingNiu-family scales.
 *
 * Ported from renpho-escs20m by Ron (MIT); see THIRD_PARTY_NOTICES.md.
 * These approximate the scale's own firmware, so values may differ slightly
 * from the RENPHO app.
 */
import { round } from './protocol';

export type SexIndex = 0 | 1; // 0 = male, 1 = female

const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));

const ALGO_0X04: Record<string, [number, number, number]> = {
  // `${sex},${athlete}` -> [c_BMI, c_age, c_int]
  '0,false': [1.524, 0.103, -21.992],
  '1,false': [1.545, 0.097, -12.689],
  '0,true': [0.7678, 0.0292, -6.5417],
  '1,true': [0.931, 0.0326, -4.5527],
};

const ALGO_0X03_NONATH: Record<number, [number, number, number, number, number]> = {
  // [c_h2, c_w, c_r, c_age, c_int]
  0: [0.0009, 0.392, -0.00095, -0.0693, 2.877],
  1: [0.00089, 0.39, -0.001, -0.08, -3.3 + 1.662],
};

const ALGO_0X03_ATH: Record<string, [number, number, number, number, number, number]> = {
  // `${sex},${bmi>=25}` -> [c_BMI², c_BMI, c_age, c_w, c_h, c_int]
  '0,true': [-0.0088225, 1.1402243, 0.023917, 0.003917, -0.004927, -7.809911],
  '0,false': [-0.027341, 2.0040585, 0.0282436, 0.02382, -0.019248, -17.06006],
  '1,true': [-0.0060424, 0.999226, 0.03461369, 0.0179066, -0.044369, 5.04487],
  '1,false': [-0.02172, 1.62807, 0.045364, 0.0857724, -0.09616912, 2.5939906],
};

export interface BodyFatInput {
  weightKg: number;
  heightM: number;
  age: number;
  sex: SexIndex;
  /** Impedance in ohms (resistance_1 from the frame). */
  resistance: number;
  algorithm?: number;
  athlete?: boolean;
}

/** Body fat % from weight, height, age, sex and impedance. */
export function calculateBodyFat(input: BodyFatInput): number {
  const { weightKg, heightM, age, sex, resistance } = input;
  const algorithm = input.algorithm ?? 0x04;
  const athlete = input.athlete ?? false;
  if (weightKg <= 0) throw new RangeError('weightKg must be positive');
  if (heightM <= 0) throw new RangeError('heightM must be positive');
  if (resistance <= 0) throw new RangeError('resistance must be positive');

  const bmi = weightKg / heightM ** 2;
  const heightCm = heightM * 100;

  if (algorithm === 0x04) {
    const [cBmi, cAge, cInt] = ALGO_0X04[`${sex},${athlete}`];
    let bf = cBmi * bmi + cAge * age + cInt;
    if (!athlete) bf -= 500 / resistance;
    return round(bf, 1);
  }
  if (algorithm === 0x03) {
    if (!athlete) {
      const [cH2, cW, cR, cAge, cInt] = ALGO_0X03_NONATH[sex];
      const lbm = cH2 * heightCm ** 2 + cW * weightKg + cR * resistance + cAge * age + cInt;
      return round(((weightKg - lbm) / weightKg) * 100, 1);
    }
    const [cBmi2, cBmi, cAge, cW, cH, cInt] = ALGO_0X03_ATH[`${sex},${bmi >= 25}`];
    return round(
      cBmi2 * bmi * bmi + cBmi * bmi + cAge * age + cW * weightKg + cH * heightCm + cInt,
      1,
    );
  }
  throw new RangeError(`unsupported algorithm 0x${algorithm.toString(16).padStart(2, '0')}`);
}

export interface BodyMetrics {
  bmi: number;
  bodyFat: number;
  fatFreeMass: number;
  bodyWater: number;
  skeletalMuscle: number;
  boneMass: number;
  muscleMass: number;
  protein: number;
  bmr: number;
}

/** Derive the remaining metrics from a body fat percentage. */
export function deriveBodyMetrics(
  weightKg: number,
  heightM: number,
  sex: SexIndex,
  bodyFat: number,
): BodyMetrics {
  if (weightKg <= 0) throw new RangeError('weightKg must be positive');
  if (heightM <= 0) throw new RangeError('heightM must be positive');

  const bmi = round(weightKg / heightM ** 2, 1);
  const fatFreeMass = clamp(round((weightKg * (100 - bodyFat)) / 100, 2), 5, 200);

  const linear = (constant: [number, number], factor: [number, number]) =>
    round(constant[sex] + factor[sex] * bodyFat, 1);

  const bodyWater = clamp(linear([72.202, 68.651], [-0.72223, -0.68725]), 20, 80);
  const skeletalMuscle = clamp(linear([64.713, 58.39], [-0.65508, -0.58654]), 17.5, 70);
  const protein = clamp(linear([22.787, 25.34], [-0.22735, -0.30245]), 5, 24);

  const softLeanPct = linear([94.992, 93.988], [-0.94969, -0.9396]);
  const softLeanKg = clamp(round((weightKg * softLeanPct) / 100, 2), 3.75, 110);
  const bfKg = (bodyFat * weightKg) / 100;
  const boneMass = clamp(round(weightKg - softLeanKg - bfKg, 2), 1, 7);
  const muscleMass = round(weightKg - boneMass - bfKg, 2);

  const bmrConstant: [number, number] = [372.7023, 370.5818];
  const bmrFactor: [number, number] = [430.9015, 359.6167];
  const bmr = clamp(Math.trunc(round(bmrConstant[sex] + bmrFactor[sex] * boneMass, 0)), 900, 2500);

  return { bmi, bodyFat, fatFreeMass, bodyWater, skeletalMuscle, boneMass, muscleMass, protein, bmr };
}
