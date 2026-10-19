/**
 * The "Time limit" every pre-start screen shows (token link, portal, learner). A pause-on-leave quiz
 * says so up front, so a student knows closing the quiz keeps their remaining time.
 */
export function timeLimitLabel(quiz: {
  timed: boolean;
  durationMinutes: number | null;
  pauseTimerOnLeave?: boolean;
}): string {
  if (!quiz.timed) {
    return "Untimed";
  }
  return `${quiz.durationMinutes} minutes`;
}
