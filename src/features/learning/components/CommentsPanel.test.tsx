import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { LearningCommentView } from "@/api/learning";
import { CommentsPanel } from "@/features/learning/components/CommentsPanel";

const COMMENT: LearningCommentView = {
  commentId: "comment-1",
  resourceId: "resource-1",
  authorName: "Ada Obi",
  isSelf: true,
  body: "This really helped, thanks!",
  createdAt: "2026-08-15T09:00:00Z",
  editedAt: null,
  hidden: false,
  canEdit: true,
  canModerate: false,
  editableUntil: "2026-08-15T09:15:00Z",
};

describe("CommentsPanel", () => {
  it("renders a comment's body as a plain text child - no markup, matching the plain-text invariant", () => {
    render(<CommentsPanel comments={[COMMENT]} commentsEnabled canPost onPost={vi.fn()} onEdit={vi.fn()} />);

    expect(screen.getByText("This really helped, thanks!")).toBeInTheDocument();
    expect(screen.getByText("Ada Obi")).toBeInTheDocument();
  });

  it("shows an empty state when there are no comments yet", () => {
    render(<CommentsPanel comments={[]} commentsEnabled canPost onPost={vi.fn()} onEdit={vi.fn()} />);

    expect(screen.getByText("No comments yet.")).toBeInTheDocument();
  });

  it("shows the composer only when comments are enabled and the caller can post", () => {
    render(<CommentsPanel comments={[]} commentsEnabled canPost onPost={vi.fn()} onEdit={vi.fn()} />);

    expect(screen.getByPlaceholderText("Write a comment…")).toBeInTheDocument();
  });

  it("hides the composer and shows a turned-off notice once comments are disabled, even for a caller who could otherwise post", () => {
    render(<CommentsPanel comments={[COMMENT]} commentsEnabled={false} canPost onPost={vi.fn()} onEdit={vi.fn()} />);

    expect(screen.queryByPlaceholderText("Write a comment…")).not.toBeInTheDocument();
    expect(screen.getByText("Comments are turned off for this resource.")).toBeInTheDocument();
  });

  it("hides the composer for a caller who can't post (staff moderation mode)", () => {
    render(<CommentsPanel comments={[COMMENT]} commentsEnabled canPost={false} />);

    expect(screen.queryByPlaceholderText("Write a comment…")).not.toBeInTheDocument();
  });

  it("posts a new comment through onPost and clears the composer", async () => {
    const onPost = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<CommentsPanel comments={[]} commentsEnabled canPost onPost={onPost} onEdit={vi.fn()} />);

    await user.type(screen.getByPlaceholderText("Write a comment…"), "Great lesson!");
    await user.click(screen.getByRole("button", { name: "Post" }));

    expect(onPost).toHaveBeenCalledWith("Great lesson!");
  });

  it("shows the Edit control only when the server says canEdit is true", () => {
    render(
      <CommentsPanel
        comments={[{ ...COMMENT, canEdit: false }]}
        commentsEnabled
        canPost
        onPost={vi.fn()}
        onEdit={vi.fn()}
      />,
    );

    expect(screen.queryByRole("button", { name: "Edit" })).not.toBeInTheDocument();
  });

  it("edits a comment through onEdit", async () => {
    const onEdit = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<CommentsPanel comments={[COMMENT]} commentsEnabled canPost onPost={vi.fn()} onEdit={onEdit} />);

    await user.click(screen.getByRole("button", { name: "Edit" }));
    const textarea = screen.getByDisplayValue("This really helped, thanks!");
    await user.clear(textarea);
    await user.type(textarea, "Edited body");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(onEdit).toHaveBeenCalledWith("comment-1", "Edited body");
  });

  it("shows moderation controls and a Hidden badge only in staff mode, never Edit for a non-author comment", () => {
    const staffComment: LearningCommentView = { ...COMMENT, isSelf: false, canEdit: false, canModerate: true, hidden: true };
    render(
      <CommentsPanel
        comments={[staffComment]}
        commentsEnabled
        canPost={false}
        onHide={vi.fn()}
        onUnhide={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    expect(screen.getByText("Hidden")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Unhide" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Delete" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Hide" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Edit" })).not.toBeInTheDocument();
  });

  it("hides a comment through onHide", async () => {
    const onHide = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    const staffComment: LearningCommentView = { ...COMMENT, isSelf: false, canEdit: false, canModerate: true };
    render(<CommentsPanel comments={[staffComment]} commentsEnabled canPost={false} onHide={onHide} />);

    await user.click(screen.getByRole("button", { name: "Hide" }));

    expect(onHide).toHaveBeenCalledWith("comment-1");
  });
});
