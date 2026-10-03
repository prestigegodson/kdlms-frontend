import type { Role } from "@/api/types";
import type { TourProgressView } from "@/api/onboarding";
import type { Portal, TourDefinition, TourStepDefinition } from "@/features/onboarding/types";

export type GuideStatus = "new" | "in-progress" | "done" | "skipped" | "updated";

/** A guide's status for display - "updated" means the user finished/skipped an older version. */
export function statusFor(tour: TourDefinition, progress: TourProgressView | undefined): GuideStatus {
  if (!progress) {
    return "new";
  }
  if (progress.version < tour.version) {
    return "updated";
  }
  if (progress.status === "IN_PROGRESS") {
    return "in-progress";
  }
  return progress.status === "COMPLETED" ? "done" : "skipped";
}

/**
 * Whether a guide should start on its own: never during impersonation or once the user turned
 * guides off; otherwise when it's never been seen, was left part-way, or has been updated since.
 */
export function needsAutoStart(
  tour: TourDefinition,
  progress: TourProgressView | undefined,
  autoStart: boolean,
  impersonating: boolean,
): boolean {
  if (impersonating || !autoStart) {
    return false;
  }
  const status = statusFor(tour, progress);
  return status === "new" || status === "in-progress" || status === "updated";
}

/** A shell guide counts as resolved (so page guides may start) once finished or skipped at its current version. */
export function isResolved(tour: TourDefinition, progress: TourProgressView | undefined): boolean {
  const status = statusFor(tour, progress);
  return status === "done" || status === "skipped";
}

export interface AvailabilityContext {
  portal: Portal;
  role: Role;
  /** The hrefs of every nav item currently visible to the caller (PortalShell's own filter). */
  visibleNavHrefs: ReadonlySet<string>;
}

/** Whether the caller can be offered this guide - right portal, right role, and its page is reachable. */
export function isAvailable(tour: TourDefinition, context: AvailabilityContext): boolean {
  return (
    tour.portal === context.portal &&
    tour.roles.includes(context.role) &&
    (!tour.navHref || context.visibleNavHrefs.has(tour.navHref))
  );
}

/** The steps that apply to this role and screen size. */
export function stepsFor(tour: TourDefinition, role: Role, mobile: boolean): TourStepDefinition[] {
  return tour.steps.filter(
    (step) =>
      (!step.roles || step.roles.includes(role)) &&
      (!step.only || (step.only === "mobile") === mobile),
  );
}

/** Normalises a pathname for route matching - trailing slashes never matter. */
export function normalisePath(pathname: string): string {
  return pathname.replace(/\/+$/, "") || "/";
}

/** Which portal a pathname belongs to - the first path segment. */
export function portalForPath(pathname: string): Portal | null {
  const segment = normalisePath(pathname).split("/")[1];
  return segment === "admin" || segment === "school" || segment === "guardian" || segment === "student"
    ? segment
    : null;
}

/** The start button's label for a guide in this state. */
export function guideActionLabel(status: GuideStatus): string {
  if (status === "in-progress") return "Resume";
  if (status === "done" || status === "skipped") return "Replay";
  return "Start";
}
