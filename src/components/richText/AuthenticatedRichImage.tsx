import { downloadFile } from "@/api/files";
import { RICH_IMAGE_SIZE_CLASS } from "@/components/richText/richImageSize";
import { useObjectUrl } from "@/hooks/useObjectUrl";

/**
 * Resolves one rich-text image's `data-file-id` through the authenticated
 * `GET /api/v1/files/{id}` proxy - the `RichContent` `renderImage` callback
 * for any staff-facing surface (e.g. `StudentAnswersModal`'s per-question
 * breakdown). The anonymous take-home quiz page uses a different renderer
 * (`publicQuestionImageUrl`, a plain `<img src>`) since it has no
 * Authorization header to attach.
 */
export function AuthenticatedRichImage({ fileId, alt }: { fileId: string; alt: string }) {
  const previewUrl = useObjectUrl(fileId, downloadFile);
  if (!previewUrl) {
    return null;
  }
  return (
    <img src={previewUrl} alt={alt} className={`my-1 ${RICH_IMAGE_SIZE_CLASS} rounded-control border border-slate-200`} />
  );
}
