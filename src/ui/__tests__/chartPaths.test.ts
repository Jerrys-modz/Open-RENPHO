import { buildChart, nearestIndex } from '../chartPaths';

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

describe('nearestIndex', () => {
  const coords = [{ x: 10 }, { x: 50 }, { x: 100 }];

  it('picks the closest point, clamping past either end', () => {
    expect(nearestIndex(coords, 0)).toBe(0);
    expect(nearestIndex(coords, 29)).toBe(0);
    expect(nearestIndex(coords, 31)).toBe(1);
    expect(nearestIndex(coords, 90)).toBe(2);
    expect(nearestIndex(coords, 500)).toBe(2);
  });

  it('returns -1 with no points', () => {
    expect(nearestIndex([], 5)).toBe(-1);
  });

  it('exposes where each point landed', () => {
    const g = buildChart([{ t: 0, v: 1 }, { t: 10, v: 2 }], 110, 50, { top: 10, bottom: 10, left: 10, right: 10 });
    expect(g.coords).toEqual([{ x: 10, y: 40 }, { x: 100, y: 10 }]);
  });
});
