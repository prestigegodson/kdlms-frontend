import { render, screen } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as learnersApi from "@/api/learners";
import type { ClassRoster } from "@/api/learners";
import { ClassRosterCard } from "./ClassRosterCard";

vi.mock("@/api/learners");
vi.mock("@/api/liveSessions");

function roster(learnerCount: number): ClassRoster {
  return {
    classId: "c1",
    maxStudentsPerClass: 10,
    activeCount: learnerCount,
    learners: Array.from({ length: learnerCount }, (_, index) => ({
      learnerId: `l${index}`,
      firstName: "Ada",
      lastName: `Learner${index}`,
      minor: false,
      kind: "ADULT" as const,
      enrolledAt: "2026-10-01T08:00:00Z",
      overLimit: false,
    })),
  };
}

function renderCard(writable = true) {
  const router = createMemoryRouter(
    [{ path: "/tutor/classes/c1", element: <ClassRosterCard classId="c1" writable={writable} timezone="UTC" /> }],
    { initialEntries: ["/tutor/classes/c1"] },
  );
  render(<RouterProvider router={router} />);
}

describe("ClassRosterCard", () => {
  beforeEach(() => vi.clearAllMocks());

  it("links to the class grades broadsheet", async () => {
    vi.mocked(learnersApi.getClassRoster).mockResolvedValue(roster(2));
    renderCard();
    expect(await screen.findByRole("link", { name: "Grades" })).toHaveAttribute("href", "/tutor/classes/c1/grades");
  });

  it("still shows Grades on a read-only class", async () => {
    vi.mocked(learnersApi.getClassRoster).mockResolvedValue(roster(1));
    renderCard(false);
    expect(await screen.findByRole("link", { name: "Grades" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /enroll learners/i })).not.toBeInTheDocument();
  });

  it("hides Grades when no learners are enrolled", async () => {
    vi.mocked(learnersApi.getClassRoster).mockResolvedValue(roster(0));
    renderCard();
    await screen.findByText(/no learners yet/i);
    expect(screen.queryByRole("link", { name: "Grades" })).not.toBeInTheDocument();
  });
});
