/**
 * What-to-enter guidance for `TakeHomeQuizEditorPage`'s editable fields - shown as a `FormField`
 * `description`, above the control. Kept as one editable map, the `lessonNoteFieldHelp.ts` sibling.
 */
export const TAKE_HOME_QUIZ_FIELD_HELP = {
  title: "What students and guardians see as the quiz's name.",
  instructions: "Anything students should know before starting - what to bring, how long they have, tips.",
  quizType:
    "MIDTERM writes the result straight into this subject's midterm quiz score once results are published; NORMAL is assessment-only.",
  opensAt: "When the link starts accepting answers. Shown in your own timezone.",
  closesAt: "When the link stops accepting answers - can only be extended, never brought forward, once a student has started.",
  timed: "Turn this on to give each student a countdown once they press Start, rather than the full window until closesAt.",
  durationMinutes: "How long a student has once they press Start.",
} as const;
