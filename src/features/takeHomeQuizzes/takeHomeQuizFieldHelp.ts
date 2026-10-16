/**
 * What-to-enter guidance for `TakeHomeQuizEditorPage`'s editable fields - shown as a `FormField`
 * `description`, above the control. Kept as one editable map, the `lessonNoteFieldHelp.ts` sibling.
 */
export const TAKE_HOME_QUIZ_FIELD_HELP = {
  title: "What pupils and guardians see as the quiz's name.",
  instructions: "Anything pupils should know before starting - what to bring, how long they have, tips.",
  quizType:
    "MIDTERM writes the result straight into this subject's midterm quiz score once results are published - for a quiz shared with other classes, each class's own score; NORMAL is assessment-only.",
  opensAt: "When the link starts accepting answers. Shown in your own timezone.",
  closesAt: "When the link stops accepting answers - can only be extended, never brought forward, once a pupil has started.",
  timed: "Turn this on to give each pupil a countdown once they press Start, rather than the full window until closesAt.",
  durationMinutes: "How long a pupil has once they press Start.",
  revealResultsOnSubmit:
    "Off by default. When on, a pupil sees their score and which answers were correct as soon as they submit - including a pupil who finishes before their classmates, who could then share the answers.",
  shuffle:
    "Off by default. Each pupil gets their own order, which stays the same if they leave and come back and in their review. Locked once a pupil has started.",
  tags: "Optional topic tags, e.g. photosynthesis - up to 5 per question. Only staff see them.",
} as const;
