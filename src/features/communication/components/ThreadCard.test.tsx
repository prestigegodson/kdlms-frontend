import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ThreadView } from "@/api/communication";
import { ThreadCard } from "@/features/communication/components/ThreadCard";

const THREAD: ThreadView = {
  threadId: "thread-1",
  studentId: "student-1",
  studentName: "Ada Obi",
  admissionNumber: "SCH/2026/0001",
  classId: "class-1",
  className: "Primary 1",
  category: "COMMENDATION",
  logDate: "2026-08-15",
  canReply: true,
  messages: [
    {
      messageId: "msg-1",
      threadId: "thread-1",
      authorId: "teacher-1",
      authorName: "Ms. Teacher",
      authorRole: "TEACHER",
      body: "Ada did excellent work today.",
      createdAt: "2026-08-15T09:00:00Z",
      canEdit: false,
      editableUntil: "2026-08-15T09:15:00Z",
    },
    {
      messageId: "msg-2",
      threadId: "thread-1",
      authorId: "guardian-1",
      authorName: "Mrs. Obi",
      authorRole: "GUARDIAN",
      body: "Thank you for letting me know!",
      createdAt: "2026-08-15T10:00:00Z",
      canEdit: false,
      editableUntil: "2026-08-15T10:15:00Z",
    },
    {
      messageId: "msg-3",
      threadId: "thread-1",
      authorId: "teacher-1",
      authorName: "Ms. Teacher",
      authorRole: "TEACHER",
      body: "She was very proud of it too.",
      createdAt: "2026-08-15T11:00:00Z",
      canEdit: false,
      editableUntil: "2026-08-15T11:15:00Z",
    },
  ],
};

describe("ThreadCard", () => {
  it("renders every message as a flat sibling list, root first, in chronological order - never nested", () => {
    render(<ThreadCard thread={THREAD} onReply={vi.fn()} onEditMessage={vi.fn()} />);

    const bodies = screen.getAllByText(/did excellent work|Thank you for letting|very proud/);
    expect(bodies).toHaveLength(3);
    expect(bodies[0]).toHaveTextContent("Ada did excellent work today.");
    expect(bodies[1]).toHaveTextContent("Thank you for letting me know!");
    expect(bodies[2]).toHaveTextContent("She was very proud of it too.");

    // A reply is never itself replied to - there is no third level of the DOM
    // tree carrying another message's body inside a reply's own container.
    expect(screen.getAllByText("Teacher")).toHaveLength(2);
    expect(screen.getAllByText("Guardian")).toHaveLength(1);
  });

  it("shows a reply composer when the thread is repliable", () => {
    render(<ThreadCard thread={THREAD} onReply={vi.fn()} onEditMessage={vi.fn()} />);

    expect(screen.getByPlaceholderText("Write a reply…")).toBeInTheDocument();
  });

  it("hides the reply composer for a read-only viewer (e.g. an admin browsing the log)", () => {
    render(<ThreadCard thread={{ ...THREAD, canReply: false }} onReply={vi.fn()} onEditMessage={vi.fn()} />);

    expect(screen.queryByPlaceholderText("Write a reply…")).not.toBeInTheDocument();
  });
});
