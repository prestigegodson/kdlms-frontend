/** "Godson Ositadinma" -> "GO"; falls back gracefully if either name is empty. */
export function initialsOf(name: { firstName: string; lastName: string }): string {
  return `${name.firstName.charAt(0)}${name.lastName.charAt(0)}`.toUpperCase();
}
