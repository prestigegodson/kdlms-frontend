import { MessageSquare } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
  editWardMessage,
  getWardThread,
  getWardThreads,
  markWardThreadRead,
  replyToWardThread,
  type ThreadDigestView,
  type ThreadView,
} from "@/api/communication";
import { ApiError } from "@/api/client";
import { Alert } from "@/components/ui/Alert";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Modal } from "@/components/ui/Modal";
import { PageHeader } from "@/components/ui/PageHeader";
import { Pagination } from "@/components/ui/Pagination";
import { Spinner } from "@/components/ui/Spinner";
import { CategoryBadge } from "@/features/communication/components/CategoryBadge";
import { ThreadCard } from "@/features/communication/components/ThreadCard";
import { categoryRailClass } from "@/features/communication/messageCategory";
import { WardSelector } from "@/features/guardian/components/WardSelector";
import { useUnreadMessagesStore } from "@/stores/unreadMessagesStore";
import { useWardStore } from "@/stores/wardStore";
import { formatLongDate } from "@/utils/date";
import type { Page } from "@/api/types";

/**
 * A ward's communication threads - notes their class teacher has logged,
 * read and reply here. Reuses `ThreadCard` (the same component the staff
 * board uses) inside a modal so the guardian and teacher views render
 * identical output from one component, the same precedent
 * `AttendanceSummaryPanel` set for staff/guardian attendance.
 */
export function WardMessagesPage() {
  const { wards, selectedWardId, status, errorMessage: wardError, fetchIfNeeded, retry } = useWardStore();
  const [page, setPage] = useState<Page<ThreadDigestView> | null>(null);
  const [pageIndex, setPageIndex] = useState(0);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [openThreadId, setOpenThreadId] = useState<string | null>(null);
  const refreshUnread = useUnreadMessagesStore((state) => state.refresh);

  useEffect(() => {
    fetchIfNeeded();
  }, [fetchIfNeeded]);

  const selectionKey = selectedWardId ?? "";
  const [lastSelectionKey, setLastSelectionKey] = useState(selectionKey);
  if (selectionKey !== lastSelectionKey) {
    setLastSelectionKey(selectionKey);
    setPage(null);
    setLoadError(null);
    setPageIndex(0);
  }

  function load() {
    if (!selectedWardId) return;
    getWardThreads(selectedWardId, pageIndex)
      .then(setPage)
      .catch((error: unknown) =>
        setLoadError(error instanceof ApiError ? error.message : "Failed to load messages"),
      );
  }

  useEffect(load, [selectedWardId, pageIndex]);

  const hasWards = status === "loaded" && wards.length > 0;

  return (
    <div className="space-y-6">
      <PageHeader title="Messages" description="Notes from your ward's class teacher." />

      {(status === "idle" || status === "loading") && (
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Spinner /> Loading…
        </div>
      )}
      {status === "error" && <ErrorState message={wardError ?? "Failed to load your wards"} onRetry={retry} />}
      {status === "loaded" && wards.length === 0 && (
        <EmptyState title="No wards linked yet" description="Contact your school if you believe this is a mistake." />
      )}

      {hasWards && <WardSelector />}

      {loadError && <Alert variant="error">{loadError}</Alert>}

      {page && page.content.length === 0 && (
        <EmptyState
          icon={MessageSquare}
          title="No messages yet"
          description="Your ward's class teacher hasn't logged a note yet."
        />
      )}

      {page && page.content.length > 0 && (
        <>
          <ul className="space-y-3">
            {page.content.map((thread) => (
              <li key={thread.threadId}>
                <button
                  type="button"
                  onClick={() => setOpenThreadId(thread.threadId ?? null)}
                  className={`w-full rounded-card border border-slate-200 border-l-4 bg-white p-4 text-left transition-colors hover:bg-slate-50 ${categoryRailClass(thread.category)}`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      {thread.unread && (
                        <span className="h-2 w-2 shrink-0 rounded-full bg-brand-500" aria-label="Unread" />
                      )}
                      {thread.category && <CategoryBadge category={thread.category} />}
                      <span className={`text-sm ${thread.unread ? "font-semibold text-slate-900" : "text-slate-500"}`}>
                        {formatLongDate(thread.logDate)}
                      </span>
                    </div>
                    <span className="text-sm text-slate-500">
                      {thread.startedByName}
                      {thread.replyCount > 0 ? ` · ${thread.replyCount} repl${thread.replyCount === 1 ? "y" : "ies"}` : ""}
                    </span>
                  </div>
                </button>
              </li>
            ))}
          </ul>
          <Pagination page={page} onPageChange={setPageIndex} />
        </>
      )}

      {openThreadId && selectedWardId && (
        <WardThreadModal
          studentId={selectedWardId}
          threadId={openThreadId}
          onClose={() => {
            setOpenThreadId(null);
            load();
            refreshUnread("GUARDIAN");
          }}
        />
      )}
    </div>
  );
}

function WardThreadModal({
  studentId,
  threadId,
  onClose,
}: {
  studentId: string;
  threadId: string;
  onClose: () => void;
}) {
  const [thread, setThread] = useState<ThreadView | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const markedReadRef = useRef<string | null>(null);

  useEffect(() => {
    getWardThread(studentId, threadId)
      .then((view) => {
        setThread(view);
        // Mark-read is a background side effect - guarded so it fires once per
        // opened thread (StrictMode double-invokes this effect) and reported
        // separately so a transient failure never masks a thread that loaded fine.
        if (markedReadRef.current !== threadId) {
          markedReadRef.current = threadId;
          markWardThreadRead(studentId, threadId).catch(() => {
            // best-effort: an unread badge lingering a bit longer isn't worth surfacing
          });
        }
      })
      .catch((error: unknown) =>
        setLoadError(error instanceof ApiError ? error.message : "Failed to load this thread"),
      );
  }, [studentId, threadId]);

  async function reload() {
    setThread(await getWardThread(studentId, threadId));
  }

  return (
    <Modal open onClose={onClose} title="Communication thread">
      {loadError && <Alert variant="error">{loadError}</Alert>}
      {!thread && !loadError && (
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Spinner /> Loading…
        </div>
      )}
      {thread && (
        <ThreadCard
          thread={thread}
          onReply={async (body) => {
            await replyToWardThread(studentId, threadId, body);
            await reload();
          }}
          onEditMessage={async (messageId, body) => {
            await editWardMessage(studentId, messageId, body);
            await reload();
          }}
        />
      )}
    </Modal>
  );
}
