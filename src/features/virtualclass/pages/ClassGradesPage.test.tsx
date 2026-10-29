import { render, screen } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as classTopicsApi from "@/api/classTopics";
import type { ClassGradebook } from "@/api/classTopics";
import * as virtualClassesApi from "@/api/virtualClasses";
import type { VirtualClass } from "@/api/virtualClasses";
import { ClassGradesPage } from "./ClassGradesPage";

vi.mock("@/api/classTopics", async () => {
  const actual = await vi.importActual<typeof import("@/api/classTopics")>("@/api/classTopics");
  return { ...actual, getClassGradebook: vi.fn() };
});
vi.mock("@/api/virtualClasses", async () => {
  const actual = await vi.importActual<typeof import("@/api/virtualClasses")>("@/api/virtualClasses");
  return { ...actual, getVirtualClass: vi.fn() };
});

const virtualClass: VirtualClass = {
  id: "c1",
  name: "English",
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

const gradebook: ClassGradebook = {
  topics: [{ id: "t1", classId: "c1", title: "Nouns", description: null, position: 0, gradesPublishedAt: null }],
  learners: [{ learnerId: "l1", firstName: "Ada", lastName: "Lovelace" }],
  grades: [{ topicId: "t1", learnerId: "l1", grade: "A", comment: null, gradedAt: "2026-10-20T08:00:00Z" }],
};

function renderPage() {
  const router = createMemoryRouter([{ path: "/tutor/classes/:classId/grades", element: <ClassGradesPage /> }], {
    initialEntries: ["/tutor/classes/c1/grades"],
  });
  render(<RouterProvider router={router} />);
}

describe("ClassGradesPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(classTopicsApi.getClassGradebook).mockResolvedValue(gradebook);
  });

  it("loads the class broadsheet", async () => {
    vi.mocked(virtualClassesApi.getVirtualClass).mockResolvedValue(virtualClass);
    renderPage();

    expect(await screen.findByLabelText("Grade for Ada Lovelace on Nouns")).toHaveValue("A");
    expect(screen.getByText("English")).toBeInTheDocument();
    expect(classTopicsApi.getClassGradebook).toHaveBeenCalledWith("c1");
  });

  it("is read-only for an archived class", async () => {
    vi.mocked(virtualClassesApi.getVirtualClass).mockResolvedValue({ ...virtualClass, status: "ARCHIVED" });
    renderPage();

    expect(await screen.findByText("This class is archived, so its grades are read-only.")).toBeInTheDocument();
    expect(screen.getByLabelText("Grade for Ada Lovelace on Nouns")).toBeDisabled();
  });
});
