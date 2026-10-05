import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as liveSessionsApi from "@/api/liveSessions";
import * as onlineClassesApi from "@/api/onlineClasses";
import type { OnlineClass } from "@/api/onlineClasses";
import { OnlineClassesPage } from "@/features/guardian/OnlineClassesPage";
import { MyClassesPage } from "./MyClassesPage";

vi.mock("@/api/onlineClasses");
vi.mock("@/api/liveSessions");

const algebra: OnlineClass = {
  id: "c1",
  name: "Algebra",
  description: "Equations and more.",
  subjectLabel: "Maths",
  creatorName: "Ada's Studio",
  timezone: "Africa/Lagos",
  startDate: "2026-10-01",
  endDate: null,
  slots: [{ id: "s1", dayOfWeek: 1, startTime: "09:00:00", durationMinutes: 60 }],
  upcoming: [
    {
      id: "o1",
      scheduledStart: "2026-10-05T08:00:00Z",
      scheduledEnd: "2026-10-05T09:00:00Z",
      status: "CANCELLED",
      cancelReason: "Tutor unwell",
      joinable: false,
    },
  ],
  remindersEnabled: true,
};

const live: OnlineClass = {
  ...algebra,
  id: "c2",
  name: "Geometry",
  upcoming: [
    {
      id: "o2",
      scheduledStart: "2026-10-05T10:00:00Z",
      scheduledEnd: "2026-10-05T11:00:00Z",
      status: "LIVE",
      cancelReason: null,
      joinable: true,
    },
  ],
};

function renderAt(element: React.ReactNode) {
  const router = createMemoryRouter(
    [
      { path: "/", element },
      { path: "/live/:occurrenceId", element: <p>Live room</p> },
    ],
    { initialEntries: ["/"] },
  );
  render(<RouterProvider router={router} />);
  return router;
}

describe("online classes views", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(onlineClassesApi.listMyUpcomingSessions).mockResolvedValue([]);
  });

  it("shows a learner their classes with the creator, weekly schedule and upcoming sessions", async () => {
    vi.mocked(onlineClassesApi.listMyOnlineClasses).mockResolvedValue([algebra]);

    renderAt(<MyClassesPage />);

    expect(await screen.findByRole("heading", { name: "Algebra" })).toBeInTheDocument();
    expect(screen.getByText(/Ada's Studio/)).toBeInTheDocument();
    expect(screen.getByText(/Mon 09:00–10:00/)).toBeInTheDocument();
    expect(screen.getByText("Tutor unwell")).toBeInTheDocument();
    expect(screen.getByText("Cancelled")).toBeInTheDocument();
  });

  it("shows an empty state before a learner is enrolled anywhere", async () => {
    vi.mocked(onlineClassesApi.listMyOnlineClasses).mockResolvedValue([]);

    renderAt(<MyClassesPage />);

    expect(await screen.findByText("No classes yet")).toBeInTheDocument();
  });

  it("groups a guardian's view by learner", async () => {
    vi.mocked(onlineClassesApi.listWardOnlineClasses).mockResolvedValue([
      { learnerId: "l1", firstName: "Kemi", lastName: "Obi", classes: [algebra] },
      { learnerId: "l2", firstName: "Dayo", lastName: "Obi", classes: [] },
    ]);

    renderAt(<OnlineClassesPage />);

    expect(await screen.findByRole("heading", { name: "Kemi Obi" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Algebra" })).toBeInTheDocument();
    expect(screen.getByText("Not enrolled in a class yet.")).toBeInTheDocument();
  });

  it("offers a learner a Join button into the live room only for a joinable session", async () => {
    vi.mocked(onlineClassesApi.listMyOnlineClasses).mockResolvedValue([algebra, live]);

    const router = renderAt(<MyClassesPage />);

    const join = await screen.findByRole("button", { name: "Join" });
    expect(screen.getAllByRole("button", { name: "Join" })).toHaveLength(1);
    await userEvent.click(join);
    expect(router.state.location.pathname).toBe("/live/o2");
  });

  it("labels a guardian's live-room button Watch", async () => {
    vi.mocked(onlineClassesApi.listWardOnlineClasses).mockResolvedValue([
      { learnerId: "l1", firstName: "Kemi", lastName: "Obi", classes: [live] },
    ]);

    renderAt(<OnlineClassesPage />);

    expect(await screen.findByRole("button", { name: "Watch" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Join" })).not.toBeInTheDocument();
  });

  it("shows a learner their attendance history in a class", async () => {
    vi.mocked(onlineClassesApi.listMyOnlineClasses).mockResolvedValue([algebra]);
    vi.mocked(liveSessionsApi.getMyClassAttendance).mockResolvedValue({
      classId: "c1",
      className: "Algebra",
      learnerId: "l1",
      firstName: "Lola",
      lastName: "Ade",
      sessionsHeld: 2,
      sessionsAttended: 1,
      sessions: [
        {
          occurrenceId: "o0",
          scheduledStart: "2026-09-28T08:00:00Z",
          scheduledEnd: "2026-09-28T09:00:00Z",
          status: "ENDED",
          present: true,
          minutes: 52,
          firstJoinedAt: "2026-09-28T08:01:00Z",
        },
      ],
    });

    renderAt(<MyClassesPage />);

    await userEvent.click(await screen.findByRole("button", { name: "Attendance" }));
    expect(await screen.findByText("Lola Ade attended 1 of 2 sessions of Algebra.")).toBeInTheDocument();
    expect(screen.getByText("Present")).toBeInTheDocument();
    expect(screen.getByText("52")).toBeInTheDocument();
    expect(liveSessionsApi.getMyClassAttendance).toHaveBeenCalledWith("c1");
  });

  it("lists a learner's upcoming sessions across classes above their classes", async () => {
    vi.mocked(onlineClassesApi.listMyOnlineClasses).mockResolvedValue([algebra]);
    vi.mocked(onlineClassesApi.listMyUpcomingSessions).mockResolvedValue([
      {
        id: "o9",
        classId: "c2",
        className: "Geometry",
        creatorName: "Ada's Studio",
        timezone: "Africa/Lagos",
        learnerNames: [],
        scheduledStart: "2026-10-05T10:00:00Z",
        scheduledEnd: "2026-10-05T11:00:00Z",
        status: "SCHEDULED",
        joinable: true,
      },
    ]);

    const router = renderAt(<MyClassesPage />);

    expect(await screen.findByRole("heading", { name: "Upcoming sessions", level: 2 })).toBeInTheDocument();
    expect(await screen.findByText(/Geometry/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Join" }));
    expect(router.state.location.pathname).toBe("/live/o9");
  });

  it("saves a learner's reminder choice straight away", async () => {
    vi.mocked(onlineClassesApi.listMyOnlineClasses).mockResolvedValue([algebra]);
    vi.mocked(onlineClassesApi.setMyClassReminders).mockResolvedValue({ classId: "c1", remindersEnabled: false });

    renderAt(<MyClassesPage />);

    const toggle = await screen.findByRole("checkbox", { name: /Email me a reminder/ });
    expect(toggle).toBeChecked();
    await userEvent.click(toggle);
    expect(onlineClassesApi.setMyClassReminders).toHaveBeenCalledWith("c1", false);
    expect(toggle).not.toBeChecked();
  });

  it("puts the reminder toggle back when saving fails", async () => {
    vi.mocked(onlineClassesApi.listMyOnlineClasses).mockResolvedValue([algebra]);
    vi.mocked(onlineClassesApi.setMyClassReminders).mockRejectedValue(new Error("offline"));

    renderAt(<MyClassesPage />);

    const toggle = await screen.findByRole("checkbox", { name: /Email me a reminder/ });
    await userEvent.click(toggle);
    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(toggle).toBeChecked();
  });

  it("saves a guardian's reminder choice for the class", async () => {
    vi.mocked(onlineClassesApi.listWardOnlineClasses).mockResolvedValue([
      { learnerId: "l1", firstName: "Kemi", lastName: "Obi", classes: [{ ...algebra, remindersEnabled: false }] },
    ]);
    vi.mocked(onlineClassesApi.setWardClassReminders).mockResolvedValue({ classId: "c1", remindersEnabled: true });

    renderAt(<OnlineClassesPage />);

    const toggle = await screen.findByRole("checkbox", { name: /Email me a reminder/ });
    expect(toggle).not.toBeChecked();
    await userEvent.click(toggle);
    expect(onlineClassesApi.setWardClassReminders).toHaveBeenCalledWith("c1", true);
    expect(toggle).toBeChecked();
  });
});
