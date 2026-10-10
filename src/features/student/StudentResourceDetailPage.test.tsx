import { render, screen, waitFor } from "@testing-library/react";
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
    downloadMyLearningResourceImage: vi.fn(),
    getMyLearningResourceMediaUrl: vi.fn(),
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
  return render(<RouterProvider router={router} />);
}

function mediaUrl(version: string): learningApi.MediaStreamUrlView {
  return {
    url: `https://bucket.example/school/2026/video.mp4?X-Amz-Signature=${version}`,
    expiresAt: "2026-10-09T12:00:00Z",
  };
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
  it("renders the PDF iframe for a PDF resource, fed by the blob fetch rather than a media URL", async () => {
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
    expect(learningApi.getMyLearningResourceMediaUrl).not.toHaveBeenCalled();
  });

  it("renders a rich-text resource's embedded image through the resource's own image endpoint", async () => {
    vi.mocked(learningApi.getMyLearningResource).mockResolvedValue({
      ...BASE_RESOURCE,
      resourceType: "RICH_TEXT",
      bodyHtml: '<p>Look</p><img data-file-id="file-9" alt="A shaded triangle">',
    });
    vi.mocked(learningApi.downloadMyLearningResourceImage).mockResolvedValue(
      new Blob(["png"], { type: "image/png" }),
    );

    renderPage();

    expect(await screen.findByAltText("A shaded triangle")).toBeInTheDocument();
    expect(learningApi.downloadMyLearningResourceImage).toHaveBeenCalledWith(
      "/api/v1/me/learning-resources/resource-1/images/file-9",
    );
  });

  it("streams a video straight from its presigned URL, without downloading it first", async () => {
    vi.mocked(learningApi.getMyLearningResource).mockResolvedValue({
      ...BASE_RESOURCE,
      resourceType: "VIDEO",
      fileSizeBytes: 2_000_000,
      durationSeconds: 300,
    });
    vi.mocked(learningApi.getMyLearningResourceMediaUrl).mockResolvedValue(mediaUrl("first"));

    renderPage();

    const video = (await screen.findByTitle("Fractions Explainer")) as HTMLVideoElement;
    expect(video.tagName).toBe("VIDEO");
    expect(video.getAttribute("src")).toBe(mediaUrl("first").url);
    expect(learningApi.downloadMyLearningResourceFile).not.toHaveBeenCalled();
  });

  it("fetches a fresh URL when the current one stops working and resumes where it left off", async () => {
    vi.mocked(learningApi.getMyLearningResource).mockResolvedValue({
      ...BASE_RESOURCE,
      resourceType: "VIDEO",
      positionSeconds: 5,
    });
    vi.mocked(learningApi.getMyLearningResourceMediaUrl)
      .mockResolvedValueOnce(mediaUrl("first"))
      .mockResolvedValueOnce(mediaUrl("second"));

    renderPage();
    const video = (await screen.findByTitle("Fractions Explainer")) as HTMLVideoElement;
    video.currentTime = 120;
    video.dispatchEvent(new Event("error"));

    await waitFor(() => expect(video.getAttribute("src")).toBe(mediaUrl("second").url));
    expect(learningApi.getMyLearningResourceMediaUrl).toHaveBeenCalledTimes(2);
    video.dispatchEvent(new Event("loadedmetadata"));
    // The position it had reached, not the page's original resume point.
    expect(video.currentTime).toBe(120);
  });

  it("gives up after a refreshed URL fails too", async () => {
    vi.mocked(learningApi.getMyLearningResource).mockResolvedValue({ ...BASE_RESOURCE, resourceType: "AUDIO" });
    vi.mocked(learningApi.getMyLearningResourceMediaUrl)
      .mockResolvedValueOnce(mediaUrl("first"))
      .mockResolvedValueOnce(mediaUrl("second"));

    const { container } = renderPage();
    await waitFor(() => expect(container.querySelector("audio")?.getAttribute("src")).toBe(mediaUrl("first").url));
    container.querySelector("audio")!.dispatchEvent(new Event("error"));
    await waitFor(() => expect(container.querySelector("audio")?.getAttribute("src")).toBe(mediaUrl("second").url));
    container.querySelector("audio")!.dispatchEvent(new Event("error"));

    expect(await screen.findByText(/Failed to load this file/)).toBeInTheDocument();
    expect(learningApi.getMyLearningResourceMediaUrl).toHaveBeenCalledTimes(2);
  });

  it("shows an error message when the media file fails to load", async () => {
    vi.mocked(learningApi.getMyLearningResource).mockResolvedValue({
      ...BASE_RESOURCE,
      resourceType: "AUDIO",
    });
    vi.mocked(learningApi.getMyLearningResourceMediaUrl).mockRejectedValue(new Error("network down"));

    renderPage();

    expect(await screen.findByText(/Failed to load this file/)).toBeInTheDocument();
  });

  it("renders the resource's own comments once loaded", async () => {
    vi.mocked(learningApi.getMyLearningResource).mockResolvedValue({ ...BASE_RESOURCE, resourceType: "RICH_TEXT" });
    vi.mocked(learningApi.listMyLearningComments).mockResolvedValue([
      {
        commentId: "comment-1",
        resourceId: "resource-1",
        parentCommentId: null,
        authorRole: "STUDENT",
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
    vi.mocked(learningApi.getMyLearningResourceMediaUrl).mockResolvedValue(mediaUrl("first"));

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
    vi.mocked(learningApi.getMyLearningResourceMediaUrl).mockResolvedValue(mediaUrl("first"));

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
