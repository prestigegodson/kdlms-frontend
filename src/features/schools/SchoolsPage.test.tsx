import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as schoolsApi from "@/api/schools";
import type { SchoolView } from "@/api/schools";
import { SchoolsPage } from "@/features/schools/SchoolsPage";

vi.mock("@/api/schools", async () => {
  const actual = await vi.importActual<typeof import("@/api/schools")>("@/api/schools");
  return { ...actual, listSchools: vi.fn(), createSchool: vi.fn() };
});

const SCHOOL: SchoolView = {
  id: "school-1",
  name: "Bright Stars Academy",
  code: "BSA",
  status: "ACTIVE",
};

function mockSchools(schools: SchoolView[]) {
  vi.mocked(schoolsApi.listSchools).mockResolvedValue({
    content: schools,
    totalElements: schools.length,
    totalPages: 1,
    number: 0,
    size: 20,
  });
}

function renderPage() {
  const router = createMemoryRouter(
    [
      { path: "/", element: <SchoolsPage /> },
      { path: "/admin/schools/:schoolId", element: <div>School detail page</div> },
    ],
    { initialEntries: ["/"] },
  );
  render(<RouterProvider router={router} />);
}

describe("SchoolsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("lists schools with their code and status", async () => {
    mockSchools([SCHOOL]);

    renderPage();

    expect(await screen.findByText("Bright Stars Academy")).toBeInTheDocument();
    expect(screen.getByText("BSA")).toBeInTheDocument();
    expect(screen.getByText("ACTIVE")).toBeInTheDocument();
  });

  it("navigates to the school detail route when a row is tapped", async () => {
    mockSchools([SCHOOL]);
    const user = userEvent.setup();

    renderPage();
    await screen.findByText("Bright Stars Academy");

    const row = screen.getByText("Bright Stars Academy").closest("tr")!;
    expect(row).toHaveAttribute("tabindex", "0");

    await user.click(row);

    expect(await screen.findByText("School detail page")).toBeInTheDocument();
  });
});
