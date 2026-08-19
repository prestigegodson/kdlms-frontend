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
