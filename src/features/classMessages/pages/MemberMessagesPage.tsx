import { MessageSquare } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router";
import {
  type ClassConversation,
  type ClassConversationDigest,
  type ClassConversationList,
  editMemberMessage,
  getMemberConversation,
  getMemberInbox,
  markMemberConversationRead,
  type MemberAudience,
  sendMemberMessage,
} from "@/api/classMessages";
import { getErrorMessage } from "@/api/client";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { PageHeader } from "@/components/ui/PageHeader";
import { ClassConversationPanel } from "@/features/classMessages/components/ClassConversationPanel";
import { ChatLayout, ConversationSkeleton, ListSkeleton } from "@/features/classMessages/components/ChatLayout";
import { ConversationPane } from "@/features/classMessages/components/ConversationPane";
import { conversationKey } from "@/features/classMessages/conversationKey";
import { useAuthStore } from "@/stores/authStore";
import { useClassMessagesUnreadStore } from "@/stores/classMessagesUnreadStore";

interface MemberMessagesPageProps {
  audience: MemberAudience;
}

/**
 * A learner's or a guardian's class messages (creators Phase C11): one conversation per class
 * (per followed learner, for a guardian) across every tutor, each private to that learner. Either
 * side may write first. The chosen conversation lives in the URL (`?classId=&learnerId=`).
 */
export function MemberMessagesPage({ audience }: MemberMessagesPageProps) {
  const refreshUnread = useClassMessagesUnreadStore((state) => state.refresh);
  const userId = useAuthStore((state) => state.user?.id);
  const [searchParams, setSearchParams] = useSearchParams();
  const classId = searchParams.get("classId");
  const learnerId = searchParams.get("learnerId");
  const [inbox, setInbox] = useState<ClassConversationList | null>(null);
  const [loadedConversation, setConversation] = useState<ClassConversation | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Shown only while it still matches the URL - switching conversation shows a skeleton until it loads.
  const conversation =
    loadedConversation?.classId === classId && loadedConversation?.learnerId === learnerId
      ? loadedConversation
      : null;

  const loadInbox = useCallback(() => {
    getMemberInbox(audience)
      .then((loaded) => {
        setInbox(loaded);
        setError(null);
      })
      .catch((err: unknown) => setError(getErrorMessage(err, "We couldn't load your messages.")));
  }, [audience]);

  useEffect(loadInbox, [loadInbox]);

  useEffect(() => {
    if (!classId || !learnerId) {
      return;
    }
    let cancelled = false;
    getMemberConversation(audience, classId, learnerId)
      .then(async (loaded) => {
        if (cancelled) {
          return;
        }
        setConversation(loaded);
        if (loaded.threadId) {
          await markMemberConversationRead(audience, classId, learnerId);
          refreshUnread(audience);
          loadInbox();
        }
      })
      .catch((err: unknown) => setError(getErrorMessage(err, "We couldn't load this conversation.")));
    return () => {
      cancelled = true;
    };
  }, [audience, classId, learnerId, refreshUnread, loadInbox]);

  async function send(body: string) {
    if (!classId || !learnerId) {
      return;
    }
    await sendMemberMessage(audience, classId, learnerId, body);
    setConversation(await getMemberConversation(audience, classId, learnerId));
    loadInbox();
  }

  async function edit(messageId: string, body: string) {
    if (!classId || !learnerId) {
      return;
    }
    await editMemberMessage(audience, classId, learnerId, messageId, body);
    setConversation(await getMemberConversation(audience, classId, learnerId));
  }

  const selectedKey = classId && learnerId ? conversationKey({ classId, learnerId }) : null;
  const title = (row: ClassConversationDigest) => row.className ?? "Class";
  const subtitle = (row: ClassConversationDigest) =>
    [audience === "GUARDIAN" ? row.learnerName : null, row.creatorName].filter(Boolean).join(" · ") || null;
  const ownRole = audience === "GUARDIAN" ? "GUARDIAN" : "LEARNER";
  const heading = audience === "GUARDIAN" ? "Class messages" : "Messages";

  if (error) {
    return <ErrorState message={error} onRetry={loadInbox} />;
  }

  if (inbox !== null && inbox.conversations.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader title={heading} />
        <EmptyState
          icon={MessageSquare}
          title="No messages"
          description="Your tutors' classes with messaging show up here."
        />
      </div>
    );
  }

  return (
    <ChatLayout
      open={selectedKey !== null}
      placeholder={
        audience === "GUARDIAN"
          ? "Choose a class to talk privately with your child's tutor."
          : "Choose a class to talk privately with its tutor."
      }
      list={
        <ConversationPane
          heading={heading}
          rows={inbox?.conversations ?? null}
          loading={<ListSkeleton />}
          empty={null}
          searchPlaceholder="Search classes or tutors"
          selectedKey={selectedKey}
          onSelect={(row) => setSearchParams({ classId: row.classId, learnerId: row.learnerId })}
          title={title}
          subtitle={subtitle}
          lastIsOwn={(row) => row.lastAuthorRole === ownRole && audience === "LEARNER"}
        />
      }
      conversation={
        conversation ? (
          <ClassConversationPanel
            conversation={conversation}
            title={conversation.className ?? "Class"}
            subtitle={
              [audience === "GUARDIAN" ? `About ${conversation.learnerName}` : null, conversation.creatorName]
                .filter(Boolean)
                .join(" · ") || undefined
            }
            isOwn={(message) => message.authorId === userId}
            onSend={send}
            onEditMessage={edit}
            onBack={() => setSearchParams({})}
            backLabel="Back to messages"
            emptyHint={
              conversation.creatorName ? `Start the conversation with ${conversation.creatorName}.` : undefined
            }
          />
        ) : selectedKey ? (
          <ConversationSkeleton />
        ) : null
      }
    />
  );
}
