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
});
