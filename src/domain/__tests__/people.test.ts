import type { Measurement } from '../measurement';
import {
  DEFAULT_PEOPLE,
  PRIMARY_PERSON,
  activePerson,
  addPerson,
  forPerson,
  measurementsOf,
  newPersonId,
  parsePeople,
  personOf,
  removePerson,
  renamePerson,
  serializePeople,
  setActive,
  validatePersonName,
  withoutPerson,
} from '../people';

const m = (value: number, person?: string): Measurement => ({ type: 'weight', value, takenAt: value, source: 'qn-scale', person });

describe('who a reading belongs to', () => {
  const list = [m(1), m(2, 'p1'), m(3, 'me'), m(4, 'p2')];

  it('treats readings without a person as the primary person\'s', () => {
    expect(personOf(m(1))).toBe(PRIMARY_PERSON);
    expect(measurementsOf(list, 'me').map((x) => x.value)).toEqual([1, 3]);
    expect(measurementsOf(list, 'p1').map((x) => x.value)).toEqual([2]);
  });

  it('marks new readings for others but leaves the primary person\'s unmarked', () => {
    expect(forPerson([m(1)], 'p1')[0].person).toBe('p1');
    expect('person' in forPerson([m(1)], 'me')[0]).toBe(true); // m() always has the key
    expect(forPerson([{ type: 'weight', value: 1, takenAt: 1, source: 's' }], 'me')[0]).not.toHaveProperty('person');
    expect(forPerson([m(1, 'p2')], 'p1')[0].person).toBe('p2'); // never re-labelled
  });

  it('removes one person\'s readings and nobody else\'s', () => {
    expect(withoutPerson(list, 'p1').map((x) => x.value)).toEqual([1, 3, 4]);
  });
});

describe('managing people', () => {
  it('adds, renames and switches', () => {
    let s = addPerson(DEFAULT_PEOPLE, '  Alex ', 'p1');
    s = setActive(s, 'p1');
    expect(activePerson(s)).toEqual({ id: 'p1', name: 'Alex' });
    s = renamePerson(s, 'p1', 'Sam');
    expect(s.people.map((p) => p.name)).toEqual(['Me', 'Sam']);
    expect(setActive(s, 'nobody').activeId).toBe('p1');
  });

  it('never removes the primary person, and falls back to them when the active one goes', () => {
    let s = setActive(addPerson(DEFAULT_PEOPLE, 'Alex', 'p1'), 'p1');
    expect(removePerson(s, PRIMARY_PERSON)).toBe(s);
    s = removePerson(s, 'p1');
    expect(s.people.map((p) => p.id)).toEqual(['me']);
    expect(s.activeId).toBe('me');
  });

  it('checks names', () => {
    const others = [{ id: 'me', name: 'Me' }];
    expect(validatePersonName('  ', others)).toMatch(/Enter a name/);
    expect(validatePersonName('x'.repeat(31), others)).toMatch(/up to 30/);
    expect(validatePersonName('me', others)).toMatch(/already/);
    expect(validatePersonName('Alex', others)).toBeNull();
  });

  it('makes ids that do not clash', () => {
    const r = [0.1, 0.1, 0.2];
    let i = 0;
    const first = newPersonId([], () => r[i++]);
    expect(newPersonId([{ id: first, name: 'A' }], () => r[i++ % 3 === 0 ? 0 : 0.1 === 0.1 ? 0.2 : 0.3])).not.toBe(first);
  });
});

describe('parsePeople', () => {
  it('round-trips', () => {
    const s = setActive(addPerson(DEFAULT_PEOPLE, 'Alex', 'p1'), 'p1');
    expect(parsePeople(serializePeople(s))).toEqual(s);
  });

  it('always has the primary person first, and a real active person', () => {
    expect(parsePeople('nope')).toEqual(DEFAULT_PEOPLE);
    const s = parsePeople(JSON.stringify({ people: [{ id: 'p1', name: 'Alex' }, { id: 'p1', name: 'Dup' }, { id: 'p2', name: '  ' }], activeId: 'gone' }));
    expect(s.people).toEqual([{ id: 'me', name: 'Me' }, { id: 'p1', name: 'Alex' }]);
    expect(s.activeId).toBe('me');
  });

  it('keeps a renamed primary person', () => {
    expect(parsePeople(JSON.stringify({ people: [{ id: 'me', name: 'Jordan' }], activeId: 'me' })).people[0].name).toBe('Jordan');
  });
});
