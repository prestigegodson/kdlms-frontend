import { Extension } from "@tiptap/core";
import { Plugin } from "@tiptap/pm/state";
import { type StoredFileView } from "@/api/files";

export interface PastedImageUploadOptions {
  /** Uploads one image file, returning the stored `fileId` - `api/files.ts#uploadFile` in every real caller. */
  uploadFile: (file: File) => Promise<StoredFileView>;
  /** A single file over this size is dropped rather than uploaded - mirrors `MAX_IMAGE_UPLOAD_BYTES`. */
  maxUploadBytes: number;
  /** The note's total image budget across every paste and every image-button insert combined - mirrors `LessonNoteRichText.MAX_IMAGES_PER_NOTE`; the server enforces the real limit regardless. */
  maxImages: () => number;
  /** Called with the number of images about to be uploaded, before any upload starts. */
  onUploadStart: (count: number) => void;
  onUploadEnd: () => void;
  /** Called once per paste with the count of images that could not be brought across - never silent. */
  onDropped: (count: number) => void;
}

/**
 * Word (and Google Docs) paste a picture as `<img src="data:...">` inline in
 * the clipboard's HTML - never as an uploaded reference. The stored contract
 * forbids any `src` at all (see `LessonNoteRichText`'s Javadoc), so a pasted
 * image has to be uploaded through the ordinary `POST /api/v1/files` path
 * and rewritten to `data-file-id` before it can ever reach the document -
 * the same contract `QuizImage`'s node schema already enforces one image at
 * a time via the toolbar button, applied here to a whole pasted fragment at
 * once.
 * <p>
 * A `data:`-src `<img>` can't be handled by intercepting the parsed
 * ProseMirror slice - `QuizImage`'s own `parseHTML` is `img[data-file-id]`,
 * so the schema has already dropped a bare `src`-only image by the time a
 * slice transform would see it. This extension instead reads the paste
 * event's raw clipboard HTML *before* it reaches the schema, uploads every
 * `data:` image it finds, and re-inserts the rewritten HTML as a second
 * step - `handlePaste` must return synchronously, so the upload itself is
 * fire-and-forget, surfaced to the caller only through the
 * `onUploadStart`/`onUploadEnd`/`onDropped` callbacks (see `RichTextField`'s
 * progress indicator and dropped-image `Alert`).
 * <p>
 * What does <em>not</em> survive: an image Word (or another application)
 * put on the clipboard as a `file:`/`blob:` URL, or a cross-origin `https:`
 * image (Google Docs) - none of these can be fetched by the browser from
 * inside a paste handler, so they are dropped and counted rather than
 * silently lost. Word equations (OMML `<m:oMath>`) also do not survive -
 * no LaTeX conversion is attempted; a teacher re-enters them with the ∑
 * button. An older equation Word pastes *as a picture* (MathType, or an
 * EQ field rendered to an image) survives through the ordinary image path
 * above, like any other picture.
 */
export const PastedImageUpload = Extension.create<PastedImageUploadOptions>({
  name: "pastedImageUpload",

  addProseMirrorPlugins() {
    const editor = this.editor;
    const options = this.options;

    return [
      new Plugin({
        props: {
          handlePaste(_view, event) {
            const html = event.clipboardData?.getData("text/html");
            if (!html) {
              return false;
            }
            const parsed = new DOMParser().parseFromString(html, "text/html");
            const images = Array.from(parsed.body.querySelectorAll("img"));
            if (images.length === 0) {
              return false;
            }

            event.preventDefault();
            const clipboardFiles = Array.from(event.clipboardData?.files ?? []).filter((file) =>
              file.type.startsWith("image/"),
            );

            void uploadAndInsert(editor, parsed.body, images, clipboardFiles, options);
            return true;
          },
        },
      }),
    ];
  },
});

async function uploadAndInsert(
  editor: { commands: { insertContent: (html: string) => void } },
  body: HTMLElement,
  images: HTMLImageElement[],
  clipboardFiles: File[],
  options: PastedImageUploadOptions,
): Promise<void> {
  let dropped = 0;
  const budget = options.maxImages();
  const uploadable: HTMLImageElement[] = [];
  for (const img of images) {
    const src = img.getAttribute("src") ?? "";
    if (src.startsWith("data:")) {
      uploadable.push(img);
    } else {
      // file:/blob:/cross-origin https: - can't be fetched from a paste handler.
      img.remove();
      dropped++;
    }
  }

  if (uploadable.length === 0) {
    finish(editor, body, dropped, options);
    return;
  }

  options.onUploadStart(uploadable.length);
  try {
    // Word sometimes attaches the same pictures as real clipboard files alongside the HTML -
    // prefer those (real bytes, no base64 round-trip) when the counts line up positionally.
    const preferFiles = clipboardFiles.length === uploadable.length;
    let uploaded = 0;
    for (let i = 0; i < uploadable.length; i++) {
      if (uploaded + dropped >= budget) {
        uploadable[i].remove();
        dropped++;
        continue;
      }
      try {
        const file = preferFiles ? clipboardFiles[i] : dataUrlToFile(uploadable[i].getAttribute("src") ?? "");
        if (!file || file.size > options.maxUploadBytes) {
          uploadable[i].remove();
          dropped++;
          continue;
        }
        const stored = await options.uploadFile(file);
        uploadable[i].removeAttribute("src");
        uploadable[i].setAttribute("data-file-id", stored.fileId);
      } catch {
        uploadable[i].remove();
        dropped++;
        continue;
      }
      uploaded++;
    }
  } finally {
    options.onUploadEnd();
  }
  finish(editor, body, dropped, options);
}

function finish(
  editor: { commands: { insertContent: (html: string) => void } },
  body: HTMLElement,
  dropped: number,
  options: PastedImageUploadOptions,
): void {
  if (dropped > 0) {
    options.onDropped(dropped);
  }
  editor.commands.insertContent(body.innerHTML);
}

/** Decodes a `data:<mime>;base64,<data>` URL into a `File` - `null` for anything else (an SVG data URI, a malformed value). */
function dataUrlToFile(dataUrl: string): File | null {
  const match = /^data:([^;]+);base64,(.*)$/s.exec(dataUrl);
  if (!match) {
    return null;
  }
  const [, mime, base64] = match;
  try {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return new File([bytes], "pasted-image", { type: mime });
  } catch {
    return null;
  }
}
