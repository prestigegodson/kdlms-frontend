export const ALL_TERM_NUMBERS = [1, 2, 3];

/** "All terms" when every term is selected, otherwise e.g. "T1, T3". Shared by SubjectsPage and CopySubjectsModal. */
export function termNumbersLabel(termNumbers: number[]): string {
  if (termNumbers.length === ALL_TERM_NUMBERS.length) {
    return "All terms";
  }
  return termNumbers.map((termNumber) => `T${termNumber}`).join(", ");
}
