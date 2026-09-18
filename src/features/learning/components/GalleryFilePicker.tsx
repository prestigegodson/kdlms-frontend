import { FolderOpen } from "lucide-react";
import { useEffect, useState } from "react";
import { ApiError } from "@/api/client";
import { listLearningGalleryFiles, type LearningGalleryFileView, type LearningResourceType } from "@/api/learning";
import { Alert } from "@/components/ui/Alert";
import { EmptyState } from "@/components/ui/EmptyState";
import { Pagination } from "@/components/ui/Pagination";
import { SearchInput } from "@/components/ui/SearchInput";
import { Spinner } from "@/components/ui/Spinner";
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from "@/components/ui/Table";
import type { Page } from "@/api/types";
import { formatBytes, formatDuration } from "@/utils/duration";

const PAGE_SIZE = 10;

interface GalleryFilePickerProps {
  classId: string;
  subjectId: string;
  resourceType: LearningResourceType;
  selectedFileId: string | null;
  onPick: (file: LearningGalleryFileView) => void;
}

/**
 * The "From gallery" tab of `ResourceEditorModal`'s file field (Phase 35K) - browses every
 * already-uploaded file of `resourceType` at the class's own level+branch scope, deduped one row
 * per file, so a teacher can reuse a file already attached elsewhere rather than re-uploading it.
 * Picking a row hands the parent the full view (including `durationSeconds`), which is enough to
 * populate the form with no extra round trip.
 */
export function GalleryFilePicker({ classId, subjectId, resourceType, selectedFileId, onPick }: GalleryFilePickerProps) {
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

  return (
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
          description="Nothing at this level has been uploaded yet - switch to Upload new."
        />
      )}

      {page && page.content.length > 0 && (
        <>
          <Table>
            <TableHead>
              <tr>
                <TableHeaderCell>Resource</TableHeaderCell>
                <TableHeaderCell>Class · Subject</TableHeaderCell>
                <TableHeaderCell>File</TableHeaderCell>
                <TableHeaderCell numeric>Size</TableHeaderCell>
              </tr>
            </TableHead>
            <TableBody>
              {page.content.map((file) => {
                const duration = formatDuration(file.durationSeconds);
                const selected = file.fileId === selectedFileId;
                return (
                  <TableRow
                    key={file.fileId}
                    onClick={() => onPick(file)}
                    aria-selected={selected}
                    className={selected ? "bg-brand-50" : ""}
                  >
                    <TableCell label="Resource">
                      <span className="font-medium text-slate-900">{file.resourceTitle}</span>
                      {file.useCount > 1 && (
                        <span className="ml-2 text-xs text-slate-500">Used by {file.useCount} resources</span>
                      )}
                    </TableCell>
                    <TableCell label="Class · Subject">
                      {file.className} · {file.subjectName}
                    </TableCell>
                    <TableCell label="File">
                      {file.fileName}
                      {duration && <span className="ml-2 text-xs text-slate-500">{duration}</span>}
                    </TableCell>
                    <TableCell label="Size" numeric>
                      {formatBytes(file.sizeBytes) ?? "—"}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          <Pagination page={page} onPageChange={setPageNumber} />
        </>
      )}
    </div>
  );
}
