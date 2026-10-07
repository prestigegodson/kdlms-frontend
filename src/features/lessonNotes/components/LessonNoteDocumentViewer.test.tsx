import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, describe, expect, it, vi } from "vitest";
import type { LessonNoteDocumentView } from "@/api/lessonNotes";
import {
  DOC_TYPE,
  DOCX_TYPE,
  LessonNoteDocumentViewer,
  PDF_TYPE,
} from "@/features/lessonNotes/components/LessonNoteDocumentViewer";
import { downloadBlob } from "@/utils/download";

vi.mock("@/utils/download", () => ({ downloadBlob: vi.fn() }));

const renderAsync = vi.fn(async (_blob: Blob, container: HTMLElement) => {
  container.innerHTML =
    '<section><p>Week 3 plan</p><a href="javascript:alert(1)">bad</a><a href="https://example.com">good</a>' +
    '<span onclick="alert(1)">x</span></section>';
});
vi.mock("docx-preview", () => ({ renderAsync: (...args: [Blob, HTMLElement]) => renderAsync(...args) }));

beforeAll(() => {
  URL.createObjectURL = vi.fn(() => "about:blank");
  URL.revokeObjectURL = vi.fn();
});

function doc(contentType: string, fileName: string): LessonNoteDocumentView {
  return { fileId: `file-${fileName}`, fileName, contentType, sizeBytes: 100 };
}

describe("LessonNoteDocumentViewer", () => {
  it("shows a PDF in an iframe and downloads it under its own name", async () => {
    const blob = new Blob(["%PDF"], { type: PDF_TYPE });
    render(<LessonNoteDocumentViewer document={doc(PDF_TYPE, "plan.pdf")} fetchFile={() => Promise.resolve(blob)} />);

    expect(await screen.findByTitle("plan.pdf")).toHaveAttribute("src", "about:blank");
    await userEvent.click(screen.getByRole("button", { name: "Download" }));
    expect(downloadBlob).toHaveBeenCalledWith(blob, "plan.pdf");
  });

  it("renders a .docx in place and neutralizes unsafe links and handlers", async () => {
    const blob = new Blob(["PK"], { type: DOCX_TYPE });
    render(
      <LessonNoteDocumentViewer document={doc(DOCX_TYPE, "plan.docx")} fetchFile={() => Promise.resolve(blob)} />,
    );

    const container = await screen.findByTestId("docx-preview");
    await waitFor(() => expect(container).toHaveTextContent("Week 3 plan"));
    expect(renderAsync).toHaveBeenCalledWith(
      blob,
      container,
      undefined,
      expect.objectContaining({ renderAltChunks: false }),
    );
    expect(screen.getByText("bad")).not.toHaveAttribute("href");
    expect(screen.getByText("good")).toHaveAttribute("rel", "noopener noreferrer");
    expect(screen.getByText("x")).not.toHaveAttribute("onclick");
  });

  it("offers a legacy .doc as a download only", async () => {
    render(
      <LessonNoteDocumentViewer
        document={doc(DOC_TYPE, "plan.doc")}
        fetchFile={() => Promise.resolve(new Blob(["x"]))}
      />,
    );

    expect(await screen.findByText(/can't be previewed in the browser/)).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole("button", { name: "Download" })).toBeEnabled());
  });

  it("tells a reader without file access that the document is staff-only", () => {
    render(<LessonNoteDocumentViewer document={doc(PDF_TYPE, "plan.pdf")} />);

    expect(screen.getByText(/available to school staff only/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Download" })).not.toBeInTheDocument();
  });
});
