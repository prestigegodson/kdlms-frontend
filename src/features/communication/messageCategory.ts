import type { MessageCategory } from "@/api/communication";

/** Separate from `components/CategoryBadge.tsx` so fast refresh doesn't warn about a file mixing a component with plain helpers - mirrors `attendance/attendanceStatus.ts`. */
export const MESSAGE_CATEGORIES: { value: MessageCategory; label: string }[] = [
  { value: "GENERAL", label: "General" },
  { value: "ACADEMIC", label: "Academic" },
  { value: "BEHAVIOUR", label: "Behaviour" },
  { value: "COMMENDATION", label: "Commendation" },
  { value: "CONCERN", label: "Concern" },
  { value: "HEALTH", label: "Health" },
];

const LABEL_BY_VALUE: Record<MessageCategory, string> = Object.fromEntries(
  MESSAGE_CATEGORIES.map((category) => [category.value, category.label]),
) as Record<MessageCategory, string>;

export function categoryLabel(category: MessageCategory): string {
  return LABEL_BY_VALUE[category];
}

const BADGE_VARIANTS: Record<MessageCategory, "brand" | "info" | "warning" | "success" | "danger" | "neutral"> = {
  GENERAL: "neutral",
  ACADEMIC: "brand",
  BEHAVIOUR: "info",
  COMMENDATION: "success",
  CONCERN: "danger",
  HEALTH: "warning",
};

/** The `Badge` variant for a category - see components/CategoryBadge.tsx. */
export function categoryBadgeVariant(
  category: MessageCategory,
): "brand" | "info" | "warning" | "success" | "danger" | "neutral" {
  return BADGE_VARIANTS[category];
}

// HEALTH deliberately uses the warning *tint* (amber-100/amber-800, see Badge's
// "warning" variant), never a solid amber fill - style_guide.md reserves a solid
// amber for the page's one key CTA, and CLAUDE.md is explicit that warning and
// accent must never compete for the same "amber = act here" meaning.
const RAIL_CLASSES: Record<MessageCategory, string> = {
  GENERAL: "border-l-slate-300",
  ACADEMIC: "border-l-brand-500",
  BEHAVIOUR: "border-l-blue-500",
  COMMENDATION: "border-l-green-500",
  CONCERN: "border-l-red-500",
  HEALTH: "border-l-amber-400",
};

/** The card-rail tint a thread's category lends its `ThreadCard` - see ThreadCard.tsx. */
export function categoryRailClass(category: MessageCategory | undefined): string {
  return category ? RAIL_CLASSES[category] : "border-l-slate-200";
}
