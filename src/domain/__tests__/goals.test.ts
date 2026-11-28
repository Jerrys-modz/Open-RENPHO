import type { BpReading } from '../bloodPressure';
import { bpTargetShare, meetsBpTarget, parseGoals, serializeGoals, validateBpTarget, validateWeightGoal, weightProgress } from '../goals';

describe('weightProgress', () => {
  it('counts the way from the starting weight to a lower target', () => {
    const p = weightProgress({ startKg: 100, targetKg: 80 }, 90);
    expect(p).toMatchObject({ fraction: 0.5, remainingKg: 10, reached: false, direction: 'lose' });
  });

  it('works for gaining too, and stops at the ends', () => {
    expect(weightProgress({ startKg: 60, targetKg: 70 }, 65)).toMatchObject({ fraction: 0.5, remainingKg: 5, direction: 'gain' });
    expect(weightProgress({ startKg: 100, targetKg: 80 }, 105)).toMatchObject({ fraction: 0, remainingKg: 25 });
  });

  it('is reached at or past the target', () => {
    expect(weightProgress({ startKg: 100, targetKg: 80 }, 80)).toMatchObject({ fraction: 1, remainingKg: 0, reached: true });
    expect(weightProgress({ startKg: 100, targetKg: 80 }, 78)).toMatchObject({ fraction: 1, remainingKg: 0, reached: true });
    expect(weightProgress({ startKg: 60, targetKg: 70 }, 71).reached).toBe(true);
  });
});

describe('validation', () => {
  it('rejects silly weight goals and a goal equal to the current weight', () => {
    expect(validateWeightGoal(10, 80)).toMatch(/between 20 and 400/);
    expect(validateWeightGoal(NaN, 80)).toMatch(/between 20 and 400/);
    expect(validateWeightGoal(80, NaN)).toMatch(/Weigh in once/);
    expect(validateWeightGoal(80, 80.05)).toMatch(/same as/);
    expect(validateWeightGoal(75, 80)).toBeNull();
  });

  it('checks the blood-pressure target', () => {
    expect(validateBpTarget({ systolic: 130, diastolic: 80 })).toBeNull();
    expect(validateBpTarget({ systolic: 80, diastolic: 60 })).toMatch(/Systolic target/);
    expect(validateBpTarget({ systolic: 130, diastolic: 40 })).toMatch(/Diastolic target/);
    expect(validateBpTarget({ systolic: 100, diastolic: 110 })).toMatch(/higher than diastolic/);
  });
});

describe('blood-pressure target', () => {
  const DAY = 24 * 60 * 60 * 1000;
  const rd = (takenAt: number, systolic: number, diastolic: number): BpReading => ({
    takenAt, systolic, diastolic, pulse: 60, irregularPulse: false, bodyMovement: false, arm: null, position: null, note: null,
  });
  const target = { systolic: 130, diastolic: 80 };

  it('needs both numbers below the target', () => {
    expect(meetsBpTarget({ systolic: 129, diastolic: 79 }, target)).toBe(true);
    expect(meetsBpTarget({ systolic: 130, diastolic: 70 }, target)).toBe(false);
    expect(meetsBpTarget({ systolic: 120, diastolic: 80 }, target)).toBe(false);
  });

  it('counts readings in the window ending at the newest one', () => {
    const rs = [rd(100 * DAY, 125, 75), rd(99 * DAY, 135, 85), rd(98 * DAY, 120, 70), rd(10 * DAY, 160, 100)];
    expect(bpTargetShare(rs, target, 7)).toEqual({ meeting: 2, total: 3 });
    expect(bpTargetShare(rs, target, 365)).toEqual({ meeting: 2, total: 4 });
    expect(bpTargetShare([], target, 30)).toBeNull();
  });
});

describe('parseGoals', () => {
  it('round-trips and tolerates garbage', () => {
    const g = { weight: { targetKg: 75, startKg: 80 }, bp: { systolic: 130, diastolic: 80 } };
    expect(parseGoals(serializeGoals(g))).toEqual(g);
    expect(parseGoals('nope')).toEqual({ weight: null, bp: null });
    expect(parseGoals(JSON.stringify({ weight: { targetKg: 5, startKg: 80 }, bp: { systolic: 50, diastolic: 80 } }))).toEqual({ weight: null, bp: null });
  });
});
