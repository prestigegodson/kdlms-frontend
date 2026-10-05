import type { ClassLessonNoteStatus } from "@/api/lessonNotes";
import { Badge } from "@/components/ui/Badge";

/** A class note's status pill (creators Phase C12) - only ever Draft or Published, with no review states. */
export function ClassLessonNoteStatusBadge({ status }: { status: ClassLessonNoteStatus }) {
  return status === "PUBLISHED" ? <Badge variant="success">Published</Badge> : <Badge variant="neutral">Draft</Badge>;
}
