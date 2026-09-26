import { X } from "lucide-react";
import type { KeyboardEvent as ReactKeyboardEvent } from "react";
import { useEffect, useRef, useState } from "react";
import { ApiError } from "@/api/client";
import { quickSearchStudents, type StudentView } from "@/api/students";
import { Spinner } from "@/components/ui/Spinner";
import { SearchInput } from "@/components/ui/SearchInput";

const PAGE_SIZE = 10;

/** Below this, `quickSearchStudents` short-circuits client-side rather than round-tripping for a pattern that'd match nearly every student. */
const MIN_QUERY_LENGTH = 2;

export interface StudentSearchSelection {
  id: string;
  name: string;
  admissionNumber: string;
}

interface StudentSearchFieldProps {
  /** The currently selected student, or `null`. The parent owns the value - clearing calls `onChange(null)`. */
  value: StudentSearchSelection | null;
  onChange: (student: StudentSearchSelection | null) => void;
  /** Narrows the search to one branch's ACTIVE students. Omitted disables the field with `disabledHint`. */
  branchId?: string;
  id: string;
  disabled?: boolean;
  /** Shown as the field's placeholder while it's disabled for a missing `branchId` - e.g. "Select a branch first." */
  disabledHint?: string;
}

/**
 * A searchable, single-value student picker - the app's first combobox. Purpose-built rather than
 * a generic `SearchableSelect`: one data source (`GET /api/v1/students`), one row shape, one
 * filter contract, and this is currently its only call site
 * (`inventory.RequisitionFormModal`'s optional "Student" field). Lives under `features/students/`
 * rather than `features/inventory/` so it's easy to find and reuse the next time a feature needs
 * to pick one student by name - `StudentDetailPage`'s `LinkExistingGuardianForm` and
 * `PromotionPage`'s `PlaceStudentsPanel` are two existing ad-hoc student searches this could later
 * absorb.
 *
 * Renders its results as an in-flow bordered list beneath the input, not an absolutely-positioned
 * overlay - `style_guide.md`'s dialog-becomes-a-bottom-sheet-on-mobile rule means a popover would
 * fight the sheet's own scroll region and safe-area padding, and `LinkExistingGuardianForm`
 * already proves the in-flow shape works fine inside a modal.
 *
 * Follows `learning`'s `GalleryPickerModal`'s stale-response guard (a `queryKey` compared during render, plus a
 * `cancelled` flag in the search effect) - the two other student/guardian search UIs in this app
 * lack it and can render an out-of-order result page.
 */
export function StudentSearchField({ value, onChange, branchId, id, disabled, disabledHint }: StudentSearchFieldProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<StudentView[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const optionRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const isDisabled = Boolean(disabled) || !branchId;

  // Reset while rendering - the SearchInput/GalleryPickerModal idiom - so a branch or query change
  // clears stale results synchronously rather than flashing them for one extra render.
  const queryKey = `${branchId ?? ""}|${query}`;
  const [lastQueryKey, setLastQueryKey] = useState(queryKey);
  if (queryKey !== lastQueryKey) {
    setLastQueryKey(queryKey);
    setResults(null);
    setError(null);
    setHighlightedIndex(-1);
  }

  useEffect(() => {
    if (!branchId || query.trim().length < MIN_QUERY_LENGTH) {
      return;
    }
    let cancelled = false;
    quickSearchStudents({ branchId, status: "ACTIVE", q: query }, PAGE_SIZE)
      .then((students) => {
        if (!cancelled) setResults(students);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof ApiError ? err.message : "Search failed");
      });
    return () => {
      cancelled = true;
    };
  }, [branchId, query]);

  useEffect(() => {
    // jsdom (the test environment) has no scrollIntoView implementation at all - guard past it
    // rather than relying on `?.`, which only covers a missing element, not a missing method.
    optionRefs.current[highlightedIndex]?.scrollIntoView?.({ block: "nearest" });
  }, [highlightedIndex]);

  function select(student: StudentView) {
    onChange({ id: student.id, name: student.fullName, admissionNumber: student.admissionNumber });
    setQuery("");
    setResults(null);
  }

  function handleKeyDown(event: ReactKeyboardEvent<HTMLInputElement>) {
    if (!results || results.length === 0) {
      return;
    }
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        setHighlightedIndex((current) => Math.min(current + 1, results.length - 1));
        break;
      case "ArrowUp":
        event.preventDefault();
        setHighlightedIndex((current) => Math.max(current - 1, 0));
        break;
      case "Enter":
        // The field sits inside RequisitionFormModal's <form> - selecting must never submit it.
        event.preventDefault();
        if (highlightedIndex >= 0 && highlightedIndex < results.length) {
          select(results[highlightedIndex]);
        }
        break;
      case "Escape":
        event.preventDefault();
        setQuery("");
        setResults(null);
        break;
      default:
        break;
    }
  }

  if (value) {
    return (
      <div className="flex items-center justify-between gap-2 rounded-control border border-slate-200 bg-slate-50 px-3 py-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-slate-900">{value.name}</p>
          <p className="text-xs text-slate-500">{value.admissionNumber}</p>
        </div>
        <button
          type="button"
          onClick={() => onChange(null)}
          disabled={isDisabled}
          aria-label="Clear student"
          className="shrink-0 rounded-control p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 disabled:pointer-events-none disabled:opacity-50"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    );
  }

  const listboxId = `${id}-listbox`;
  const isBelowMinLength = query.length > 0 && query.trim().length < MIN_QUERY_LENGTH;
  const showList = query.trim().length >= MIN_QUERY_LENGTH;
  const activeOptionId =
    highlightedIndex >= 0 && results && results.length > 0 ? `${id}-option-${highlightedIndex}` : undefined;

  return (
    <div>
      <SearchInput
        id={id}
        value={query}
        onChange={setQuery}
        onKeyDown={handleKeyDown}
        placeholder={isDisabled ? (disabledHint ?? "Select a branch first.") : "Search by name or admission number"}
        disabled={isDisabled}
        role="combobox"
        aria-expanded={showList}
        aria-controls={listboxId}
        aria-activedescendant={activeOptionId}
      />
      {isDisabled ? null : isBelowMinLength ? (
        <p className="mt-1 text-xs text-slate-500">Keep typing - at least {MIN_QUERY_LENGTH} characters.</p>
      ) : !showList ? (
        <p className="mt-1 text-xs text-slate-500">Type a name or admission number.</p>
      ) : error ? (
        <p className="mt-1 text-sm text-red-600">{error}</p>
      ) : results === null ? (
        <div className="mt-2 flex items-center gap-2 text-sm text-slate-500">
          <Spinner /> Searching…
        </div>
      ) : results.length === 0 ? (
        <p className="mt-1 text-sm text-slate-500">No matching students.</p>
      ) : (
        <ul
          id={listboxId}
          role="listbox"
          aria-label="Matching students"
          className="mt-2 max-h-48 divide-y divide-slate-100 overflow-y-auto rounded-panel border border-slate-200"
        >
          {results.map((student, index) => (
            <li key={student.id} role="presentation">
              <button
                id={`${id}-option-${index}`}
                ref={(element) => {
                  optionRefs.current[index] = element;
                }}
                type="button"
                role="option"
                aria-selected={index === highlightedIndex}
                onClick={() => select(student)}
                onMouseEnter={() => setHighlightedIndex(index)}
                className={`block w-full px-3 py-2 text-left text-sm hover:bg-slate-50 ${
                  index === highlightedIndex ? "bg-brand-50" : ""
                }`}
              >
                <p className="font-medium text-slate-900">{student.fullName}</p>
                <p className="text-slate-500">
                  {student.admissionNumber}
                  {student.currentClassName ? ` · ${student.currentClassName}` : ""}
                </p>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
