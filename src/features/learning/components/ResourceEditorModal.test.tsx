import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as filesApi from "@/api/files";
import * as learningApi from "@/api/learning";
import { ResourceEditorModal } from "@/features/learning/components/ResourceEditorModal";

vi.mock("@/api/files", async () => {
  const actual = await vi.importActual<typeof import("@/api/files")>("@/api/files");
  return { ...actual, uploadFile: vi.fn() };
});

vi.mock("@/api/learning", async () => {
  const actual = await vi.importActual<typeof import("@/api/learning")>("@/api/learning");
  return { ...actual, createLearningResource: vi.fn(), updateLearningResource: vi.fn() };
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

function fileOfSize(name: string, type: string, sizeBytes: number): File {
  const file = new File([""], name, { type });
  Object.defineProperty(file, "size", { value: sizeBytes });
  return file;
}

beforeEach(() => vi.clearAllMocks());

describe("ResourceEditorModal", () => {
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

  it("rejects an over-cap mp3 before ever calling uploadFile", async () => {
    renderModal(true);
    const user = userEvent.setup();
    await user.selectOptions(screen.getByLabelText("Type"), "AUDIO");

    const oversized = fileOfSize("lesson.mp3", "audio/mpeg", filesApi.uploadLimitFor("audio/mpeg") + 1);
    const fileInput = screen.getByLabelText(/File/) as HTMLInputElement;
    await user.upload(fileInput, oversized);

    expect(filesApi.uploadFile).not.toHaveBeenCalled();
    expect(await screen.findByText(/larger than/)).toBeInTheDocument();
  });

  // jsdom's HTMLMediaElement never fires `loadedmetadata`, so the modal's duration probe always
  // falls through to its own timeout before resolving `null` - this test's timeout must exceed
  // that (DURATION_PROBE_TIMEOUT_MS, 4s) rather than race it.
  it(
    "submits an AUDIO resource with the uploaded fileId and resourceType AUDIO",
    async () => {
      vi.mocked(filesApi.uploadFile).mockResolvedValue({
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
});
