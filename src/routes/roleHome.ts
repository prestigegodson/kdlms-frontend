import type { Role } from "@/api/types";

/** The default landing route for each role - where RequireRole sends a logged-in user whose role can't access the current route. */
export function homePathForRole(role: Role): string {
  switch (role) {
    case "SYSTEM_ADMIN":
      return "/admin";
    case "SCHOOL_ADMIN":
    case "BRANCH_ADMIN":
    case "TEACHER":
    case "INVENTORY_MANAGER":
      return "/school";
    case "GUARDIAN":
      return "/guardian";
    case "STUDENT":
      return "/student";
    default:
      return "/login";
  }
}
