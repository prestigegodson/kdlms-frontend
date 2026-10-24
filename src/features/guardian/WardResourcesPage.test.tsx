import { render, screen } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { MyLearningResourceSummaryView } from "@/api/learning";
import * as wardsApi from "@/api/wards";
import { WardResourcesPage } from "@/features/guardian/WardResourcesPage";
import { resetWardStore } from "@/stores/wardStore";

vi.mock("@/api/wards", async () => {
  const actual = await vi.importActual<typeof import("@/api/wards")>("@/api/wards");
  return {
    ...actual,
    listMyWards: vi.fn(),
    listWardLearningResources: vi.fn(),
  };
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

function row(overrides: Partial<MyLearningResourceSummaryView>): MyLearningResourceSummaryView {
  return {
    id: "r1",
    title: "Fractions",
    description: null,
    subjectName: "Mathematics",
    resourceType: "RICH_TEXT",
    durationSeconds: null,
    position: 0,
    completed: false,
    availableUntil: null,
    cardKind: "SUBJECT",
    cardId: "math",
    cardName: "Mathematics",
    visibleSince: "2026-10-01T09:00:00Z",
    opened: false,
    ...overrides,
  };
}

function renderPage() {
  const router = createMemoryRouter([{ path: "/guardian/resources", element: <WardResourcesPage /> }], {
    initialEntries: ["/guardian/resources"],
  });
  render(<RouterProvider router={router} />);
}

describe("WardResourcesPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetWardStore();
  });

  it("shows an empty state when the guardian has no linked wards", async () => {
    vi.mocked(wardsApi.listMyWards).mockResolvedValue([]);

    renderPage();

    expect(await screen.findByText("No wards linked yet")).toBeInTheDocument();
    expect(wardsApi.listWardLearningResources).not.toHaveBeenCalled();
  });

  it("groups the ward's resources by subject with the ward's progress, linking to each one", async () => {
    vi.mocked(wardsApi.listMyWards).mockResolvedValue([WARD]);
    vi.mocked(wardsApi.listWardLearningResources).mockResolvedValue([
      row({ id: "r1", title: "Fractions", completed: true, opened: true }),
      row({ id: "r2", title: "Decimals worksheet", resourceType: "PDF", opened: false }),
      row({ id: "r3", title: "Reading", cardId: "eng", cardName: "English", subjectName: "English", opened: true }),
    ]);

    renderPage();

    expect(await screen.findByRole("heading", { name: "Mathematics" })).toBeInTheDocument();
    expect(screen.getByText("2 resources")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "English" })).toBeInTheDocument();
    expect(screen.getByText("1 resource")).toBeInTheDocument();
    expect(wardsApi.listWardLearningResources).toHaveBeenCalledWith("s1");
    expect(screen.getByText("Done")).toBeInTheDocument();
    expect(screen.getByText("Not opened")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "PDF" })).toBeInTheDocument();
    expect(screen.getAllByRole("img", { name: "Note" })).toHaveLength(2);
    expect(screen.getByRole("link", { name: /Fractions/ })).toHaveAttribute("href", "/guardian/resources/s1/r1");
  });

  it("shows an empty state when the ward has no resources this term", async () => {
    vi.mocked(wardsApi.listMyWards).mockResolvedValue([WARD]);
    vi.mocked(wardsApi.listWardLearningResources).mockResolvedValue([]);

    renderPage();

    expect(await screen.findByText("No resources yet")).toBeInTheDocument();
  });
});
