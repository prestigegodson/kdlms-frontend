import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as creatorsApi from "@/api/creators";
import * as dashboardApi from "@/api/dashboard";
import type { CreatorAdminView } from "@/api/creators";
import { CreatorsPage } from "@/features/creators/admin/CreatorsPage";

vi.mock("@/api/tutorCurrencies");
vi.mock("@/api/creators", async () => {
  const actual = await vi.importActual<typeof import("@/api/creators")>("@/api/creators");
  return { ...actual, listCreators: vi.fn(), onboardCreator: vi.fn() };
});

vi.mock("@/api/dashboard", async () => {
  const actual = await vi.importActual<typeof import("@/api/dashboard")>("@/api/dashboard");
  return { ...actual, getCreatorDashboard: vi.fn() };
});

const CREATOR: CreatorAdminView = {
  schoolId: "tenant-1",
  businessName: "Analytical Tutors",
  firstName: "Ada",
  lastName: "Lovelace",
  contactAddress: "1 Marina",
  mobile: "+2348000000000",
  timezone: "Africa/Lagos",
  currency: "NGN",
  status: "ACTIVE",
  userId: "user-1",
  email: "ada@creator.example",
  emailVerified: false,
  createdAt: "2026-10-03T10:00:00Z",
};

function renderPage() {
  const router = createMemoryRouter(
    [
      { path: "/", element: <CreatorsPage /> },
      { path: "/admin/tutors/:schoolId", element: <div>Tutor detail page</div> },
    ],
    { initialEntries: ["/"] },
  );
  render(<RouterProvider router={router} />);
}

describe("CreatorsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(dashboardApi.getCreatorDashboard).mockReturnValue(new Promise(() => {}));
    vi.mocked(creatorsApi.listCreators).mockResolvedValue({
      content: [CREATOR],
      totalElements: 1,
      totalPages: 1,
      number: 0,
      size: 20,
    });
  });

  it("lists tutors with their email, verification and status", async () => {
    renderPage();

    expect(await screen.findByText("Analytical Tutors")).toBeInTheDocument();
    expect(screen.getByText("ada@creator.example")).toBeInTheDocument();
    expect(screen.getByText("Unverified")).toBeInTheDocument();
    expect(screen.getByText("ACTIVE")).toBeInTheDocument();
  });

  it("still lists tutors when the overview fails to load", async () => {
    vi.mocked(dashboardApi.getCreatorDashboard).mockRejectedValue(new Error("boom"));
    renderPage();

    expect(await screen.findByText("Failed to load the tutors overview")).toBeInTheDocument();
    expect(await screen.findByText("Analytical Tutors")).toBeInTheDocument();
  });

  it("searches by the typed query", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("Analytical Tutors");

    await user.type(screen.getByPlaceholderText("Search business, name or email"), "ada");

    await vi.waitFor(() => expect(creatorsApi.listCreators).toHaveBeenLastCalledWith("ada", 0, 20));
  });

  it("opens the tutor's detail page when a row is tapped", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click((await screen.findByText("Analytical Tutors")).closest("tr")!);

    expect(await screen.findByText("Tutor detail page")).toBeInTheDocument();
  });
});
