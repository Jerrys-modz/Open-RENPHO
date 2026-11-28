import {
  CM_PER_IN,
  convertValue,
  defaultUnitSystem,
  formatDeltaForDisplay,
  formatForDisplay,
  heightToInput,
  parseHeightToCm,
  parseWeightToKg,
  weightToInput,
} from '../units';

describe('convertValue / formatForDisplay', () => {
  it('leaves metric values alone', () => {
    expect(convertValue(75, 'kg', 'metric')).toEqual({ value: 75, unit: 'kg' });
  });
  it('converts kg to lb and cm to in when imperial', () => {
    expect(formatForDisplay({ unit: 'kg', digits: 2 }, 108.7, 'imperial')).toEqual({ text: '239.6', unit: 'lb' });
    expect(formatForDisplay({ unit: 'cm', digits: 1 }, 31.5, 'imperial')).toEqual({ text: '12.4', unit: 'in' });
  });
  it('does not touch percentages, BMI or kcal', () => {
    expect(formatForDisplay({ unit: '%', digits: 1 }, 21, 'imperial')).toEqual({ text: '21.0', unit: '%' });
    expect(formatForDisplay({ unit: 'kcal', digits: 0 }, 1665.4, 'imperial')).toEqual({ text: '1665', unit: 'kcal' });
    expect(formatForDisplay({ unit: '', digits: 1 }, 23.74, 'imperial')).toEqual({ text: '23.7', unit: '' });
  });
});

describe('formatDeltaForDisplay', () => {
  it('signs and converts a change', () => {
    expect(formatDeltaForDisplay({ unit: 'kg', digits: 1 }, -0.5, 'imperial')).toEqual({ text: '-1.1', unit: 'lb' });
    expect(formatDeltaForDisplay({ unit: 'kg', digits: 1 }, 0.5, 'metric')).toEqual({ text: '+0.5', unit: 'kg' });
  });
  it('shows a tiny change as zero without a sign', () => {
    expect(formatDeltaForDisplay({ unit: 'kg', digits: 1 }, 0.01, 'metric')).toEqual({ text: '0.0', unit: 'kg' });
  });
});

describe('defaultUnitSystem', () => {
  it('is imperial for the US and metric elsewhere', () => {
    expect(defaultUnitSystem('en-US')).toBe('imperial');
    expect(defaultUnitSystem('en_US')).toBe('imperial');
    expect(defaultUnitSystem('en-GB')).toBe('metric');
    expect(defaultUnitSystem('de-DE')).toBe('metric');
    expect(defaultUnitSystem(undefined)).toBe('metric');
  });
});

describe('height input', () => {
  it('metric is plain cm', () => {
    expect(parseHeightToCm('178', 'metric')).toBe(178);
    expect(parseHeightToCm('170,5', 'metric')).toBe(170.5);
    expect(heightToInput(178, 'metric')).toBe('178');
  });
  it('imperial accepts inches and feet-and-inches', () => {
    expect(parseHeightToCm('70', 'imperial')).toBeCloseTo(70 * CM_PER_IN, 5);
    expect(parseHeightToCm("5'10", 'imperial')).toBeCloseTo(70 * CM_PER_IN, 5);
    expect(parseHeightToCm('5\' 10"', 'imperial')).toBeCloseTo(70 * CM_PER_IN, 5);
    expect(parseHeightToCm('6 ft', 'imperial')).toBeCloseTo(72 * CM_PER_IN, 5);
    expect(parseHeightToCm('5ft 11in', 'imperial')).toBeCloseTo(71 * CM_PER_IN, 5);
  });
  it('rejects nonsense', () => {
    expect(parseHeightToCm('tall', 'imperial')).toBeNaN();
    expect(parseHeightToCm('', 'imperial')).toBeNaN();
  });
  it('shows an existing height back in inches', () => {
    expect(heightToInput(177.8, 'imperial')).toBe('70');
  });
});

describe('blood pressure units', () => {
  const bp = { unit: 'mmHg', digits: 0 };
  it('shows mmHg untouched by the weight/length system', () => {
    expect(formatForDisplay(bp, 125, 'imperial')).toEqual({ text: '125', unit: 'mmHg' });
    expect(formatForDisplay(bp, 125, 'metric', 'mmHg')).toEqual({ text: '125', unit: 'mmHg' });
  });
  it('converts to kPa with one decimal', () => {
    expect(formatForDisplay(bp, 120, 'metric', 'kPa')).toEqual({ text: '16.0', unit: 'kPa' });
    expect(formatForDisplay(bp, 80, 'imperial', 'kPa')).toEqual({ text: '10.7', unit: 'kPa' });
  });
  it('converts a change in pressure too', () => {
    expect(formatDeltaForDisplay(bp, 10, 'metric', 'kPa')).toEqual({ text: '+1.3', unit: 'kPa' });
    expect(formatDeltaForDisplay(bp, -10, 'metric')).toEqual({ text: '-10', unit: 'mmHg' });
  });
});

describe('weight input', () => {
  it('parses what was typed in the current system into kg', () => {
    expect(parseWeightToKg('165', 'imperial')).toBeCloseTo(74.84, 1);
    expect(parseWeightToKg('74,5', 'metric')).toBe(74.5);
    expect(parseWeightToKg('', 'metric')).toBeNaN();
    expect(parseWeightToKg('abc', 'imperial')).toBeNaN();
  });

  it('shows kg the way it would be typed', () => {
    expect(weightToInput(74.84, 'metric')).toBe('74.8');
    expect(weightToInput(74.84, 'imperial')).toBe('165.0');
  });
});
