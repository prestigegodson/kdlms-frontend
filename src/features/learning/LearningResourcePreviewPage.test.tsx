import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as filesApi from "@/api/files";
import * as learningApi from "@/api/learning";
import { LearningResourcePreviewPage } from "@/features/learning/LearningResourcePreviewPage";

vi.mock("@/api/learning", async () => {
  const actual = await vi.importActual<typeof import("@/api/learning")>("@/api/learning");
  return {
    ...actual,
    getLearningResource: vi.fn(),
    listLearningComments: vi.fn(),
    hideLearningComment: vi.fn(),
    unhideLearningComment: vi.fn(),
    deleteLearningComment: vi.fn(),
    setLearningResourceCommentsEnabled: vi.fn(),
    publishLearningResource: vi.fn(),
    unpublishLearningResource: vi.fn(),
    archiveLearningResource: vi.fn(),
  };
});

vi.mock("@/api/files", async () => {
  const actual = await vi.importActual<typeof import("@/api/files")>("@/api/files");
  return {
    ...actual,
    downloadFile: vi.fn(),
    downloadFileWithProgress: vi.fn(),
  };
});

const BASE_RESOURCE: learningApi.LearningResourceView = {
  id: "resource-1",
  classId: "class-1",
  className: "JSS 1A",
  subjectId: "subject-1",
  subjectName: "Mathematics",
  termId: "term-1",
  title: "Fractions Explainer",
  description: null,
  resourceType: "RICH_TEXT",
  bodyHtml: null,
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

function renderPage(resourceId = "resource-1") {
  const router = createMemoryRouter(
    [{ path: "/school/learning-resources/:resourceId", element: <LearningResourcePreviewPage /> }],
    { initialEntries: [`/school/learning-resources/${resourceId}`] },
  );
  render(<RouterProvider router={router} />);
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(learningApi.listLearningComments).mockResolvedValue([]);
});

describe("LearningResourcePreviewPage", () => {
  it("renders a RICH_TEXT resource's sanitized body and resolves an embedded image through the authenticated files proxy", async () => {
    vi.mocked(learningApi.getLearningResource).mockResolvedValue({
      ...BASE_RESOURCE,
      bodyHtml: '<p>Halves and <img data-file-id="img-1" alt="diagram" /></p>',
    });
    vi.mocked(filesApi.downloadFile).mockResolvedValue(new Blob(["fake-png"], { type: "image/png" }));

    renderPage();

    expect(await screen.findByText(/Halves and/)).toBeInTheDocument();
    expect(await screen.findByAltText("diagram")).toBeInTheDocument();
    expect(filesApi.downloadFile).toHaveBeenCalledWith("img-1");
  });

  it("renders the PDF iframe once the blob resolves, fed by the authenticated files proxy", async () => {
    vi.mocked(learningApi.getLearningResource).mockResolvedValue({
      ...BASE_RESOURCE,
      resourceType: "PDF",
      fileId: "file-1",
    });
    vi.mocked(filesApi.downloadFile).mockResolvedValue(new Blob(["%PDF"], { type: "application/pdf" }));

    renderPage();

    const iframe = await screen.findByTitle("Fractions Explainer");
    expect(iframe.tagName).toBe("IFRAME");
    expect(filesApi.downloadFile).toHaveBeenCalledWith("file-1");
    expect(filesApi.downloadFileWithProgress).not.toHaveBeenCalled();
  });

  it("shows a determinate progress bar while a video downloads, then the video element once it resolves", async () => {
    vi.mocked(learningApi.getLearningResource).mockResolvedValue({
      ...BASE_RESOURCE,
      resourceType: "VIDEO",
      fileId: "file-1",
      durationSeconds: 300,
    });
    let resolveDownload: (blob: Blob) => void = () => {};
    vi.mocked(filesApi.downloadFileWithProgress).mockImplementation(
      (_fileId, onProgress) =>
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
    expect(filesApi.downloadFileWithProgress).toHaveBeenCalledWith("file-1", expect.any(Function));
  });

  it("renders the sandboxed YouTube embed for a YOUTUBE resource", async () => {
    vi.mocked(learningApi.getLearningResource).mockResolvedValue({
      ...BASE_RESOURCE,
      resourceType: "YOUTUBE",
      youtubeVideoId: "dQw4w9WgXcQ",
    });

    renderPage();

    const iframe = await screen.findByTitle("Fractions Explainer");
    expect(iframe.getAttribute("src")).toBe("https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ");
  });

  it("shows no mark-as-done control and no comment composer - both are a student's own interaction", async () => {
    vi.mocked(learningApi.getLearningResource).mockResolvedValue(BASE_RESOURCE);

    renderPage();

    await screen.findByText("Fractions Explainer");
    expect(screen.queryByRole("button", { name: "Mark as done" })).not.toBeInTheDocument();
    expect(screen.queryByPlaceholderText("Write a comment…")).not.toBeInTheDocument();
  });

  it("moderates comments via hide, the same control the staff modal uses", async () => {
    vi.mocked(learningApi.getLearningResource).mockResolvedValue(BASE_RESOURCE);
    vi.mocked(learningApi.listLearningComments).mockResolvedValue([
      {
        commentId: "comment-1",
        resourceId: "resource-1",
        authorName: "Ada Obi",
        isSelf: false,
        body: "Great lesson!",
        createdAt: "2026-08-15T09:00:00Z",
        editedAt: null,
        hidden: false,
        canEdit: false,
        canModerate: true,
        editableUntil: "2026-08-15T09:15:00Z",
      },
    ]);
    vi.mocked(learningApi.hideLearningComment).mockResolvedValue({
      commentId: "comment-1",
      resourceId: "resource-1",
      authorName: "Ada Obi",
      isSelf: false,
      body: "Great lesson!",
      createdAt: "2026-08-15T09:00:00Z",
      editedAt: null,
      hidden: true,
      canEdit: false,
      canModerate: true,
      editableUntil: "2026-08-15T09:15:00Z",
    });
    const user = userEvent.setup();

    renderPage();
    await screen.findByText("Great lesson!");

    await user.click(screen.getByRole("button", { name: "Hide" }));

    expect(learningApi.hideLearningComment).toHaveBeenCalledWith("resource-1", "comment-1");
  });

  it("offers Unpublish (not Publish) for a PUBLISHED resource, following the server-derived actions", async () => {
    vi.mocked(learningApi.getLearningResource).mockResolvedValue(BASE_RESOURCE);

    renderPage();

    await screen.findByText("Fractions Explainer");
    expect(screen.getByRole("button", { name: /Unpublish/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Publish$/ })).not.toBeInTheDocument();
  });

  it("offers Publish for a DRAFT resource and calls it from the header action", async () => {
    vi.mocked(learningApi.getLearningResource).mockResolvedValue({
      ...BASE_RESOURCE,
      status: "DRAFT",
      actions: { canEdit: true, canPublish: true, canUnpublish: false, canArchive: true, canDelete: true },
    });
    vi.mocked(learningApi.publishLearningResource).mockResolvedValue({ ...BASE_RESOURCE, status: "PUBLISHED" });
    const user = userEvent.setup();

    renderPage();
    await screen.findByText("Fractions Explainer");

    await user.click(screen.getByRole("button", { name: /Publish/ }));

    expect(learningApi.publishLearningResource).toHaveBeenCalledWith("resource-1");
  });
});
