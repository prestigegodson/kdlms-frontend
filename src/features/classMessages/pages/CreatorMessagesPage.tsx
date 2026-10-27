import { Megaphone, MessageSquare, Presentation } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import {
  type ClassConversation,
  type ClassMessagesBoard,
  editCreatorMessage,
  getClassMessagesBoard,
  getCreatorConversation,
  markCreatorConversationRead,
  sendCreatorMessage,
} from "@/api/classMessages";
import { getErrorMessage } from "@/api/client";
import { listVirtualClasses, type VirtualClass } from "@/api/virtualClasses";
import { can } from "@/auth/permissions";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { PageHeader } from "@/components/ui/PageHeader";
import { Select } from "@/components/ui/Select";
import { Skeleton } from "@/components/ui/Skeleton";
import { AnnouncementSheet } from "@/features/classMessages/components/AnnouncementSheet";
import { ClassConversationPanel } from "@/features/classMessages/components/ClassConversationPanel";
import { ChatLayout, ConversationSkeleton, ListSkeleton } from "@/features/classMessages/components/ChatLayout";
import { ConversationPane } from "@/features/classMessages/components/ConversationPane";
import { conversationKey } from "@/features/classMessages/conversationKey";
import { useClassMessagesUnreadStore } from "@/stores/classMessagesUnreadStore";
import { useCreatorPlanStore } from "@/stores/creatorPlanStore";

/**
 * A creator's class messages (creators Phase C11): pick a class, see one row per learner, open a
 * learner's private conversation, or announce to the whole class. The class and learner live in the
 * URL (`?classId=&learnerId=`), so a roster's "Message" link lands straight on a conversation.
 */
export function CreatorMessagesPage() {
  const fetchPlan = useCreatorPlanStore((state) => state.fetchIfNeeded);
  const plan = useCreatorPlanStore((state) => state.plan);
  const planStatus = useCreatorPlanStore((state) => state.status);
  const refreshUnread = useClassMessagesUnreadStore((state) => state.refresh);
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const classId = searchParams.get("classId");
  const learnerId = searchParams.get("learnerId");

  const [classes, setClasses] = useState<VirtualClass[] | null>(null);
  const [loadedBoard, setBoard] = useState<ClassMessagesBoard | null>(null);
  const [loadedConversation, setConversation] = useState<ClassConversation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [announcing, setAnnouncing] = useState(false);
  // What was loaded last, shown only while it still matches the URL - a class or learner switch
  // shows a skeleton until its own data arrives.
  const board = loadedBoard?.classId === classId ? loadedBoard : null;
  const conversation =
    loadedConversation?.classId === classId && loadedConversation?.learnerId === learnerId
      ? loadedConversation
      : null;

  useEffect(() => {
    fetchPlan();
  }, [fetchPlan]);

  // Unknown while the plan loads; if it can't be loaded, carry on and let the server's own answer show.
  const entitled =
    planStatus === "loaded"
      ? can.viewClassMessages("CREATOR", plan?.communication ?? false)
      : planStatus === "error"
        ? true
        : null;

  useEffect(() => {
    if (entitled !== true) {
      return;
    }
    listVirtualClasses()
      .then((list) =>
        setClasses(
          [...list.classes].sort((a, b) =>
            a.status === b.status ? a.name.localeCompare(b.name) : a.status === "ACTIVE" ? -1 : 1,
          ),
        ),
      )
      .catch((err: unknown) => setError(getErrorMessage(err, "We couldn't load your classes.")));
  }, [entitled]);

  // Land on the first class when none is chosen yet.
  useEffect(() => {
    if (!classId && classes && classes.length > 0) {
      setSearchParams({ classId: classes[0].id }, { replace: true });
    }
  }, [classId, classes, setSearchParams]);

  const loadBoard = useCallback(() => {
    if (!classId) {
      return;
    }
    getClassMessagesBoard(classId)
      .then((loaded) => {
        setBoard(loaded);
        setError(null);
      })
      .catch((err: unknown) => setError(getErrorMessage(err, "We couldn't load this class's messages.")));
  }, [classId]);

  useEffect(() => {
    if (entitled === true) {
      loadBoard();
    }
  }, [entitled, loadBoard]);

  useEffect(() => {
    if (entitled !== true || !classId || !learnerId) {
      return;
    }
    let cancelled = false;
    getCreatorConversation(classId, learnerId)
      .then(async (loaded) => {
        if (cancelled) {
          return;
        }
        setConversation(loaded);
        if (loaded.threadId) {
          await markCreatorConversationRead(classId, learnerId);
          refreshUnread("CREATOR");
          loadBoard();
        }
      })
      .catch((err: unknown) => setError(getErrorMessage(err, "We couldn't load this conversation.")));
    return () => {
      cancelled = true;
    };
  }, [entitled, classId, learnerId, refreshUnread, loadBoard]);

  if (entitled === false) {
    return (
      <div className="space-y-6">
        <PageHeader title="Messages" />
        <EmptyState
          icon={MessageSquare}
          title="Messaging isn't in your plan"
          description="Upgrade to a plan with messaging to talk with your learners and their guardians."
          action={
            <Link
              to="/tutor/billing"
              className="inline-flex min-h-11 items-center rounded-control bg-brand-500 px-4 text-sm font-medium text-white hover:bg-brand-600"
            >
              See plans
            </Link>
          }
        />
      </div>
    );
  }

  async function send(body: string) {
    if (!classId || !learnerId) {
      return;
    }
    await sendCreatorMessage(classId, learnerId, body);
    setConversation(await getCreatorConversation(classId, learnerId));
    loadBoard();
  }

  async function edit(messageId: string, body: string) {
    if (!classId || !learnerId) {
      return;
    }
    await editCreatorMessage(messageId, body);
    setConversation(await getCreatorConversation(classId, learnerId));
  }

  const selectedKey = classId && learnerId ? conversationKey({ classId, learnerId }) : null;
  const canAnnounce = can.announceToClass("CREATOR") && !!board?.writable && board.rows.length > 0;

  if (error) {
    return <ErrorState message={error} onRetry={loadBoard} />;
  }

  if (classes !== null && classes.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader title="Messages" />
        <EmptyState
          icon={MessageSquare}
          title="No classes yet"
          description="Create a class and enroll learners to start messaging them."
        />
      </div>
    );
  }

  return (
    <>
      <ChatLayout
        open={selectedKey !== null}
        placeholder="Choose a learner to open your conversation, or announce something to the whole class."
        list={
          <ConversationPane
            heading="Messages"
            action={
              canAnnounce ? (
                <Button size="sm" onClick={() => setAnnouncing(true)} aria-label="Announce to class">
                  <Megaphone className="h-4 w-4" aria-hidden="true" />
                  Announce
                </Button>
              ) : undefined
            }
            toolbar={
              classes === null ? (
                <Skeleton className="h-10" />
              ) : (
                <Select
                  aria-label="Class"
                  value={classId ?? ""}
                  onChange={(event) => setSearchParams({ classId: event.target.value })}
                >
                  {classes.map((virtualClass) => (
                    <option key={virtualClass.id} value={virtualClass.id}>
                      {virtualClass.name}
                      {virtualClass.status === "ARCHIVED" ? " (archived)" : ""}
                    </option>
                  ))}
                </Select>
              )
            }
            rows={board?.rows ?? null}
            loading={<ListSkeleton />}
            empty={
              <div className="px-4 py-10 text-center text-sm text-slate-500">
                <p className="font-medium text-slate-700">No learners in this class</p>
                <p className="mt-1">Enroll learners in this class to message them.</p>
              </div>
            }
            searchPlaceholder="Search learners"
            selectedKey={selectedKey}
            onSelect={(row) => setSearchParams({ classId: row.classId, learnerId: row.learnerId })}
            title={(row) => row.learnerName ?? "Learner"}
            lastIsOwn={(row) => row.lastAuthorRole === "CREATOR"}
          />
        }
        conversation={
          conversation && board ? (
            <ClassConversationPanel
              conversation={conversation}
              title={conversation.learnerName ?? "Learner"}
              subtitle={board.className}
              isOwn={(message) => message.authorRole === "CREATOR"}
              onSend={send}
              onEditMessage={edit}
              onBack={() => setSearchParams({ classId: board.classId })}
              backLabel={`Back to ${board.className}`}
              emptyHint={`Say hello to ${conversation.learnerName ?? "your learner"}.`}
              menu={[
                {
                  label: "View class",
                  icon: Presentation,
                  onSelect: () => navigate(`/tutor/classes/${board.classId}`),
                },
                ...(canAnnounce
                  ? [{ label: "Announce to class", icon: Megaphone, onSelect: () => setAnnouncing(true) }]
                  : []),
              ]}
            />
          ) : selectedKey ? (
            <ConversationSkeleton />
          ) : null
        }
      />

      {announcing && board && (
        <AnnouncementSheet
          classId={board.classId}
          className={board.className}
          onClose={() => setAnnouncing(false)}
          onSent={() => {
            loadBoard();
            if (learnerId && classId) {
              getCreatorConversation(classId, learnerId).then(setConversation).catch(() => undefined);
            }
          }}
        />
      )}
    </>
  );
}
