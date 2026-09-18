import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as learningApi from "@/api/learning";
import { StudentResourceDetailPage } from "@/features/student/StudentResourceDetailPage";

vi.mock("@/api/learning", async () => {
  const actual = await vi.importActual<typeof import("@/api/learning")>("@/api/learning");
  return {
    ...actual,
    getMyLearningResource: vi.fn(),
    downloadMyLearningResourceFile: vi.fn(),
    downloadMyLearningResourceFileWithProgress: vi.fn(),
    listMyLearningComments: vi.fn(),
    postMyLearningComment: vi.fn(),
    editMyLearningComment: vi.fn(),
    recordMyLearningInteraction: vi.fn(),
  };
});

const BASE_RESOURCE = {
  id: "resource-1",
  title: "Fractions Explainer",
  description: null,
  subjectName: "Mathematics",
  bodyHtml: null,
  youtubeVideoId: null,
  durationSeconds: null,
  fileSizeBytes: null,
  commentsEnabled: true,
  completed: false,
  positionSeconds: null,
};

const DEFAULT_INTERACTION: learningApi.MyLearningInteractionView = {
  resourceId: "resource-1",
  completed: false,
  completedAt: null,
  positionSeconds: null,
  lastOpenedAt: "2026-01-01T00:00:00Z",
};

function renderPage(resourceId = "resource-1") {
  const router = createMemoryRouter(
    [{ path: "/student/resources/:resourceId", element: <StudentResourceDetailPage /> }],
    { initialEntries: [`/student/resources/${resourceId}`] },
  );
  render(<RouterProvider router={router} />);
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(learningApi.listMyLearningComments).mockResolvedValue([]);
  vi.mocked(learningApi.recordMyLearningInteraction).mockResolvedValue(DEFAULT_INTERACTION);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("StudentResourceDetailPage", () => {
  it("renders the PDF iframe for a PDF resource, fed by the plain (non-progress) blob fetch", async () => {
    vi.mocked(learningApi.getMyLearningResource).mockResolvedValue({
      ...BASE_RESOURCE,
      resourceType: "PDF",
      fileSizeBytes: 1000,
    });
    vi.mocked(learningApi.downloadMyLearningResourceFile).mockResolvedValue(
      new Blob(["%PDF"], { type: "application/pdf" }),
    );

    renderPage();

    const iframe = await screen.findByTitle("Fractions Explainer");
    expect(iframe.tagName).toBe("IFRAME");
    expect(learningApi.downloadMyLearningResourceFileWithProgress).not.toHaveBeenCalled();
  });

  it("shows a determinate progress bar while a video downloads, then the video element once it resolves", async () => {
    vi.mocked(learningApi.getMyLearningResource).mockResolvedValue({
      ...BASE_RESOURCE,
      resourceType: "VIDEO",
      fileSizeBytes: 2_000_000,
      durationSeconds: 300,
    });
    let resolveDownload: (blob: Blob) => void = () => {};
    vi.mocked(learningApi.downloadMyLearningResourceFileWithProgress).mockImplementation(
      (_resourceId, onProgress) =>
        new Promise((resolve) => {
          onProgress({ loadedBytes: 1_000_000, totalBytes: 2_000_000 });
          resolveDownload = resolve;
        }),
    );

    renderPage();

    expect(await screen.findByText(/Downloading… 50%/)).toBeInTheDocument();

    resolveDownload(new Blob(["fake-mp4-bytes"], { type: "video/mp4" }));

    const video = await screen.findByTitle("Fractions Explainer");
    expect(video.tagName).toBe("VIDEO");
  });

  it("shows an error message when the media file fails to load", async () => {
    vi.mocked(learningApi.getMyLearningResource).mockResolvedValue({
      ...BASE_RESOURCE,
      resourceType: "AUDIO",
    });
    vi.mocked(learningApi.downloadMyLearningResourceFileWithProgress).mockRejectedValue(new Error("network down"));

    renderPage();

    expect(await screen.findByText(/Failed to load this file/)).toBeInTheDocument();
  });

  it("renders the resource's own comments once loaded", async () => {
    vi.mocked(learningApi.getMyLearningResource).mockResolvedValue({ ...BASE_RESOURCE, resourceType: "RICH_TEXT" });
    vi.mocked(learningApi.listMyLearningComments).mockResolvedValue([
      {
        commentId: "comment-1",
        resourceId: "resource-1",
        authorName: "Ada Obi",
        isSelf: true,
        body: "Thanks for this!",
        createdAt: "2026-08-15T09:00:00Z",
        editedAt: null,
        hidden: false,
        canEdit: true,
        canModerate: false,
        editableUntil: "2026-08-15T09:15:00Z",
      },
    ]);

    renderPage();

    expect(await screen.findByText("Thanks for this!")).toBeInTheDocument();
  });

  it("hides the comment composer once comments_enabled is off for the resource", async () => {
    vi.mocked(learningApi.getMyLearningResource).mockResolvedValue({
      ...BASE_RESOURCE,
      resourceType: "RICH_TEXT",
      commentsEnabled: false,
    });

    renderPage();

    await screen.findByText("Comments are turned off for this resource.");
    expect(screen.queryByPlaceholderText("Write a comment…")).not.toBeInTheDocument();
  });

  it("fires the opened ping once on mount with an all-omitted body", async () => {
    vi.mocked(learningApi.getMyLearningResource).mockResolvedValue({ ...BASE_RESOURCE, resourceType: "RICH_TEXT" });

    renderPage();

    await screen.findByText("Not yet completed");
    expect(learningApi.recordMyLearningInteraction).toHaveBeenCalledTimes(1);
    expect(learningApi.recordMyLearningInteraction).toHaveBeenCalledWith("resource-1", {});
  });

  it("toggles completion via the mark-as-done button and re-renders from the response view", async () => {
    const user = userEvent.setup();
    vi.mocked(learningApi.getMyLearningResource).mockResolvedValue({ ...BASE_RESOURCE, resourceType: "RICH_TEXT" });
    vi.mocked(learningApi.recordMyLearningInteraction).mockResolvedValueOnce(DEFAULT_INTERACTION).mockResolvedValueOnce({
      resourceId: "resource-1",
      completed: true,
      completedAt: "2026-01-02T10:00:00Z",
      positionSeconds: null,
      lastOpenedAt: "2026-01-02T10:00:00Z",
    });

    renderPage();

    await screen.findByText("Not yet completed");
    await user.click(screen.getByRole("button", { name: "Mark as done" }));

    expect(await screen.findByText("Completed")).toBeInTheDocument();
    expect(learningApi.recordMyLearningInteraction).toHaveBeenLastCalledWith("resource-1", { completed: true });
  });

  it("resumes playback from the initial view's positionSeconds on loadedmetadata", async () => {
    vi.mocked(learningApi.getMyLearningResource).mockResolvedValue({
      ...BASE_RESOURCE,
      resourceType: "VIDEO",
      positionSeconds: 42,
    });
    vi.mocked(learningApi.downloadMyLearningResourceFileWithProgress).mockResolvedValue(
      new Blob(["fake-mp4-bytes"], { type: "video/mp4" }),
    );

    renderPage();

    const video = (await screen.findByTitle("Fractions Explainer")) as HTMLVideoElement;
    video.dispatchEvent(new Event("loadedmetadata"));

    expect(video.currentTime).toBe(42);
  });

  it("schedules a throttled, floored position autosave on timeupdate", async () => {
    vi.mocked(learningApi.getMyLearningResource).mockResolvedValue({
      ...BASE_RESOURCE,
      resourceType: "VIDEO",
      positionSeconds: null,
    });
    vi.mocked(learningApi.downloadMyLearningResourceFileWithProgress).mockResolvedValue(
      new Blob(["fake-mp4-bytes"], { type: "video/mp4" }),
    );

    renderPage();
    const video = (await screen.findByTitle("Fractions Explainer")) as HTMLVideoElement;

    vi.useFakeTimers();
    Object.defineProperty(video, "currentTime", { value: 12.7, writable: true, configurable: true });
    video.dispatchEvent(new Event("timeupdate"));
    // Not yet - a position autosave is throttled, not immediate.
    expect(learningApi.recordMyLearningInteraction).not.toHaveBeenCalledWith("resource-1", { positionSeconds: 12 });

    vi.advanceTimersByTime(15_000);
    expect(learningApi.recordMyLearningInteraction).toHaveBeenCalledWith("resource-1", { positionSeconds: 12 });
  });
});
