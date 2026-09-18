import { describe, expect, it } from "vitest";
import type { Role } from "@/api/types";
import { can, type TeacherScope } from "@/auth/permissions";

describe("can.viewMessages", () => {
  it("is false for every role when the school isn't entitled, regardless of role or scope", () => {
    expect(can.viewMessages("SCHOOL_ADMIN", null, false)).toBe(false);
    expect(can.viewMessages("BRANCH_ADMIN", null, false)).toBe(false);
    expect(can.viewMessages("TEACHER", { isClassTeacher: true }, false)).toBe(false);
    expect(can.viewMessages("GUARDIAN", null, false)).toBe(false);
  });

  it("is true for SCHOOL_ADMIN/BRANCH_ADMIN/GUARDIAN once entitled, with no scope requirement", () => {
    expect(can.viewMessages("SCHOOL_ADMIN", null, true)).toBe(true);
    expect(can.viewMessages("BRANCH_ADMIN", null, true)).toBe(true);
    expect(can.viewMessages("GUARDIAN", null, true)).toBe(true);
  });

  it("is true for a TEACHER only when they class-teach at least one class", () => {
    expect(can.viewMessages("TEACHER", { isClassTeacher: true }, true)).toBe(true);
    expect(can.viewMessages("TEACHER", { isClassTeacher: false }, true)).toBe(false);
    expect(can.viewMessages("TEACHER", null, true)).toBe(false);
  });
});

describe("can.manageBranchAdmins", () => {
  it("is true only for SCHOOL_ADMIN", () => {
    expect(can.manageBranchAdmins("SCHOOL_ADMIN")).toBe(true);
    expect(can.manageBranchAdmins("BRANCH_ADMIN")).toBe(false);
    expect(can.manageBranchAdmins("TEACHER")).toBe(false);
    expect(can.manageBranchAdmins("GUARDIAN")).toBe(false);
    expect(can.manageBranchAdmins(undefined)).toBe(false);
  });
});

describe("can.composeMessages", () => {
  it("is true only for an entitled class-teaching TEACHER", () => {
    expect(can.composeMessages("TEACHER", { isClassTeacher: true }, true)).toBe(true);
  });

  it("is false for admins even when entitled - only the class teacher starts a thread", () => {
    expect(can.composeMessages("SCHOOL_ADMIN", null, true)).toBe(false);
    expect(can.composeMessages("BRANCH_ADMIN", null, true)).toBe(false);
  });

  it("is false for a GUARDIAN - a guardian may only reply, never start a thread", () => {
    expect(can.composeMessages("GUARDIAN", null, true)).toBe(false);
  });

  it("is false when the school isn't entitled, even for a class-teaching TEACHER", () => {
    expect(can.composeMessages("TEACHER", { isClassTeacher: true }, false)).toBe(false);
  });

  it("is false for a subject-teacher-only account", () => {
    expect(can.composeMessages("TEACHER", { isClassTeacher: false }, true)).toBe(false);
  });
});

describe("can.managePeriodGrid", () => {
  it("is true only for an entitled SCHOOL_ADMIN", () => {
    expect(can.managePeriodGrid("SCHOOL_ADMIN", true)).toBe(true);
  });

  it("is false when the school isn't entitled, even for SCHOOL_ADMIN", () => {
    expect(can.managePeriodGrid("SCHOOL_ADMIN", false)).toBe(false);
  });

  it("is false for every other role, even when entitled", () => {
    expect(can.managePeriodGrid("BRANCH_ADMIN", true)).toBe(false);
    expect(can.managePeriodGrid("TEACHER", true)).toBe(false);
    expect(can.managePeriodGrid("GUARDIAN", true)).toBe(false);
    expect(can.managePeriodGrid(undefined, true)).toBe(false);
  });
});

describe("can.viewPeriodGrid", () => {
  it("is true for an entitled SCHOOL_ADMIN or BRANCH_ADMIN", () => {
    expect(can.viewPeriodGrid("SCHOOL_ADMIN", true)).toBe(true);
    expect(can.viewPeriodGrid("BRANCH_ADMIN", true)).toBe(true);
  });

  it("is false when the school isn't entitled, even for SCHOOL_ADMIN/BRANCH_ADMIN", () => {
    expect(can.viewPeriodGrid("SCHOOL_ADMIN", false)).toBe(false);
    expect(can.viewPeriodGrid("BRANCH_ADMIN", false)).toBe(false);
  });

  it("is false for every other role, even when entitled", () => {
    expect(can.viewPeriodGrid("TEACHER", true)).toBe(false);
    expect(can.viewPeriodGrid("GUARDIAN", true)).toBe(false);
    expect(can.viewPeriodGrid(undefined, true)).toBe(false);
  });
});

describe("can.viewLessonNotes", () => {
  it("is true for an entitled SCHOOL_ADMIN, BRANCH_ADMIN, or TEACHER", () => {
    expect(can.viewLessonNotes("SCHOOL_ADMIN", true)).toBe(true);
    expect(can.viewLessonNotes("BRANCH_ADMIN", true)).toBe(true);
    expect(can.viewLessonNotes("TEACHER", true)).toBe(true);
  });

  it("is false when the school isn't entitled, even for staff roles", () => {
    expect(can.viewLessonNotes("SCHOOL_ADMIN", false)).toBe(false);
    expect(can.viewLessonNotes("TEACHER", false)).toBe(false);
  });

  it("is false for GUARDIAN, even when entitled", () => {
    expect(can.viewLessonNotes("GUARDIAN", true)).toBe(false);
    expect(can.viewLessonNotes(undefined, true)).toBe(false);
  });
});

describe("can.authorLessonNotes", () => {
  it("is true for an entitled SCHOOL_ADMIN, BRANCH_ADMIN, or TEACHER", () => {
    expect(can.authorLessonNotes("SCHOOL_ADMIN", true)).toBe(true);
    expect(can.authorLessonNotes("BRANCH_ADMIN", true)).toBe(true);
    expect(can.authorLessonNotes("TEACHER", true)).toBe(true);
  });

  it("is false when the school isn't entitled", () => {
    expect(can.authorLessonNotes("TEACHER", false)).toBe(false);
  });

  it("is false for GUARDIAN, even when entitled", () => {
    expect(can.authorLessonNotes("GUARDIAN", true)).toBe(false);
  });
});

describe("can.reviewLessonNotes", () => {
  it("is true for an entitled SCHOOL_ADMIN or BRANCH_ADMIN", () => {
    expect(can.reviewLessonNotes("SCHOOL_ADMIN", true)).toBe(true);
    expect(can.reviewLessonNotes("BRANCH_ADMIN", true)).toBe(true);
  });

  it("is false for TEACHER, even when entitled - narrower than authorLessonNotes", () => {
    expect(can.reviewLessonNotes("TEACHER", true)).toBe(false);
  });

  it("is false when the school isn't entitled", () => {
    expect(can.reviewLessonNotes("SCHOOL_ADMIN", false)).toBe(false);
  });

  it("is false for GUARDIAN, even when entitled", () => {
    expect(can.reviewLessonNotes("GUARDIAN", true)).toBe(false);
  });
});

describe("can.viewWardLessonNotes", () => {
  it("is true only for an entitled GUARDIAN", () => {
    expect(can.viewWardLessonNotes("GUARDIAN", true)).toBe(true);
  });

  it("is false when the school isn't entitled", () => {
    expect(can.viewWardLessonNotes("GUARDIAN", false)).toBe(false);
  });

  it("is false for every staff role, even when entitled - a separate backend path from viewLessonNotes", () => {
    expect(can.viewWardLessonNotes("SCHOOL_ADMIN", true)).toBe(false);
    expect(can.viewWardLessonNotes("BRANCH_ADMIN", true)).toBe(false);
    expect(can.viewWardLessonNotes("TEACHER", true)).toBe(false);
    expect(can.viewWardLessonNotes(undefined, true)).toBe(false);
  });
});

describe("can.viewTakeHomeQuizzes", () => {
  it("is true for an entitled SCHOOL_ADMIN, BRANCH_ADMIN, or TEACHER", () => {
    expect(can.viewTakeHomeQuizzes("SCHOOL_ADMIN", true)).toBe(true);
    expect(can.viewTakeHomeQuizzes("BRANCH_ADMIN", true)).toBe(true);
    expect(can.viewTakeHomeQuizzes("TEACHER", true)).toBe(true);
  });

  it("is false when the school isn't entitled, even for staff roles", () => {
    expect(can.viewTakeHomeQuizzes("SCHOOL_ADMIN", false)).toBe(false);
    expect(can.viewTakeHomeQuizzes("TEACHER", false)).toBe(false);
  });

  it("is false for GUARDIAN, even when entitled", () => {
    expect(can.viewTakeHomeQuizzes("GUARDIAN", true)).toBe(false);
    expect(can.viewTakeHomeQuizzes(undefined, true)).toBe(false);
  });
});

describe("can.authorTakeHomeQuizzes", () => {
  it("is true for an entitled SCHOOL_ADMIN, BRANCH_ADMIN, or TEACHER", () => {
    expect(can.authorTakeHomeQuizzes("SCHOOL_ADMIN", true)).toBe(true);
    expect(can.authorTakeHomeQuizzes("BRANCH_ADMIN", true)).toBe(true);
    expect(can.authorTakeHomeQuizzes("TEACHER", true)).toBe(true);
  });

  it("is false when the school isn't entitled", () => {
    expect(can.authorTakeHomeQuizzes("TEACHER", false)).toBe(false);
  });

  it("is false for GUARDIAN, even when entitled", () => {
    expect(can.authorTakeHomeQuizzes("GUARDIAN", true)).toBe(false);
  });
});

describe("can.publishTakeHomeQuizResults", () => {
  it("is true for an entitled SCHOOL_ADMIN, BRANCH_ADMIN, or TEACHER", () => {
    expect(can.publishTakeHomeQuizResults("SCHOOL_ADMIN", true)).toBe(true);
    expect(can.publishTakeHomeQuizResults("BRANCH_ADMIN", true)).toBe(true);
    expect(can.publishTakeHomeQuizResults("TEACHER", true)).toBe(true);
  });

  it("is false when the school isn't entitled", () => {
    expect(can.publishTakeHomeQuizResults("SCHOOL_ADMIN", false)).toBe(false);
  });

  it("is false for GUARDIAN, even when entitled", () => {
    expect(can.publishTakeHomeQuizResults("GUARDIAN", true)).toBe(false);
  });
});

describe("can.adjustTakeHomeQuizScore", () => {
  it("is true only for an entitled TEACHER", () => {
    expect(can.adjustTakeHomeQuizScore("TEACHER", true)).toBe(true);
  });

  it("is false when the school isn't entitled, even for TEACHER", () => {
    expect(can.adjustTakeHomeQuizScore("TEACHER", false)).toBe(false);
  });

  it("is false for SCHOOL_ADMIN/BRANCH_ADMIN even when entitled - no admin override path", () => {
    expect(can.adjustTakeHomeQuizScore("SCHOOL_ADMIN", true)).toBe(false);
    expect(can.adjustTakeHomeQuizScore("BRANCH_ADMIN", true)).toBe(false);
  });

  it("is false for GUARDIAN and undefined", () => {
    expect(can.adjustTakeHomeQuizScore("GUARDIAN", true)).toBe(false);
    expect(can.adjustTakeHomeQuizScore(undefined, true)).toBe(false);
  });
});

describe("can.viewWardTakeHomeQuizzes", () => {
  it("is true only for an entitled GUARDIAN", () => {
    expect(can.viewWardTakeHomeQuizzes("GUARDIAN", true)).toBe(true);
  });

  it("is false when the school isn't entitled", () => {
    expect(can.viewWardTakeHomeQuizzes("GUARDIAN", false)).toBe(false);
  });

  it("is false for every staff role, even when entitled - a separate backend path from viewTakeHomeQuizzes", () => {
    expect(can.viewWardTakeHomeQuizzes("SCHOOL_ADMIN", true)).toBe(false);
    expect(can.viewWardTakeHomeQuizzes("BRANCH_ADMIN", true)).toBe(false);
    expect(can.viewWardTakeHomeQuizzes("TEACHER", true)).toBe(false);
    expect(can.viewWardTakeHomeQuizzes(undefined, true)).toBe(false);
  });
});

describe("can.manageSupportContact", () => {
  it("is true only for SYSTEM_ADMIN", () => {
    expect(can.manageSupportContact("SYSTEM_ADMIN")).toBe(true);
    expect(can.manageSupportContact("SCHOOL_ADMIN")).toBe(false);
    expect(can.manageSupportContact("BRANCH_ADMIN")).toBe(false);
    expect(can.manageSupportContact("TEACHER")).toBe(false);
    expect(can.manageSupportContact("GUARDIAN")).toBe(false);
    expect(can.manageSupportContact(undefined)).toBe(false);
  });
});

describe("can.recordRemarks", () => {
  it("is true only for a class-teaching TEACHER", () => {
    expect(can.recordRemarks("TEACHER", { isClassTeacher: true })).toBe(true);
  });

  it("is false for a subject-teacher-only account", () => {
    expect(can.recordRemarks("TEACHER", { isClassTeacher: false })).toBe(false);
    expect(can.recordRemarks("TEACHER", null)).toBe(false);
  });

  it("is false for every admin role, even class-teacher scope aside", () => {
    expect(can.recordRemarks("SCHOOL_ADMIN", { isClassTeacher: true })).toBe(false);
    expect(can.recordRemarks("BRANCH_ADMIN", { isClassTeacher: true })).toBe(false);
    expect(can.recordRemarks("GUARDIAN", { isClassTeacher: true })).toBe(false);
  });
});

describe("can.recordPrincipalRemark", () => {
  it("is true only for SCHOOL_ADMIN/BRANCH_ADMIN", () => {
    expect(can.recordPrincipalRemark("SCHOOL_ADMIN")).toBe(true);
    expect(can.recordPrincipalRemark("BRANCH_ADMIN")).toBe(true);
  });

  it("is false for a TEACHER - not even a class teacher writes the principal's half", () => {
    expect(can.recordPrincipalRemark("TEACHER")).toBe(false);
  });

  it("is false for GUARDIAN and undefined", () => {
    expect(can.recordPrincipalRemark("GUARDIAN")).toBe(false);
    expect(can.recordPrincipalRemark(undefined)).toBe(false);
  });
});

describe("can.viewSupportContact", () => {
  it("is true only for SCHOOL_ADMIN/BRANCH_ADMIN", () => {
    expect(can.viewSupportContact("SCHOOL_ADMIN")).toBe(true);
    expect(can.viewSupportContact("BRANCH_ADMIN")).toBe(true);
    expect(can.viewSupportContact("SYSTEM_ADMIN")).toBe(false);
    expect(can.viewSupportContact("TEACHER")).toBe(false);
    expect(can.viewSupportContact("GUARDIAN")).toBe(false);
    expect(can.viewSupportContact(undefined)).toBe(false);
  });
});

describe("can.manageAiSettings", () => {
  it("is true only for SYSTEM_ADMIN", () => {
    expect(can.manageAiSettings("SYSTEM_ADMIN")).toBe(true);
    expect(can.manageAiSettings("SCHOOL_ADMIN")).toBe(false);
    expect(can.manageAiSettings("BRANCH_ADMIN")).toBe(false);
    expect(can.manageAiSettings("TEACHER")).toBe(false);
    expect(can.manageAiSettings("GUARDIAN")).toBe(false);
    expect(can.manageAiSettings(undefined)).toBe(false);
  });
});

describe("can.viewBilling", () => {
  it("is true for an entitled SCHOOL_ADMIN or BRANCH_ADMIN", () => {
    expect(can.viewBilling("SCHOOL_ADMIN", true)).toBe(true);
    expect(can.viewBilling("BRANCH_ADMIN", true)).toBe(true);
  });

  it("is false for TEACHER, even when entitled - fees are not academic information", () => {
    expect(can.viewBilling("TEACHER", true)).toBe(false);
  });

  it("is false when the school isn't entitled, even for staff roles", () => {
    expect(can.viewBilling("SCHOOL_ADMIN", false)).toBe(false);
    expect(can.viewBilling("BRANCH_ADMIN", false)).toBe(false);
  });

  it("is false for GUARDIAN, even when entitled", () => {
    expect(can.viewBilling("GUARDIAN", true)).toBe(false);
    expect(can.viewBilling(undefined, true)).toBe(false);
  });
});

describe("can.manageFees", () => {
  it("is true only for an entitled SCHOOL_ADMIN", () => {
    expect(can.manageFees("SCHOOL_ADMIN", true)).toBe(true);
  });

  it("is false for BRANCH_ADMIN - read-only on fee definitions", () => {
    expect(can.manageFees("BRANCH_ADMIN", true)).toBe(false);
  });

  it("is false for TEACHER and GUARDIAN, even when entitled", () => {
    expect(can.manageFees("TEACHER", true)).toBe(false);
    expect(can.manageFees("GUARDIAN", true)).toBe(false);
  });

  it("is false when the school isn't entitled", () => {
    expect(can.manageFees("SCHOOL_ADMIN", false)).toBe(false);
  });
});

describe("can.manageFeePrices", () => {
  it("is true for an entitled SCHOOL_ADMIN or BRANCH_ADMIN", () => {
    expect(can.manageFeePrices("SCHOOL_ADMIN", true)).toBe(true);
    expect(can.manageFeePrices("BRANCH_ADMIN", true)).toBe(true);
  });

  it("is false for TEACHER and GUARDIAN, even when entitled", () => {
    expect(can.manageFeePrices("TEACHER", true)).toBe(false);
    expect(can.manageFeePrices("GUARDIAN", true)).toBe(false);
  });

  it("is false when the school isn't entitled", () => {
    expect(can.manageFeePrices("SCHOOL_ADMIN", false)).toBe(false);
    expect(can.manageFeePrices("BRANCH_ADMIN", false)).toBe(false);
  });
});

describe("can.editStudentBills", () => {
  it("is true for an entitled SCHOOL_ADMIN or BRANCH_ADMIN", () => {
    expect(can.editStudentBills("SCHOOL_ADMIN", true)).toBe(true);
    expect(can.editStudentBills("BRANCH_ADMIN", true)).toBe(true);
  });

  it("is false for TEACHER and GUARDIAN, even when entitled", () => {
    expect(can.editStudentBills("TEACHER", true)).toBe(false);
    expect(can.editStudentBills("GUARDIAN", true)).toBe(false);
  });

  it("is false when the school isn't entitled", () => {
    expect(can.editStudentBills("SCHOOL_ADMIN", false)).toBe(false);
    expect(can.editStudentBills("BRANCH_ADMIN", false)).toBe(false);
  });
});

describe("can.manageAdvanceBills", () => {
  it("is true for an entitled SCHOOL_ADMIN or BRANCH_ADMIN", () => {
    expect(can.manageAdvanceBills("SCHOOL_ADMIN", true)).toBe(true);
    expect(can.manageAdvanceBills("BRANCH_ADMIN", true)).toBe(true);
  });

  it("is false for TEACHER and GUARDIAN, even when entitled", () => {
    expect(can.manageAdvanceBills("TEACHER", true)).toBe(false);
    expect(can.manageAdvanceBills("GUARDIAN", true)).toBe(false);
  });

  it("is false when the school isn't entitled", () => {
    expect(can.manageAdvanceBills("SCHOOL_ADMIN", false)).toBe(false);
    expect(can.manageAdvanceBills("BRANCH_ADMIN", false)).toBe(false);
  });
});

describe("can.manageBillingSettings", () => {
  it("is true only for an entitled SCHOOL_ADMIN", () => {
    expect(can.manageBillingSettings("SCHOOL_ADMIN", true)).toBe(true);
  });

  it("is false for BRANCH_ADMIN, TEACHER, and GUARDIAN, even when entitled", () => {
    expect(can.manageBillingSettings("BRANCH_ADMIN", true)).toBe(false);
    expect(can.manageBillingSettings("TEACHER", true)).toBe(false);
    expect(can.manageBillingSettings("GUARDIAN", true)).toBe(false);
  });

  it("is false when the school isn't entitled", () => {
    expect(can.manageBillingSettings("SCHOOL_ADMIN", false)).toBe(false);
  });
});

describe("can.publishBills", () => {
  it("is true for an entitled SCHOOL_ADMIN or BRANCH_ADMIN", () => {
    expect(can.publishBills("SCHOOL_ADMIN", true)).toBe(true);
    expect(can.publishBills("BRANCH_ADMIN", true)).toBe(true);
  });

  it("is false for TEACHER and GUARDIAN, even when entitled", () => {
    expect(can.publishBills("TEACHER", true)).toBe(false);
    expect(can.publishBills("GUARDIAN", true)).toBe(false);
  });

  it("is false when the school isn't entitled", () => {
    expect(can.publishBills("SCHOOL_ADMIN", false)).toBe(false);
    expect(can.publishBills("BRANCH_ADMIN", false)).toBe(false);
  });
});

describe("can.viewWardBills", () => {
  it("is true only for an entitled GUARDIAN", () => {
    expect(can.viewWardBills("GUARDIAN", true)).toBe(true);
  });

  it("is false when the school isn't entitled", () => {
    expect(can.viewWardBills("GUARDIAN", false)).toBe(false);
  });

  it("is false for every staff role, even when entitled - a separate backend path from viewBilling", () => {
    expect(can.viewWardBills("SCHOOL_ADMIN", true)).toBe(false);
    expect(can.viewWardBills("BRANCH_ADMIN", true)).toBe(false);
    expect(can.viewWardBills("TEACHER", true)).toBe(false);
    expect(can.viewWardBills(undefined, true)).toBe(false);
  });
});

describe("can.viewStudentPortal", () => {
  it("is true only for STUDENT", () => {
    expect(can.viewStudentPortal("STUDENT")).toBe(true);
  });

  it("is false for every other role", () => {
    expect(can.viewStudentPortal("GUARDIAN")).toBe(false);
    expect(can.viewStudentPortal("SCHOOL_ADMIN")).toBe(false);
    expect(can.viewStudentPortal("BRANCH_ADMIN")).toBe(false);
    expect(can.viewStudentPortal("TEACHER")).toBe(false);
    expect(can.viewStudentPortal("INVENTORY_MANAGER")).toBe(false);
    expect(can.viewStudentPortal(undefined)).toBe(false);
  });
});

describe("can.viewStudentResults", () => {
  it("is true only for STUDENT", () => {
    expect(can.viewStudentResults("STUDENT")).toBe(true);
  });

  it("is false for every other role", () => {
    expect(can.viewStudentResults("GUARDIAN")).toBe(false);
    expect(can.viewStudentResults("SCHOOL_ADMIN")).toBe(false);
    expect(can.viewStudentResults(undefined)).toBe(false);
  });
});

describe("can.viewStudentTimetable", () => {
  it("is true only for an entitled STUDENT", () => {
    expect(can.viewStudentTimetable("STUDENT", true)).toBe(true);
  });

  it("is false when the school isn't entitled", () => {
    expect(can.viewStudentTimetable("STUDENT", false)).toBe(false);
  });

  it("is false for every staff/guardian role, even when entitled", () => {
    expect(can.viewStudentTimetable("GUARDIAN", true)).toBe(false);
    expect(can.viewStudentTimetable("SCHOOL_ADMIN", true)).toBe(false);
    expect(can.viewStudentTimetable("TEACHER", true)).toBe(false);
    expect(can.viewStudentTimetable(undefined, true)).toBe(false);
  });
});

describe("can.viewInventory", () => {
  it("is true for SCHOOL_ADMIN, BRANCH_ADMIN, and INVENTORY_MANAGER alike - the module's own entry gate", () => {
    expect(can.viewInventory("SCHOOL_ADMIN")).toBe(true);
    expect(can.viewInventory("BRANCH_ADMIN")).toBe(true);
    expect(can.viewInventory("INVENTORY_MANAGER")).toBe(true);
  });

  it("is false for TEACHER and GUARDIAN - no entitlement check either way, this module is ungated", () => {
    expect(can.viewInventory("TEACHER")).toBe(false);
    expect(can.viewInventory("GUARDIAN")).toBe(false);
    expect(can.viewInventory(undefined)).toBe(false);
  });
});

describe("can.manageInventoryCatalogue", () => {
  it("is true only for SCHOOL_ADMIN - a real 403 for BRANCH_ADMIN/INVENTORY_MANAGER, not a 404", () => {
    expect(can.manageInventoryCatalogue("SCHOOL_ADMIN")).toBe(true);
    expect(can.manageInventoryCatalogue("BRANCH_ADMIN")).toBe(false);
    expect(can.manageInventoryCatalogue("INVENTORY_MANAGER")).toBe(false);
  });
});

describe("can.manageInventoryStock", () => {
  it("is true for SCHOOL_ADMIN/BRANCH_ADMIN but false for INVENTORY_MANAGER - raising a requisition isn't moving stock", () => {
    expect(can.manageInventoryStock("SCHOOL_ADMIN")).toBe(true);
    expect(can.manageInventoryStock("BRANCH_ADMIN")).toBe(true);
    expect(can.manageInventoryStock("INVENTORY_MANAGER")).toBe(false);
  });
});

describe("can.manageRequisitions vs can.reviewRequisitions", () => {
  it("INVENTORY_MANAGER may raise a requisition but never review one - the seam this role exists to express", () => {
    expect(can.manageRequisitions("INVENTORY_MANAGER")).toBe(true);
    expect(can.reviewRequisitions("INVENTORY_MANAGER")).toBe(false);
  });

  it("SCHOOL_ADMIN and BRANCH_ADMIN may both raise and review, own-branch scoped server-side", () => {
    expect(can.manageRequisitions("SCHOOL_ADMIN")).toBe(true);
    expect(can.reviewRequisitions("SCHOOL_ADMIN")).toBe(true);
    expect(can.manageRequisitions("BRANCH_ADMIN")).toBe(true);
    expect(can.reviewRequisitions("BRANCH_ADMIN")).toBe(true);
  });

  it("is false for TEACHER and GUARDIAN on both", () => {
    expect(can.manageRequisitions("TEACHER")).toBe(false);
    expect(can.reviewRequisitions("TEACHER")).toBe(false);
    expect(can.manageRequisitions("GUARDIAN")).toBe(false);
    expect(can.reviewRequisitions("GUARDIAN")).toBe(false);
  });
});

describe("can.manageStudentLogins", () => {
  it("is true for an entitled SCHOOL_ADMIN or BRANCH_ADMIN regardless of scope", () => {
    expect(can.manageStudentLogins("SCHOOL_ADMIN", null, true)).toBe(true);
    expect(can.manageStudentLogins("BRANCH_ADMIN", null, true)).toBe(true);
  });

  it("is true for an entitled class-teaching TEACHER, false for a subject-teacher-only one", () => {
    expect(can.manageStudentLogins("TEACHER", { isClassTeacher: true }, true)).toBe(true);
    expect(can.manageStudentLogins("TEACHER", { isClassTeacher: false }, true)).toBe(false);
    expect(can.manageStudentLogins("TEACHER", null, true)).toBe(false);
  });

  it("is false when the school isn't entitled, even for SCHOOL_ADMIN", () => {
    expect(can.manageStudentLogins("SCHOOL_ADMIN", null, false)).toBe(false);
    expect(can.manageStudentLogins("TEACHER", { isClassTeacher: true }, false)).toBe(false);
  });

  it("is false for GUARDIAN and INVENTORY_MANAGER, even when entitled", () => {
    expect(can.manageStudentLogins("GUARDIAN", null, true)).toBe(false);
    expect(can.manageStudentLogins("INVENTORY_MANAGER", null, true)).toBe(false);
    expect(can.manageStudentLogins(undefined, null, true)).toBe(false);
  });
});

describe("can.viewLearningResources", () => {
  it("is true for an entitled SCHOOL_ADMIN, BRANCH_ADMIN, or TEACHER", () => {
    expect(can.viewLearningResources("SCHOOL_ADMIN", true)).toBe(true);
    expect(can.viewLearningResources("BRANCH_ADMIN", true)).toBe(true);
    expect(can.viewLearningResources("TEACHER", true)).toBe(true);
  });

  it("is false when the school isn't entitled, even for staff roles", () => {
    expect(can.viewLearningResources("SCHOOL_ADMIN", false)).toBe(false);
    expect(can.viewLearningResources("TEACHER", false)).toBe(false);
  });

  it("is false for GUARDIAN or STUDENT, even when entitled", () => {
    expect(can.viewLearningResources("GUARDIAN", true)).toBe(false);
    expect(can.viewLearningResources("STUDENT", true)).toBe(false);
    expect(can.viewLearningResources(undefined, true)).toBe(false);
  });
});

describe("can.authorLearningResources", () => {
  it("is true for an entitled SCHOOL_ADMIN, BRANCH_ADMIN, or TEACHER", () => {
    expect(can.authorLearningResources("SCHOOL_ADMIN", true)).toBe(true);
    expect(can.authorLearningResources("BRANCH_ADMIN", true)).toBe(true);
    expect(can.authorLearningResources("TEACHER", true)).toBe(true);
  });

  it("is false when the school isn't entitled", () => {
    expect(can.authorLearningResources("TEACHER", false)).toBe(false);
  });

  it("is false for GUARDIAN or STUDENT, even when entitled", () => {
    expect(can.authorLearningResources("GUARDIAN", true)).toBe(false);
    expect(can.authorLearningResources("STUDENT", true)).toBe(false);
  });
});

describe("can.authorLearningMedia", () => {
  it("is true for an authoring role only when both onDemandLearning and learningMedia hold", () => {
    expect(can.authorLearningMedia("SCHOOL_ADMIN", true, true)).toBe(true);
    expect(can.authorLearningMedia("BRANCH_ADMIN", true, true)).toBe(true);
    expect(can.authorLearningMedia("TEACHER", true, true)).toBe(true);
  });

  it("is false when learningMedia is off even though onDemandLearning is on", () => {
    expect(can.authorLearningMedia("SCHOOL_ADMIN", true, false)).toBe(false);
    expect(can.authorLearningMedia("TEACHER", true, false)).toBe(false);
  });

  it("is false when onDemandLearning is off even though learningMedia is on", () => {
    expect(can.authorLearningMedia("SCHOOL_ADMIN", false, true)).toBe(false);
  });

  it("is false for a non-authoring role regardless of either flag", () => {
    expect(can.authorLearningMedia("GUARDIAN", true, true)).toBe(false);
    expect(can.authorLearningMedia("STUDENT", true, true)).toBe(false);
    expect(can.authorLearningMedia(undefined, true, true)).toBe(false);
  });
});

describe("can.viewLearningCompletions", () => {
  it("follows authorLearningResources exactly, for every role", () => {
    const roles: (Role | undefined)[] = [
      "SYSTEM_ADMIN",
      "SCHOOL_ADMIN",
      "BRANCH_ADMIN",
      "TEACHER",
      "INVENTORY_MANAGER",
      "GUARDIAN",
      "STUDENT",
      undefined,
    ];
    for (const entitled of [true, false]) {
      for (const role of roles) {
        expect(can.viewLearningCompletions(role, entitled)).toBe(can.authorLearningResources(role, entitled));
      }
    }
  });

  it("is true for an authoring role when entitled, false for a STUDENT even when entitled", () => {
    expect(can.viewLearningCompletions("SCHOOL_ADMIN", true)).toBe(true);
    expect(can.viewLearningCompletions("TEACHER", true)).toBe(true);
    expect(can.viewLearningCompletions("STUDENT", true)).toBe(false);
    expect(can.viewLearningCompletions("SCHOOL_ADMIN", false)).toBe(false);
  });
});

/**
 * Phase 35J: a `STUDENT` is denied every capability that isn't its own
 * (`viewStudentPortal`/`viewStudentResults`/`viewStudentTimetable`/
 * `viewStudentResources`/`viewStudentQuizzes`) or the one STUDENT-only write
 * (`postLearningComments`) - a sweep over the rest of the `can` object with
 * every gate deliberately forced open (`entitled`/`scope`/`onDemandLearning`/
 * `learningMedia` all `true`), so a future capability added to this file
 * without an explicit role check fails this test loudly rather than silently
 * admitting STUDENT.
 */
describe("can - a STUDENT is denied every staff/guardian capability", () => {
  const classTeacherScope: TeacherScope = { isClassTeacher: true };

  const staffAndGuardianChecks: Record<string, () => boolean> = {
    manageAcademics: () => can.manageAcademics("STUDENT"),
    viewSubjectCatalogue: () => can.viewSubjectCatalogue("STUDENT"),
    manageTeachers: () => can.manageTeachers("STUDENT"),
    manageBranches: () => can.manageBranches("STUDENT"),
    manageBranchAdmins: () => can.manageBranchAdmins("STUDENT"),
    selectBranch: () => can.selectBranch("STUDENT"),
    manageLevels: () => can.manageLevels("STUDENT"),
    deleteSubjects: () => can.deleteSubjects("STUDENT"),
    viewAttendance: () => can.viewAttendance("STUDENT", classTeacherScope),
    markAttendance: () => can.markAttendance("STUDENT", classTeacherScope),
    manageStudents: () => can.manageStudents("STUDENT"),
    viewStudents: () => can.viewStudents("STUDENT"),
    managePromotions: () => can.managePromotions("STUDENT"),
    manageGuardians: () => can.manageGuardians("STUDENT"),
    manageStudentSubjects: () => can.manageStudentSubjects("STUDENT", classTeacherScope),
    manageStudentLogins: () => can.manageStudentLogins("STUDENT", classTeacherScope, true),
    viewBirthdays: () => can.viewBirthdays("STUDENT", classTeacherScope),
    viewClassBirthdays: () => can.viewClassBirthdays("STUDENT", true),
    manageGradingSystems: () => can.manageGradingSystems("STUDENT"),
    recordAssessments: () => can.recordAssessments("STUDENT"),
    viewResults: () => can.viewResults("STUDENT"),
    recordRemarks: () => can.recordRemarks("STUDENT", classTeacherScope),
    recordPrincipalRemark: () => can.recordPrincipalRemark("STUDENT"),
    publishResults: () => can.publishResults("STUDENT"),
    manageResultTemplates: () => can.manageResultTemplates("STUDENT"),
    manageReportSettings: () => can.manageReportSettings("STUDENT"),
    manageSchoolSettings: () => can.manageSchoolSettings("STUDENT"),
    viewReportSettings: () => can.viewReportSettings("STUDENT"),
    viewReports: () => can.viewReports("STUDENT"),
    viewWards: () => can.viewWards("STUDENT"),
    viewMessages: () => can.viewMessages("STUDENT", classTeacherScope, true),
    composeMessages: () => can.composeMessages("STUDENT", classTeacherScope, true),
    manageMyNotifications: () => can.manageMyNotifications("STUDENT", true),
    managePeriodGrid: () => can.managePeriodGrid("STUDENT", true),
    viewPeriodGrid: () => can.viewPeriodGrid("STUDENT", true),
    manageTimetable: () => can.manageTimetable("STUDENT", true),
    viewTimetable: () => can.viewTimetable("STUDENT", classTeacherScope, true),
    viewLessonNotes: () => can.viewLessonNotes("STUDENT", true),
    authorLessonNotes: () => can.authorLessonNotes("STUDENT", true),
    reviewLessonNotes: () => can.reviewLessonNotes("STUDENT", true),
    generateLessonNotesWithAi: () => can.generateLessonNotesWithAi("STUDENT", true),
    viewWardLessonNotes: () => can.viewWardLessonNotes("STUDENT", true),
    viewTakeHomeQuizzes: () => can.viewTakeHomeQuizzes("STUDENT", true),
    authorTakeHomeQuizzes: () => can.authorTakeHomeQuizzes("STUDENT", true),
    viewLearningResources: () => can.viewLearningResources("STUDENT", true),
    authorLearningResources: () => can.authorLearningResources("STUDENT", true),
    authorLearningMedia: () => can.authorLearningMedia("STUDENT", true, true),
    moderateLearningComments: () => can.moderateLearningComments("STUDENT", true),
    viewLearningCompletions: () => can.viewLearningCompletions("STUDENT", true),
    publishTakeHomeQuizResults: () => can.publishTakeHomeQuizResults("STUDENT", true),
    adjustTakeHomeQuizScore: () => can.adjustTakeHomeQuizScore("STUDENT", true),
    viewWardTakeHomeQuizzes: () => can.viewWardTakeHomeQuizzes("STUDENT", true),
    manageSupportContact: () => can.manageSupportContact("STUDENT"),
    viewSupportContact: () => can.viewSupportContact("STUDENT"),
    manageAiSettings: () => can.manageAiSettings("STUDENT"),
    viewBilling: () => can.viewBilling("STUDENT", true),
    manageFees: () => can.manageFees("STUDENT", true),
    manageFeePrices: () => can.manageFeePrices("STUDENT", true),
    manageTransport: () => can.manageTransport("STUDENT", true),
    manageAdvanceBills: () => can.manageAdvanceBills("STUDENT", true),
    manageBillingSettings: () => can.manageBillingSettings("STUDENT", true),
    publishBills: () => can.publishBills("STUDENT", true),
    editStudentBills: () => can.editStudentBills("STUDENT", true),
    viewWardBills: () => can.viewWardBills("STUDENT", true),
    viewInventory: () => can.viewInventory("STUDENT"),
    manageInventoryCatalogue: () => can.manageInventoryCatalogue("STUDENT"),
    manageInventoryStock: () => can.manageInventoryStock("STUDENT"),
    manageRequisitions: () => can.manageRequisitions("STUDENT"),
    reviewRequisitions: () => can.reviewRequisitions("STUDENT"),
  };

  it.each(Object.entries(staffAndGuardianChecks))("%s is false for STUDENT", (_name, check) => {
    expect(check()).toBe(false);
  });
});
