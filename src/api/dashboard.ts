import { apiFetch } from "@/api/client";

/** Mirrors backend dashboard.application.port.in.AdminDashboardView - the SYSTEM_ADMIN landing page. */
export interface AdminDashboardView {
  totalSchools: number;
  activeSchools: number;
  suspendedSchools: number;
  archivedSchools: number;
  activeSubscriptions: number;
  expiringSoonSubscriptions: number;
  expiredSubscriptions: number;
}

/** Mirrors backend dashboard.application.port.in.SchoolDashboardView.AttendanceToday. */
export interface DashboardAttendanceToday {
  totalClasses: number;
  classesMarked: number;
  present: number;
  absent: number;
  late: number;
  excused: number;
}

/** Mirrors backend dashboard.application.port.in.SchoolDashboardView.ClassRef - a named class reference for a dashboard list row. */
export interface DashboardClassRef {
  classId: string;
  className: string;
  levelName: string;
}

/** Mirrors backend dashboard.application.port.in.SchoolDashboardView.PublicationProgress. */
export interface DashboardPublicationProgress {
  totalClasses: number;
  publishedClasses: number;
  unpublishedClasses: DashboardClassRef[];
}

/** Mirrors backend dashboard.application.port.in.SchoolDashboardView.SetupGaps - the data-quality roll-up. */
export interface DashboardSetupGaps {
  classesWithoutClassTeacher: DashboardClassRef[];
  studentsWithoutGuardian: number;
}

/** Mirrors backend dashboard.application.port.in.SchoolDashboardView.AdminSection - SCHOOL_ADMIN/BRANCH_ADMIN only. */
export interface SchoolDashboardAdminSection {
  activeStudents: number;
  /** The activeStudents headcount split by gender - activeGirls + activeBoys always equals activeStudents. */
  activeGirls: number;
  activeBoys: number;
  /**
   * `undefined` for a BRANCH_ADMIN (the plan limit is school-wide, not
   * branch-scoped) or when the school has no currently-active subscription
   * - both render as a bare count with no denominator.
   */
  activeStudentLimit?: number;
  activeClasses: number;
  registersMarkable: boolean;
  attendanceToday: DashboardAttendanceToday;
  publicationProgress?: DashboardPublicationProgress;
  setupGaps: DashboardSetupGaps;
}

/** Mirrors backend dashboard.application.port.in.SchoolDashboardView.TeacherClassRow. */
export interface DashboardTeacherClassRow {
  classId: string;
  className: string;
  registerMarkedToday: boolean;
}

/** Mirrors backend dashboard.application.port.in.SchoolDashboardView.TeacherSection - TEACHER only. */
export interface SchoolDashboardTeacherSection {
  classes: DashboardTeacherClassRow[];
}

/**
 * Mirrors backend dashboard.application.port.in.SchoolDashboardView.TermProgress.
 * `daysRemaining` is signed, not clamped to zero - negative once the term's
 * `endDate` has passed without a later term being marked current.
 */
export interface DashboardTermProgress {
  name: string;
  startDate: string;
  endDate: string;
  daysRemaining: number;
}

/** Mirrors backend dashboard.application.port.in.SchoolDashboardView.NextTerm. */
export interface DashboardNextTerm {
  name: string;
  startDate: string;
}

/** Mirrors backend dashboard.application.port.in.SchoolDashboardView.StockLevelRow - one flagged item on the inventory tile's stock preview. */
export interface DashboardLowStockItem {
  itemId: string;
  itemName: string;
  itemTypeName: string;
  unit: string;
  onHand: number;
  reorderLevel: number;
  band: "OUT_OF_STOCK" | "LOW" | "APPROACHING";
}

/** Mirrors backend dashboard.application.port.in.SchoolDashboardView.RequisitionRow - one of the caller's own still-open requisitions. */
export interface DashboardRequisitionRow {
  requisitionId: string;
  reference: string;
  status: "DRAFT" | "SUBMITTED" | "APPROVED" | "REJECTED";
  neededBy: string | null;
  lineCount: number;
  createdAt: string;
}

/**
 * Mirrors backend dashboard.application.port.in.SchoolDashboardView.InventorySection -
 * INVENTORY_MANAGER only. `stockPreview`/`requisitionPreview` are each capped previews
 * (most-urgent/most-recent first) - the Inventory page itself is the full list.
 */
export interface SchoolDashboardInventorySection {
  outOfStockItems: number;
  lowStockItems: number;
  approachingReorderItems: number;
  stockPreview: DashboardLowStockItem[];
  draftRequisitions: number;
  awaitingReviewRequisitions: number;
  approvedNotFulfilledRequisitions: number;
  rejectedRequisitions: number;
  requisitionPreview: DashboardRequisitionRow[];
}

/**
 * Mirrors backend dashboard.application.port.in.SchoolDashboardView - the
 * school portal landing page, shaped server-side by caller role. Exactly
 * one of `admin`/`teacher`/`inventory` is present (the others are omitted
 * entirely, per the backend's non-null Jackson inclusion setting - never
 * sent as `null`), matching the caller's role.
 */
export interface SchoolDashboardView {
  currentSessionName?: string;
  currentTermName?: string;
  currentTerm?: DashboardTermProgress;
  nextTerm?: DashboardNextTerm;
  admin?: SchoolDashboardAdminSection;
  teacher?: SchoolDashboardTeacherSection;
  inventory?: SchoolDashboardInventorySection;
}

export function getAdminDashboard(): Promise<AdminDashboardView> {
  return apiFetch<AdminDashboardView>("/api/v1/admin/dashboard");
}

export function getSchoolDashboard(): Promise<SchoolDashboardView> {
  return apiFetch<SchoolDashboardView>("/api/v1/dashboard");
}
