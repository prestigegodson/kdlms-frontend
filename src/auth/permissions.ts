import type { Role } from "@/api/types";

/** The subset of a TEACHER's assignment shape that gates UI - see stores/teacherScopeStore.ts. */
export interface TeacherScope {
  isClassTeacher: boolean;
}

/**
 * Single source of truth for what each role may see and do across the
 * School and Guardian portals - nav items (layouts/SchoolLayout.tsx,
 * layouts/GuardianLayout.tsx), route guards (routes/index.tsx), and in-page
 * controls all read from here instead of repeating `role === "..."`
 * comparisons, so the three can't drift apart. Mirrors the role capability
 * matrix in CLAUDE.md's Roles section.
 */
export const can = {
  /** Sessions & terms, class/subject/teacher-assignment writes - SCHOOL_ADMIN and BRANCH_ADMIN only. */
  manageAcademics(role: Role | undefined): boolean {
    return role === "SCHOOL_ADMIN" || role === "BRANCH_ADMIN";
  },

  /**
   * The admin subject/subject-group catalogue (all subjects of a level, plus
   * group management). A TEACHER never sees this - they get "My Subjects"
   * instead, scoped to their own assignments (see api/me.ts).
   */
  viewSubjectCatalogue(role: Role | undefined): boolean {
    return role === "SCHOOL_ADMIN" || role === "BRANCH_ADMIN";
  },

  /** The teacher directory (create/list teacher accounts) - not TEACHER-visible. */
  manageTeachers(role: Role | undefined): boolean {
    return role === "SCHOOL_ADMIN" || role === "BRANCH_ADMIN";
  },

  /** Branch management - SCHOOL_ADMIN only (a BRANCH_ADMIN is confined to their own branch, not branch admin itself). */
  manageBranches(role: Role | undefined): boolean {
    return role === "SCHOOL_ADMIN";
  },

  /** Level rename/reorder/add/archive/delete - SCHOOL_ADMIN only, since levels are school-wide, not branch-scoped. */
  manageLevels(role: Role | undefined): boolean {
    return role === "SCHOOL_ADMIN";
  },

  /**
   * Both admin roles always see attendance (read-only for them); a TEACHER
   * only when they class-teach at least one class - a subject-teacher-only
   * account has no attendance to view.
   */
  viewAttendance(role: Role | undefined, scope: TeacherScope | null): boolean {
    if (role === "SCHOOL_ADMIN" || role === "BRANCH_ADMIN") {
      return true;
    }
    return role === "TEACHER" && (scope?.isClassTeacher ?? false);
  },

  /** Only a class teacher marks/edits attendance - admins are read-only, even SCHOOL_ADMIN. */
  markAttendance(role: Role | undefined, scope: TeacherScope | null): boolean {
    return role === "TEACHER" && (scope?.isClassTeacher ?? false);
  },

  /** Register/edit/graduate/withdraw students, and same-session transfer - SCHOOL_ADMIN and BRANCH_ADMIN only. */
  manageStudents(role: Role | undefined): boolean {
    return role === "SCHOOL_ADMIN" || role === "BRANCH_ADMIN";
  },

  /**
   * The student registry (registration + browsing). A TEACHER gets their own
   * read-only class roster instead, via `GET /api/v1/me/classes/{id}/students`.
   */
  viewStudents(role: Role | undefined): boolean {
    return role === "SCHOOL_ADMIN" || role === "BRANCH_ADMIN" || role === "TEACHER";
  },

  /** Bulk promotion and search-and-place - SCHOOL_ADMIN and BRANCH_ADMIN only. */
  managePromotions(role: Role | undefined): boolean {
    return role === "SCHOOL_ADMIN" || role === "BRANCH_ADMIN";
  },

  /** Guardian provisioning and ward linking - not TEACHER-visible. */
  manageGuardians(role: Role | undefined): boolean {
    return role === "SCHOOL_ADMIN" || role === "BRANCH_ADMIN";
  },

  /** Per-level grading system configuration - SCHOOL_ADMIN only, school-wide like levels themselves. */
  manageGradingSystems(role: Role | undefined): boolean {
    return role === "SCHOOL_ADMIN";
  },

  /** Score/rating entry - TEACHER only, no admin correction path (mirrors markAttendance). */
  recordAssessments(role: Role | undefined): boolean {
    return role === "TEACHER";
  },

  /** Computed results and the broadsheet - admins read-only (their own branch for BRANCH_ADMIN), teacher's own classes. */
  viewResults(role: Role | undefined): boolean {
    return role === "SCHOOL_ADMIN" || role === "BRANCH_ADMIN" || role === "TEACHER";
  },

  /** The guardian-visibility publication gate - SCHOOL_ADMIN and BRANCH_ADMIN only. */
  publishResults(role: Role | undefined): boolean {
    return role === "SCHOOL_ADMIN" || role === "BRANCH_ADMIN";
  },

  /** Designing master result templates on the layout canvas - SYSTEM_ADMIN only, outside tenant scope entirely. */
  manageResultTemplates(role: Role | undefined): boolean {
    return role === "SYSTEM_ADMIN";
  },

  /** A school's result-report branding and per-level template assignment - SCHOOL_ADMIN only (BRANCH_ADMIN is read-only, via viewReportSettings). */
  manageReportSettings(role: Role | undefined): boolean {
    return role === "SCHOOL_ADMIN";
  },

  /** Read-only view of a school's report settings/level-template assignments - SCHOOL_ADMIN and BRANCH_ADMIN. */
  viewReportSettings(role: Role | undefined): boolean {
    return role === "SCHOOL_ADMIN" || role === "BRANCH_ADMIN";
  },

  /** Report preview/PDF download - same visibility as viewResults: admins (branch-scoped for BRANCH_ADMIN), a teacher's own classes. */
  viewReports(role: Role | undefined): boolean {
    return role === "SCHOOL_ADMIN" || role === "BRANCH_ADMIN" || role === "TEACHER";
  },

  /**
   * The guardian portal (wards, published results, attendance, report
   * download) - GUARDIAN only. Deliberately not `viewResults`/`viewReports`
   * reused here: those gate the staff broadsheet/report screens and
   * exclude GUARDIAN by design (a guardian's own results/report reads are
   * ward-scoped and publication-gated, an entirely separate backend path).
   */
  viewWards(role: Role | undefined): boolean {
    return role === "GUARDIAN";
  },
};
