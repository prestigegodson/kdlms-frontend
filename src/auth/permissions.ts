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

  /**
   * Provisioning and managing the school's BRANCH_ADMIN accounts - SCHOOL_ADMIN
   * only, narrower than `manageTeachers`: a BRANCH_ADMIN can't mint a peer.
   * Mirrors `manageBranches`.
   */
  manageBranchAdmins(role: Role | undefined): boolean {
    return role === "SCHOOL_ADMIN";
  },

  /**
   * Whether this role picks a branch via a Branch filter (Assessments,
   * Attendance, Reports, Messages, Teachers) rather than having one derived
   * from their token - SCHOOL_ADMIN only. A BRANCH_ADMIN/TEACHER is always
   * confined to their own branch server-side, so no control renders for
   * them - see features/branches/useBranchScope.ts.
   */
  selectBranch(role: Role | undefined): boolean {
    return role === "SCHOOL_ADMIN";
  },

  /** Level rename/reorder/add/archive/delete - SCHOOL_ADMIN only, since levels are school-wide, not branch-scoped. */
  manageLevels(role: Role | undefined): boolean {
    return role === "SCHOOL_ADMIN";
  },

  /**
   * Permanently deleting a subject - SCHOOL_ADMIN only, unlike the rest of
   * the catalogue's writes (`manageAcademics` covers create/edit/activate/
   * deactivate for SCHOOL_ADMIN and BRANCH_ADMIN alike). Mirrors `manageLevels`.
   */
  deleteSubjects(role: Role | undefined): boolean {
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

  /**
   * Registering students for a selective subject - both admin roles plus a
   * TEACHER who class-teaches at least one class (mirrors `markAttendance`'s
   * scoping; a subject-teacher-only account gets nothing). The real
   * per-student/per-class scoping is still enforced server-side - this only
   * gates whether the UI offers the control at all.
   */
  manageStudentSubjects(role: Role | undefined, scope: TeacherScope | null): boolean {
    if (role === "SCHOOL_ADMIN" || role === "BRANCH_ADMIN") {
      return true;
    }
    return role === "TEACHER" && (scope?.isClassTeacher ?? false);
  },

  /**
   * The school dashboard's upcoming-birthdays card - admins school/branch-wide,
   * a TEACHER only if they class-teach at least one class (mirrors
   * `markAttendance`'s scoping; a subject-teacher-only account gets nothing).
   */
  viewBirthdays(role: Role | undefined, scope: TeacherScope | null): boolean {
    if (role === "SCHOOL_ADMIN" || role === "BRANCH_ADMIN") {
      return true;
    }
    return role === "TEACHER" && (scope?.isClassTeacher ?? false);
  },

  /**
   * The class detail page's own "Upcoming birthdays" section - as
   * {@link viewBirthdays}, but for one specific class, where the caller
   * already knows whether they're *that* class's class teacher
   * (`isClassTeacherOfThisClass`) rather than relying on the coarser
   * `TeacherScope.isClassTeacher` (true if they class-teach *any* class). A
   * subject-teacher-only account on this class must not see the section -
   * the server 404s the same request, so this only keeps the UI from
   * offering a control that would fail.
   */
  viewClassBirthdays(role: Role | undefined, isClassTeacherOfThisClass: boolean): boolean {
    if (role === "SCHOOL_ADMIN" || role === "BRANCH_ADMIN") {
      return true;
    }
    return role === "TEACHER" && isClassTeacherOfThisClass;
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

  /**
   * School-wide operational policy toggles (currently just weekend
   * attendance) - SCHOOL_ADMIN only, like manageLevels/manageGradingSystems.
   * BRANCH_ADMIN and TEACHER can still read the underlying flag (see
   * schoolSettingsStore, which the attendance date picker relies on) - this
   * gate is only for the School Settings screen itself.
   */
  manageSchoolSettings(role: Role | undefined): boolean {
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

  /**
   * The home-school communication log - gated on the school's subscription
   * entitlement (see stores/featureStore.ts) on top of role, since this is
   * the one feature that's actually turned off for an unentitled school
   * rather than merely dormant. SCHOOL_ADMIN/BRANCH_ADMIN always see it
   * read-only; a TEACHER only when they class-teach at least one class
   * (mirrors `viewAttendance`'s scoping - a subject-teacher-only account has
   * no communication log either); a GUARDIAN always sees their own wards'.
   */
  viewMessages(role: Role | undefined, scope: TeacherScope | null, entitled: boolean): boolean {
    if (!entitled) {
      return false;
    }
    if (role === "SCHOOL_ADMIN" || role === "BRANCH_ADMIN" || role === "GUARDIAN") {
      return true;
    }
    return role === "TEACHER" && (scope?.isClassTeacher ?? false);
  },

  /**
   * Starting a new thread (single-student note or whole-class broadcast) -
   * the class teacher only, mirrors `markAttendance`. A GUARDIAN may reply
   * to an existing thread (server-derived per-thread via `ThreadView.canReply`,
   * not a blanket permission here) but never starts one.
   */
  composeMessages(role: Role | undefined, scope: TeacherScope | null, entitled: boolean): boolean {
    return entitled && role === "TEACHER" && (scope?.isClassTeacher ?? false);
  },

  /**
   * A guardian's own communication-thread-started email opt-out - GUARDIAN
   * only, and only relevant while the school's communication entitlement is
   * on (the page controls email for a feature the guardian can otherwise see
   * nothing of). A SCHOOL_ADMIN/BRANCH_ADMIN sets the same flag on a
   * guardian's behalf from the guardian edit form instead - see
   * `manageGuardians`.
   */
  manageMyNotifications(role: Role | undefined, entitled: boolean): boolean {
    return entitled && role === "GUARDIAN";
  },

  /**
   * Editing a level's period grid - SCHOOL_ADMIN only, school-wide like
   * levels and grading systems themselves (mirrors `manageGradingSystems`).
   * Gated on the school's Timetables package entitlement (see
   * stores/featureStore.ts) on top of role, the same hard-lockout shape
   * `viewMessages`/`composeMessages` use for communication - full lockout on
   * downgrade, reads included, not merely dormant. `viewTimetable`/
   * `manageTimetable` (Phase 12C/12D) will follow the same entitled-first
   * shape once the class-timetable pages land.
   */
  managePeriodGrid(role: Role | undefined, entitled: boolean): boolean {
    return entitled && role === "SCHOOL_ADMIN";
  },

  /**
   * Filling/editing a class's weekly timetable - SCHOOL_ADMIN/BRANCH_ADMIN
   * (own branch) only, no teacher write path at all (see CLAUDE.md's Roles
   * table - unlike attendance, there's no class-teacher-write shape here).
   * Gated on the school's Timetables package entitlement, the same
   * full-lockout shape `managePeriodGrid` uses. Pulled forward from Phase
   * 12D (which adds the teacher/guardian read views and the matching
   * `viewTimetable` check) so the Phase 12C authoring screen is reachable
   * and verifiable end-to-end - the same call `managePeriodGrid` made in
   * Phase 12B.
   */
  manageTimetable(role: Role | undefined, entitled: boolean): boolean {
    return entitled && (role === "SCHOOL_ADMIN" || role === "BRANCH_ADMIN");
  },

  /**
   * Seeing a timetable at all - SCHOOL_ADMIN/BRANCH_ADMIN (the authoring
   * screen, `manageTimetable` narrows further to who may write), GUARDIAN
   * (their ward's class grid, Phase 12E), or any TEACHER, class-teacher or
   * subject-teacher-only alike - unlike `viewAttendance`, a subject-teacher-
   * only account still has periods of their own to see on the "My timetable"
   * tab, so `scope` isn't consulted here; it's `TeacherTimetablePanel` that
   * uses `scope?.isClassTeacher` to decide whether the second "Class
   * timetable" tab renders at all. Gated on the Timetables entitlement, the
   * same full-lockout shape every other check in this module uses.
   */
  viewTimetable(role: Role | undefined, _scope: TeacherScope | null, entitled: boolean): boolean {
    if (!entitled) {
      return false;
    }
    return (
      role === "SCHOOL_ADMIN" || role === "BRANCH_ADMIN" || role === "GUARDIAN" || role === "TEACHER"
    );
  },
};
