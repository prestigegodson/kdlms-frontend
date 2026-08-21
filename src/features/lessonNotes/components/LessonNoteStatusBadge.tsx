import type { LessonNoteStatus } from "@/api/lessonNotes";
import { Badge } from "@/components/ui/Badge";
import { LESSON_NOTE_STATUS_LABELS } from "@/features/lessonNotes/lessonNoteStatus";

const VARIANTS: Record<LessonNoteStatus, "neutral" | "info" | "success" | "danger"> = {
  DRAFT: "neutral",
  SUBMITTED: "info",
  APPROVED: "success",
  REJECTED: "danger",
};

/** A status pill for the week grid, review queue, and editor header alike. */
export function LessonNoteStatusBadge({ status }: { status: LessonNoteStatus | null }) {
  if (!status) {
    return <span className="text-sm text-slate-400">Not started</span>;
  }
  return <Badge variant={VARIANTS[status]}>{LESSON_NOTE_STATUS_LABELS[status]}</Badge>;
}
