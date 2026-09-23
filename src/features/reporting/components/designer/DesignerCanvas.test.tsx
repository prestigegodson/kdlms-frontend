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

/** Renders `editor.canUndo`/`editor.selection` alongside the canvas so a test can assert on state `DesignerCanvas` itself exposes no way to read back. */
function Harness({ initial }: { initial?: ReportLayout } = {}) {
  const editor = useLayoutEditor(initial ?? blankLayout());
  return (
    <div>
      <span data-testid="can-undo">{String(editor.canUndo)}</span>
      <span data-testid="selection">{JSON.stringify(editor.selection)}</span>
      <DesignerCanvas editor={editor} />
    </div>
  );
}

function layoutWithConditionalRow(): ReportLayout {
  return {
    version: 1,
    page: { paddingPx: 24, fontFamily: "Helvetica, Arial, sans-serif", fontSizePx: 12, color: "#1a1a1a" },
    rows: [
      {
        id: "row-1",
        condition: { match: "ALL", rules: [{ flag: "HAS_CLASS_TEACHER_REMARK", expected: true }] },
        columns: [{ id: "col-1", widthPercent: 100, elements: [{ id: "el-1", type: "TEXT", text: "Row one text" }] }],
      },
    ],
  };
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

describe("DesignerCanvas conditional row badge", () => {
  it("shows a Conditional badge on a row with a visibility condition", () => {
    render(<Harness initial={layoutWithConditionalRow()} />);

    expect(screen.getByText("Conditional")).toBeInTheDocument();
  });

  it("does not show a Conditional badge on an unconditional row", () => {
    render(<Harness />);

    expect(screen.queryByText("Conditional")).not.toBeInTheDocument();
  });

  it("includes Conditional in the collapsed row summary", async () => {
    const user = userEvent.setup();
    render(<Harness initial={layoutWithConditionalRow()} />);

    await user.click(screen.getByRole("button", { name: "Collapse row" }));

    expect(screen.getByText(/Row 1 · 1 column · 1 element · Conditional/)).toBeInTheDocument();
  });
});

describe("DesignerCanvas row selection", () => {
  it("an expanded row has an always-present, labeled handle that selects it", () => {
    render(<Harness />);

    // Regression guard: this must be reachable without hovering (jsdom applies no real hover
    // state, so its mere presence in the DOM - not just a CSS opacity toggle - is what matters).
    expect(screen.getByRole("button", { name: "Row 1" })).toBeInTheDocument();
  });

  it("clicking the Row handle selects the row, not whatever element is inside it", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    expect(screen.getByTestId("selection")).toHaveTextContent("null");

    await user.click(screen.getByRole("button", { name: "Row 1" }));

    expect(screen.getByTestId("selection")).toHaveTextContent(JSON.stringify({ type: "row", rowId: "row-1" }));
  });

  it("clicking an element on the canvas selects that element, never the row it lives in", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(screen.getByText("Row one text"));

    expect(screen.getByTestId("selection")).toHaveTextContent('"type":"element"');
    expect(screen.getByTestId("selection")).not.toHaveTextContent('"type":"row"');
  });
});
