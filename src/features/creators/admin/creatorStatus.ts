import type { CreatorAdminView } from "@/api/creators";

export const CREATOR_STATUS_VARIANT: Record<CreatorAdminView["status"], "success" | "warning" | "danger"> = {
  ACTIVE: "success",
  SUSPENDED: "warning",
  ARCHIVED: "danger",
  UNKNOWN: "danger",
};
