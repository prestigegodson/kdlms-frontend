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
