import { FileAudio, FileText, FileVideo, FolderOpen } from "lucide-react";
import { useEffect, useState } from "react";
import { ApiError } from "@/api/client";
import { listLearningGalleryFiles, type LearningGalleryFileView, type LearningResourceType } from "@/api/learning";
import { Alert } from "@/components/ui/Alert";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Modal } from "@/components/ui/Modal";
import { Pagination } from "@/components/ui/Pagination";
import { SearchInput } from "@/components/ui/SearchInput";
import { Spinner } from "@/components/ui/Spinner";
import type { Page } from "@/api/types";
import { formatInstantDate } from "@/utils/date";
import { formatBytes, formatDuration } from "@/utils/duration";

const PAGE_SIZE = 9;

const TYPE_ICON: Record<string, typeof FileText> = {
  PDF: FileText,
  AUDIO: FileAudio,
  VIDEO: FileVideo,
};

interface GalleryPickerModalProps {
  classId: string;
  subjectId: string;
  resourceType: LearningResourceType;
  selectedFileId: string | null;
  onPick: (file: LearningGalleryFileView) => void;
  onClose: () => void;
}

/**
 * "Choose from gallery" (Phase 35K) - browses every already-uploaded file of `resourceType` at
 * the class's own level+branch scope, deduped one row per file, so a teacher can reuse a file
 * already attached elsewhere rather than re-uploading it. Picking a card hands the parent the full
 * view (including `durationSeconds`) and closes - enough to populate `ResourceEditorModal`'s form
 * with no extra round trip.
 *
 * Rendered as a *sibling* of the editor's own `<Modal>`, never nested inside it - React's Escape
 * handling and `Modal`'s own keydown listener both work on the React tree, not the DOM tree, so a
 * nested dialog's Escape would bubble into the editor's own handler and close both, silently
 * discarding whatever the author had already typed.
 */
export function GalleryPickerModal({
  classId,
  subjectId,
  resourceType,
  selectedFileId,
  onPick,
  onClose,
}: GalleryPickerModalProps) {
  const [search, setSearch] = useState("");
  const [pageNumber, setPageNumber] = useState(0);
  const [page, setPage] = useState<Page<LearningGalleryFileView> | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Reset while rendering rather than in the effect (the SearchInput/LearningResourcesPage
  // idiom) - any dependency change means the in-flight/last-shown page no longer answers the new
  // query, so `page`/`error` go back to "loading" synchronously instead of via a setState call
  // inside the effect body.
  const queryKey = `${classId}|${subjectId}|${resourceType}|${search}|${pageNumber}`;
  const [lastQueryKey, setLastQueryKey] = useState(queryKey);
  if (queryKey !== lastQueryKey) {
    setLastQueryKey(queryKey);
    setPage(null);
    setError(null);
  }

  useEffect(() => {
    let cancelled = false;
    listLearningGalleryFiles({ classId, subjectId, resourceType, search, page: pageNumber, size: PAGE_SIZE })
      .then((result) => {
        if (!cancelled) setPage(result);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof ApiError ? err.message : "Failed to load the gallery");
      });
    return () => {
      cancelled = true;
    };
  }, [classId, subjectId, resourceType, search, pageNumber]);

  const loading = page === null && error === null;

  function handleSearch(value: string) {
    setSearch(value);
    setPageNumber(0);
  }

  function handlePick(file: LearningGalleryFileView) {
    onPick(file);
    onClose();
  }

  return (
    <Modal open onClose={onClose} title="Choose from gallery" size="xxl">
      <div className="space-y-3">
        <SearchInput value={search} onChange={handleSearch} placeholder="Search by resource title" />

        {error && <Alert variant="error">{error}</Alert>}

        {loading && (
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Spinner /> Loading…
          </div>
        )}

        {!error && page && page.content.length === 0 && (
          <EmptyState
            icon={FolderOpen}
            title="No files here yet"
            description="Nothing at this level has been uploaded yet - close this and upload a new file."
          />
        )}

        {page && page.content.length > 0 && (
          <>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {page.content.map((file) => {
                const duration = formatDuration(file.durationSeconds);
                const selected = file.fileId === selectedFileId;
                const Icon = TYPE_ICON[file.resourceType] ?? FileText;
                return (
                  <button
                    key={file.fileId}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => handlePick(file)}
                    className="text-left"
                  >
                    <Card
                      className={`flex h-full flex-col gap-2 transition-shadow hover:shadow-md ${
                        selected ? "border-brand-500 ring-1 ring-brand-500" : ""
                      }`}
                    >
                      <div>
                        <p className="line-clamp-2 font-medium text-slate-900">{file.resourceTitle}</p>
                        <p className="mt-0.5 text-xs text-slate-500">
                          {file.className} · {file.subjectName}
                        </p>
                      </div>
                      <div className="mt-auto flex items-start gap-2 border-t border-slate-100 pt-2">
                        <Icon className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
                        <div className="min-w-0">
                          <p className="truncate text-sm text-slate-700">{file.fileName}</p>
                          <p className="text-xs text-slate-500">
                            {formatBytes(file.sizeBytes) ?? "—"} · {formatInstantDate(file.uploadedAt)}
                            {duration && ` · ${duration}`}
                          </p>
                        </div>
                      </div>
                      {file.useCount > 1 && (
                        <p className="text-xs text-slate-500">Used by {file.useCount} resources</p>
                      )}
                    </Card>
                  </button>
                );
              })}
            </div>
            <Pagination page={page} onPageChange={setPageNumber} />
          </>
        )}
      </div>
    </Modal>
  );
}
