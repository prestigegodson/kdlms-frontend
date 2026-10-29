import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as classTopicsApi from "@/api/classTopics";
import type { TopicGradebook } from "@/api/classTopics";
import * as virtualClassesApi from "@/api/virtualClasses";
import type { VirtualClass } from "@/api/virtualClasses";
import { TopicGradesPage } from "./TopicGradesPage";

vi.mock("@/api/classTopics", async () => {
  const actual = await vi.importActual<typeof import("@/api/classTopics")>("@/api/classTopics");
  return { ...actual, getTopicGradebook: vi.fn(), saveTopicGrades: vi.fn(), publishTopicGrades: vi.fn() };
});
vi.mock("@/api/virtualClasses", async () => {
  const actual = await vi.importActual<typeof import("@/api/virtualClasses")>("@/api/virtualClasses");
  return { ...actual, getVirtualClass: vi.fn() };
});

const virtualClass: VirtualClass = {
  id: "c1",
  name: "Science",
  description: null,
  subjectLabel: null,
  status: "ACTIVE",
  startDate: "2026-10-01",
  endDate: null,
  overLimit: false,
  slots: [],
  createdAt: "2026-10-01T08:00:00Z",
  meetingMode: "PLATFORM",
  meetingUrl: null,
  meetingProvider: null,
  meetingUnavailable: false,
};

function gradebook(overrides: Partial<TopicGradebook> = {}): TopicGradebook {
  return {
    topic: {
      id: "t1",
      classId: "c1",
      title: "Plants",
      description: null,
      position: 0,
    },
    learners: [
      { learnerId: "l1", firstName: "Ada", lastName: "Lovelace", grade: "B", comment: null, gradedAt: null },
      { learnerId: "l2", firstName: "Ben", lastName: "Okri", grade: null, comment: null, gradedAt: null },
    ],
    ...overrides,
  };
}

function renderPage() {
  const router = createMemoryRouter(
    [{ path: "/tutor/classes/:classId/topics/:topicId", element: <TopicGradesPage /> }],
    { initialEntries: ["/tutor/classes/c1/topics/t1"] },
  );
  render(<RouterProvider router={router} />);
}

describe("TopicGradesPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(virtualClassesApi.getVirtualClass).mockResolvedValue(virtualClass);
  });

  it("saves only the learners whose grade or comment changed", async () => {
    vi.mocked(classTopicsApi.getTopicGradebook).mockResolvedValue(gradebook());
    vi.mocked(classTopicsApi.saveTopicGrades).mockResolvedValue(gradebook());

    renderPage();
    const save = await screen.findByRole("button", { name: "Save grades" });
    expect(save).toBeDisabled();
    await userEvent.type(screen.getByLabelText("Grade for Ben Okri"), "7/10");
    await userEvent.type(screen.getByLabelText("Comment for Ben Okri"), "Good effort");
    await userEvent.click(save);

    expect(classTopicsApi.saveTopicGrades).toHaveBeenCalledWith("c1", "t1", [
      { learnerId: "l2", grade: "7/10", comment: "Good effort" },
    ]);
  });

  it("refuses a comment without a grade and blocks publishing while changes are unsaved", async () => {
    vi.mocked(classTopicsApi.getTopicGradebook).mockResolvedValue(gradebook());

    renderPage();
    await userEvent.type(await screen.findByLabelText("Comment for Ben Okri"), "Needs a grade");

    expect(screen.getByText("Enter a grade for every learner you've written a comment for.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save grades" })).toBeDisabled();
    expect(screen.getByRole("button", { name: /Publish grades/ })).toBeDisabled();
  });

  it("publishes the topic's grades", async () => {
    vi.mocked(classTopicsApi.getTopicGradebook).mockResolvedValue(gradebook());
    vi.mocked(classTopicsApi.publishTopicGrades).mockResolvedValue({
      ...gradebook().topic,
      gradesPublishedAt: "2026-10-29T10:00:00Z",
    });

    renderPage();
    expect(await screen.findByText("Not published yet")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /Publish grades/ }));

    expect(classTopicsApi.publishTopicGrades).toHaveBeenCalledWith("c1", "t1");
    expect(await screen.findByRole("button", { name: /Unpublish grades/ })).toBeInTheDocument();
  });
});
