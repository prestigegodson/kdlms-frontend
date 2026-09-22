import { MessageSquare } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router";
import {
  type ClassThreadBoardView,
  type ThreadDigestView,
  type ThreadView,
  type UnreadThreadsView,
  editMessage,
  getBoard,
  getThread,
  getUnreadThreads,
  markThreadRead,
  replyToThread,
} from "@/api/communication";
import { ApiError, getErrorMessage } from "@/api/client";
import { listMyClasses, type TeacherClassView } from "@/api/me";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Modal } from "@/components/ui/Modal";
import { PageHeader } from "@/components/ui/PageHeader";
import { Spinner } from "@/components/ui/Spinner";
import { StickySubHeader } from "@/components/ui/StickySubHeader";
import { Tabs } from "@/components/ui/Tabs";
import { ClassDatePicker } from "@/features/attendance/components/ClassDatePicker";
import { ComposeNoteSheet, type RosterOption } from "@/features/communication/components/ComposeNoteSheet";
import { MessageBoard } from "@/features/communication/components/MessageBoard";
import { ThreadCard } from "@/features/communication/components/ThreadCard";
import { UnreadThreadList } from "@/features/communication/components/UnreadThreadList";
import { useUnreadMessagesStore } from "@/stores/unreadMessagesStore";
import { todayIso } from "@/utils/date";

type MessagesTab = "unread" | "board";

/**
 * A class teacher's daily log: pick a class (class-taught only - a
 * subject-teacher-only account has nothing to log, mirrors
 * TeacherRegisterPanel) and a day, then see every roster student with
 * whether a note was logged and log new ones. "Log a note" is this view's
 * one accent CTA (style_guide.md's 60/30/10 balance).
 */
export function TeacherMessageBoard() {
  const [classes, setClasses] = useState<TeacherClassView[] | null>(null);
  const [classId, setClassId] = useState("");
  const [date, setDate] = useState(todayIso());

  const [board, setBoard] = useState<ClassThreadBoardView | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [composeStudentIds, setComposeStudentIds] = useState<string[] | null>(null);
  const [openThreadId, setOpenThreadId] = useState<string | null>(null);

  const unreadCount = useUnreadMessagesStore((state) => state.count);
  const refreshUnread = useUnreadMessagesStore((state) => state.refresh);
  const [searchParams, setSearchParams] = useSearchParams();
  const viewParam = searchParams.get("view");
  // Defaults to the Unread tab when there's something unread to see (and no explicit
  // ?view= was given) - what makes the nav pill's click land directly on the messages
  // it's counting, rather than on today's by-class-and-date board.
  const [tab, setTab] = useState<MessagesTab>(() =>
    viewParam === "unread" || viewParam === "board" ? viewParam : unreadCount > 0 ? "unread" : "board",
  );
  const [unreadView, setUnreadView] = useState<UnreadThreadsView | null>(null);
  const [unreadError, setUnreadError] = useState<string | null>(null);

  function changeTab(next: MessagesTab) {
    setTab(next);
    setSearchParams(next === "board" ? {} : { view: next }, { replace: true });
  }

  function loadUnread() {
    getUnreadThreads()
      .then((view) => {
        setUnreadView(view);
        setUnreadError(null);
      })
      .catch((error: unknown) => setUnreadError(getErrorMessage(error, "Failed to load unread messages")));
  }

  useEffect(() => {
    if (tab === "unread") {
      loadUnread();
      refreshUnread("TEACHER");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs only when the tab changes, not on every refreshUnread identity change
  }, [tab]);

  useEffect(() => {
    listMyClasses()
      .then((all) => setClasses(all.filter((teacherClass) => teacherClass.isClassTeacher)))
      .catch(() => setClasses([]));
  }, []);

  const effectiveClassId = classId || classes?.[0]?.classId || "";

  const selectionKey = `${effectiveClassId}|${date}`;
  const [lastSelectionKey, setLastSelectionKey] = useState(selectionKey);
  if (selectionKey !== lastSelectionKey) {
    setLastSelectionKey(selectionKey);
    setBoard(null);
    setLoadError(null);
  }

  function load() {
    if (!effectiveClassId || !date) return;
    getBoard(effectiveClassId, date)
      .then(setBoard)
      .catch((error: unknown) =>
        setLoadError(error instanceof ApiError ? error.message : "Failed to load the board"),
      );
  }

  useEffect(load, [effectiveClassId, date]);

  const classOptions = (classes ?? []).map((teacherClass) => ({
    id: teacherClass.classId,
    name: teacherClass.className,
  }));
  const roster: RosterOption[] = (board?.rows ?? []).map((row) => ({
    studentId: row.studentId,
    studentName: row.studentName,
    admissionNumber: row.admissionNumber,
  }));

  function handleSaved() {
    setComposeStudentIds(null);
    load();
    refreshUnread("TEACHER");
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Messages"
        description="Log a note about a student today, or catch up on replies."
        actions={
          tab === "board" &&
          board &&
          board.canCompose && (
            <Button variant="accent" onClick={() => setComposeStudentIds([])}>
              Log a note
            </Button>
          )
        }
      />

      <Tabs
        ariaLabel="Message views"
        value={tab}
        onChange={changeTab}
        items={[
          { value: "unread", label: `Unread (${unreadCount})` },
          { value: "board", label: "By class & date" },
        ]}
      />

      {tab === "unread" && (
        <UnreadThreadList
          view={unreadView}
          error={unreadError}
          onOpenThread={(thread: ThreadDigestView) => setOpenThreadId(thread.threadId ?? null)}
        />
      )}

      {tab === "board" && (
        <>
          {classes === null && (
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <Spinner /> Loading your classes…
            </div>
          )}
          {classes !== null && classes.length === 0 && (
            <EmptyState
              icon={MessageSquare}
              title="No classes to log for"
              description="You'll see this page once you're assigned as a class teacher."
            />
          )}

          {classes !== null && classes.length > 0 && (
            <StickySubHeader>
              <ClassDatePicker
                classes={classOptions}
                classId={effectiveClassId}
                onClassChange={setClassId}
                date={date}
                onDateChange={setDate}
              />
            </StickySubHeader>
          )}

          {loadError && <Alert variant="error">{loadError}</Alert>}

          {board && board.rows.length === 0 && (
            <EmptyState
              title="Nobody to log for"
              description="No students are enrolled in this class for this session."
            />
          )}
          {board && board.rows.length > 0 && (
            <MessageBoard
              board={board}
              onOpenThread={setOpenThreadId}
              onComposeFor={board.canCompose ? (studentId) => setComposeStudentIds([studentId]) : undefined}
            />
          )}
        </>
      )}

      {composeStudentIds && effectiveClassId && (
        <ComposeNoteSheet
          classId={effectiveClassId}
          roster={roster}
          initialStudentIds={composeStudentIds}
          onClose={() => setComposeStudentIds(null)}
          onSaved={handleSaved}
        />
      )}

      {openThreadId && (
        <ThreadModal
          threadId={openThreadId}
          onClose={() => {
            setOpenThreadId(null);
            load();
            loadUnread();
            refreshUnread("TEACHER");
          }}
        />
      )}
    </div>
  );
}

function ThreadModal({ threadId, onClose }: { threadId: string; onClose: () => void }) {
  const [thread, setThread] = useState<ThreadView | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const markedReadRef = useRef<string | null>(null);

  useEffect(() => {
    getThread(threadId)
      .then((view) => {
        setThread(view);
        // Mark-read is a background side effect - guarded so it fires once per
        // opened thread (StrictMode double-invokes this effect) and reported
        // separately so a transient failure never masks a thread that loaded fine.
        if (markedReadRef.current !== threadId) {
          markedReadRef.current = threadId;
          markThreadRead(threadId).catch(() => {
            // best-effort: an unread badge lingering a bit longer isn't worth surfacing
          });
        }
      })
      .catch((error: unknown) =>
        setLoadError(error instanceof ApiError ? error.message : "Failed to load this thread"),
      );
  }, [threadId]);

  async function reload() {
    setThread(await getThread(threadId));
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
            await replyToThread(threadId, body);
            await reload();
          }}
          onEditMessage={async (messageId, body) => {
            await editMessage(messageId, body);
            await reload();
          }}
        />
      )}
    </Modal>
  );
}
