/**
 * `items` shuffled, never in their original order when there are two or more - the client twin of
 * the server's `QuizShuffle`, for the author's "Try it" preview only. The order a student sees always
 * comes from the server, seeded per attempt.
 */
export function shuffleAwayFromOrder<T>(items: readonly T[], random: () => number = Math.random): T[] {
  if (items.length < 2) {
    return [...items];
  }
  const shuffled = [...items];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  if (shuffled.every((item, index) => item === items[index])) {
    return [...items.slice(1), items[0]];
  }
  return shuffled;
}
