import { MessageSquare } from "lucide-react";
import { useEffect, useState } from "react";
import { type ClassThreadBoardView, type ThreadView, getBoard, getThread } from "@/api/communication";
import { ApiError } from "@/api/client";
import { listClasses, type SchoolClassView } from "@/api/classes";
import { can } from "@/auth/permissions";
import { Alert } from "@/components/ui/Alert";
import { EmptyState } from "@/components/ui/EmptyState";
import { Modal } from "@/components/ui/Modal";
import { PageHeader } from "@/components/ui/PageHeader";
import { Spinner } from "@/components/ui/Spinner";
import { StickySubHeader } from "@/components/ui/StickySubHeader";
import { ClassDatePicker } from "@/features/attendance/components/ClassDatePicker";
import { BranchFilter } from "@/features/branches/components/BranchFilter";
import { useBranchScope } from "@/features/branches/useBranchScope";
import { MessageBoard } from "@/features/communication/components/MessageBoard";
import { ThreadCard } from "@/features/communication/components/ThreadCard";
import { useAuthStore } from "@/stores/authStore";
import { todayIso } from "@/utils/date";

/**
 * A read-only view for SCHOOL_ADMIN (every class) / BRANCH_ADMIN (own
 * branch, server-scoped) - the same board a class teacher sees, minus any
 * compose or reply affordance. No `POST .../read` call here: that endpoint
 * is TEACHER-only, and an admin browsing the log is an observer, not a
 * participant (see CLAUDE.md's Domain Rules for `communication`).
 */
export function AdminMessageOverview() {
  const role = useAuthStore((state) => state.user?.role);
  const showsBranchFilter = can.selectBranch(role);
  const { ready: branchReady, branchId } = useBranchScope();

  const [classes, setClasses] = useState<SchoolClassView[] | null>(null);
  const [classId, setClassId] = useState("");
  const [date, setDate] = useState(todayIso());
  const [board, setBoard] = useState<ClassThreadBoardView | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [openThreadId, setOpenThreadId] = useState<string | null>(null);

  useEffect(() => {
    if (!branchReady) return;
    listClasses(branchId, undefined, 0, 200)
      .then((page) => setClasses(page.content))
      .catch(() => setClasses([]));
  }, [branchReady, branchId]);

  // A branch change clears the class selection during render (same idiom as below) - a class
  // from the previous branch would otherwise stay selected even once it's out of the picker's options.
  const [lastBranchId, setLastBranchId] = useState(branchId);
  if (branchId !== lastBranchId) {
    setLastBranchId(branchId);
    setClassId("");
  }

  const classOptions = (classes ?? []).map((schoolClass) => ({ id: schoolClass.id, name: schoolClass.name }));
  const effectiveClassId = classId || classOptions[0]?.id || "";

  const selectionKey = `${effectiveClassId}|${date}`;
  const [lastSelectionKey, setLastSelectionKey] = useState(selectionKey);
  if (selectionKey !== lastSelectionKey) {
    setLastSelectionKey(selectionKey);
    setBoard(null);
    setLoadError(null);
  }

  useEffect(() => {
    if (!effectiveClassId || !date) return;
    getBoard(effectiveClassId, date)
      .then(setBoard)
      .catch((error: unknown) =>
        setLoadError(error instanceof ApiError ? error.message : "Failed to load the board"),
      );
  }, [effectiveClassId, date]);

  return (
    <div className="space-y-6">
      <PageHeader title="Messages" description="Review the class communication log for any day." />

      {classes === null && (
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Spinner /> Loading classes…
        </div>
      )}
      {classes !== null && classes.length === 0 && (
        <EmptyState icon={MessageSquare} title="No classes yet" />
      )}

      {classes !== null && (classes.length > 0 || showsBranchFilter) && (
        <StickySubHeader>
          <BranchFilter id="messages-branch" />
          {classes.length > 0 && (
            <ClassDatePicker
              classes={classOptions}
              classId={effectiveClassId}
              onClassChange={setClassId}
              date={date}
              onDateChange={setDate}
            />
          )}
        </StickySubHeader>
      )}

      {loadError && <Alert variant="error">{loadError}</Alert>}

      {board && board.rows.length === 0 && <EmptyState title="No students enrolled" />}
      {board && board.rows.length > 0 && <MessageBoard board={board} onOpenThread={setOpenThreadId} />}

      {openThreadId && <ReadOnlyThreadModal threadId={openThreadId} onClose={() => setOpenThreadId(null)} />}
    </div>
  );
}

function ReadOnlyThreadModal({ threadId, onClose }: { threadId: string; onClose: () => void }) {
  const [thread, setThread] = useState<ThreadView | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    getThread(threadId)
      .then(setThread)
      .catch((error: unknown) =>
        setLoadError(error instanceof ApiError ? error.message : "Failed to load this thread"),
      );
  }, [threadId]);

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
          onReply={async () => undefined}
          onEditMessage={async () => undefined}
        />
      )}
    </Modal>
  );
}
