import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { DesignerCanvas } from "@/features/reporting/components/designer/DesignerCanvas";
import { useLayoutEditor } from "@/features/reporting/components/designer/useLayoutEditor";
import type { ReportLayout } from "@/features/reporting/components/designer/layout";

function blankLayout(): ReportLayout {
  return {
    version: 1,
    page: { paddingPx: 24, fontFamily: "Helvetica, Arial, sans-serif", fontSizePx: 12, color: "#1a1a1a" },
    rows: [
      {
        id: "row-1",
        columns: [{ id: "col-1", widthPercent: 100, elements: [{ id: "el-1", type: "TEXT", text: "Row one text" }] }],
      },
    ],
  };
}

/** Renders `editor.canUndo` alongside the canvas so a test can assert row-collapse never pushes undo history - `DesignerCanvas` itself exposes no such affordance. */
function Harness() {
  const editor = useLayoutEditor(blankLayout());
  return (
    <div>
      <span data-testid="can-undo">{String(editor.canUndo)}</span>
      <DesignerCanvas editor={editor} />
    </div>
  );
}

describe("DesignerCanvas row collapsing", () => {
  it("collapsing a row via its toggle hides its content behind a one-line summary", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    expect(screen.getByText("Row one text")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Collapse row" }));

    expect(screen.queryByText("Row one text")).not.toBeInTheDocument();
    expect(screen.getByText(/Row 1 · 1 column · 1 element/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Expand row" }));

    expect(screen.getByText("Row one text")).toBeInTheDocument();
  });

  it("collapsing a row is view-only and never pushes undo history", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    expect(screen.getByTestId("can-undo")).toHaveTextContent("false");

    await user.click(screen.getByRole("button", { name: "Collapse row" }));

    expect(screen.getByTestId("can-undo")).toHaveTextContent("false");
  });

  it("Collapse all / Expand all only appear once there is more than one row, and toggle every row at once", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    expect(screen.queryByRole("button", { name: "Collapse all" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Add row" }));
    expect(screen.getByRole("button", { name: "Collapse all" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Collapse all" }));
    expect(screen.queryByText("Row one text")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Expand all" }));
    expect(screen.getByText("Row one text")).toBeInTheDocument();
  });
});
