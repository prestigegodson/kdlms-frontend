import type { LessonNoteStatus } from "@/api/lessonNotes";

/** Separate from `components/LessonNoteStatusBadge.tsx` so fast refresh doesn't warn about a file mixing a component with plain helpers - mirrors `communication/messageCategory.ts`. */
export const LESSON_NOTE_STATUSES: { value: LessonNoteStatus; label: string }[] = [
  { value: "DRAFT", label: "Draft" },
  { value: "SUBMITTED", label: "Submitted" },
  { value: "APPROVED", label: "Approved" },
  { value: "REJECTED", label: "Rejected" },
];

export const LESSON_NOTE_STATUS_LABELS: Record<LessonNoteStatus, string> = Object.fromEntries(
  LESSON_NOTE_STATUSES.map((status) => [status.value, status.label]),
) as Record<LessonNoteStatus, string>;
