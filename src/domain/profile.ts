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
