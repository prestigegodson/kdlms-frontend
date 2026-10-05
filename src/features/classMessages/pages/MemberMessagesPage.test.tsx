import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as classMessagesApi from "@/api/classMessages";
import type { ClassConversation, ClassConversationList } from "@/api/classMessages";
import { resetClassMessagesUnreadStore } from "@/stores/classMessagesUnreadStore";
import { MemberMessagesPage } from "./MemberMessagesPage";

vi.mock("@/api/classMessages");

const INBOX: ClassConversationList = {
  unread: 0,
  conversations: [
    {
      threadId: null,
      classId: "c1",
      className: "Piano",
      learnerId: "l1",
      learnerName: "Kemi Ade",
      creatorName: "Keys Studio",
      lastMessageAt: null,
      lastMessagePreview: null,
      lastAuthorRole: null,
      unread: false,
    },
  ],
};

const EMPTY_CONVERSATION: ClassConversation = {
  threadId: null,
  classId: "c1",
  className: "Piano",
  learnerId: "l1",
  learnerName: "Kemi Ade",
  creatorName: "Keys Studio",
  canPost: true,
  messages: [],
};

function renderPage(audience: "LEARNER" | "GUARDIAN") {
  const router = createMemoryRouter([{ path: "/", element: <MemberMessagesPage audience={audience} /> }], {
    initialEntries: ["/"],
  });
  render(<RouterProvider router={router} />);
}

describe("MemberMessagesPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetClassMessagesUnreadStore();
    vi.mocked(classMessagesApi.getMemberInbox).mockResolvedValue(INBOX);
    vi.mocked(classMessagesApi.getMemberConversation).mockResolvedValue(EMPTY_CONVERSATION);
  });

  it("lets a guardian write first in a conversation nobody has started", async () => {
    vi.mocked(classMessagesApi.sendMemberMessage).mockResolvedValue({
      messageId: "m1",
      threadId: "t1",
      authorId: "u1",
      authorRole: "GUARDIAN",
      body: "Kemi will be late",
      createdAt: "2026-10-05T08:00:00Z",
      canEdit: true,
      editableUntil: "2026-10-05T08:15:00Z",
    });
    renderPage("GUARDIAN");
    const user = userEvent.setup();

    expect(await screen.findByText("Kemi Ade · Keys Studio")).toBeInTheDocument();
    await user.click(screen.getByText("Piano"));
    expect(await screen.findByText("No messages yet.")).toBeInTheDocument();
    // Nothing stored yet, so there is nothing to mark read.
    expect(classMessagesApi.markMemberConversationRead).not.toHaveBeenCalled();

    await user.type(screen.getByPlaceholderText("Write a message…"), "Kemi will be late");
    await user.click(screen.getByRole("button", { name: "Send" }));

    await waitFor(() =>
      expect(classMessagesApi.sendMemberMessage).toHaveBeenCalledWith("GUARDIAN", "c1", "l1", "Kemi will be late"),
    );
  });

  it("hides the composer on a read-only conversation", async () => {
    vi.mocked(classMessagesApi.getMemberConversation).mockResolvedValue({ ...EMPTY_CONVERSATION, canPost: false });
    renderPage("LEARNER");

    await userEvent.setup().click(await screen.findByText("Piano"));

    expect(await screen.findByText("This conversation is read-only.")).toBeInTheDocument();
    expect(screen.queryByPlaceholderText("Write a message…")).not.toBeInTheDocument();
  });

  it("shows an empty state when there are no class conversations", async () => {
    vi.mocked(classMessagesApi.getMemberInbox).mockResolvedValue({ unread: 0, conversations: [] });
    renderPage("LEARNER");

    expect(await screen.findByText("No messages")).toBeInTheDocument();
  });
});
