import type { Role } from "@/api/types";

/** Which portal shell a guide belongs to - each has its own shell tour and How-to guides page. */
export type Portal = "admin" | "school" | "guardian" | "student";

/**
 * One step of a guide. `target` names a `data-tour="…"` hook in the DOM; omit it for a centered
 * step with no spotlight (an intro or closing note). A step whose target isn't on screen - a
 * feature-gated nav item, a desktop-only rail on a phone - is skipped rather than blocking the
 * guide (see TourRunner).
 */
export interface TourStepDefinition {
  /** The `data-tour` value to spotlight; omit for a centered step. */
  target?: string;
  /** Used instead of `target` below `lg`, where the sidebar becomes the bottom tab bar. */
  mobileTarget?: string;
  /** Only show on (`"mobile"`) or above (`"desktop"`) the `lg` breakpoint. */
  only?: "mobile" | "desktop";
  /** Narrows the step to these roles within the guide's own audience - role-tailored copy. */
  roles?: Role[];
  title: string;
  body: string;
}

export interface TourDefinition {
  /** Stable id persisted server-side; must match identity.domain.TourKey's shape. */
  key: string;
  /**
   * Bump whenever a guide's content changes meaningfully - a user whose saved progress is for an
   * older version is offered the guide again, once.
   */
  version: number;
  portal: Portal;
  /** `shell` guides tour the portal chrome and run on first login; `page` guides run on first visit to `route`. */
  kind: "shell" | "page";
  title: string;
  description: string;
  /** Grouping heading on the How-to guides page, e.g. "Getting started", "Academics". */
  area: string;
  roles: Role[];
  /** A page guide's pathname - it auto-starts (and replays) there. Shell guides run anywhere. */
  route?: string;
  /**
   * The nav item that leads to `route`. A guide is only offered when this item is visible to the
   * caller, so every package entitlement / role / Head-of-Level gate the nav already applies (see
   * auth/permissions.ts) gates the guide too, without restating it here.
   */
  navHref?: string;
  steps: TourStepDefinition[];
}
