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
});
