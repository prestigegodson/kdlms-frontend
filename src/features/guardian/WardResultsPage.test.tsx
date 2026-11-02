import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider, useParams } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as wardsApi from "@/api/wards";
import { WardResultsPage } from "@/features/guardian/WardResultsPage";
import { resetAuthStore, useAuthStore } from "@/stores/authStore";
import { resetWardStore, useWardStore } from "@/stores/wardStore";

vi.mock("@/api/wards", async () => {
  const actual = await vi.importActual<typeof import("@/api/wards")>("@/api/wards");
  return { ...actual, listMyWards: vi.fn() };
});

const WARD = {
  studentId: "s1",
  fullName: "Ada Obi",
  admissionNumber: "SCH/2026/0001",
  relationship: "MOTHER",
  gender: "FEMALE" as const,
  currentClassName: "Primary 3",
  status: "ACTIVE",
  schoolId: "school-1",
  schoolName: "Bright Star Academy",
};

const WARD_2 = {
  studentId: "s2",
  fullName: "Bode Obi",
  admissionNumber: "SUN/2026/0007",
  relationship: "FATHER",
  gender: "MALE" as const,
  status: "ACTIVE",
  schoolId: "school-2",
  schoolName: "Sunrise Academy",
};

function WardResultsStub() {
  const { studentId } = useParams();
  return <p>Results for {studentId}</p>;
}

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
      { path: "/", element: <WardResultsPage /> },
      { path: "/guardian/results/:studentId", element: <WardResultsStub /> },
    ],
    { initialEntries: ["/"] },
  );
  render(<RouterProvider router={router} />);
}

describe("WardResultsPage (entry point - redirects to a ward)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetWardStore();
  });

  it("shows an empty state when the guardian has no linked wards", async () => {
    vi.mocked(wardsApi.listMyWards).mockResolvedValue([]);

    renderPage();

    expect(await screen.findByText("No wards linked yet")).toBeInTheDocument();
  });

  it("shows a retryable error state when the ward list fails to load", async () => {
    vi.mocked(wardsApi.listMyWards).mockRejectedValueOnce(new Error("network down")).mockResolvedValue([WARD]);
    const user = userEvent.setup();

    renderPage();

    expect(await screen.findByRole("button", { name: "Try again" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Try again" }));

    expect(await screen.findByText("Results for s1")).toBeInTheDocument();
  });

  it("redirects to the first ward's results when none is selected yet", async () => {
    vi.mocked(wardsApi.listMyWards).mockResolvedValue([WARD, WARD_2]);

    renderPage();

    expect(await screen.findByText("Results for s1")).toBeInTheDocument();
  });

  it("redirects to the already-selected ward's results", async () => {
    vi.mocked(wardsApi.listMyWards).mockResolvedValue([WARD, WARD_2]);
    useWardStore.setState({ selectedWardId: "s2" });

    renderPage();

    expect(await screen.findByText("Results for s2")).toBeInTheDocument();
  });
});
