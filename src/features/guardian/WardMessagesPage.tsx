import { ChevronRight, MessageSquare } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router";
import {
  editWardMessage,
  getWardThread,
  getWardThreads,
  getWardUnreadThreads,
  markWardThreadRead,
  replyToWardThread,
  type ThreadDigestView,
  type ThreadView,
  type UnreadThreadsView,
} from "@/api/communication";
import { ApiError, getErrorMessage } from "@/api/client";
import { Alert } from "@/components/ui/Alert";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Modal } from "@/components/ui/Modal";
import { PageHeader } from "@/components/ui/PageHeader";
import { Pagination } from "@/components/ui/Pagination";
import { Spinner } from "@/components/ui/Spinner";
import { StickySubHeader } from "@/components/ui/StickySubHeader";
import { Tabs } from "@/components/ui/Tabs";
import { CategoryBadge } from "@/features/communication/components/CategoryBadge";
import { ThreadCard } from "@/features/communication/components/ThreadCard";
import { UnreadThreadList } from "@/features/communication/components/UnreadThreadList";
import { categoryRailClass } from "@/features/communication/messageCategory";
import { WardSelector } from "@/features/guardian/components/WardSelector";
import { useUnreadMessagesStore } from "@/stores/unreadMessagesStore";
import { useWardStore } from "@/stores/wardStore";
import { formatLongDate } from "@/utils/date";
import type { Page } from "@/api/types";

type MessagesTab = "unread" | "all";

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
  const [openThread, setOpenThread] = useState<{ studentId: string; threadId: string } | null>(null);

  const unreadCount = useUnreadMessagesStore((state) => state.count);
  const refreshUnread = useUnreadMessagesStore((state) => state.refresh);
  const [searchParams, setSearchParams] = useSearchParams();
  const viewParam = searchParams.get("view");
  // Defaults to the Unread tab when there's something unread to see (and no explicit
  // ?view= was given) - what makes the nav pill's click land directly on the messages
  // it's counting, rather than on the currently selected ward's own thread list.
  const [tab, setTab] = useState<MessagesTab>(() =>
    viewParam === "unread" || viewParam === "all" ? viewParam : unreadCount > 0 ? "unread" : "all",
  );
  const [unreadView, setUnreadView] = useState<UnreadThreadsView | null>(null);
  const [unreadError, setUnreadError] = useState<string | null>(null);

  function changeTab(next: MessagesTab) {
    setTab(next);
    setSearchParams(next === "all" ? {} : { view: next }, { replace: true });
  }

  function loadUnread() {
    getWardUnreadThreads()
      .then((view) => {
        setUnreadView(view);
        setUnreadError(null);
      })
      .catch((error: unknown) => setUnreadError(getErrorMessage(error, "Failed to load unread messages")));
  }

  useEffect(() => {
    if (tab === "unread") {
      loadUnread();
      refreshUnread("GUARDIAN");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs only when the tab changes, not on every refreshUnread identity change
  }, [tab]);

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

      {hasWards && (
        <Tabs
          ariaLabel="Message views"
          value={tab}
          onChange={changeTab}
          items={[
            { value: "unread", label: `Unread (${unreadCount})` },
            { value: "all", label: "All messages" },
          ]}
        />
      )}

      {hasWards && tab === "unread" && (
        <UnreadThreadList
          view={unreadView}
          error={unreadError}
          onOpenThread={(thread) =>
            thread.threadId && setOpenThread({ studentId: thread.studentId, threadId: thread.threadId })
          }
        />
      )}

      {hasWards && tab === "all" && (
        <>
          <StickySubHeader>
            <WardSelector />
          </StickySubHeader>

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
                      onClick={() =>
                        thread.threadId &&
                        selectedWardId &&
                        setOpenThread({ studentId: selectedWardId, threadId: thread.threadId })
                      }
                      className={`flex min-h-14 w-full items-center gap-3 rounded-card border border-slate-200 border-l-4 bg-white p-4 text-left transition-colors hover:bg-slate-50 ${categoryRailClass(thread.category)}`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            {thread.unread && (
                              <span className="h-2 w-2 shrink-0 rounded-full bg-brand-500" aria-label="Unread" />
                            )}
                            {thread.category && <CategoryBadge category={thread.category} />}
                            <span
                              className={`text-sm ${thread.unread ? "font-semibold text-slate-900" : "text-slate-500"}`}
                            >
                              {formatLongDate(thread.logDate)}
                            </span>
                          </div>
                          <span className="text-sm text-slate-500">
                            {thread.startedByName}
                            {thread.replyCount > 0
                              ? ` · ${thread.replyCount} repl${thread.replyCount === 1 ? "y" : "ies"}`
                              : ""}
                          </span>
                        </div>
                      </div>
                      <ChevronRight className="h-5 w-5 shrink-0 text-slate-400" aria-hidden="true" />
                    </button>
                  </li>
                ))}
              </ul>
              <Pagination page={page} onPageChange={setPageIndex} />
            </>
          )}
        </>
      )}

      {openThread && (
        <WardThreadModal
          studentId={openThread.studentId}
          threadId={openThread.threadId}
          onClose={() => {
            setOpenThread(null);
            load();
            loadUnread();
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
