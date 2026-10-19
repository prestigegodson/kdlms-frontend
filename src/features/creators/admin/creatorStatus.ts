import type { CreatorAdminView } from "@/api/creators";

export const CREATOR_STATUS_VARIANT: Record<CreatorAdminView["status"], "success" | "warning" | "danger"> = {
  ACTIVE: "success",
  SUSPENDED: "warning",
  ARCHIVED: "danger",
  UNKNOWN: "danger",
};

/** A creator tenant is only ever ARCHIVED by deleting the creator, so that's what the admin sees. */
export const CREATOR_STATUS_LABEL: Record<CreatorAdminView["status"], string> = {
  ACTIVE: "ACTIVE",
  SUSPENDED: "SUSPENDED",
  ARCHIVED: "DELETED",
  UNKNOWN: "UNKNOWN",
};
