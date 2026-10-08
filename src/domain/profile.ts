export type Sex = 'male' | 'female';

export interface UserProfile {
  sex: Sex;
  /** ISO date, YYYY-MM-DD. */
  birthDate: string;
  heightCm: number;
  athlete: boolean;
}

/** Whole years, birthday-aware (matches how the RENPHO app computes age). */
export function ageOn(birthDate: string, on: Date = new Date()): number {
  const [y, m, d] = birthDate.split('-').map(Number);
  let age = on.getFullYear() - y;
  const beforeBirthday =
    on.getMonth() + 1 < m || (on.getMonth() + 1 === m && on.getDate() < d);
  if (beforeBirthday) age -= 1;
  return age;
}

export interface ProfileInput {
  sex: Sex;
  birthDate: string;
  heightCm: string | number;
  athlete: boolean;
}

export type ProfileResult = { ok: true; profile: UserProfile } | { ok: false; errors: string[] };

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Checks what the user typed and returns a clean profile or a list of problems. */
export function validateProfile(input: ProfileInput, now: Date = new Date()): ProfileResult {
  const errors: string[] = [];

  const m = ISO_DATE.exec(input.birthDate.trim());
  let birthDate = '';
  if (!m) {
    errors.push('Birth date must look like 1990-04-23.');
  } else {
    const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
    const date = new Date(Date.UTC(y, mo - 1, d));
    const real = date.getUTCFullYear() === y && date.getUTCMonth() === mo - 1 && date.getUTCDate() === d;
    if (!real) errors.push('That birth date does not exist.');
    else {
      birthDate = input.birthDate.trim();
      const age = ageOn(birthDate, now);
      if (age < 10 || age > 110) errors.push('Age must be between 10 and 110.');
    }
  }

  const height = typeof input.heightCm === 'number' ? input.heightCm : Number(input.heightCm.trim().replace(',', '.'));
  if (!Number.isFinite(height) || height < 100 || height > 250) {
    errors.push('Height must be between 100 and 250 cm.');
  }

  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, profile: { sex: input.sex, birthDate, heightCm: height, athlete: input.athlete } };
}

export function serializeProfile(p: UserProfile): string {
  return JSON.stringify({ version: 1, profile: p });
}

/** Tolerant: null for anything unreadable or invalid. */
export function parseProfile(text: string): UserProfile | null {
  try {
    const data = JSON.parse(text) as { profile?: Partial<UserProfile> };
    const p = data.profile;
    if (!p || (p.sex !== 'male' && p.sex !== 'female') || typeof p.athlete !== 'boolean') return null;
    const r = validateProfile({
      sex: p.sex,
      birthDate: String(p.birthDate),
      heightCm: Number(p.heightCm),
      athlete: p.athlete,
    });
    return r.ok ? r.profile : null;
  } catch {
    return null;
  }
}
