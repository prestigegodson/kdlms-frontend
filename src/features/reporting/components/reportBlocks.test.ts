import { describe, expect, it } from "vitest";
import { BLOCK_LABELS, REPORT_BLOCK_NAMES } from "@/features/reporting/components/designer/layout";
import { REPORT_BLOCKS, REPORT_TOKENS } from "@/features/reporting/components/reportBlocks";

/**
 * Keeps the palette registry (`REPORT_BLOCKS`) and the layout model's block
 * union (`REPORT_BLOCK_NAMES`/`BLOCK_LABELS`) from drifting apart - both are
 * meant to mirror backend `reporting.domain.ReportBlock` in exact sync, and
 * nothing else in the type system catches a name added to one but not the
 * other.
 */
describe("report block registries stay in sync", () => {
  it("REPORT_BLOCKS carries exactly the ids in REPORT_BLOCK_NAMES", () => {
    const paletteIds = REPORT_BLOCKS.map((block) => block.id).sort();
    const layoutNames = [...REPORT_BLOCK_NAMES].sort();
    expect(paletteIds).toEqual(layoutNames);
  });

  it("BLOCK_LABELS has an entry for every block name", () => {
    expect(Object.keys(BLOCK_LABELS).sort()).toEqual([...REPORT_BLOCK_NAMES].sort());
  });

  it("includes the two remark blocks, mode-agnostic (no `mode` field)", () => {
    const classTeacherRemark = REPORT_BLOCKS.find((block) => block.id === "REMARK_CLASS_TEACHER");
    const principalRemark = REPORT_BLOCKS.find((block) => block.id === "REMARK_PRINCIPAL");
    expect(classTeacherRemark?.mode).toBeUndefined();
    expect(principalRemark?.mode).toBeUndefined();
  });

  it("includes SCHOOL_LOGO, mode-agnostic (no `mode` field)", () => {
    const schoolLogo = REPORT_BLOCKS.find((block) => block.id === "SCHOOL_LOGO");
    expect(schoolLogo?.mode).toBeUndefined();
  });

  it("includes the two remark tokens", () => {
    const keys = REPORT_TOKENS.map((token) => token.key);
    expect(keys).toContain("remark.classTeacher");
    expect(keys).toContain("remark.principal");
  });
});
