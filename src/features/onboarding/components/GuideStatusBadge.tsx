import { Badge } from "@/components/ui/Badge";
import type { GuideStatus } from "@/features/onboarding/eligibility";

const LABELS: Record<GuideStatus, { label: string; variant: "brand" | "info" | "success" | "neutral" | "warning" }> = {
  new: { label: "New", variant: "brand" },
  "in-progress": { label: "In progress", variant: "info" },
  done: { label: "Done", variant: "success" },
  skipped: { label: "Skipped", variant: "neutral" },
  updated: { label: "Updated", variant: "warning" },
};

export function GuideStatusBadge({ status }: { status: GuideStatus }) {
  const { label, variant } = LABELS[status];
  return <Badge variant={variant}>{label}</Badge>;
}
