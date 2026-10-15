import type { StudentLoginStatus } from "@/api/students";
import { Badge } from "@/components/ui/Badge";

const LABELS: Record<StudentLoginStatus, { label: string; variant: "success" | "warning" | "neutral" }> = {
  ACTIVE: { label: "Active", variant: "success" },
  PENDING: { label: "Not signed in yet", variant: "warning" },
  DISABLED: { label: "Disabled", variant: "neutral" },
  NONE: { label: "No login", variant: "neutral" },
};

/**
 * A pupil's portal-login status - the backend's `StudentLoginStatus`, shared by the
 * Students list and the profile's Portal access card. A login only reads "Active" once the
 * pupil has actually signed in.
 */
export function StudentLoginStatusBadge({ status }: { status: StudentLoginStatus | undefined }) {
  const { label, variant } = LABELS[status ?? "NONE"];
  return <Badge variant={variant}>{label}</Badge>;
}
