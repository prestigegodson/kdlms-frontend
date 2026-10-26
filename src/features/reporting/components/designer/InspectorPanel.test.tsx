import { fireEvent, render, screen } from "@testing-library/react";
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

function TableBlockHarness({ onLayout }: { onLayout: (layout: ReportLayout) => void }) {
  const layout = blankLayout();
  layout.page.headerColors = { headerBackground: "#003366" };
  layout.rows[0].columns[0].elements = [{ id: "el-1", type: "BLOCK", block: "RATING_TABLE" }];
  const editor = useLayoutEditor(layout);
  if (editor.selection === null) editor.setSelection({ type: "element", elementId: "el-1" });
  onLayout(editor.layout);
  return <InspectorPanel editor={editor} />;
}

describe("InspectorPanel table header colors", () => {
  it("a table block shows the template default and can override then reset it", async () => {
    const user = userEvent.setup();
    let latest: ReportLayout | undefined;
    render(<TableBlockHarness onLayout={(layout) => (latest = layout)} />);

    const headerBackground = screen.getByLabelText("Header background");
    expect(headerBackground).toHaveValue("#003366");
    expect(screen.getByLabelText("Subject group row background")).toHaveValue("#e8e8e8");
    expect(screen.queryByText("Use template default")).not.toBeInTheDocument();

    fireEvent.input(headerBackground, { target: { value: "#8b0000" } });
    const block = () => latest!.rows[0].columns[0].elements[0];
    expect(block().style?.headerColors).toEqual({ headerBackground: "#8b0000" });

    await user.click(screen.getByText("Use template default"));
    expect(block().style?.headerColors).toBeUndefined();
    expect(screen.getByLabelText("Header background")).toHaveValue("#003366");
  });
});

function SelectionHarness({
  selectElement,
  elements = [],
  onLayout,
}: {
  selectElement?: string;
  elements?: ReportLayout["rows"][number]["columns"][number]["elements"];
  onLayout: (layout: ReportLayout) => void;
}) {
  const layout = blankLayout();
  layout.page.color = "#224466";
  layout.rows[0].columns[0].elements = elements;
  const editor = useLayoutEditor(layout);
  if (editor.selection === null) editor.setSelection(selectElement ? { type: "element", elementId: selectElement } : { type: "page" });
  onLayout(editor.layout);
  return <InspectorPanel editor={editor} />;
}

describe("InspectorPanel color reset", () => {
  it("page text color can be reset to the starter default", async () => {
    const user = userEvent.setup();
    let latest: ReportLayout | undefined;
    render(<SelectionHarness onLayout={(layout) => (latest = layout)} />);

    expect(screen.getByLabelText("Text color")).toHaveValue("#224466");
    await user.click(screen.getByText("Reset to default"));

    expect(latest!.page.color).toBe("#1a1a1a");
    expect(screen.queryByText("Reset to default")).not.toBeInTheDocument();
  });

  it("element text color falls back to the page color and can be reset to it", async () => {
    const user = userEvent.setup();
    let latest: ReportLayout | undefined;
    render(
      <SelectionHarness
        selectElement="el-1"
        elements={[{ id: "el-1", type: "TEXT", text: "Hi" }]}
        onLayout={(layout) => (latest = layout)}
      />,
    );

    const picker = screen.getByLabelText("Text color");
    expect(picker).toHaveValue("#224466");
    expect(screen.queryByText("Use page text color")).not.toBeInTheDocument();

    fireEvent.input(picker, { target: { value: "#8b0000" } });
    const element = () => latest!.rows[0].columns[0].elements[0];
    expect(element().style?.color).toBe("#8b0000");

    await user.click(screen.getByText("Use page text color"));
    expect(element().style?.color).toBeUndefined();
  });

  it("divider line color can be reset to its default", async () => {
    const user = userEvent.setup();
    let latest: ReportLayout | undefined;
    render(
      <SelectionHarness selectElement="el-1" elements={[{ id: "el-1", type: "DIVIDER" }]} onLayout={(layout) => (latest = layout)} />,
    );

    const picker = screen.getByLabelText("Line color");
    expect(picker).toHaveValue("#cccccc");
    fireEvent.input(picker, { target: { value: "#8b0000" } });
    await user.click(screen.getByText("Reset to default"));

    expect(latest!.rows[0].columns[0].elements[0].style?.color).toBeUndefined();
    expect(screen.getByLabelText("Line color")).toHaveValue("#cccccc");
  });
});
