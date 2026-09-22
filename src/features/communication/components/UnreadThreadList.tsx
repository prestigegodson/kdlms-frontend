import { ChevronRight, MessageSquare } from "lucide-react";
import type { ThreadDigestView, UnreadThreadsView } from "@/api/communication";
import { Alert } from "@/components/ui/Alert";
import { EmptyState } from "@/components/ui/EmptyState";
import { Spinner } from "@/components/ui/Spinner";
import { CategoryBadge } from "@/features/communication/components/CategoryBadge";
import { categoryRailClass } from "@/features/communication/messageCategory";
import { formatInstant } from "@/utils/date";

interface UnreadThreadListProps {
  /** `null` while loading. */
  view: UnreadThreadsView | null;
  error?: string | null;
  onOpenThread: (thread: ThreadDigestView) => void;
}

/**
 * The Unread tab's row list - shared by the teacher board and the guardian's
 * ward messages page, since both surface the same `UnreadThreadsView` shape
 * (see backend `communication.application.port.in.UnreadThreadsView`). Row
 * styling mirrors `WardMessagesPage`'s existing thread button: category rail,
 * unread dot, `CategoryBadge`, `ChevronRight`. Unlike that page's per-ward
 * list, a row here always shows the student and class name, since this list
 * spans several classes (teacher) or several wards (guardian).
 */
export function UnreadThreadList({ view, error, onOpenThread }: UnreadThreadListProps) {
  if (error) {
    return <Alert variant="error">{error}</Alert>;
  }

  if (!view) {
    return (
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <Spinner /> Loading…
      </div>
    );
  }

  if (view.threads.length === 0) {
    return (
      <EmptyState icon={MessageSquare} title="You're all caught up" description="No unread messages right now." />
    );
  }

  return (
    <div className="space-y-3">
      <ul className="space-y-3">
        {view.threads.map((thread) => (
          <li key={thread.threadId}>
            <button
              type="button"
              onClick={() => onOpenThread(thread)}
              className={`flex min-h-14 w-full items-center gap-3 rounded-card border border-slate-200 border-l-4 bg-white p-4 text-left transition-colors hover:bg-slate-50 ${categoryRailClass(thread.category)}`}
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 shrink-0 rounded-full bg-brand-500" aria-label="Unread" />
                    {thread.category && <CategoryBadge category={thread.category} />}
                    <span className="text-sm font-semibold text-slate-900">
                      {thread.studentName} · {thread.className}
                    </span>
                  </div>
                  <span className="text-sm text-slate-500">{formatInstant(thread.lastMessageAt)}</span>
                </div>
                <p className="mt-1 text-sm text-slate-500">
                  {thread.startedByName}
                  {thread.replyCount > 0 ? ` · ${thread.replyCount} repl${thread.replyCount === 1 ? "y" : "ies"}` : ""}
                </p>
              </div>
              <ChevronRight className="h-5 w-5 shrink-0 text-slate-400" aria-hidden="true" />
            </button>
          </li>
        ))}
      </ul>
      {view.total > view.threads.length && (
        <p className="text-sm text-slate-500">
          Showing the {view.threads.length} most recent of {view.total}.
        </p>
      )}
    </div>
  );
}
