import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as classResourcesApi from "@/api/classLearningResources";
import type { MyLearningResourceView } from "@/api/learning";
import { ClassResourceDetailPage } from "./ClassResourceDetailPage";

vi.mock("@/api/classLearningResources", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/api/classLearningResources")>()),
  getMemberClassResource: vi.fn(),
  recordLearnerClassResourceInteraction: vi.fn(),
  downloadClassResourceFile: vi.fn(),
  downloadClassResourceFileWithProgress: vi.fn(),
  downloadClassResourceImage: vi.fn(),
}));

const NOTES: MyLearningResourceView = {
  id: "r1",
  title: "Reading notes",
  description: "Read before Monday",
  subjectName: "Literature",
  resourceType: "RICH_TEXT",
  bodyHtml: "<p>Chapter one</p>",
  youtubeVideoId: null,
  durationSeconds: null,
  fileSizeBytes: null,
  commentsEnabled: false,
  completed: false,
  positionSeconds: null,
};

function renderAt(path: string, audience: "LEARNER" | "GUARDIAN") {
  const routePath =
    audience === "GUARDIAN"
      ? "/guardian/class-resources/:learnerId/:classId/:resourceId"
      : "/learner/resources/:classId/:resourceId";
  const router = createMemoryRouter([{ path: routePath, element: <ClassResourceDetailPage audience={audience} /> }], {
    initialEntries: [path],
  });
  render(<RouterProvider router={router} />);
}

describe("ClassResourceDetailPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(classResourcesApi.getMemberClassResource).mockResolvedValue(NOTES);
    vi.mocked(classResourcesApi.recordLearnerClassResourceInteraction).mockImplementation(
      async (_classId, resourceId, request) => ({
        resourceId,
        completed: request.completed ?? false,
        completedAt: request.completed ? "2026-10-05T10:00:00Z" : null,
        positionSeconds: null,
        lastOpenedAt: "2026-10-05T10:00:00Z",
      }),
    );
  });

  it("lets a learner read a resource and mark it done", async () => {
    const user = userEvent.setup();
    renderAt("/learner/resources/c1/r1", "LEARNER");

    expect(await screen.findByText("Chapter one")).toBeInTheDocument();
    expect(classResourcesApi.getMemberClassResource).toHaveBeenCalledWith({ classId: "c1", learnerId: undefined }, "r1");
    await user.click(screen.getByRole("button", { name: "Mark as done" }));

    expect(classResourcesApi.recordLearnerClassResourceInteraction).toHaveBeenCalledWith("c1", "r1", {
      completed: true,
    });
    expect(await screen.findByText("Completed")).toBeInTheDocument();
  });

  it("lets a guardian read through the child they follow, without recording progress", async () => {
    renderAt("/guardian/class-resources/l1/c1/r1", "GUARDIAN");

    expect(await screen.findByText("Chapter one")).toBeInTheDocument();
    expect(classResourcesApi.getMemberClassResource).toHaveBeenCalledWith({ classId: "c1", learnerId: "l1" }, "r1");
    expect(screen.queryByRole("button", { name: "Mark as done" })).not.toBeInTheDocument();
    expect(classResourcesApi.recordLearnerClassResourceInteraction).not.toHaveBeenCalled();
  });
});
