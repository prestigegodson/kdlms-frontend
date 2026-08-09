import { ChevronLeft, ChevronRight } from "lucide-react";
import type { Page } from "@/api/types";

interface PaginationProps {
  page: Page<unknown>;
  onPageChange: (page: number) => void;
  className?: string;
}

/**
 * "Showing x-y of z" plus prev/next, driven directly by a backend `Page<T>`
 * (`number`/`size`/`totalElements`/`totalPages`) - no page in the app read
 * those fields before Phase 4's student registry needed real pagination.
 * Page numbers are 0-indexed on the wire (matching Spring Data's `Pageable`)
 * but shown 1-indexed, matching every other "page N" convention.
 */
export function Pagination({ page, onPageChange, className = "" }: PaginationProps) {
  if (page.totalElements === 0) {
    return null;
  }

  const currentPage1Indexed = page.number + 1;
  const rangeStart = page.number * page.size + 1;
  const rangeEnd = Math.min(rangeStart + page.content.length - 1, page.totalElements);
  const isFirstPage = page.number <= 0;
  const isLastPage = page.number >= page.totalPages - 1;

  return (
    <div className={`flex flex-col items-center justify-between gap-3 sm:flex-row ${className}`}>
      <p className="text-sm text-slate-500">
        Showing <span className="font-medium text-slate-700">{rangeStart}</span>&ndash;
        <span className="font-medium text-slate-700">{rangeEnd}</span> of{" "}
        <span className="font-medium text-slate-700">{page.totalElements}</span>
      </p>
      <div className="flex items-center gap-1">
        <button
          type="button"
          disabled={isFirstPage}
          onClick={() => onPageChange(page.number - 1)}
          aria-label="Previous page"
          className="flex h-9 w-9 items-center justify-center rounded-control text-slate-600 hover:bg-slate-100 disabled:pointer-events-none disabled:opacity-40 mobile:h-11 mobile:w-11"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        </button>
        <span className="min-w-[5.5rem] text-center text-sm text-slate-600">
          Page {currentPage1Indexed} of {Math.max(page.totalPages, 1)}
        </span>
        <button
          type="button"
          disabled={isLastPage}
          onClick={() => onPageChange(page.number + 1)}
          aria-label="Next page"
          className="flex h-9 w-9 items-center justify-center rounded-control text-slate-600 hover:bg-slate-100 disabled:pointer-events-none disabled:opacity-40 mobile:h-11 mobile:w-11"
        >
          <ChevronRight className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
