import { render, screen } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as classTopicsApi from "@/api/classTopics";
import * as virtualClassesApi from "@/api/virtualClasses";
import type { VirtualClass } from "@/api/virtualClasses";
import { ClassTopicsPage } from "./ClassTopicsPage";

vi.mock("@/api/classTopics", async () => {
  const actual = await vi.importActual<typeof import("@/api/classTopics")>("@/api/classTopics");
  return { ...actual, listClassTopics: vi.fn() };
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

function renderPage() {
  const router = createMemoryRouter(
    [{ path: "/tutor/classes/:classId/topics", element: <ClassTopicsPage /> }],
    { initialEntries: ["/tutor/classes/c1/topics"] },
  );
  render(<RouterProvider router={router} />);
}

describe("ClassTopicsPage", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(classTopicsApi.listClassTopics).mockResolvedValue([
      {
        id: "t1",
        classId: "c1",
        title: "Fractions",
        description: null,
        position: 0,
        gradesPublishedAt: null,
      },
    ]);
  });

  it("shows the class's topics under its name", async () => {
    vi.mocked(virtualClassesApi.getVirtualClass).mockResolvedValue(virtualClass);

    renderPage();

    expect(await screen.findByText("Fractions")).toBeInTheDocument();
    expect(screen.getByText("Science")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Back to class/ })).toHaveAttribute("href", "/tutor/classes/c1");
    expect(screen.getByRole("button", { name: /Add topic/ })).toBeInTheDocument();
    expect(classTopicsApi.listClassTopics).toHaveBeenCalledWith("c1");
  });

  it("is read-only for an archived class", async () => {
    vi.mocked(virtualClassesApi.getVirtualClass).mockResolvedValue({ ...virtualClass, status: "ARCHIVED" });

    renderPage();

    expect(await screen.findByText("Fractions")).toBeInTheDocument();
    expect(screen.getByText(/This class is archived/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Add topic/ })).not.toBeInTheDocument();
  });
});
