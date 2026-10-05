import { render, screen } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as classResourcesApi from "@/api/classLearningResources";
import { ApiError } from "@/api/client";
import type { MyLearningResourceSummaryView } from "@/api/learning";
import * as onlineClassesApi from "@/api/onlineClasses";
import type { OnlineClass } from "@/api/onlineClasses";
import { ClassResourcesPage } from "./ClassResourcesPage";

vi.mock("@/api/classLearningResources", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/api/classLearningResources")>()),
  listMemberClassResources: vi.fn(),
}));
vi.mock("@/api/onlineClasses");

const ENGLISH: OnlineClass = {
  id: "c1",
  name: "English",
  description: null,
  subjectLabel: null,
  creatorName: "Ada's Studio",
  timezone: "Africa/Lagos",
  startDate: "2026-10-01",
  endDate: null,
  slots: [],
  upcoming: [],
  remindersEnabled: true,
};

function resource(overrides: Partial<MyLearningResourceSummaryView>): MyLearningResourceSummaryView {
  return {
    id: "r1",
    title: "Reading notes",
    description: null,
    subjectName: "",
    resourceType: "RICH_TEXT",
    durationSeconds: null,
    position: 0,
    completed: false,
    availableUntil: null,
    ...overrides,
  };
}

function renderAt(path: string, audience: "LEARNER" | "GUARDIAN") {
  const router = createMemoryRouter([{ path: "/resources", element: <ClassResourcesPage audience={audience} /> }], {
    initialEntries: [path],
  });
  render(<RouterProvider router={router} />);
}

describe("ClassResourcesPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(onlineClassesApi.listMyOnlineClasses).mockResolvedValue([ENGLISH]);
    vi.mocked(onlineClassesApi.listWardOnlineClasses).mockResolvedValue([
      { learnerId: "l1", firstName: "Kemi", lastName: "Ola", classes: [ENGLISH] },
    ]);
  });

  it("links a learner's resources to their own detail page and marks finished ones", async () => {
    vi.mocked(classResourcesApi.listMemberClassResources).mockResolvedValue({
      classId: "c1",
      className: "English",
      resources: [resource({ completed: true }), resource({ id: "r2", title: "Phonics", resourceType: "YOUTUBE" })],
    });
    renderAt("/resources", "LEARNER");

    const link = await screen.findByRole("link", { name: /Reading notes/ });
    expect(link).toHaveAttribute("href", "/learner/resources/c1/r1");
    expect(screen.getByText("Done")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Phonics/ })).toHaveAttribute("href", "/learner/resources/c1/r2");
    expect(classResourcesApi.listMemberClassResources).toHaveBeenCalledWith({ classId: "c1", learnerId: undefined });
  });

  it("links a guardian's rows through the child they follow, with no progress badge", async () => {
    vi.mocked(classResourcesApi.listMemberClassResources).mockResolvedValue({
      classId: "c1",
      className: "English",
      resources: [resource({ completed: true })],
    });
    renderAt("/resources", "GUARDIAN");

    const link = await screen.findByRole("link", { name: /Reading notes/ });
    expect(link).toHaveAttribute("href", "/guardian/class-resources/l1/c1/r1");
    expect(screen.queryByText("Done")).not.toBeInTheDocument();
    expect(classResourcesApi.listMemberClassResources).toHaveBeenCalledWith({ classId: "c1", learnerId: "l1" });
  });

  it("explains when the tutor's plan doesn't include resources", async () => {
    vi.mocked(classResourcesApi.listMemberClassResources).mockRejectedValue(
      new ApiError(403, "Learning resources are not included in the current plan."),
    );
    renderAt("/resources", "LEARNER");

    expect(await screen.findByText("Resources aren't available")).toBeInTheDocument();
    expect(screen.getByText("Learning resources are not included in the current plan.")).toBeInTheDocument();
  });
});
