import { MessageSquare } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
  type ClassThreadBoardView,
  type ThreadView,
  editMessage,
  getBoard,
  getThread,
  markThreadRead,
  replyToThread,
} from "@/api/communication";
import { ApiError } from "@/api/client";
import { listMyClasses, type TeacherClassView } from "@/api/me";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Modal } from "@/components/ui/Modal";
import { PageHeader } from "@/components/ui/PageHeader";
import { Spinner } from "@/components/ui/Spinner";
import { StickySubHeader } from "@/components/ui/StickySubHeader";
import { ClassDatePicker } from "@/features/attendance/components/ClassDatePicker";
import { ComposeNoteSheet, type RosterOption } from "@/features/communication/components/ComposeNoteSheet";
import { MessageBoard } from "@/features/communication/components/MessageBoard";
import { ThreadCard } from "@/features/communication/components/ThreadCard";
import { useUnreadMessagesStore } from "@/stores/unreadMessagesStore";
import { todayIso } from "@/utils/date";

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

  const refreshUnread = useUnreadMessagesStore((state) => state.refresh);

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
          board &&
          board.canCompose && (
            <Button variant="accent" onClick={() => setComposeStudentIds([])}>
              Log a note
            </Button>
          )
        }
      />

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
        <EmptyState title="Nobody to log for" description="No students are enrolled in this class for this session." />
      )}
      {board && board.rows.length > 0 && (
        <MessageBoard
          board={board}
          onOpenThread={setOpenThreadId}
          onComposeFor={board.canCompose ? (studentId) => setComposeStudentIds([studentId]) : undefined}
        />
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
