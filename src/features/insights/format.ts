import type { RiskSignal, Severity } from "@/api/insights";

type BadgeVariant = "neutral" | "warning" | "danger";

/** Severity is a status, so it wears the reserved status colours (style_guide.md) - never decoration. */
export const SEVERITY_BADGE: Record<Severity, { variant: BadgeVariant; label: string }> = {
  AT_RISK: { variant: "danger", label: "At risk" },
  WATCH: { variant: "warning", label: "Watch" },
  NONE: { variant: "neutral", label: "On track" },
};

/** Short chip labels; the reason's full server-authored `message` is always shown beside them. */
export const SIGNAL_LABEL: Record<RiskSignal, string> = {
  AVERAGE_DROP: "Average drop",
  POSITION_DROP: "Position drop",
  FAILING_SUBJECTS: "Failing subjects",
  LOW_ATTENDANCE: "Low attendance",
  ABSENCE_STREAK: "Absence streak",
  MISSED_QUIZZES: "Missed quizzes",
  LEARNING_DISENGAGEMENT: "Unopened resources",
};

/** 1 -> "1st", 22 -> "22nd", 13 -> "13th" - the same ordinals the backend's reason messages use. */
export function ordinal(value: number): string {
  const mod100 = value % 100;
  if (mod100 >= 11 && mod100 <= 13) {
    return `${value}th`;
  }
  switch (value % 10) {
    case 1:
      return `${value}st`;
    case 2:
      return `${value}nd`;
    case 3:
      return `${value}rd`;
    default:
      return `${value}th`;
  }
}

/** One decimal place, trailing ".0" dropped: 62.5 -> "62.5", 80 -> "80". "—" when unknown. */
export function formatScore(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "—";
  }
  return String(Math.round(value * 10) / 10);
}

export function formatPosition(position: number | null | undefined, classSize: number | null | undefined): string {
  if (position === null || position === undefined) {
    return "—";
  }
  return classSize ? `${ordinal(position)} of ${classSize}` : ordinal(position);
}
