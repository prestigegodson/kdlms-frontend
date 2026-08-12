/** "Godson Ositadinma" -> "GO"; falls back gracefully if either name is empty. */
export function initialsOf(name: { firstName: string; lastName: string }): string {
  return `${name.firstName.charAt(0)}${name.lastName.charAt(0)}`.toUpperCase();
}

/**
 * As {@link initialsOf}, for a caller that only has a combined `fullName`
 * (e.g. `MyWardView`, which doesn't split first/other/last) - first and last
 * word, ignoring anything in between so a middle "other name" doesn't win
 * over the surname.
 */
export function initialsOfFullName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "";
  const first = parts[0];
  const last = parts[parts.length - 1];
  return parts.length === 1 ? first.charAt(0).toUpperCase() : `${first.charAt(0)}${last.charAt(0)}`.toUpperCase();
}
