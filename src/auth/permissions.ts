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
   * An INVENTORY_MANAGER gets the same read-only registry browsing as a
   * TEACHER - the only student access that role has (see `manageStudents`,
   * which stays SCHOOL_ADMIN/BRANCH_ADMIN-only, so registration/edit/medical/
   * guardians/transfer stay hidden).
   */
  viewStudents(role: Role | undefined): boolean {
    return (
      role === "SCHOOL_ADMIN" || role === "BRANCH_ADMIN" || role === "TEACHER" || role === "INVENTORY_MANAGER"
    );
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
   * Provision/reset/revoke a student's portal login, individually or in bulk for a whole
   * class - SCHOOL_ADMIN, BRANCH_ADMIN, and a TEACHER who class-teaches at least one class
   * (the `manageStudentSubjects` scoping; a subject-teacher-only account gets nothing). Gated
   * on the school's Student logins entitlement, the same full-lockout shape
   * Messages/Timetable/Lesson notes use. The real per-student/per-class scoping is still
   * enforced server-side - this only gates whether the UI offers the control at all.
   */
  manageStudentLogins(role: Role | undefined, scope: TeacherScope | null, entitled: boolean): boolean {
    if (!entitled) {
      return false;
    }
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

  /**
   * Writing a class's holistic term remark - the class teacher only, not
   * every recordAssessments-eligible teacher: a remark is the class
   * teacher's alone, narrower than recordAssessments' class-teach ∪
   * subject-teach union (mirrors markAttendance's scoping). A
   * subject-teacher-only TEACHER can still read the sheet - RemarksEntryGrid
   * renders it read-only for them based on the server's own
   * `classTeacherEditable` flag, not this check.
   */
  recordRemarks(role: Role | undefined, scope: TeacherScope | null): boolean {
    return role === "TEACHER" && (scope?.isClassTeacher ?? false);
  },

  /**
   * Writing the separate principal remark - SCHOOL_ADMIN/BRANCH_ADMIN only,
   * the one deliberate admin-write exception to assessment's usual
   * teacher-write/admin-read shape (see CLAUDE.md's Domain Rules:
   * `principal_remark` is a physically separate column a teacher can never
   * write, and an admin can never edit the teacher's half).
   */
  recordPrincipalRemark(role: Role | undefined): boolean {
    return role === "SCHOOL_ADMIN" || role === "BRANCH_ADMIN";
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
   * Editing a level's period grid, and copying one level's grid onto
   * another - SCHOOL_ADMIN only, school-wide like levels and grading
   * systems themselves (mirrors `manageGradingSystems`). Gated on the
   * school's Timetables package entitlement (see stores/featureStore.ts) on
   * top of role, the same hard-lockout shape `viewMessages`/`composeMessages`
   * use for communication - full lockout on downgrade, reads included, not
   * merely dormant.
   */
  managePeriodGrid(role: Role | undefined, entitled: boolean): boolean {
    return entitled && role === "SCHOOL_ADMIN";
  },

  /**
   * Seeing a level's period grid at all - SCHOOL_ADMIN (who can also edit,
   * via `managePeriodGrid`) or BRANCH_ADMIN read-only, mirroring the
   * `viewReportSettings`/`manageReportSettings` pair. The GET endpoints have
   * always allowed BRANCH_ADMIN; this is what actually surfaces the page for
   * them. Gated on the Timetables entitlement, the same full-lockout shape
   * every other check in this module uses.
   */
  viewPeriodGrid(role: Role | undefined, entitled: boolean): boolean {
    return entitled && (role === "SCHOOL_ADMIN" || role === "BRANCH_ADMIN");
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

  /**
   * Seeing the lesson-notes week grid / an individual note - staff
   * (school-wide, no branch scoping: a lesson note is keyed on
   * subject+level+term+week, and levels/subjects are school-wide constructs
   * here, the same reason `viewPeriodGrid`/`managePeriodGrid` give
   * BRANCH_ADMIN unscoped access) or a TEACHER assigned (class-teach or
   * subject-teach) at that subject's level - the backend
   * `LessonNoteAccessGuard.requireVisible` union. Gated on the school's
   * Lesson notes entitlement, the same full-lockout shape Messages/Timetable
   * use.
   */
  viewLessonNotes(role: Role | undefined, entitled: boolean): boolean {
    if (!entitled) {
      return false;
    }
    return role === "SCHOOL_ADMIN" || role === "BRANCH_ADMIN" || role === "TEACHER";
  },

  /**
   * Authoring/editing a lesson note - admins (any), or a TEACHER who
   * subject-teaches that subject specifically (narrower than
   * `viewLessonNotes` - a class teacher who doesn't teach the subject can't
   * author its note, per CLAUDE.md's Domain Rules). The frontend can't
   * evaluate the subject-teach narrowing itself (it needs server data), so
   * this only gates route/nav visibility; the editor's actual save is
   * additionally enforced server-side by `LessonNoteAccessGuard.requireAuthorable`.
   */
  authorLessonNotes(role: Role | undefined, entitled: boolean): boolean {
    if (!entitled) {
      return false;
    }
    return role === "SCHOOL_ADMIN" || role === "BRANCH_ADMIN" || role === "TEACHER";
  },

  /**
   * Reviewing a lesson note (approve/reject/reopen) and browsing the review queue - admins only,
   * mirroring the backend `LessonNoteAccessGuard.requireReviewable`'s narrower-than-`authorLessonNotes`
   * shape: a subject's own subject teacher may write and see the note but never review it, even
   * their own.
   */
  reviewLessonNotes(role: Role | undefined, entitled: boolean): boolean {
    if (!entitled) {
      return false;
    }
    return role === "SCHOOL_ADMIN" || role === "BRANCH_ADMIN";
  },

  /**
   * Showing the "Generate with AI" button on the lesson-note editor - the same role set as
   * `authorLessonNotes` (only someone who can write a note has any use for a draft to review), but
   * gated on the school's separate `aiLessonNotes` entitlement rather than the base `lessonNotes`
   * one, per CLAUDE.md: a school can hold Lesson notes without AI lesson notes. The backend layers
   * its own per-school monthly quota on top of this, which the frontend can't evaluate - a school
   * that's simply exhausted its quota for the month still sees this button and gets a clean refusal
   * from the generate call itself.
   */
  generateLessonNotesWithAi(role: Role | undefined, entitled: boolean): boolean {
    if (!entitled) {
      return false;
    }
    return role === "SCHOOL_ADMIN" || role === "BRANCH_ADMIN" || role === "TEACHER";
  },

  /**
   * A guardian's read of their own ward's approved lesson notes - a **separate** check from
   * `viewLessonNotes`, not GUARDIAN added to it, the same reasoning `viewWards` gives for not
   * reusing staff `viewResults`/`viewReports`: the guardian path
   * (`MyWardLessonNotesUseCase`/`GET /api/v1/me/wards/{id}/lesson-notes`) is authorized entirely
   * through the `shared` SPI `GuardianWards` and gated on `APPROVED` status, an entirely separate
   * backend path from `LessonNoteAccessGuard.requireVisible` (which `viewLessonNotes` names, and
   * which `LessonNoteAccessGuardTest` asserts refuses a GUARDIAN caller outright). Gated on the
   * school's Lesson notes entitlement, the same full-lockout shape every other check here uses.
   */
  viewWardLessonNotes(role: Role | undefined, entitled: boolean): boolean {
    return entitled && role === "GUARDIAN";
  },

  /**
   * Seeing the take-home quiz list / an individual quiz - staff (admins) or a TEACHER assigned
   * (class-teach or subject-teach) to that quiz's class, the backend
   * `TakeHomeQuizAccessGuard.requireVisible` union - the same shape `viewLessonNotes` documents.
   * Gated on the school's Take-home quizzes entitlement, the same full-lockout shape
   * Messages/Timetable/Lesson notes use.
   */
  viewTakeHomeQuizzes(role: Role | undefined, entitled: boolean): boolean {
    if (!entitled) {
      return false;
    }
    return role === "SCHOOL_ADMIN" || role === "BRANCH_ADMIN" || role === "TEACHER";
  },

  /**
   * Authoring/editing/publishing a take-home quiz - admins (any), or a TEACHER who class-teaches
   * or subject-teaches that class (the narrower subject-teach-only-their-own-subject rule is
   * server data the frontend can't evaluate, so this only gates route/nav visibility; the actual
   * save is additionally enforced server-side by `TakeHomeQuizAccessGuard.requireAuthorable`).
   */
  authorTakeHomeQuizzes(role: Role | undefined, entitled: boolean): boolean {
    if (!entitled) {
      return false;
    }
    return role === "SCHOOL_ADMIN" || role === "BRANCH_ADMIN" || role === "TEACHER";
  },

  /**
   * Seeing the learning-resource list / an individual resource - staff (admins) or a TEACHER
   * assigned (class-teach or subject-teach) to that resource's class, the backend
   * `LearningResourceAccessGuard.requireVisible` union - the `viewTakeHomeQuizzes` shape. Gated on
   * the school's On-demand learning entitlement, the same full-lockout shape
   * Messages/Timetable/Lesson notes/Take-home quizzes use.
   */
  viewLearningResources(role: Role | undefined, entitled: boolean): boolean {
    if (!entitled) {
      return false;
    }
    return role === "SCHOOL_ADMIN" || role === "BRANCH_ADMIN" || role === "TEACHER";
  },

  /**
   * Authoring/editing/publishing a learning resource - same role set as `viewLearningResources`
   * (the narrower subject-teach-only-their-own-subject rule is server data the frontend can't
   * evaluate, so this only gates route/nav visibility; the actual save is additionally enforced
   * server-side by `LearningResourceAccessGuard.requireAuthorable`).
   */
  authorLearningResources(role: Role | undefined, entitled: boolean): boolean {
    if (!entitled) {
      return false;
    }
    return role === "SCHOOL_ADMIN" || role === "BRANCH_ADMIN" || role === "TEACHER";
  },

  /**
   * Authoring an `AUDIO`/`VIDEO` learning resource specifically (Phase 35F) - a second,
   * independent flag (`learningMedia`) layered on top of `onDemandLearning`/`authorLearningResources`,
   * so both must hold. The first `can.*` predicate in this file to take two feature flags.
   */
  authorLearningMedia(role: Role | undefined, onDemandLearning: boolean, learningMedia: boolean): boolean {
    return can.authorLearningResources(role, onDemandLearning) && learningMedia;
  },

  /**
   * Posting into a learning resource's class-wide discussion (Phase 35G) - STUDENT only, the
   * only posting path this phase; a teacher/admin moderates instead (`moderateLearningComments`
   * below). Per-comment `canEdit` still comes from the server, never re-derived here - this only
   * gates whether the composer itself is reachable.
   */
  postLearningComments(role: Role | undefined, entitled: boolean): boolean {
    return entitled && role === "STUDENT";
  },

  /**
   * Hiding/unhiding/deleting a comment, or toggling a resource's `comments_enabled` switch - the
   * same role set as `authorLearningResources`, since moderation is a resource-authoring-adjacent
   * capability, not a separate one.
   */
  moderateLearningComments(role: Role | undefined, entitled: boolean): boolean {
    return can.authorLearningResources(role, entitled);
  },

  /**
   * Seeing a resource's per-student completion roster (Phase 35H) - the same role set as
   * `authorLearningResources`/`moderateLearningComments`, since it's an authoring-adjacent read
   * rather than a separate capability.
   */
  viewLearningCompletions(role: Role | undefined, entitled: boolean): boolean {
    return can.authorLearningResources(role, entitled);
  },

  /**
   * Publishing/unpublishing a quiz's results - same role set as `authorTakeHomeQuizzes`, per the
   * permissions matrix in quiz-module.md (publish/unpublish rows).
   */
  publishTakeHomeQuizResults(role: Role | undefined, entitled: boolean): boolean {
    if (!entitled) {
      return false;
    }
    return role === "SCHOOL_ADMIN" || role === "BRANCH_ADMIN" || role === "TEACHER";
  },

  /**
   * Adjusting an attempt's score - TEACHER only, even when entitled. Deliberate: take-home quiz
   * scoring is teacher-write/admin-read with no admin override path, the same rule
   * `assessment`/`attendance` follow - an admin who needs a score changed resets the attempt or
   * asks the teacher (quiz-module.md's permissions matrix, footnote 3).
   */
  adjustTakeHomeQuizScore(role: Role | undefined, entitled: boolean): boolean {
    return entitled && role === "TEACHER";
  },

  /**
   * A guardian's read of their own ward's take-home quiz results - a **separate** check from
   * `viewTakeHomeQuizzes`, not GUARDIAN added to it, the same reasoning `viewWardLessonNotes`
   * gives: the guardian path is authorized entirely through the `shared` SPI `GuardianWards` and
   * gated on the quiz's own `RESULTS_PUBLISHED` state, an entirely separate backend path from
   * `TakeHomeQuizAccessGuard.requireVisible`. Gated on the school's Take-home quizzes
   * entitlement, the same full-lockout shape every other check here uses.
   */
  viewWardTakeHomeQuizzes(role: Role | undefined, entitled: boolean): boolean {
    return entitled && role === "GUARDIAN";
  },

  /** Setting the platform's own support contact details - SYSTEM_ADMIN only, outside tenant scope entirely. */
  manageSupportContact(role: Role | undefined): boolean {
    return role === "SYSTEM_ADMIN";
  },

  /** Reading the platform's support contact - SCHOOL_ADMIN and BRANCH_ADMIN only, so they have a way to reach KDLMS. */
  viewSupportContact(role: Role | undefined): boolean {
    return role === "SCHOOL_ADMIN" || role === "BRANCH_ADMIN";
  },

  /**
   * Setting the platform's own AI provider/model - SYSTEM_ADMIN only, outside tenant scope
   * entirely, like `manageSupportContact`. Unlike support contact, no school role can even read
   * this - a school never needs to know which provider the operator has chosen, only whether the
   * lesson-notes AI button is entitled (a separate, per-school concern).
   */
  manageAiSettings(role: Role | undefined): boolean {
    return role === "SYSTEM_ADMIN";
  },

  /**
   * Seeing the "Fees & Bills" screen at all - SCHOOL_ADMIN or BRANCH_ADMIN (read-only on fee
   * definitions/settings; own-branch pricing/publication land in later phases), gated on the
   * school's Billing package entitlement, the same full-lockout shape Messages/Timetable/Lesson
   * notes/Take-home quizzes use. Deliberately **not** TEACHER - fees are not academic information
   * the class-teach/subject-teach model applies to, per `billing.application.service.
   * BillingAccessGuard`'s own Javadoc (unlike every other gated module, TEACHER has no access at
   * all here). A guardian's own read of their ward's published bills (Phase 21G) gets its own,
   * separate predicate rather than GUARDIAN appended here - the `viewWards`/`viewWardLessonNotes`
   * precedent: that path is authorized entirely through the `shared` SPI `GuardianWards`, an
   * entirely different backend path from `BillingAccessGuard`, which
   * `BillingAccessGuardTest` asserts refuses a GUARDIAN caller outright.
   */
  viewBilling(role: Role | undefined, entitled: boolean): boolean {
    if (!entitled) {
      return false;
    }
    return role === "SCHOOL_ADMIN" || role === "BRANCH_ADMIN";
  },

  /**
   * Creating/editing/deleting a fee definition - SCHOOL_ADMIN only; BRANCH_ADMIN reads the
   * catalogue via `viewBilling` but gets a real 403 on a write here (not this module's usual
   * 404-not-403 shape - see `FeeController`'s Javadoc: fee definitions are school-wide, not
   * something a BRANCH_ADMIN partially owns, unlike branch-scoped pricing/publication).
   */
  manageFees(role: Role | undefined, entitled: boolean): boolean {
    if (!entitled) {
      return false;
    }
    return role === "SCHOOL_ADMIN";
  },

  /**
   * Saving a branch's fee price grid, or copying prices from another session - SCHOOL_ADMIN (any
   * branch) or BRANCH_ADMIN (own branch, enforced server-side by `BillingAccessGuard.
   * requireBranchWritable` - 404, not 403, this module's usual shape, unlike `manageFees`/
   * `manageBillingSettings` which stay SCHOOL_ADMIN-only).
   */
  manageFeePrices(role: Role | undefined, entitled: boolean): boolean {
    if (!entitled) {
      return false;
    }
    return role === "SCHOOL_ADMIN" || role === "BRANCH_ADMIN";
  },

  /**
   * The school-bus fee's routes, fares, and rider assignment (Phase 22) - `manageFeePrices`'s
   * body exactly, since all three are the same branch-scoped write `BillingAccessGuard.
   * requireBranchWritable` grants: SCHOOL_ADMIN (any branch) or BRANCH_ADMIN (own branch).
   */
  manageTransport(role: Role | undefined, entitled: boolean): boolean {
    if (!entitled) {
      return false;
    }
    return role === "SCHOOL_ADMIN" || role === "BRANCH_ADMIN";
  },

  /**
   * Saving a branch+session's advance-bill plan (which class bills at which level before
   * promotion), or copying it from another session (Phase 24) - `manageFeePrices`'s body
   * exactly, since it's the same branch-scoped write `BillingAccessGuard.requireBranchWritable`
   * grants: SCHOOL_ADMIN (any branch) or BRANCH_ADMIN (own branch).
   */
  manageAdvanceBills(role: Role | undefined, entitled: boolean): boolean {
    if (!entitled) {
      return false;
    }
    return role === "SCHOOL_ADMIN" || role === "BRANCH_ADMIN";
  },

  /** Editing billing settings (currency, bank accounts, instructions) - SCHOOL_ADMIN only, mirrors `manageFees`. */
  manageBillingSettings(role: Role | undefined, entitled: boolean): boolean {
    if (!entitled) {
      return false;
    }
    return role === "SCHOOL_ADMIN";
  },

  /**
   * Publishing/unpublishing a branch's term bills, or issuing missing deliveries to newly-joined
   * students - SCHOOL_ADMIN (any branch) or BRANCH_ADMIN (own branch, enforced server-side by
   * `BillingAccessGuard.requireBranchWritable`), the `manageFeePrices` shape exactly.
   */
  publishBills(role: Role | undefined, entitled: boolean): boolean {
    if (!entitled) {
      return false;
    }
    return role === "SCHOOL_ADMIN" || role === "BRANCH_ADMIN";
  },

  /**
   * Editing one student's optional-fee opt-ins, per-fee overrides, and custom charges (Phase 25) -
   * `manageFeePrices`'s body exactly, the same branch-scoped write `BillingAccessGuard.
   * requireBranchWritable` grants against the student's own resolved class/branch: SCHOOL_ADMIN
   * (any branch) or BRANCH_ADMIN (own branch). Deliberately not TEACHER, matching every other
   * write in this module.
   */
  editStudentBills(role: Role | undefined, entitled: boolean): boolean {
    if (!entitled) {
      return false;
    }
    return role === "SCHOOL_ADMIN" || role === "BRANCH_ADMIN";
  },

  /**
   * A guardian's read of their own ward's published, billable bills - a **separate** check from
   * `viewBilling`, not GUARDIAN added to it, the `viewWardLessonNotes`/`viewWardTakeHomeQuizzes`
   * precedent `viewBilling`'s own Javadoc-style comment above pre-announced: the guardian path
   * (`MyWardBillsUseCase`/`GET /api/v1/me/wards/{id}/bills`) is authorized entirely through the
   * `shared` SPI `GuardianWards`, an entirely separate backend path from `BillingAccessGuard`
   * (which `viewBilling` names, and which `BillingAccessGuardTest` asserts refuses a GUARDIAN
   * caller outright). Gated on the school's Billing entitlement, the same full-lockout shape
   * every other check here uses.
   */
  viewWardBills(role: Role | undefined, entitled: boolean): boolean {
    return entitled && role === "GUARDIAN";
  },

  /**
   * The inventory module's own entry gate - SCHOOL_ADMIN, BRANCH_ADMIN, or INVENTORY_MANAGER, no
   * TEACHER access anywhere in this module (the `billing` shape). Deliberately **no `entitled`
   * parameter**, unlike `viewBilling` - inventory is ungated, every school gets it regardless of
   * package.
   */
  viewInventory(role: Role | undefined): boolean {
    return role === "SCHOOL_ADMIN" || role === "BRANCH_ADMIN" || role === "INVENTORY_MANAGER";
  },

  /** Item-type/item catalogue writes - SCHOOL_ADMIN only, a real 403 for BRANCH_ADMIN/INVENTORY_MANAGER (the `manageFees` shape): the catalogue is school-wide, not something either partially owns. */
  manageInventoryCatalogue(role: Role | undefined): boolean {
    return role === "SCHOOL_ADMIN";
  },

  /**
   * Receiving/adjusting a branch's stock - SCHOOL_ADMIN (any branch) or BRANCH_ADMIN (own branch,
   * enforced server-side by `InventoryAccessGuard.requireBranchWritable`). Deliberately excludes
   * INVENTORY_MANAGER, who may raise a requisition (`manageRequisitions`) and issue stock directly
   * (`issueStock`) but not receive or adjust it.
   */
  manageInventoryStock(role: Role | undefined): boolean {
    return role === "SCHOOL_ADMIN" || role === "BRANCH_ADMIN";
  },

  /**
   * Issuing stock directly to a named recipient (Phase 40) - SCHOOL_ADMIN (any branch),
   * BRANCH_ADMIN, or INVENTORY_MANAGER (own branch, enforced server-side by
   * `InventoryAccessGuard.requireBranchAccess`) - the natural storekeeper, unlike
   * `manageInventoryStock`'s receive/adjust.
   */
  issueStock(role: Role | undefined): boolean {
    return role === "SCHOOL_ADMIN" || role === "BRANCH_ADMIN" || role === "INVENTORY_MANAGER";
  },

  /**
   * Raising/editing/submitting/withdrawing/cancelling a requisition - SCHOOL_ADMIN/BRANCH_ADMIN
   * (own branch) or INVENTORY_MANAGER (own branch, own requisitions only, enforced server-side by
   * `InventoryAccessGuard.requireBranchAccess`). Unlike `manageInventoryStock`, this admits
   * INVENTORY_MANAGER - one of this module's raise-only capabilities.
   */
  manageRequisitions(role: Role | undefined): boolean {
    return role === "SCHOOL_ADMIN" || role === "BRANCH_ADMIN" || role === "INVENTORY_MANAGER";
  },

  /**
   * Approving/rejecting/fulfilling a requisition - SCHOOL_ADMIN/BRANCH_ADMIN only, enforced
   * server-side by `InventoryAccessGuard.requireBranchWritable`. Deliberately excludes
   * INVENTORY_MANAGER even for a requisition they raised themselves - the review/write gate stays
   * admin-only.
   */
  reviewRequisitions(role: Role | undefined): boolean {
    return role === "SCHOOL_ADMIN" || role === "BRANCH_ADMIN";
  },

  /**
   * Whether the calling STUDENT may reach the student portal at all - the `viewWards` shape for
   * the fourth portal (Phase 35C). Ungated on any subscription flag here, matching
   * `StudentLayout`'s route guard: `SubscriptionFeature.STUDENT_LOGINS` is enforced server-side,
   * inside `shared.application.port.out.StudentIdentity#resolve` (see CLAUDE.md's Domain Rules),
   * not client-side by this predicate - a downgraded school's student still lands on `/student`
   * and sees a 403 from the API, not a route bounce.
   */
  viewStudentPortal(role: Role | undefined): boolean {
    return role === "STUDENT";
  },

  /** The student portal's own Results tab - the `viewWards` shape, ungated for the same reason `viewStudentPortal` is. */
  viewStudentResults(role: Role | undefined): boolean {
    return role === "STUDENT";
  },

  /**
   * The student portal's own Timetable tab - gated on the school's Timetables package
   * entitlement, the `viewWardBills`/`viewTimetable` shape.
   */
  viewStudentTimetable(role: Role | undefined, entitled: boolean): boolean {
    return entitled && role === "STUDENT";
  },

  /**
   * The student portal's own Resources tab (Phase 35E) - gated on the school's On-demand learning
   * entitlement, the `viewStudentTimetable` shape.
   */
  viewStudentResources(role: Role | undefined, entitled: boolean): boolean {
    return entitled && role === "STUDENT";
  },

  /**
   * The student portal's own Quizzes tab (Phase 35I.3) - gated on the school's Take-home quizzes
   * entitlement, the `viewStudentTimetable`/`viewStudentResources` shape. A separate predicate
   * from `viewTakeHomeQuizzes` (staff) and `viewWardTakeHomeQuizzes` (guardian) - the
   * `viewWardTakeHomeQuizzes` convention: the backend path is entirely different per role, so each
   * gets its own predicate rather than widening one to admit every role.
   */
  viewStudentQuizzes(role: Role | undefined, entitled: boolean): boolean {
    return entitled && role === "STUDENT";
  },
};
