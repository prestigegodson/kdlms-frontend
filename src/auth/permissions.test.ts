import { describe, expect, it } from "vitest";
import { can } from "@/auth/permissions";

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
