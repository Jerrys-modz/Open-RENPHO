import { activePerson, addPerson, newPersonId, PRIMARY_PERSON, removePerson, renamePerson, setActive, validatePersonName } from '@/domain/people';
import { clearBeurerPairingFor } from './beurerPairing';
import { getPeople, savePeople } from './usePeople';
import { deleteGoalsFor } from './useGoals';
import { removePersonData } from './useMeasurements';
import { deleteProfileFor } from './useProfile';

/** Adds a person and makes no one active. Returns an error message, or null on success. */
export function addPersonByName(name: string): string | null {
  const state = getPeople();
  const error = validatePersonName(name, state.people);
  if (error) return error;
  savePeople(addPerson(state, name, newPersonId(state.people)));
  return null;
}

export function renamePersonTo(id: string, name: string): string | null {
  const state = getPeople();
  const error = validatePersonName(name, state.people.filter((p) => p.id !== id));
  if (error) return error;
  savePeople(renamePerson(state, id, name));
  return null;
}

export function switchToPerson(id: string): void {
  savePeople(setActive(getPeople(), id));
}

/** Removes a person and everything of theirs on this phone: readings, profile, goals and Beurer slot. The primary person cannot be removed. */
export function removePersonAndData(id: string): void {
  if (id === PRIMARY_PERSON) return;
  // Leave the person first, so no screen is showing data that is about to disappear.
  savePeople(removePerson(getPeople(), id));
  removePersonData(id);
  deleteProfileFor(id);
  deleteGoalsFor(id);
  clearBeurerPairingFor(id);
}

export { activePerson };
