import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as templatesApi from "@/api/resultTemplates";
import type { ResultTemplateView } from "@/api/resultTemplates";
import TemplateDesignerPage from "@/features/reporting/TemplateDesignerPage";
import {
  buildEarlyYearsProgressReportLayout,
  buildStandardResultSheetLayout,
} from "@/features/reporting/components/designer/starterLayouts";
import type { ReportLayout } from "@/features/reporting/components/designer/layout";

vi.mock("@/api/resultTemplates", async () => {
  const actual = await vi.importActual<typeof import("@/api/resultTemplates")>("@/api/resultTemplates");
  return {
    ...actual,
    getResultTemplate: vi.fn(),
    updateResultTemplate: vi.fn(),
    previewResultTemplate: vi.fn(),
    publishResultTemplate: vi.fn(),
    retireResultTemplate: vi.fn(),
  };
});

const NUMERIC_TEMPLATE: ResultTemplateView = {
  id: "template-1",
  name: "Standard result sheet",
  description: "A description",
  assessmentMode: "NUMERIC",
  baseLevel: "PRIMARY",
  layout: buildStandardResultSheetLayout(),
  status: "DRAFT",
  createdBy: "admin-1",
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
};

const QUALITATIVE_TEMPLATE: ResultTemplateView = {
  ...NUMERIC_TEMPLATE,
  assessmentMode: "QUALITATIVE",
  layout: buildEarlyYearsProgressReportLayout(),
};

function renderPage() {
  const router = createMemoryRouter(
    [{ path: "/admin/templates/:templateId", element: <TemplateDesignerPage /> }],
    { initialEntries: ["/admin/templates/template-1"] },
  );
  render(<RouterProvider router={router} />);
}

describe("TemplateDesignerPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(templatesApi.getResultTemplate).mockResolvedValue(NUMERIC_TEMPLATE);
  });

  it("loads the template and shows a mode-filtered block palette", async () => {
    renderPage();

    expect(await screen.findByDisplayValue("Standard result sheet")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Score table/ })).toBeInTheDocument();
    // RATING_TABLE is QUALITATIVE-only - never offered on a NUMERIC template's palette,
    // the bug the old GrapesJS designer had (see BlockPalette's module comment).
    expect(screen.queryByRole("button", { name: /Rating table/ })).not.toBeInTheDocument();
  });

  it("offers the Student photo block on a NUMERIC template", async () => {
    renderPage();
    expect(await screen.findByDisplayValue("Standard result sheet")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Student photo/ })).toBeInTheDocument();
  });

  it("offers the Student photo block on a QUALITATIVE template too", async () => {
    vi.mocked(templatesApi.getResultTemplate).mockResolvedValue(QUALITATIVE_TEMPLATE);
    renderPage();
    expect(await screen.findByDisplayValue("Standard result sheet")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Student photo/ })).toBeInTheDocument();
  });

  it("Save sends the current layout back to the API", async () => {
    const user = userEvent.setup();
    vi.mocked(templatesApi.updateResultTemplate).mockResolvedValue(NUMERIC_TEMPLATE);
    renderPage();
    await screen.findByDisplayValue("Standard result sheet");

    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(templatesApi.updateResultTemplate).toHaveBeenCalledWith(
      "template-1",
      expect.objectContaining({ name: "Standard result sheet", layout: expect.any(Object) }),
    ));
    expect(await screen.findByText("Template saved.")).toBeInTheDocument();
  });

  it("Publish saves first, then publishes - fixing the old flow that could publish stale content", async () => {
    const user = userEvent.setup();
    vi.mocked(templatesApi.updateResultTemplate).mockResolvedValue(NUMERIC_TEMPLATE);
    vi.mocked(templatesApi.publishResultTemplate).mockResolvedValue({ ...NUMERIC_TEMPLATE, status: "PUBLISHED" });
    renderPage();
    await screen.findByDisplayValue("Standard result sheet");

    await user.click(screen.getByRole("button", { name: "Publish" }));

    await waitFor(() => expect(templatesApi.updateResultTemplate).toHaveBeenCalled());
    expect(templatesApi.publishResultTemplate).toHaveBeenCalledWith("template-1");
  });

  it("clicking a palette block appends it to the canvas and marks the template dirty", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByDisplayValue("Standard result sheet");

    expect(screen.getByRole("button", { name: "Undo" })).toBeDisabled();

    await user.click(screen.getByRole("button", { name: /Attendance summary/ }));

    expect(screen.getByRole("button", { name: "Undo" })).not.toBeDisabled();
  });

  it("clicking a palette block with an element selected inserts it right after that element, not at the end", async () => {
    const user = userEvent.setup();
    const layout: ReportLayout = {
      version: 1,
      page: { paddingPx: 24, fontFamily: "Helvetica, Arial, sans-serif", fontSizePx: 12, color: "#1a1a1a" },
      rows: [
        {
          id: "row-1",
          columns: [
            {
              id: "col-1",
              widthPercent: 100,
              elements: [
                { id: "el-1", type: "TEXT", text: "First element" },
                { id: "el-2", type: "TEXT", text: "Second element" },
              ],
            },
          ],
        },
      ],
    };
    vi.mocked(templatesApi.getResultTemplate).mockResolvedValue({ ...NUMERIC_TEMPLATE, layout });
    renderPage();
    await screen.findByDisplayValue("Standard result sheet");

    await user.click(screen.getByText("First element"));
    await user.click(screen.getByRole("button", { name: "Spacer" }));

    // Spacer's preview renders "<n>px gap" - a unique marker to locate it in document order
    // against the two text elements, since the palette caption should have said it would
    // land right after the selected "First element", not at the canvas's very end.
    const text = document.body.textContent ?? "";
    expect(text.indexOf("First element")).toBeLessThan(text.indexOf("px gap"));
    expect(text.indexOf("px gap")).toBeLessThan(text.indexOf("Second element"));
  });

  it("the palette caption reflects where a click will insert", async () => {
    const user = userEvent.setup();
    const layout: ReportLayout = {
      version: 1,
      page: { paddingPx: 24, fontFamily: "Helvetica, Arial, sans-serif", fontSizePx: 12, color: "#1a1a1a" },
      rows: [{ id: "row-1", columns: [{ id: "col-1", widthPercent: 100, elements: [{ id: "el-1", type: "TEXT", text: "Only element" }] }] }],
    };
    vi.mocked(templatesApi.getResultTemplate).mockResolvedValue({ ...NUMERIC_TEMPLATE, layout });
    renderPage();
    await screen.findByDisplayValue("Standard result sheet");

    expect(screen.getByText(/adds it to the end of the canvas/i)).toBeInTheDocument();

    await user.click(screen.getByText("Only element"));

    expect(screen.getByText(/inserts it right after the selected element/i)).toBeInTheDocument();
  });
});
