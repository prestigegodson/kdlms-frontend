import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as templatesApi from "@/api/resultTemplates";
import type { ResultTemplateSummary } from "@/api/resultTemplates";
import * as schoolsApi from "@/api/schools";
import { ResultTemplatesPage } from "@/features/reporting/ResultTemplatesPage";

vi.mock("@/api/resultTemplates", async () => {
  const actual = await vi.importActual<typeof import("@/api/resultTemplates")>("@/api/resultTemplates");
  return {
    ...actual,
    listResultTemplates: vi.fn(),
    deleteResultTemplate: vi.fn(),
    publishResultTemplate: vi.fn(),
    retireResultTemplate: vi.fn(),
    duplicateResultTemplate: vi.fn(),
  };
});

vi.mock("@/api/schools", async () => {
  const actual = await vi.importActual<typeof import("@/api/schools")>("@/api/schools");
  return { ...actual, listSchools: vi.fn() };
});

const TEMPLATE: ResultTemplateSummary = {
  id: "template-1",
  name: "Standard result sheet",
  assessmentMode: "NUMERIC",
  baseLevel: "PRIMARY",
  status: "DRAFT",
  updatedAt: "2026-01-01T00:00:00Z",
};

function mockTemplates(templates: ResultTemplateSummary[]) {
  vi.mocked(templatesApi.listResultTemplates).mockResolvedValue({
    content: templates,
    totalElements: templates.length,
    totalPages: 1,
    number: 0,
    size: 200,
  });
}

function renderPage() {
  const router = createMemoryRouter(
    [
      { path: "/", element: <ResultTemplatesPage /> },
      { path: "/admin/templates/:templateId", element: <div>Template designer page</div> },
    ],
    { initialEntries: ["/"] },
  );
  render(<RouterProvider router={router} />);
}

describe("ResultTemplatesPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(schoolsApi.listSchools).mockResolvedValue({
      content: [],
      totalElements: 0,
      totalPages: 1,
      number: 0,
      size: 500,
    });
  });

  it("navigates to the designer route when a row is tapped", async () => {
    mockTemplates([TEMPLATE]);
    const user = userEvent.setup();

    renderPage();
    await screen.findByText("Standard result sheet");

    const row = screen.getByText("Standard result sheet").closest("tr")!;
    expect(row).toHaveAttribute("tabindex", "0");

    await user.click(row);

    expect(await screen.findByText("Template designer page")).toBeInTheDocument();
  });

  it("Delete opens its confirmation dialog without navigating the row", async () => {
    mockTemplates([TEMPLATE]);
    const user = userEvent.setup();

    renderPage();
    await screen.findByText("Standard result sheet");

    // The row itself is also a nav target (TableRow's `to`) - clicking the
    // inline Delete action must stop propagation rather than also navigating away.
    await user.click(screen.getByRole("button", { name: "Delete" }));

    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("Standard result sheet")).toBeInTheDocument();
    expect(screen.queryByText("Template designer page")).not.toBeInTheDocument();
  });

  it("Duplicate opens a modal prefilled from the source and navigates to the new template on submit", async () => {
    mockTemplates([TEMPLATE]);
    vi.mocked(templatesApi.duplicateResultTemplate).mockResolvedValue({
      id: "template-2",
      name: "Copy of Standard result sheet",
      assessmentMode: "NUMERIC",
      baseLevel: "PRIMARY",
      layout: {
        version: 1,
        page: { paddingPx: 24, fontFamily: "Helvetica, Arial, sans-serif", fontSizePx: 12, color: "#000" },
        rows: [],
      },
      status: "DRAFT",
      createdBy: "user-1",
      createdAt: "2026-01-01T00:00:00Z",
      updatedAt: "2026-01-01T00:00:00Z",
    });
    const user = userEvent.setup();

    renderPage();
    await screen.findByText("Standard result sheet");

    await user.click(screen.getByRole("button", { name: "Duplicate" }));

    const dialog = await screen.findByRole("dialog");
    expect(dialog).toHaveTextContent("Duplicate template");
    const nameInput = screen.getByLabelText("Name") as HTMLInputElement;
    expect(nameInput.value).toBe("Copy of Standard result sheet");

    await user.click(screen.getByRole("button", { name: "Duplicate and design" }));

    expect(templatesApi.duplicateResultTemplate).toHaveBeenCalledWith("template-1", {
      name: "Copy of Standard result sheet",
      description: undefined,
      baseLevel: "PRIMARY",
      schoolId: undefined,
    });
    expect(await screen.findByText("Template designer page")).toBeInTheDocument();
  });

  it("shows an error in the Duplicate modal when the request fails", async () => {
    mockTemplates([TEMPLATE]);
    vi.mocked(templatesApi.duplicateResultTemplate).mockRejectedValue(new Error("boom"));
    const user = userEvent.setup();

    renderPage();
    await screen.findByText("Standard result sheet");

    await user.click(screen.getByRole("button", { name: "Duplicate" }));
    await screen.findByRole("dialog");
    await user.click(screen.getByRole("button", { name: "Duplicate and design" }));

    expect(await screen.findByText("Failed to duplicate template")).toBeInTheDocument();
    expect(screen.queryByText("Template designer page")).not.toBeInTheDocument();
  });
});
