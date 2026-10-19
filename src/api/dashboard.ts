import { apiFetch } from "@/api/client";

/** Mirrors backend dashboard.application.port.in.AdminDashboardView.ExpiringSchoolRow - one row on the renewal worklist. */
export interface AdminDashboardExpiringSchool {
  schoolId: string;
  schoolName: string;
  packageName: string;
  endDate: string;
  daysRemaining: number;
}

/**
 * Mirrors backend dashboard.application.port.in.AdminDashboardView.PlatformImpact - all-time,
 * lifetime counts across every school regardless of status, cached for a few minutes server-side.
 */
export interface AdminDashboardPlatformImpact {
  students: number;
  studentsWithLogin: number;
  staff: number;
  teachers: number;
  guardians: number;
  takeHomeQuizzes: number;
  quizQuestions: number;
  learningResources: number;
  lessonNotes: number;
  aiGenerations: number;
  classes: number;
  subjects: number;
  billPublications: number;
  stockIssues: number;
  requisitions: number;
}

/** Mirrors backend dashboard.application.port.in.AdminDashboardView - the SYSTEM_ADMIN landing page. */
export interface AdminDashboardView {
  totalSchools: number;
  activeSchools: number;
  suspendedSchools: number;
  archivedSchools: number;
  activeSubscriptions: number;
  expiringSoonSubscriptions: number;
  expiredSubscriptions: number;
  /** The renewal worklist - every school whose subscription is still active but ends within 3 months, soonest first. */
  expiringSchools: AdminDashboardExpiringSchool[];
  /** Platform-wide people/content/activity totals - see {@link AdminDashboardPlatformImpact}. */
  impact: AdminDashboardPlatformImpact;
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
  midtermResultsPublished: boolean;
  termResultsPublished: boolean;
}

/** Mirrors backend dashboard.application.port.in.SchoolDashboardView.EntryProgress. */
export interface DashboardEntryProgress {
  recorded: number;
  total: number;
}

/**
 * Mirrors backend dashboard.application.port.in.SchoolDashboardView.SubjectClassRow - one
 * subject-teaching assignment. `midterm`/`exam` are omitted when no term is current, or the
 * subject isn't graded or isn't assessed in that period.
 */
export interface DashboardSubjectClassRow {
  classId: string;
  className: string;
  levelName?: string;
  subjectId: string;
  subjectName: string;
  studentCount: number;
  midterm?: DashboardEntryProgress;
  exam?: DashboardEntryProgress;
  midtermResultsPublished: boolean;
  termResultsPublished: boolean;
}

/** Mirrors backend dashboard.application.port.in.SchoolDashboardView.SubjectRef. */
export interface DashboardSubjectRef {
  subjectId: string;
  subjectName: string;
  levelName: string;
}

/** Mirrors backend dashboard.application.port.in.SchoolDashboardView.LessonNoteTodo. */
export interface DashboardLessonNoteTodo {
  draft: number;
  submitted: number;
  rejected: number;
  currentWeek?: number;
  missingThisWeek: DashboardSubjectRef[];
}

/** Mirrors backend dashboard.application.port.in.SchoolDashboardView.QuizTodo. */
export interface DashboardQuizTodo {
  draft: number;
  open: number;
  closedAwaitingResults: number;
  openSubmissions: number;
}

/**
 * Mirrors backend dashboard.application.port.in.SchoolDashboardView.TeacherSection - TEACHER only.
 * `classes` are the classes they class-teach (register marking); `subjectClasses` one row per
 * subject they subject-teach. `lessonNotes`/`quizzes` are omitted when the school's plan lacks
 * the feature, no term is current, or there's nothing of theirs to count.
 */
export interface SchoolDashboardTeacherSection {
  classes: DashboardTeacherClassRow[];
  subjectClasses: DashboardSubjectClassRow[];
  lessonNotes?: DashboardLessonNoteTodo;
  quizzes?: DashboardQuizTodo;
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

/** Mirrors backend dashboard.application.port.in.CreatorDashboardView.MonthCount - `month` is `yyyy-MM`. */
export interface CreatorDashboardMonthCount {
  month: string;
  count: number;
}

/** Mirrors backend dashboard.application.port.in.CreatorDashboardView.PlanCount. */
export interface CreatorDashboardPlanCount {
  packageId: string;
  name: string;
  free: boolean;
  creators: number;
}

/** Mirrors backend dashboard.application.port.in.CreatorDashboardView.CurrencyRevenue - amounts in minor units. */
export interface CreatorDashboardCurrencyRevenue {
  currency: string;
  receivedMinor: number;
  last30DaysMinor: number;
  discountMinor: number;
  successfulCharges: number;
  failedCharges: number;
  abandonedCharges: number;
}

/** Mirrors backend dashboard.application.port.in.CreatorDashboardView.RevenueRow. */
export interface CreatorDashboardRevenueRow {
  schoolId: string;
  name: string;
  currency: string;
  amountMinor: number;
}

/** Mirrors backend dashboard.application.port.in.CreatorDashboardView.CountRow. */
export interface CreatorDashboardCountRow {
  schoolId: string;
  name: string;
  count: number;
}

/**
 * Mirrors backend dashboard.application.port.in.CreatorDashboardView - the SYSTEM_ADMIN creators
 * overview above the Creators list. All-time unless a field says otherwise; cached a few minutes
 * server-side.
 */
export interface CreatorDashboardView {
  creators: {
    total: number;
    active: number;
    suspended: number;
    archived: number;
    unverifiedEmail: number;
    /** The last six calendar months (UTC), oldest first. */
    signupsByMonth: CreatorDashboardMonthCount[];
  };
  plans: {
    plans: CreatorDashboardPlanCount[];
    onPaidPlan: number;
    withoutPlan: number;
    autoRenewOn: number;
    inGrace: number;
  };
  classes: {
    total: number;
    active: number;
    archived: number;
    sessionsHeld: number;
    /** Starting in the next seven days. */
    sessionsUpcoming: number;
    sessionsCancelled: number;
    sessionsLive: number;
    hoursDelivered: number;
    /** Scheduled hours in the next seven days. */
    hoursUpcoming: number;
  };
  learners: {
    total: number;
    adults: number;
    minors: number;
    withLogin: number;
    guardians: number;
    pendingInvites: number;
    activeEnrollments: number;
    attendanceHours: number;
  };
  /** One row per currency - amounts in different currencies are never added together. */
  revenue: CreatorDashboardCurrencyRevenue[];
  top: {
    /** Up to five per currency, largest first. */
    byRevenue: CreatorDashboardRevenueRow[];
    byClasses: CreatorDashboardCountRow[];
    byLearners: CreatorDashboardCountRow[];
  };
  generatedAt: string;
}

export function getCreatorDashboard(): Promise<CreatorDashboardView> {
  return apiFetch<CreatorDashboardView>("/api/v1/admin/dashboard/creators");
}
