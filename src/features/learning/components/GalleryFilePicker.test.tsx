import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as learningApi from "@/api/learning";
import type { LearningGalleryFileView } from "@/api/learning";
import type { Page } from "@/api/types";
import { GalleryFilePicker } from "@/features/learning/components/GalleryFilePicker";

vi.mock("@/api/learning", async () => {
  const actual = await vi.importActual<typeof import("@/api/learning")>("@/api/learning");
  return { ...actual, listLearningGalleryFiles: vi.fn() };
});

function pageOf(content: LearningGalleryFileView[]): Page<LearningGalleryFileView> {
  return { content, totalElements: content.length, totalPages: 1, number: 0, size: 10 };
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
};

beforeEach(() => vi.clearAllMocks());

describe("GalleryFilePicker", () => {
  it("loads and renders a deduped file, showing the reuse count", async () => {
    vi.mocked(learningApi.listLearningGalleryFiles).mockResolvedValue(pageOf([HANDOUT]));

    render(
      <GalleryFilePicker
        classId="class-1"
        subjectId="subject-1"
        resourceType="PDF"
        selectedFileId={null}
        onPick={vi.fn()}
      />,
    );

    expect(await screen.findByText("Handout B")).toBeInTheDocument();
    expect(screen.getByText("handout.pdf")).toBeInTheDocument();
    expect(screen.getByText("Used by 2 resources")).toBeInTheDocument();
    expect(learningApi.listLearningGalleryFiles).toHaveBeenCalledWith(
      expect.objectContaining({ classId: "class-1", subjectId: "subject-1", resourceType: "PDF" }),
    );
  });

  it("doesn't show a reuse count for a file used by only one resource", async () => {
    vi.mocked(learningApi.listLearningGalleryFiles).mockResolvedValue(pageOf([{ ...HANDOUT, useCount: 1 }]));

    render(
      <GalleryFilePicker
        classId="class-1"
        subjectId="subject-1"
        resourceType="PDF"
        selectedFileId={null}
        onPick={vi.fn()}
      />,
    );

    await screen.findByText("Handout B");
    expect(screen.queryByText(/Used by/)).not.toBeInTheDocument();
  });

  it("calls onPick with the row's file when clicked", async () => {
    vi.mocked(learningApi.listLearningGalleryFiles).mockResolvedValue(pageOf([HANDOUT]));
    const onPick = vi.fn();
    const user = userEvent.setup();

    render(
      <GalleryFilePicker
        classId="class-1"
        subjectId="subject-1"
        resourceType="PDF"
        selectedFileId={null}
        onPick={onPick}
      />,
    );

    await user.click(await screen.findByText("Handout B"));
    expect(onPick).toHaveBeenCalledWith(HANDOUT);
  });

  it("shows an empty state when the level has no gallery files yet", async () => {
    vi.mocked(learningApi.listLearningGalleryFiles).mockResolvedValue(pageOf([]));

    render(
      <GalleryFilePicker
        classId="class-1"
        subjectId="subject-1"
        resourceType="PDF"
        selectedFileId={null}
        onPick={vi.fn()}
      />,
    );

    expect(await screen.findByText("No files here yet")).toBeInTheDocument();
  });

  it("shows an error message when the load fails", async () => {
    vi.mocked(learningApi.listLearningGalleryFiles).mockRejectedValue(new Error("network down"));

    render(
      <GalleryFilePicker
        classId="class-1"
        subjectId="subject-1"
        resourceType="PDF"
        selectedFileId={null}
        onPick={vi.fn()}
      />,
    );

    expect(await screen.findByText("Failed to load the gallery")).toBeInTheDocument();
  });
});
