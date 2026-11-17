import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import type { RemarkSheetRow } from "@/api/assessments";
import { RemarkEntryRow } from "@/features/assessments/components/RemarkEntryRow";

const LONG_REMARK =
  "Zara has shown remarkable progress this term across every subject, participates eagerly in class discussions, and helps her classmates whenever she can.";

function row(classTeacherRemark?: string): RemarkSheetRow {
  return {
    enrollmentId: "e1",
    studentName: "Zara Bello",
    admissionNumber: "KDL001",
    classTeacherRemark,
    classTeacherRemarkByName: "Mrs Ade",
    traits: [],
  };
}

function renderRow(remark?: string) {
  return render(
    <table>
      <tbody>
        <RemarkEntryRow
          row={row(remark)}
          field="principal"
          label="Principal's remark"
          value=""
          editable
          dirty={false}
          onChange={() => {}}
        />
      </tbody>
    </table>,
  );
}

describe("RemarkEntryRow class teacher remark", () => {
  it("clamps a long remark and expands it on demand", async () => {
    const user = userEvent.setup();
    renderRow(LONG_REMARK);

    const text = screen.getByText(LONG_REMARK);
    expect(text).toHaveClass("line-clamp-2");
    const toggle = screen.getByRole("button", { name: "Show full class teacher's remark for Zara Bello" });
    expect(toggle).toHaveTextContent("Show more");
    expect(toggle).toHaveAttribute("aria-expanded", "false");

    await user.click(toggle);

    expect(text).not.toHaveClass("line-clamp-2");
    const collapse = screen.getByRole("button", { name: "Show less of class teacher's remark for Zara Bello" });
    expect(collapse).toHaveTextContent("Show less");
    expect(collapse).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("— Mrs Ade")).toBeInTheDocument();
  });

  it("shows a short remark in full with no toggle", () => {
    renderRow("Good work.");

    expect(screen.getByText("Good work.")).not.toHaveClass("line-clamp-2");
    expect(screen.queryByRole("button", { name: /class teacher's remark/ })).not.toBeInTheDocument();
  });

  it("shows a dash when there is no remark", () => {
    renderRow(undefined);

    expect(screen.getByText("—")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /class teacher's remark/ })).not.toBeInTheDocument();
  });
});
