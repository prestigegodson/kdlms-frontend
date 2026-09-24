import type { LearningResourceStatus } from "@/api/learning";
import { formatInstantDate } from "@/utils/date";

/** Separate from `components/LearningResourceStatusBadge.tsx` so fast refresh doesn't warn about a file mixing a component with plain helpers - mirrors `lessonNotes/lessonNoteStatus.ts`. */
export const LEARNING_RESOURCE_STATUS_VARIANT: Record<LearningResourceStatus, "neutral" | "success" | "warning"> = {
  DRAFT: "neutral",
  PUBLISHED: "success",
  ARCHIVED: "warning",
};

/**
 * A second, client-side-only badge for a `PUBLISHED` row whose availability window (Phase 35L)
 * means it isn't actually visible to students right now - "Scheduled" before `availableFrom`,
 * "Ended" after `availableUntil`. Purely informational: the server, never this, is what actually
 * enforces the window (a repository-query predicate on the student surface), so this is display
 * only and never gates anything itself. Returns `null` when the resource is either not
 * `PUBLISHED` or currently within its window (or has no window at all).
 */
export function learningResourceAvailabilityBadge(
  status: LearningResourceStatus,
  availableFrom: string | null,
  availableUntil: string | null,
): { label: string; variant: "neutral" | "warning" } | null {
  if (status !== "PUBLISHED") {
    return null;
  }
  const now = Date.now();
  if (availableFrom && new Date(availableFrom).getTime() > now) {
    return { label: `Scheduled · from ${formatInstantDate(availableFrom)}`, variant: "neutral" };
  }
  if (availableUntil && new Date(availableUntil).getTime() < now) {
    return { label: `Ended ${formatInstantDate(availableUntil)}`, variant: "warning" };
  }
  return null;
}
