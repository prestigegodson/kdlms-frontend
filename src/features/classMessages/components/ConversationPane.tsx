import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import type { ClassConversationDigest } from "@/api/classMessages";
import { SearchInput } from "@/components/ui/SearchInput";
import { ConversationList } from "@/features/classMessages/components/ConversationList";

type SortOrder = "LATEST" | "UNREAD" | "NAME";

const SORT_LABELS: Record<SortOrder, string> = {
  LATEST: "Latest",
  UNREAD: "Unread first",
  NAME: "A–Z",
};

interface ConversationPaneProps {
  heading: string;
  /** Beside the heading - a creator's Announce button. */
  action?: ReactNode;
  /** Between the heading and the search field - a creator's class picker. */
  toolbar?: ReactNode;
  /** `null` while loading. */
  rows: ClassConversationDigest[] | null;
  /** Shown in place of the list when there are no rows at all. */
  empty: ReactNode;
  loading: ReactNode;
  searchPlaceholder: string;
  selectedKey: string | null;
  onSelect: (row: ClassConversationDigest) => void;
  title: (row: ClassConversationDigest) => string;
  subtitle?: (row: ClassConversationDigest) => string | null;
  lastIsOwn?: (row: ClassConversationDigest) => boolean;
}

/**
 * The left pane of a class messages page: heading, optional picker, a client-side search over the
 * loaded rows, a sort, and the conversation list. "Latest" keeps the server's order, which already
 * puts written-in conversations first, most recent first.
 */
export function ConversationPane({
  heading,
  action,
  toolbar,
  rows,
  empty,
  loading,
  searchPlaceholder,
  selectedKey,
  onSelect,
  title,
  subtitle,
  lastIsOwn,
}: ConversationPaneProps) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortOrder>("LATEST");

  const visible = useMemo(() => {
    if (!rows) return null;
    const needle = query.trim().toLowerCase();
    const matching = needle
      ? rows.filter((row) =>
          [title(row), subtitle?.(row)].some((text) => text?.toLowerCase().includes(needle)),
        )
      : rows;
    if (sort === "NAME") {
      return [...matching].sort((a, b) => title(a).localeCompare(title(b)));
    }
    if (sort === "UNREAD") {
      // A stable sort keeps the server's latest-first order within each half.
      return [...matching].sort((a, b) => Number(b.unread) - Number(a.unread));
    }
    return matching;
  }, [rows, query, sort, title, subtitle]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="space-y-3 border-b border-slate-200 px-4 pb-3 pt-4">
        <div className="flex items-center justify-between gap-3">
          <h1 className="font-display text-2xl font-medium text-slate-900">{heading}</h1>
          {action}
        </div>
        {toolbar}
        {rows && rows.length > 0 && (
          <>
            <SearchInput value={query} onChange={setQuery} placeholder={searchPlaceholder} debounceMs={0} />
            <label className="flex items-center gap-2 text-xs text-slate-500">
              Sort by
              <select
                value={sort}
                onChange={(event) => setSort(event.target.value as SortOrder)}
                className="rounded-control bg-transparent py-1 font-medium text-slate-800 hover:bg-slate-100"
              >
                {(Object.keys(SORT_LABELS) as SortOrder[]).map((order) => (
                  <option key={order} value={order}>
                    {SORT_LABELS[order]}
                  </option>
                ))}
              </select>
            </label>
          </>
        )}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {visible === null ? (
          loading
        ) : rows?.length === 0 ? (
          empty
        ) : visible.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-slate-500">No conversations match “{query.trim()}”.</p>
        ) : (
          <ConversationList
            rows={visible}
            selectedKey={selectedKey}
            onSelect={onSelect}
            title={title}
            subtitle={subtitle}
            lastIsOwn={lastIsOwn}
          />
        )}
      </div>
    </div>
  );
}
