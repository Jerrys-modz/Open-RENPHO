import type { Measurement } from './measurement';

/** The first person, and the owner of the phone. Existing readings (saved before people existed) are theirs. */
export const PRIMARY_PERSON = 'me';

export const PERSON_NAME_MAX = 30;

export interface Person {
  id: string;
  name: string;
}

export interface People {
  people: Person[];
  activeId: string;
}

export const DEFAULT_PEOPLE: People = { people: [{ id: PRIMARY_PERSON, name: 'Me' }], activeId: PRIMARY_PERSON };

/** Whose a reading is: readings without a person belong to the primary person. */
export const personOf = (m: Pick<Measurement, 'person'>): string => m.person ?? PRIMARY_PERSON;

/** Only this person's readings. */
export const measurementsOf = (list: readonly Measurement[], personId: string): Measurement[] =>
  list.filter((m) => personOf(m) === personId);

/** Marks readings as someone's. The primary person's are left unmarked, so the stored data stays as it always was. */
export function forPerson(ms: readonly Measurement[], personId: string): Measurement[] {
  return ms.map((m) => (m.person !== undefined || personId === PRIMARY_PERSON ? m : { ...m, person: personId }));
}

/** Removes everything that belongs to one person. */
export const withoutPerson = (list: readonly Measurement[], personId: string): Measurement[] =>
  list.filter((m) => personOf(m) !== personId);

export const activePerson = (p: People): Person => p.people.find((x) => x.id === p.activeId) ?? p.people[0];

/** Null when fine, otherwise a message for the user. */
export function validatePersonName(name: string, others: readonly Person[]): string | null {
  const t = name.trim();
  if (t === '') return 'Enter a name.';
  if (t.length > PERSON_NAME_MAX) return `Names can be up to ${PERSON_NAME_MAX} characters.`;
  if (others.some((o) => o.name.trim().toLowerCase() === t.toLowerCase())) return 'Someone already has that name.';
  return null;
}

/** A short unique id for a new person. */
export function newPersonId(existing: readonly Person[], random: () => number = Math.random): string {
  for (;;) {
    const id = `p${Math.floor(random() * 36 ** 6).toString(36).padStart(6, '0')}`;
    if (!existing.some((p) => p.id === id)) return id;
  }
}

export function addPerson(state: People, name: string, id: string): People {
  return { ...state, people: [...state.people, { id, name: name.trim() }] };
}

export function renamePerson(state: People, id: string, name: string): People {
  return { ...state, people: state.people.map((p) => (p.id === id ? { ...p, name: name.trim() } : p)) };
}

/** The primary person cannot be removed. If the active person is removed, the primary becomes active. */
export function removePerson(state: People, id: string): People {
  if (id === PRIMARY_PERSON) return state;
  const people = state.people.filter((p) => p.id !== id);
  return { people, activeId: state.activeId === id ? PRIMARY_PERSON : state.activeId };
}

export function setActive(state: People, id: string): People {
  return state.people.some((p) => p.id === id) ? { ...state, activeId: id } : state;
}

export function serializePeople(s: People): string {
  return JSON.stringify({ version: 1, ...s });
}

/** Tolerant: the primary person always exists and comes first, and the active person is always someone real. */
export function parsePeople(text: string): People {
  try {
    const d = JSON.parse(text) as { people?: unknown; activeId?: unknown };
    const raw = Array.isArray(d.people) ? d.people : [];
    const seen = new Set<string>([PRIMARY_PERSON]);
    const others: Person[] = [];
    let primaryName = DEFAULT_PEOPLE.people[0].name;
    for (const x of raw as { id?: unknown; name?: unknown }[]) {
      if (!x || typeof x.id !== 'string' || typeof x.name !== 'string') continue;
      const name = x.name.trim().slice(0, PERSON_NAME_MAX);
      if (name === '') continue;
      if (x.id === PRIMARY_PERSON) primaryName = name;
      else if (!seen.has(x.id)) {
        seen.add(x.id);
        others.push({ id: x.id, name });
      }
    }
    const people = [{ id: PRIMARY_PERSON, name: primaryName }, ...others];
    const activeId = typeof d.activeId === 'string' && people.some((p) => p.id === d.activeId) ? d.activeId : PRIMARY_PERSON;
    return { people, activeId };
  } catch {
    return DEFAULT_PEOPLE;
  }
}

/** The file a person's data lives in: the primary person keeps the original name, others get their id added. */
export const personFile = (base: string, personId: string): string =>
  personId === PRIMARY_PERSON ? `${base}.json` : `${base}-${personId}.json`;
