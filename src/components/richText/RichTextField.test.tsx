import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { beforeAll, describe, expect, it, vi } from "vitest";
import * as filesApi from "@/api/files";
import { RichTextField } from "@/components/richText/RichTextField";

// jsdom doesn't implement the layout/geometry APIs ProseMirror's EditorView
// uses for mouse-driven caret placement and scroll-into-view - these
// polyfills only need a plausible shape, since nothing here asserts on
// visual position. Scoped to this file rather than the shared test setup,
// since RichContent/every other test in the app renders no real editor.
beforeAll(() => {
  document.elementFromPoint = () => null;
  Range.prototype.getBoundingClientRect = () =>
    ({ top: 0, left: 0, bottom: 0, right: 0, width: 0, height: 0, x: 0, y: 0, toJSON() {} }) as DOMRect;
  Range.prototype.getClientRects = () => ({ length: 0, item: () => null, [Symbol.iterator]: function* () {} }) as unknown as DOMRectList;
});

vi.mock("@/api/files", async () => {
  const actual = await vi.importActual<typeof import("@/api/files")>("@/api/files");
  return {
    ...actual,
    uploadFile: vi.fn(),
    downloadFile: vi.fn(),
  };
});

// A minimal controlled-field harness - RichTextField itself doesn't own
// state. The saved HTML is also echoed into a plain node so tests can assert
// on the serialized contract (what a save would actually send) rather than
// the live editing DOM, which for an atomic node like `quizImage` is a
// `ReactNodeViewRenderer` preview - never the same markup `getHTML()` emits.
function Field({ singleLine = false, allowImages = false }: { singleLine?: boolean; allowImages?: boolean } = {}) {
  const [value, setValue] = useState("<p></p>");
  return (
    <>
      <RichTextField value={value} onChange={setValue} allowImages={allowImages} singleLine={singleLine} ariaLabel="Prompt" />
      <div data-testid="html-output">{value}</div>
    </>
  );
}

describe("RichTextField", () => {
  it("applies bold to newly typed text after toggling the mark on", async () => {
    const user = userEvent.setup();
    render(<Field />);

    const editable = screen.getByLabelText("Prompt");
    await user.click(editable);
    await user.click(screen.getByRole("button", { name: "Bold" }));
    await user.type(editable, "hello");

    await waitFor(() => expect(editable.querySelector("strong")).toHaveTextContent("hello"));
  });

  it("inserts an inline-math node via the maths dialog", async () => {
    const user = userEvent.setup();
    render(<Field />);

    await user.click(screen.getByRole("button", { name: "Insert maths" }));
    const latexInput = await screen.findByLabelText("LaTeX expression");
    await user.type(latexInput, "x^2");
    await user.click(screen.getByRole("button", { name: "Insert" }));

    const editable = screen.getByLabelText("Prompt");
    await waitFor(() => expect(editable.querySelector('span[data-type="inline-math"]')).not.toBeNull());
    expect(editable.querySelector("span[data-latex]")?.getAttribute("data-latex")).toBe("x^2");
  });

  it("uploads an image and serializes a data-file-id reference with no src attribute", async () => {
    vi.mocked(filesApi.uploadFile).mockResolvedValue({
      fileId: "11111111-1111-1111-1111-111111111111",
      fileName: "diagram.png",
      contentType: "image/png",
      sizeBytes: 100,
    });
    vi.mocked(filesApi.downloadFile).mockResolvedValue(new Blob());

    const user = userEvent.setup();
    const { container } = render(<Field allowImages />);

    const file = new File(["fake"], "diagram.png", { type: "image/png" });
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(input, file);

    // The live editing DOM renders `quizImage` through a `ReactNodeViewRenderer`
    // preview (a blob-URL `<img>` for the teacher to see what they picked) -
    // that markup is never what gets saved. What matters is `getHTML()`'s
    // serialized output, echoed here via the harness's plain output node.
    await waitFor(() => {
      const html = screen.getByTestId("html-output").textContent ?? "";
      expect(html).toContain('data-file-id="11111111-1111-1111-1111-111111111111"');
    });
    const html = screen.getByTestId("html-output").textContent ?? "";
    expect(html).not.toMatch(/<img[^>]*\bsrc=/);
  });

  it("uploads an image in single-line mode too (Phase 20J - a choice option's label)", async () => {
    vi.mocked(filesApi.uploadFile).mockResolvedValue({
      fileId: "33333333-3333-3333-3333-333333333333",
      fileName: "option.png",
      contentType: "image/png",
      sizeBytes: 100,
    });
    vi.mocked(filesApi.downloadFile).mockResolvedValue(new Blob());

    const user = userEvent.setup();
    const { container } = render(<Field singleLine allowImages />);

    expect(screen.getByRole("button", { name: "Insert image" })).not.toBeNull();

    const file = new File(["fake"], "option.png", { type: "image/png" });
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(input, file);

    await waitFor(() => {
      const html = screen.getByTestId("html-output").textContent ?? "";
      expect(html).toContain('data-file-id="33333333-3333-3333-3333-333333333333"');
    });
    const html = screen.getByTestId("html-output").textContent ?? "";
    expect(html).not.toMatch(/<img[^>]*\bsrc=/);
    // A single line still means one paragraph - the image node is inline, not a new block.
    expect(html.match(/<p>/g)).toHaveLength(1);
  });

  it("swallows Enter in single-line mode rather than starting a new line", async () => {
    const user = userEvent.setup();
    render(<Field singleLine />);

    const editable = screen.getByLabelText("Prompt");
    await user.click(editable);
    await user.type(editable, "one{enter}two");

    await waitFor(() => expect(editable.querySelectorAll("p")).toHaveLength(1));
    expect(editable).toHaveTextContent("onetwo");
  });
});
