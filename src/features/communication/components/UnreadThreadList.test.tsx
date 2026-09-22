import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { ThreadDigestView, UnreadThreadsView } from "@/api/communication";
import { UnreadThreadList } from "@/features/communication/components/UnreadThreadList";

function thread(overrides: Partial<ThreadDigestView> = {}): ThreadDigestView {
  return {
    threadId: "thread-1",
    studentId: "student-1",
    studentName: "Ada Obi",
    admissionNumber: "SCH/2026/0001",
    classId: "class-1",
    className: "Primary 1",
    category: "GENERAL",
    logDate: "2026-08-15",
    startedByName: "Ms. Teacher",
    lastMessageAt: "2026-08-15T09:00:00Z",
    replyCount: 1,
    guardianHasReplied: true,
    unread: true,
    ...overrides,
  };
}

describe("UnreadThreadList", () => {
  it("shows a loading state while view is null", () => {
    render(<UnreadThreadList view={null} onOpenThread={vi.fn()} />);
    expect(screen.getByText("Loading…")).toBeInTheDocument();
  });

  it("shows an error instead of the list when one is given", () => {
    render(<UnreadThreadList view={null} error="Failed to load unread messages" onOpenThread={vi.fn()} />);
    expect(screen.getByText("Failed to load unread messages")).toBeInTheDocument();
  });

  it("shows an empty state once loaded with no unread threads", () => {
    render(<UnreadThreadList view={{ threads: [], total: 0 }} onOpenThread={vi.fn()} />);
    expect(screen.getByText("You're all caught up")).toBeInTheDocument();
  });

  it("renders a row per unread thread and calls onOpenThread with the clicked row", async () => {
    const user = userEvent.setup();
    const onOpenThread = vi.fn();
    const view: UnreadThreadsView = { threads: [thread(), thread({ threadId: "thread-2", studentName: "Bola Ade" })], total: 2 };
    render(<UnreadThreadList view={view} onOpenThread={onOpenThread} />);

    expect(screen.getByText("Ada Obi · Primary 1")).toBeInTheDocument();
    expect(screen.getByText("Bola Ade · Primary 1")).toBeInTheDocument();

    await user.click(screen.getByText("Ada Obi · Primary 1"));
    expect(onOpenThread).toHaveBeenCalledWith(view.threads[0]);
  });

  it("shows a truncation note when total exceeds the returned threads", () => {
    render(<UnreadThreadList view={{ threads: [thread()], total: 5 }} onOpenThread={vi.fn()} />);
    expect(screen.getByText("Showing the 1 most recent of 5.")).toBeInTheDocument();
  });
});
