import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as filesApi from "@/api/files";
import * as learningApi from "@/api/learning";
import { ResourceEditorModal } from "@/features/learning/components/ResourceEditorModal";

vi.mock("@/api/files", async () => {
  const actual = await vi.importActual<typeof import("@/api/files")>("@/api/files");
  return { ...actual, uploadFile: vi.fn(), uploadMediaFile: vi.fn() };
});

vi.mock("@/api/learning", async () => {
  const actual = await vi.importActual<typeof import("@/api/learning")>("@/api/learning");
  return {
    ...actual,
    createLearningResource: vi.fn(),
    updateLearningResource: vi.fn(),
    listLearningGalleryFiles: vi.fn(),
  };
});

const SUBJECTS = [{ subjectId: "subject-1", subjectName: "Mathematics" }];

function renderModal(canAuthorMedia: boolean) {
  render(
    <ResourceEditorModal
      classId="class-1"
      subjectId="subject-1"
      termId="term-1"
      subjects={SUBJECTS}
      canAuthorMedia={canAuthorMedia}
      onClose={vi.fn()}
      onSaved={vi.fn()}
    />,
  );
}

function renderModalWithWindow(availableFrom: string | null, availableUntil: string | null) {
  vi.mocked(learningApi.updateLearningResource).mockResolvedValue({} as learningApi.LearningResourceView);
  render(
    <ResourceEditorModal
      classId="class-1"
      subjectId="subject-1"
      termId="term-1"
      subjects={SUBJECTS}
      canAuthorMedia
      resource={{
        id: "resource-1",
        classId: "class-1",
        className: "Class 1",
        subjectId: "subject-1",
        subjectName: "Mathematics",
        termId: "term-1",
        title: "Handout",
        description: null,
        resourceType: "PDF",
        bodyHtml: null,
        fileId: "file-1",
        youtubeVideoId: null,
        durationSeconds: null,
        commentsEnabled: true,
        status: "DRAFT",
        position: 0,
        availableFrom,
        availableUntil,
        actions: { canEdit: true, canPublish: true, canUnpublish: false, canArchive: true, canDelete: true },
        updatedAt: "2026-01-01T00:00:00Z",
      }}
      onClose={vi.fn()}
      onSaved={vi.fn()}
    />,
  );
}

function fileOfSize(name: string, type: string, sizeBytes: number): File {
  const file = new File([""], name, { type });
  Object.defineProperty(file, "size", { value: sizeBytes });
  return file;
}

beforeEach(() => vi.clearAllMocks());

describe("ResourceEditorModal", () => {
  it("creates a resource for a subject group picked beside the subjects", async () => {
    vi.mocked(learningApi.createLearningResource).mockResolvedValue({} as learningApi.LearningResourceView);
    render(
      <ResourceEditorModal
        classId="class-1"
        subjectId="subject-1"
        termId="term-1"
        subjects={SUBJECTS}
        subjectGroups={[{ subjectGroupId: "group-1", subjectGroupName: "Sciences" }]}
        canAuthorMedia={false}
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />,
    );
    const user = userEvent.setup();
    await user.selectOptions(screen.getByLabelText("Subject"), "Sciences");
    await user.selectOptions(screen.getByLabelText("Type"), "YOUTUBE");
    await user.type(screen.getByLabelText("Title"), "Lab safety");
    await user.type(screen.getByLabelText("YouTube URL"), "https://youtu.be/dQw4w9WgXcQ");
    await user.click(screen.getByRole("button", { name: "Add resource" }));

    expect(learningApi.createLearningResource).toHaveBeenCalledWith(
      expect.objectContaining({ classId: "class-1", subjectId: null, subjectGroupId: "group-1", termId: "term-1" }),
    );
  });

  it("hides the Audio/Video type options when the caller can't author media", () => {
    renderModal(false);
    const typeSelect = screen.getByLabelText("Type");
    expect(screen.queryByRole("option", { name: "Audio (mp3)" })).not.toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Video (mp4)" })).not.toBeInTheDocument();
    expect(typeSelect).toBeInTheDocument();
  });

  it("shows the Audio/Video type options when the caller can author media", () => {
    renderModal(true);
    expect(screen.getByRole("option", { name: "Audio (mp3)" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Video (mp4)" })).toBeInTheDocument();
  });

  it("rejects an over-cap mp3 before ever uploading it", async () => {
    renderModal(true);
    const user = userEvent.setup();
    await user.selectOptions(screen.getByLabelText("Type"), "AUDIO");

    const oversized = fileOfSize("lesson.mp3", "audio/mpeg", filesApi.uploadLimitFor("audio/mpeg") + 1);
    const fileInput = screen.getByLabelText(/File/) as HTMLInputElement;
    await user.upload(fileInput, oversized);

    expect(filesApi.uploadMediaFile).not.toHaveBeenCalled();
    expect(await screen.findByText(/larger than/)).toBeInTheDocument();
  });

  it("uploads a video in parts with a progress bar, and Cancel upload aborts it", async () => {
    let signal: AbortSignal | undefined;
    vi.mocked(filesApi.uploadMediaFile).mockImplementation((_file, options) => {
      signal = options?.signal;
      options?.onProgress?.(0.4);
      return new Promise(() => {});
    });
    renderModal(true);
    const user = userEvent.setup();
    await user.selectOptions(screen.getByLabelText("Type"), "VIDEO");

    await user.upload(screen.getByLabelText(/File/) as HTMLInputElement, fileOfSize("lesson.mp4", "video/mp4", 1000));

    expect(filesApi.uploadFile).not.toHaveBeenCalled();
    const uploaded = vi.mocked(filesApi.uploadMediaFile).mock.calls[0][0];
    expect(uploaded.type).toBe("video/mp4");
    expect(screen.getByRole("progressbar", { name: "Upload progress" })).toHaveAttribute("aria-valuenow", "40");
    expect(screen.getByText("Uploading 40%")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Cancel upload" }));

    expect(signal?.aborted).toBe(true);
    expect(screen.queryByRole("progressbar", { name: "Upload progress" })).not.toBeInTheDocument();
  });

  // jsdom's HTMLMediaElement never fires `loadedmetadata`, so the modal's duration probe always
  // falls through to its own timeout before resolving `null` - this test's timeout must exceed
  // that (DURATION_PROBE_TIMEOUT_MS, 4s) rather than race it.
  it(
    "submits an AUDIO resource with the uploaded fileId and resourceType AUDIO",
    async () => {
      vi.mocked(filesApi.uploadMediaFile).mockResolvedValue({
        fileId: "file-1",
        fileName: "lesson.mp3",
        contentType: "audio/mpeg",
        sizeBytes: 1000,
      });
      vi.mocked(learningApi.createLearningResource).mockResolvedValue({
        id: "resource-1",
        classId: "class-1",
        className: "Class 1",
        subjectId: "subject-1",
        subjectName: "Mathematics",
        termId: "term-1",
        title: "Times Tables Song",
        description: null,
        resourceType: "AUDIO",
        bodyHtml: null,
        fileId: "file-1",
        youtubeVideoId: null,
        durationSeconds: null,
        commentsEnabled: true,
        status: "DRAFT",
        position: 0,
        availableFrom: null,
        availableUntil: null,
        actions: { canEdit: true, canPublish: true, canUnpublish: false, canArchive: true, canDelete: true },
        updatedAt: "2026-01-01T00:00:00Z",
      });

      renderModal(true);
      const user = userEvent.setup();
      await user.selectOptions(screen.getByLabelText("Type"), "AUDIO");
      await user.type(screen.getByLabelText("Title"), "Times Tables Song");

      const smallMp3 = fileOfSize("lesson.mp3", "audio/mpeg", 1000);
      await user.upload(screen.getByLabelText(/File/) as HTMLInputElement, smallMp3);
      expect(await screen.findByText("lesson.mp3", {}, { timeout: 6000 })).toBeInTheDocument();

      await user.click(screen.getByRole("button", { name: "Add resource" }));

      expect(learningApi.createLearningResource).toHaveBeenCalledWith(
        expect.objectContaining({
          classId: "class-1",
          subjectId: "subject-1",
          termId: "term-1",
          resourceType: "AUDIO",
          fileId: "file-1",
          title: "Times Tables Song",
        }),
      );
    },
    8000,
  );

  it("opens the gallery modal (not a tab) when 'Choose from gallery' is clicked, with no tablist rendered", async () => {
    vi.mocked(learningApi.listLearningGalleryFiles).mockResolvedValue({
      content: [],
      totalElements: 0,
      totalPages: 1,
      number: 0,
      size: 9,
    });

    renderModal(true);
    const user = userEvent.setup();
    await user.selectOptions(screen.getByLabelText("Type"), "PDF");

    expect(screen.queryByRole("tablist")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Choose from gallery" }));

    expect(await screen.findByRole("dialog", { name: "Choose from gallery" })).toBeInTheDocument();
  });

  it("sends the availability window as local-day start/end instants", async () => {
    vi.mocked(filesApi.uploadFile).mockResolvedValue({
      fileId: "file-1",
      fileName: "handout.pdf",
      contentType: "application/pdf",
      sizeBytes: 1000,
    });

    renderModal(true);
    const user = userEvent.setup();
    await user.selectOptions(screen.getByLabelText("Type"), "PDF");
    await user.type(screen.getByLabelText("Title"), "Handout");
    await user.upload(screen.getByLabelText(/File/) as HTMLInputElement, fileOfSize("handout.pdf", "application/pdf", 1000));
    expect(await screen.findByText("handout.pdf")).toBeInTheDocument();

    await user.type(screen.getByLabelText("Available from"), "2026-03-10");
    await user.type(screen.getByLabelText("Available until"), "2026-03-20");
    await user.click(screen.getByRole("button", { name: "Add resource" }));

    expect(learningApi.createLearningResource).toHaveBeenCalledWith(
      expect.objectContaining({
        availableFrom: new Date(2026, 2, 10, 0, 0, 0, 0).toISOString(),
        availableUntil: new Date(2026, 2, 20, 23, 59, 59, 999).toISOString(),
      }),
    );
  });

  it("sends the availability window with the chosen times", async () => {
    vi.mocked(filesApi.uploadFile).mockResolvedValue({
      fileId: "file-1",
      fileName: "handout.pdf",
      contentType: "application/pdf",
      sizeBytes: 1000,
    });

    renderModal(true);
    const user = userEvent.setup();
    await user.selectOptions(screen.getByLabelText("Type"), "PDF");
    await user.type(screen.getByLabelText("Title"), "Handout");
    await user.upload(screen.getByLabelText(/File/) as HTMLInputElement, fileOfSize("handout.pdf", "application/pdf", 1000));
    expect(await screen.findByText("handout.pdf")).toBeInTheDocument();

    await user.type(screen.getByLabelText("Available from"), "2026-03-10");
    await user.type(screen.getByLabelText("Available from time"), "08:30");
    await user.type(screen.getByLabelText("Available until"), "2026-03-20");
    await user.type(screen.getByLabelText("Available until time"), "16:00");
    await user.click(screen.getByRole("button", { name: "Add resource" }));

    expect(learningApi.createLearningResource).toHaveBeenCalledWith(
      expect.objectContaining({
        availableFrom: new Date(2026, 2, 10, 8, 30).toISOString(),
        availableUntil: new Date(2026, 2, 20, 16, 0).toISOString(),
      }),
    );
  });

  it("refuses a same-day window whose end time is before its start time", async () => {
    renderModal(true);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText("Title"), "Notes");
    await user.type(screen.getByLabelText("Available from"), "2026-03-10");
    await user.type(screen.getByLabelText("Available from time"), "14:00");
    await user.type(screen.getByLabelText("Available until"), "2026-03-10");
    await user.type(screen.getByLabelText("Available until time"), "09:00");

    expect(screen.getByText(/cannot be before its start\./)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add resource" })).toBeDisabled();
  });

  it("shows a stored end-of-day 'until' as a blank time and a stored time as itself", () => {
    renderModalWithWindow(new Date(2026, 2, 10, 14, 0).toISOString(), new Date(2026, 2, 20, 23, 59, 59, 999).toISOString());

    expect(screen.getByLabelText("Available from time")).toHaveValue("14:00");
    expect(screen.getByLabelText("Available until time")).toHaveValue("");
  });

  it("re-saves an untouched end-of-day 'until' as the identical instant", async () => {
    const until = new Date(2026, 2, 20, 23, 59, 59, 999).toISOString();
    renderModalWithWindow(null, until);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    expect(learningApi.updateLearningResource).toHaveBeenCalledWith(
      "resource-1",
      expect.objectContaining({ availableFrom: null, availableUntil: until }),
    );
  });

  it("blocks typing an 'Available until' date earlier than the chosen 'Available from' date", async () => {
    renderModal(true);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText("Available from"), "2026-03-20");
    // Rejected by the field's own min (wired to "Available from") before it ever reaches
    // onChange - so the draft is left uncommitted rather than producing an invalid window.
    await user.type(screen.getByLabelText("Available until"), "2026-03-10");

    expect(screen.queryByText(/cannot be before its start\./)).not.toBeInTheDocument();
  });

  it("disables submit and refuses to save when an existing resource's availability window is already inconsistent", () => {
    render(
      <ResourceEditorModal
        classId="class-1"
        subjectId="subject-1"
        termId="term-1"
        subjects={SUBJECTS}
        canAuthorMedia
        resource={{
          id: "resource-1",
          classId: "class-1",
          className: "Class 1",
          subjectId: "subject-1",
          subjectName: "Mathematics",
          termId: "term-1",
          title: "Handout",
          description: null,
          resourceType: "PDF",
          bodyHtml: null,
          fileId: "file-1",
          youtubeVideoId: null,
          durationSeconds: null,
          commentsEnabled: true,
          status: "DRAFT",
          position: 0,
          availableFrom: "2026-03-20T00:00:00.000Z",
          availableUntil: "2026-03-10T23:59:59.999Z",
          actions: { canEdit: true, canPublish: true, canUnpublish: false, canArchive: true, canDelete: true },
          updatedAt: "2026-01-01T00:00:00Z",
        }}
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: "Save changes" })).toBeDisabled();
    expect(screen.getByText(/cannot be before its start\./)).toBeInTheDocument();
    expect(learningApi.updateLearningResource).not.toHaveBeenCalled();
  });
});
