import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as learningApi from "@/api/learning";
import type { LearningCommentView, LearningResourceView } from "@/api/learning";
import type { Role } from "@/api/types";
import { CommentsModal } from "@/features/learning/components/CommentsModal";
import { resetAuthStore, useAuthStore } from "@/stores/authStore";

vi.mock("@/api/learning", async () => {
  const actual = await vi.importActual<typeof import("@/api/learning")>("@/api/learning");
  return {
    ...actual,
    getLearningResource: vi.fn(),
    listLearningComments: vi.fn(),
    postLearningComment: vi.fn(),
    hideLearningComment: vi.fn(),
    unhideLearningComment: vi.fn(),
    deleteLearningComment: vi.fn(),
    setLearningResourceCommentsEnabled: vi.fn(),
  };
});

const RESOURCE: LearningResourceView = {
  id: "resource-1",
  classId: "class-1",
  className: "Primary 1",
  subjectId: "subject-1",
  subjectName: "Mathematics",
  termId: "term-1",
  title: "Fractions Explainer",
  description: null,
  resourceType: "RICH_TEXT",
  bodyHtml: "<p>Halves</p>",
  fileId: null,
  youtubeVideoId: null,
  durationSeconds: null,
  commentsEnabled: true,
  status: "PUBLISHED",
  position: 0,
  availableFrom: null,
  availableUntil: null,
  actions: { canEdit: true, canPublish: false, canUnpublish: true, canArchive: true, canDelete: false },
  updatedAt: "2026-08-15T09:00:00Z",
};

const COMMENT: LearningCommentView = {
  commentId: "comment-1",
  resourceId: "resource-1",
  parentCommentId: null,
  authorRole: "STUDENT",
  authorName: "Ada Obi",
  isSelf: false,
  body: "Great lesson!",
  createdAt: "2026-08-15T09:00:00Z",
  editedAt: null,
  hidden: false,
  canEdit: false,
  canModerate: true,
  editableUntil: "2026-08-15T09:15:00Z",
};

function signInAs(role: Role) {
  useAuthStore.setState({
    user: { id: "user-1", email: "user@school.example", firstName: "A", lastName: "B", role, schoolId: "school-1" },
    accessToken: "access",
    refreshToken: "refresh",
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  resetAuthStore();
});

describe("CommentsModal", () => {
  it("loads the resource and its comments, then renders both", async () => {
    vi.mocked(learningApi.getLearningResource).mockResolvedValue(RESOURCE);
    vi.mocked(learningApi.listLearningComments).mockResolvedValue([COMMENT]);

    render(<CommentsModal resourceId="resource-1" onClose={vi.fn()} />);

    expect(await screen.findByText("Comments · Fractions Explainer")).toBeInTheDocument();
    expect(screen.getByText("Great lesson!")).toBeInTheDocument();
  });

  it("never shows a composer or Reply to an admin - admins moderate but never post", async () => {
    signInAs("SCHOOL_ADMIN");
    vi.mocked(learningApi.getLearningResource).mockResolvedValue(RESOURCE);
    vi.mocked(learningApi.listLearningComments).mockResolvedValue([COMMENT]);

    render(<CommentsModal resourceId="resource-1" onClose={vi.fn()} />);

    await screen.findByText("Great lesson!");
    expect(screen.queryByPlaceholderText("Write a comment…")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Reply" })).not.toBeInTheDocument();
  });

  it("lets a teacher reply to a student's comment", async () => {
    signInAs("TEACHER");
    vi.mocked(learningApi.getLearningResource).mockResolvedValue(RESOURCE);
    vi.mocked(learningApi.listLearningComments).mockResolvedValue([COMMENT]);
    vi.mocked(learningApi.postLearningComment).mockResolvedValue({ ...COMMENT, commentId: "reply-1" });
    const user = userEvent.setup();

    render(<CommentsModal resourceId="resource-1" onClose={vi.fn()} />);

    await screen.findByText("Great lesson!");
    expect(screen.getByPlaceholderText("Write a comment…")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Reply" }));
    await user.type(screen.getByPlaceholderText("Write a reply…"), "Glad it helped!");
    await user.click(screen.getByRole("button", { name: "Reply" }));

    expect(learningApi.postLearningComment).toHaveBeenCalledWith("resource-1", "Glad it helped!", COMMENT.commentId);
  });

  it("toggles comments_enabled through the checkbox", async () => {
    vi.mocked(learningApi.getLearningResource).mockResolvedValue(RESOURCE);
    vi.mocked(learningApi.listLearningComments).mockResolvedValue([]);
    vi.mocked(learningApi.setLearningResourceCommentsEnabled).mockResolvedValue({
      ...RESOURCE,
      commentsEnabled: false,
    });
    const user = userEvent.setup();

    render(<CommentsModal resourceId="resource-1" onClose={vi.fn()} />);
    await screen.findByText("No comments yet.");

    await user.click(screen.getByRole("checkbox", { name: "Comments enabled" }));

    expect(learningApi.setLearningResourceCommentsEnabled).toHaveBeenCalledWith("resource-1", false);
  });

  it("hides a comment through the moderation control", async () => {
    vi.mocked(learningApi.getLearningResource).mockResolvedValue(RESOURCE);
    vi.mocked(learningApi.listLearningComments).mockResolvedValue([COMMENT]);
    vi.mocked(learningApi.hideLearningComment).mockResolvedValue({ ...COMMENT, hidden: true });
    const user = userEvent.setup();

    render(<CommentsModal resourceId="resource-1" onClose={vi.fn()} />);
    await screen.findByText("Great lesson!");

    await user.click(screen.getByRole("button", { name: "Hide" }));

    expect(learningApi.hideLearningComment).toHaveBeenCalledWith("resource-1", "comment-1");
  });
});
