import { Badge } from "@/components/ui/Badge";
import type { TemplateStatus } from "@/api/resultTemplates";

const VARIANTS: Record<TemplateStatus, "neutral" | "success" | "warning"> = {
  DRAFT: "neutral",
  PUBLISHED: "success",
  RETIRED: "warning",
};

const LABELS: Record<TemplateStatus, string> = {
  DRAFT: "Draft",
  PUBLISHED: "Published",
  RETIRED: "Retired",
};

export function TemplateStatusBadge({ status }: { status: TemplateStatus }) {
  return <Badge variant={VARIANTS[status]}>{LABELS[status]}</Badge>;
}
