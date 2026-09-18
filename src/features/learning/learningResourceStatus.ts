import type { LearningResourceStatus } from "@/api/learning";

/** Separate from `components/LearningResourceStatusBadge.tsx` so fast refresh doesn't warn about a file mixing a component with plain helpers - mirrors `lessonNotes/lessonNoteStatus.ts`. */
export const LEARNING_RESOURCE_STATUS_VARIANT: Record<LearningResourceStatus, "neutral" | "success" | "warning"> = {
  DRAFT: "neutral",
  PUBLISHED: "success",
  ARCHIVED: "warning",
};
