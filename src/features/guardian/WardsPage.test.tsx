import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as wardsApi from "@/api/wards";
import { WardsPage } from "@/features/guardian/WardsPage";
import { resetAuthStore, useAuthStore } from "@/stores/authStore";
import { resetWardStore, useWardStore } from "@/stores/wardStore";

vi.mock("@/api/wards", async () => {
  const actual = await vi.importActual<typeof import("@/api/wards")>("@/api/wards");
  return { ...actual, listMyWards: vi.fn(), listWardTerms: vi.fn(), getWardAttendance: vi.fn() };
});

function renderPage() {
  resetAuthStore();
  useAuthStore.setState({
    user: {
      id: "guardian-1",
      email: "guardian@example.com",
      firstName: "Gina",
      lastName: "G",
      role: "GUARDIAN",
      schoolId: "school-1",
    },
    accessToken: "access",
    refreshToken: "refresh",
  });
  const router = createMemoryRouter(
    [
      { path: "/", element: <WardsPage /> },
      { path: "/guardian/results", element: <p>Results page</p> },
    ],
    { initialEntries: ["/"] },
  );
  render(<RouterProvider router={router} />);
}

describe("WardsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetWardStore();
    vi.mocked(wardsApi.listWardTerms).mockResolvedValue([]);
    vi.mocked(wardsApi.getWardAttendance).mockRejectedValue(new Error("no term"));
  });

  it("shows an empty state when the guardian has no linked wards", async () => {
    vi.mocked(wardsApi.listMyWards).mockResolvedValue([]);

    renderPage();

    expect(await screen.findByText("No wards linked yet")).toBeInTheDocument();
  });

  it("renders a card per linked ward", async () => {
    vi.mocked(wardsApi.listMyWards).mockResolvedValue([
      {
        studentId: "s1",
        fullName: "Ada Obi",
        admissionNumber: "SCH/2026/0001",
        relationship: "MOTHER",
        gender: "FEMALE",
        currentClassName: "Primary 3",
        levelName: "Primary",
        status: "ACTIVE",
        schoolId: "school-1",
        schoolName: "Bright Star Academy",
      },
    ]);

    renderPage();

    expect(await screen.findByText("Ada Obi")).toBeInTheDocument();
    expect(screen.getByText("SCH/2026/0001")).toBeInTheDocument();
    expect(screen.getByText("Primary 3")).toBeInTheDocument();
  });

  it("does not render a separate 'View results' button - the card itself is the results tap target", async () => {
    vi.mocked(wardsApi.listMyWards).mockResolvedValue([
      {
        studentId: "s1",
        fullName: "Ada Obi",
        admissionNumber: "SCH/2026/0001",
        relationship: "MOTHER",
        gender: "FEMALE",
        currentClassName: "Primary 3",
        levelName: "Primary",
        status: "ACTIVE",
        schoolId: "school-1",
        schoolName: "Bright Star Academy",
      },
    ]);

    renderPage();
    await screen.findByText("Ada Obi");

    expect(screen.queryByRole("button", { name: "View results" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "View attendance" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Medical & emergency" })).toBeInTheDocument();
  });

  it("selects the ward and navigates to Results when its card is tapped", async () => {
    vi.mocked(wardsApi.listMyWards).mockResolvedValue([
      {
        studentId: "s1",
        fullName: "Ada Obi",
        admissionNumber: "SCH/2026/0001",
        relationship: "MOTHER",
        gender: "FEMALE",
        currentClassName: "Primary 3",
        levelName: "Primary",
        status: "ACTIVE",
        schoolId: "school-1",
        schoolName: "Bright Star Academy",
      },
    ]);
    const user = userEvent.setup();

    renderPage();
    await screen.findByText("Ada Obi");

    await user.click(screen.getByRole("button", { name: "Ada Obi — view results" }));

    expect(useWardStore.getState().selectedWardId).toBe("s1");
    expect(await screen.findByText("Results page")).toBeInTheDocument();
  });

  it("groups wards under a school heading when the guardian has wards at more than one school", async () => {
    vi.mocked(wardsApi.listMyWards).mockResolvedValue([
      {
        studentId: "s1",
        fullName: "Ada Obi",
        admissionNumber: "SCH/2026/0001",
        relationship: "MOTHER",
        gender: "FEMALE",
        status: "ACTIVE",
        schoolId: "school-1",
        schoolName: "Bright Star Academy",
      },
      {
        studentId: "s2",
        fullName: "Bode Obi",
        admissionNumber: "SUN/2026/0007",
        relationship: "FATHER",
        gender: "MALE",
        status: "ACTIVE",
        schoolId: "school-2",
        schoolName: "Sunrise Academy",
      },
    ]);

    renderPage();

    expect(await screen.findByText("Ada Obi")).toBeInTheDocument();
    expect(screen.getByText("Bode Obi")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Bright Star Academy" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Sunrise Academy" })).toBeInTheDocument();
  });
});
