import { NodeViewWrapper, type ReactNodeViewProps } from "@tiptap/react";
import { downloadFile } from "@/api/files";
import { Spinner } from "@/components/ui/Spinner";
import { useObjectUrl } from "@/hooks/useObjectUrl";

/**
 * The in-editor preview for a `quizImage` node - resolves `data-file-id`
 * through the authenticated `GET /api/v1/files/{id}` proxy via the same
 * `useObjectUrl` hook `ImageUploadField`'s preview uses, since the bucket is
 * private and a bare `<img src>` can never reach it.
 */
export function QuizImageNodeView({ node, selected }: ReactNodeViewProps) {
  const fileId = (node.attrs.fileId as string | null) ?? undefined;
  const alt = (node.attrs.alt as string | null) ?? "";
  const previewUrl = useObjectUrl(fileId, downloadFile);

  return (
    <NodeViewWrapper as="span" className="inline-block align-middle">
      {previewUrl ? (
        <img
          src={previewUrl}
          alt={alt}
          className={`inline-block max-h-32 rounded-control border ${
            selected ? "border-brand-500 ring-2 ring-brand-100" : "border-slate-200"
          }`}
        />
      ) : (
        <span className="inline-flex h-12 w-16 items-center justify-center rounded-control border border-dashed border-slate-300 bg-slate-50">
          <Spinner />
        </span>
      )}
    </NodeViewWrapper>
  );
}
