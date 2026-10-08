import { buildChart } from '../chartPaths';

const PAD = { top: 10, bottom: 10, left: 10, right: 10 };

describe('buildChart', () => {
  it('returns empty geometry for no points', () => {
    expect(buildChart([], 100, 50)).toMatchObject({ line: '', area: '', last: null });
  });

  it('maps oldest to the left and the highest value to the top', () => {
    const g = buildChart(
      [
        { t: 0, v: 10 },
        { t: 10, v: 20 },
      ],
      110,
      50,
      PAD,
    );
    expect(g.line).toBe('M10 40 L100 10');
    expect(g.min).toBe(10);
    expect(g.max).toBe(20);
    expect(g.last).toEqual({ x: 100, y: 10 });
  });

  it('closes the area down to the bottom padding', () => {
    const g = buildChart(
      [
        { t: 0, v: 1 },
        { t: 1, v: 2 },
      ],
      100,
      50,
      PAD,
    );
    expect(g.area.endsWith('L10 40 Z')).toBe(true);
  });

  it('centres a flat or single series instead of dividing by zero', () => {
    const flat = buildChart(
      [
        { t: 0, v: 5 },
        { t: 10, v: 5 },
      ],
      110,
      50,
      PAD,
    );
    expect(flat.line).toBe('M10 25 L100 25');
    const one = buildChart([{ t: 7, v: 3 }], 110, 50, PAD);
    expect(one.line).toBe('M55 25');
    expect(one.area).toBe('');
  });
});
