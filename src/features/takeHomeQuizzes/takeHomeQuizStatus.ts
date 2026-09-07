import type { TakeHomeQuizAvailability, TakeHomeQuizStatus } from "@/api/takeHomeQuizzes";

/**
 * The badge shown for a quiz row - `DRAFT`/`RESULTS_PUBLISHED`/`ARCHIVED`
 * read directly off `status`, but a `PUBLISHED` quiz shows its *derived*
 * `availability` (`SCHEDULED`/`OPEN`/`CLOSED`) instead, since that's the
 * distinction a teacher actually cares about - see
 * `TakeHomeQuizAvailabilityPolicy`'s Javadoc on the backend for why this is
 * never stored.
 */
export function quizStatusLabel(status: TakeHomeQuizStatus, availability: TakeHomeQuizAvailability | null): string {
  if (status === "PUBLISHED" && availability) {
    return AVAILABILITY_LABELS[availability];
  }
  return STATUS_LABELS[status];
}

export function quizStatusVariant(
  status: TakeHomeQuizStatus,
  availability: TakeHomeQuizAvailability | null,
): "neutral" | "info" | "success" | "warning" {
  if (status === "PUBLISHED" && availability) {
    return AVAILABILITY_VARIANTS[availability];
  }
  return STATUS_VARIANTS[status];
}

const STATUS_LABELS: Record<TakeHomeQuizStatus, string> = {
  DRAFT: "Draft",
  PUBLISHED: "Published",
  RESULTS_PUBLISHED: "Results published",
  ARCHIVED: "Archived",
};

const STATUS_VARIANTS: Record<TakeHomeQuizStatus, "neutral" | "info" | "success" | "warning"> = {
  DRAFT: "neutral",
  PUBLISHED: "info",
  RESULTS_PUBLISHED: "success",
  ARCHIVED: "neutral",
};

const AVAILABILITY_LABELS: Record<TakeHomeQuizAvailability, string> = {
  SCHEDULED: "Scheduled",
  OPEN: "Open",
  CLOSED: "Closed",
};

const AVAILABILITY_VARIANTS: Record<TakeHomeQuizAvailability, "neutral" | "info" | "success" | "warning"> = {
  SCHEDULED: "neutral",
  OPEN: "success",
  CLOSED: "warning",
};
