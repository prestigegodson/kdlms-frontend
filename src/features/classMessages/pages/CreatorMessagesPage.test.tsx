import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as classMessagesApi from "@/api/classMessages";
import type { ClassConversation, ClassMessagesBoard } from "@/api/classMessages";
import * as creatorPlanApi from "@/api/creatorPlan";
import type { CreatorPlanView } from "@/api/creatorPlan";
import * as virtualClassesApi from "@/api/virtualClasses";
import { resetClassMessagesUnreadStore } from "@/stores/classMessagesUnreadStore";
import { resetCreatorPlanStore } from "@/stores/creatorPlanStore";
import { CreatorMessagesPage } from "./CreatorMessagesPage";

vi.mock("@/api/classMessages");
vi.mock("@/api/creatorPlan");
vi.mock("@/api/virtualClasses");

const PLAN = {
  source: "SUBSCRIPTION",
  packageId: "pkg",
  planName: "Pro",
  free: false,
  billingCycle: "MONTHLY",
  startDate: "2026-10-01",
  endDate: "2026-11-01",
  maxClasses: 5,
  maxStudentsPerClass: 10,
  maxSessionMinutes: 60,
  maxParticipantsPerSession: null,
  maxMonthlySessionHours: 10,
  lessonNotes: false,
  aiLessonNotes: false,
  aiGenerationLimit: 0,
  takeHomeQuiz: false,
  onDemandLearning: false,
  learningMedia: false,
  communication: true,
  guardianAccess: true,
  autoRenew: false,
  graceUntil: null,
} satisfies CreatorPlanView;

const BOARD: ClassMessagesBoard = {
  classId: "c1",
  className: "Maths",
  writable: true,
  rows: [
    {
      threadId: "t1",
      classId: "c1",
      className: "Maths",
      learnerId: "l1",
      learnerName: "Ada Lovelace",
      creatorName: null,
      lastMessageAt: "2026-10-04T09:00:00Z",
      lastMessagePreview: "Can we start earlier?",
      lastAuthorRole: "LEARNER",
      unread: true,
    },
    {
      threadId: null,
      classId: "c1",
      className: "Maths",
      learnerId: "l2",
      learnerName: "Bo Brown",
      creatorName: null,
      lastMessageAt: null,
      lastMessagePreview: null,
      lastAuthorRole: null,
      unread: false,
    },
  ],
};

const CONVERSATION: ClassConversation = {
  threadId: "t1",
  classId: "c1",
  className: "Maths",
  learnerId: "l1",
  learnerName: "Ada Lovelace",
  creatorName: null,
  canPost: true,
  messages: [
    {
      messageId: "m1",
      threadId: "t1",
      authorId: "u-ada",
      authorName: "Ada Lovelace",
      authorRole: "LEARNER",
      body: "Can we start earlier?",
      createdAt: "2026-10-04T09:00:00Z",
      canEdit: false,
      editableUntil: "2026-10-04T09:15:00Z",
      announcement: false,
    },
  ],
};

function renderAt(path: string) {
  const router = createMemoryRouter([{ path: "/creator/messages", element: <CreatorMessagesPage /> }], {
    initialEntries: [path],
  });
  render(<RouterProvider router={router} />);
}

describe("CreatorMessagesPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetCreatorPlanStore();
    resetClassMessagesUnreadStore();
    vi.mocked(creatorPlanApi.getMyCreatorPlan).mockResolvedValue(PLAN);
    vi.mocked(virtualClassesApi.listVirtualClasses).mockResolvedValue({
      classes: [
        {
          id: "c1",
          name: "Maths",
          description: null,
          subjectLabel: null,
          status: "ACTIVE",
          startDate: "2026-10-01",
          endDate: null,
          overLimit: false,
          slots: [],
          createdAt: "2026-10-01T00:00:00Z",
        },
      ],
      maxClasses: 5,
      activeCount: 1,
      timezone: "Africa/Lagos",
    });
    vi.mocked(classMessagesApi.getClassMessagesBoard).mockResolvedValue(BOARD);
    vi.mocked(classMessagesApi.getCreatorConversation).mockResolvedValue(CONVERSATION);
    vi.mocked(classMessagesApi.markCreatorConversationRead).mockResolvedValue(undefined);
    vi.mocked(classMessagesApi.getCreatorUnreadCount).mockResolvedValue({ unreadThreads: 0 });
  });

  it("lists the first class's learners and opens a conversation, marking it read", async () => {
    renderAt("/creator/messages");

    expect(await screen.findByText("Ada Lovelace")).toBeInTheDocument();
    expect(screen.getByText("Bo Brown")).toBeInTheDocument();
    expect(screen.getByText("No messages yet")).toBeInTheDocument();
    expect(classMessagesApi.getClassMessagesBoard).toHaveBeenCalledWith("c1");

    await userEvent.setup().click(screen.getByText("Ada Lovelace"));

    expect(await screen.findByRole("heading", { name: "Ada Lovelace" })).toBeInTheDocument();
    await waitFor(() => expect(classMessagesApi.markCreatorConversationRead).toHaveBeenCalledWith("c1", "l1"));
  });

  it("sends a message into the open conversation", async () => {
    vi.mocked(classMessagesApi.sendCreatorMessage).mockResolvedValue(CONVERSATION.messages[0]);
    renderAt("/creator/messages?classId=c1&learnerId=l1");
    const user = userEvent.setup();

    await user.type(await screen.findByPlaceholderText("Write a message…"), "Yes, 8am works");
    await user.click(screen.getByRole("button", { name: "Send" }));

    await waitFor(() =>
      expect(classMessagesApi.sendCreatorMessage).toHaveBeenCalledWith("c1", "l1", "Yes, 8am works"),
    );
  });

  it("announces to the whole class", async () => {
    vi.mocked(classMessagesApi.announceToClass).mockResolvedValue({ delivered: 2, emailed: 1 });
    renderAt("/creator/messages?classId=c1");
    const user = userEvent.setup();

    await user.click(await screen.findByRole("button", { name: /Announce to class/ }));
    await user.type(screen.getByLabelText("Announcement"), "No class on Friday");
    await user.click(screen.getByRole("button", { name: "Send announcement" }));

    await waitFor(() => expect(classMessagesApi.announceToClass).toHaveBeenCalledWith("c1", "No class on Friday"));
    expect(await screen.findByText(/Sent to 2 learners/)).toBeInTheDocument();
  });

  it("shows an upgrade notice when the plan has no messaging", async () => {
    vi.mocked(creatorPlanApi.getMyCreatorPlan).mockResolvedValue({ ...PLAN, communication: false });
    renderAt("/creator/messages");

    expect(await screen.findByText("Messaging isn't in your plan")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "See plans" })).toHaveAttribute("href", "/creator/billing");
    expect(virtualClassesApi.listVirtualClasses).not.toHaveBeenCalled();
  });
});
