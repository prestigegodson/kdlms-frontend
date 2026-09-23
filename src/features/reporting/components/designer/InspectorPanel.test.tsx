import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { InspectorPanel } from "@/features/reporting/components/designer/InspectorPanel";
import { useLayoutEditor } from "@/features/reporting/components/designer/useLayoutEditor";
import type { ReportLayout } from "@/features/reporting/components/designer/layout";

function blankLayout(): ReportLayout {
  return {
    version: 1,
    page: { paddingPx: 24, fontFamily: "Helvetica, Arial, sans-serif", fontSizePx: 12, color: "#1a1a1a" },
    rows: [{ id: "row-1", columns: [{ id: "col-1", widthPercent: 100, elements: [] }] }],
  };
}

/** Selects `row-1` on mount, mirroring a designer clicking a row on the canvas - `InspectorPanel` renders nothing useful for this suite without a row selection. */
function Harness() {
  const editor = useLayoutEditor(blankLayout());
  if (editor.selection === null) editor.setSelection({ type: "row", rowId: "row-1" });
  return <InspectorPanel editor={editor} />;
}

describe("InspectorPanel row Visibility section", () => {
  it("checking 'Only show this row when…' seeds a single-rule ALL condition", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(screen.getByLabelText(/Only show this row when/));

    // A single rule renders no Match selector (ALL vs ANY is meaningless with one rule) -
    // the flag Select is the first combobox after the toggle is checked.
    expect(screen.queryByLabelText("Match")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Condition")).toHaveValue("HAS_CLASS_TEACHER_REMARK");
    expect(screen.getByLabelText("is / is not")).toHaveValue("true");
  });

  it("unchecking clears the condition entirely", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByLabelText(/Only show this row when/));
    expect(screen.getByLabelText("Condition")).toBeInTheDocument();

    await user.click(screen.getByLabelText(/Only show this row when/));

    expect(screen.queryByLabelText("Condition")).not.toBeInTheDocument();
  });

  it("the Match selector appears once a second rule is added, and disappears again after removing it", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByLabelText(/Only show this row when/));

    await user.click(screen.getByRole("button", { name: "+ Add condition" }));

    expect(screen.getByLabelText("Match")).toBeInTheDocument();
    expect(screen.getAllByLabelText("Condition")).toHaveLength(2);

    await user.click(screen.getAllByRole("button", { name: "Remove" })[1]);

    expect(screen.queryByLabelText("Match")).not.toBeInTheDocument();
    expect(screen.getAllByLabelText("Condition")).toHaveLength(1);
  });

  it("Add condition is disabled once the rule cap is reached", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByLabelText(/Only show this row when/));

    const addButton = screen.getByRole("button", { name: "+ Add condition" });
    // Seeded with 1 rule; the dropdown offers 8 selectable flags, so 4 more clicks reach the cap of 5.
    await user.click(addButton);
    await user.click(addButton);
    await user.click(addButton);
    await user.click(addButton);

    expect(screen.getAllByLabelText("Condition")).toHaveLength(5);
    expect(addButton).toBeDisabled();
  });

  it("removing the last remaining rule clears the whole condition rather than leaving an empty rule list", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByLabelText(/Only show this row when/));

    await user.click(screen.getByRole("button", { name: "Remove" }));

    expect(screen.queryByLabelText("Condition")).not.toBeInTheDocument();
    // The toggle itself reflects the cleared state - unchecked, not checked-with-no-rules.
    expect(screen.getByLabelText(/Only show this row when/)).not.toBeChecked();
  });

  it("changing the flag or the polarity commits through the layout", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByLabelText(/Only show this row when/));

    await user.selectOptions(screen.getByLabelText("Condition"), "IS_MIDTERM");
    await user.selectOptions(screen.getByLabelText("is / is not"), "false");

    expect(screen.getByLabelText("Condition")).toHaveValue("IS_MIDTERM");
    expect(screen.getByLabelText("is / is not")).toHaveValue("false");
  });
});
