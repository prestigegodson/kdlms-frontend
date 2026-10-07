import { Download, FileText, Lock } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { LessonNoteDocumentView } from "@/api/lessonNotes";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import { downloadBlob } from "@/utils/download";

export const PDF_TYPE = "application/pdf";
export const DOCX_TYPE = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
export const DOC_TYPE = "application/msword";

interface LessonNoteDocumentViewerProps {
  document: LessonNoteDocumentView;
  /**
   * Fetches the file's bytes - staff pass `downloadFile` (`GET /api/v1/files/{id}`). Omitted for a
   * guardian, who can't reach that proxy: the viewer then says the document is staff-only rather
   * than failing a request.
   */
  fetchFile?: (fileId: string) => Promise<Blob>;
}

/**
 * Shows an `UPLOAD`-mode lesson note's file in place: a PDF in the browser's own viewer (an iframe
 * on a blob URL, the learning module's `ResourceViewer` pattern), a .docx rendered client-side by
 * `docx-preview` (lazy-loaded, so it stays out of the main bundle), and a legacy .doc - which no
 * browser can render - as a download. Every type also offers a download under its own file name.
 * The file is fetched once and reused for both the preview and the download.
 */
export function LessonNoteDocumentViewer({ document, fetchFile }: LessonNoteDocumentViewerProps) {
  // Each piece of state remembers which file it belongs to, so swapping files reads as "loading"
  // straight away instead of resetting state inside the effects.
  const [loaded, setLoaded] = useState<{ fileId: string; blob: Blob; pdfUrl: string | null } | null>(null);
  const [failure, setFailure] = useState<{ fileId: string; message: string } | null>(null);
  const [renderedBlob, setRenderedBlob] = useState<Blob | null>(null);
  const docxContainer = useRef<HTMLDivElement>(null);
  const { fileId, fileName, contentType } = document;
  const current = loaded?.fileId === fileId ? loaded : null;
  const blob = current?.blob ?? null;
  const pdfUrl = current?.pdfUrl ?? null;
  const error = failure?.fileId === fileId ? failure.message : null;
  const rendering = blob !== null && renderedBlob !== blob;

  useEffect(() => {
    if (!fetchFile) return;
    let cancelled = false;
    let objectUrl: string | null = null;
    fetchFile(fileId)
      .then((fetched) => {
        if (cancelled) return;
        if (contentType === PDF_TYPE) {
          // Re-typed so the browser's PDF viewer engages even if the response came back untyped.
          objectUrl = URL.createObjectURL(new Blob([fetched], { type: PDF_TYPE }));
        }
        setLoaded({ fileId, blob: fetched, pdfUrl: objectUrl });
      })
      .catch(() => {
        if (!cancelled) setFailure({ fileId, message: "This document couldn't be loaded." });
      });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [fileId, contentType, fetchFile]);

  useEffect(() => {
    const container = docxContainer.current;
    if (!blob || contentType !== DOCX_TYPE || !container) return;
    let cancelled = false;
    import("docx-preview")
      .then(({ renderAsync }) =>
        renderAsync(blob, container, undefined, {
          inWrapper: true,
          className: "docx",
          useBase64URL: true,
          experimental: false,
          // An altChunk embeds raw HTML from the file - never rendered.
          renderAltChunks: false,
          renderChanges: false,
          renderComments: false,
        }),
      )
      .then(() => {
        if (!cancelled) neutralizeRenderedDocument(container);
      })
      .catch(() => {
        if (!cancelled) {
          setFailure({
            fileId,
            message: "This Word document couldn't be displayed. Download it to view it instead.",
          });
        }
      })
      .finally(() => {
        if (!cancelled) setRenderedBlob(blob);
      });
    return () => {
      cancelled = true;
      container.replaceChildren();
    };
  }, [blob, contentType, fileId]);

  const header = (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-control border border-slate-200 bg-slate-50 px-3 py-2">
      <span className="flex min-w-0 items-center gap-2 text-sm text-slate-900">
        <FileText className="h-4 w-4 shrink-0 text-slate-500" aria-hidden="true" />
        <span className="truncate">{fileName}</span>
      </span>
      {fetchFile && (
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={!blob}
          onClick={() => blob && downloadBlob(blob, fileName)}
        >
          <Download className="h-4 w-4" aria-hidden="true" />
          Download
        </Button>
      )}
    </div>
  );

  if (!fetchFile) {
    return (
      <div className="space-y-3">
        {header}
        <p className="flex items-center gap-2 text-sm text-slate-500">
          <Lock className="h-4 w-4" aria-hidden="true" />
          This lesson note is an uploaded document available to school staff only.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {header}
      {error && <Alert variant="error">{error}</Alert>}
      {contentType === PDF_TYPE &&
        !error &&
        (pdfUrl ? (
          <iframe
            src={pdfUrl}
            title={fileName}
            className="h-[80vh] w-full rounded-card border border-slate-200"
          />
        ) : (
          <Spinner />
        ))}
      {contentType === DOCX_TYPE && !error && (
        <>
          {(!blob || rendering) && <Spinner />}
          <div
            ref={docxContainer}
            data-testid="docx-preview"
            className="max-h-[80vh] overflow-auto rounded-card border border-slate-200 bg-slate-100"
          />
        </>
      )}
      {contentType === DOC_TYPE && (
        <Alert variant="info">
          Word 97-2003 (.doc) files can't be previewed in the browser. Download it to read it, or save it as .docx
          and upload it again to view it here.
        </Alert>
      )}
    </div>
  );
}

/**
 * Defence in depth over what `docx-preview` produced: it builds DOM nodes rather than parsing HTML,
 * but a document's hyperlinks are author-controlled, so only `http(s):`/`mailto:`/in-document
 * anchors survive, and they open in a new tab. Anything script-shaped is removed outright.
 */
function neutralizeRenderedDocument(container: HTMLElement) {
  container.querySelectorAll("script, iframe, object, embed, form").forEach((element) => element.remove());
  container.querySelectorAll("*").forEach((element) => {
    for (const attribute of Array.from(element.attributes)) {
      if (attribute.name.toLowerCase().startsWith("on")) element.removeAttribute(attribute.name);
    }
  });
  container.querySelectorAll("a[href]").forEach((anchor) => {
    const href = anchor.getAttribute("href") ?? "";
    if (href.startsWith("#")) return;
    if (!/^(https?:|mailto:)/i.test(href.trim())) {
      anchor.removeAttribute("href");
      return;
    }
    anchor.setAttribute("target", "_blank");
    anchor.setAttribute("rel", "noopener noreferrer");
  });
}
