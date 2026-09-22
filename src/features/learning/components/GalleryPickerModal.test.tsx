import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as learningApi from "@/api/learning";
import type { LearningGalleryFileView } from "@/api/learning";
import type { Page } from "@/api/types";
import { GalleryPickerModal } from "@/features/learning/components/GalleryPickerModal";

vi.mock("@/api/learning", async () => {
  const actual = await vi.importActual<typeof import("@/api/learning")>("@/api/learning");
  return { ...actual, listLearningGalleryFiles: vi.fn() };
});

function pageOf(content: LearningGalleryFileView[]): Page<LearningGalleryFileView> {
  return { content, totalElements: content.length, totalPages: 1, number: 0, size: 9 };
}

const HANDOUT: LearningGalleryFileView = {
  fileId: "file-1",
  fileName: "handout.pdf",
  contentType: "application/pdf",
  sizeBytes: 204_800,
  resourceType: "PDF",
  durationSeconds: null,
  resourceTitle: "Handout B",
  className: "Primary 2",
  subjectName: "English",
  useCount: 2,
  lastUsedAt: "2026-09-02T10:00:00Z",
  uploadedAt: "2026-03-10T14:00:00Z",
};

beforeEach(() => vi.clearAllMocks());

describe("GalleryPickerModal", () => {
  it("loads and renders a deduped file as a card, showing the reuse count and upload date", async () => {
    vi.mocked(learningApi.listLearningGalleryFiles).mockResolvedValue(pageOf([HANDOUT]));

    render(
      <GalleryPickerModal
        classId="class-1"
        subjectId="subject-1"
        resourceType="PDF"
        selectedFileId={null}
        onPick={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    expect(await screen.findByText("Handout B")).toBeInTheDocument();
    expect(screen.getByText("handout.pdf")).toBeInTheDocument();
    expect(screen.getByText("Used by 2 resources")).toBeInTheDocument();
    expect(screen.getByText(/10 Mar 2026/)).toBeInTheDocument();
    expect(learningApi.listLearningGalleryFiles).toHaveBeenCalledWith(
      expect.objectContaining({ classId: "class-1", subjectId: "subject-1", resourceType: "PDF" }),
    );
  });

  it("doesn't show a reuse count for a file used by only one resource", async () => {
    vi.mocked(learningApi.listLearningGalleryFiles).mockResolvedValue(pageOf([{ ...HANDOUT, useCount: 1 }]));

    render(
      <GalleryPickerModal
        classId="class-1"
        subjectId="subject-1"
        resourceType="PDF"
        selectedFileId={null}
        onPick={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    await screen.findByText("Handout B");
    expect(screen.queryByText(/Used by/)).not.toBeInTheDocument();
  });

  it("calls onPick with the card's file and closes when clicked", async () => {
    vi.mocked(learningApi.listLearningGalleryFiles).mockResolvedValue(pageOf([HANDOUT]));
    const onPick = vi.fn();
    const onClose = vi.fn();
    const user = userEvent.setup();

    render(
      <GalleryPickerModal
        classId="class-1"
        subjectId="subject-1"
        resourceType="PDF"
        selectedFileId={null}
        onPick={onPick}
        onClose={onClose}
      />,
    );

    await user.click(await screen.findByText("Handout B"));
    expect(onPick).toHaveBeenCalledWith(HANDOUT);
    expect(onClose).toHaveBeenCalled();
  });

  it("shows an empty state when the level has no gallery files yet", async () => {
    vi.mocked(learningApi.listLearningGalleryFiles).mockResolvedValue(pageOf([]));

    render(
      <GalleryPickerModal
        classId="class-1"
        subjectId="subject-1"
        resourceType="PDF"
        selectedFileId={null}
        onPick={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    expect(await screen.findByText("No files here yet")).toBeInTheDocument();
  });

  it("shows an error message when the load fails", async () => {
    vi.mocked(learningApi.listLearningGalleryFiles).mockRejectedValue(new Error("network down"));

    render(
      <GalleryPickerModal
        classId="class-1"
        subjectId="subject-1"
        resourceType="PDF"
        selectedFileId={null}
        onPick={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    expect(await screen.findByText("Failed to load the gallery")).toBeInTheDocument();
  });

  it("closes on Escape without calling onPick", async () => {
    vi.mocked(learningApi.listLearningGalleryFiles).mockResolvedValue(pageOf([HANDOUT]));
    const onPick = vi.fn();
    const onClose = vi.fn();
    const user = userEvent.setup();

    render(
      <GalleryPickerModal
        classId="class-1"
        subjectId="subject-1"
        resourceType="PDF"
        selectedFileId={null}
        onPick={onPick}
        onClose={onClose}
      />,
    );

    await screen.findByText("Handout B");
    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalled();
    expect(onPick).not.toHaveBeenCalled();
  });
});
