import { ArrowLeft, Lock, MessageSquare } from "lucide-react";
import { Fragment, useEffect, useRef } from "react";
import type { ClassConversation } from "@/api/classMessages";
import type { MessageView } from "@/api/communication";
import { ActionMenu, type ActionMenuItem } from "@/components/ui/ActionMenu";
import { Avatar } from "@/components/ui/Avatar";
import { ChatComposer } from "@/features/classMessages/components/ChatComposer";
import { continuesRun, dayLabel, groupByDay } from "@/features/classMessages/components/chatTimeline";
import { MessageBubble } from "@/features/classMessages/components/MessageBubble";
import { initialsOfFullName } from "@/utils/initials";

interface ClassConversationPanelProps {
  conversation: ClassConversation;
  /** The heading line - the learner's name for a creator, the class (and tutor) for a learner or guardian. */
  title: string;
  subtitle?: string;
  /** Whether the signed-in user wrote a message - their bubbles sit on the right. */
  isOwn: (message: MessageView) => boolean;
  onSend: (body: string) => Promise<void>;
  onEditMessage: (messageId: string, body: string) => Promise<void>;
  /** Shown on small screens, where the conversation replaces the list. */
  onBack?: () => void;
  backLabel?: string;
  menu?: ActionMenuItem[];
  /** The line under the empty-conversation icon. */
  emptyHint?: string;
}

/**
 * One creator-learner class conversation (creators Phase C11) as a chat: a header, the messages as
 * bubbles split by day, and the composer docked at the bottom. `conversation.canPost` (server-derived
 * - archived or over-limit class, over-limit enrollment, or a learner no longer in the class) decides
 * whether the composer renders, so the same panel serves the creator, the learner, and a guardian.
 */
export function ClassConversationPanel({
  conversation,
  title,
  subtitle,
  isOwn,
  onSend,
  onEditMessage,
  onBack,
  backLabel = "Back to conversations",
  menu,
  emptyHint,
}: ClassConversationPanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const lastMessageId = conversation.messages[conversation.messages.length - 1]?.messageId;

  // Land on the newest message when a conversation opens and whenever one is added.
  useEffect(() => {
    const scroller = scrollRef.current;
    if (scroller) {
      scroller.scrollTop = scroller.scrollHeight;
    }
  }, [conversation.classId, conversation.learnerId, lastMessageId]);

  const days = groupByDay(conversation.messages);

  return (
    <section className="flex h-full min-h-0 flex-col" aria-label={`Conversation with ${title}`}>
      <header className="flex items-center gap-3 border-b border-slate-200 px-4 py-3 sm:px-5">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            aria-label={backLabel}
            className="-ml-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-slate-600 hover:bg-slate-100 lg:hidden"
          >
            <ArrowLeft className="h-5 w-5" aria-hidden="true" />
          </button>
        )}
        <Avatar initials={initialsOfFullName(title)} url={null} size="sm" />
        <div className="min-w-0 flex-1">
          <h2 className="truncate font-display text-lg font-medium text-slate-900">{title}</h2>
          {subtitle && <p className="truncate text-xs text-slate-500">{subtitle}</p>}
        </div>
        {menu && menu.length > 0 && <ActionMenu items={menu} label="More" ariaLabel="More conversation actions" />}
      </header>

      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto bg-slate-50/60 px-3 py-4 sm:px-5">
        {conversation.messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 py-10 text-center text-sm text-slate-500">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-50">
              <MessageSquare className="h-6 w-6 text-brand-500" aria-hidden="true" />
            </span>
            <p className="font-medium text-slate-700">No messages yet.</p>
            {emptyHint && <p>{emptyHint}</p>}
          </div>
        ) : (
          <ol className="space-y-3">
            {days.map((day) => (
              <Fragment key={day.key}>
                <li className="flex items-center gap-3 py-2">
                  <span className="h-px flex-1 bg-slate-200" />
                  <span className="text-xs font-medium text-slate-500">{dayLabel(day.date)}</span>
                  <span className="h-px flex-1 bg-slate-200" />
                </li>
                {day.messages.map((message, index) => (
                  <li key={message.messageId}>
                    <MessageBubble
                      message={message}
                      own={isOwn(message)}
                      firstOfRun={!continuesRun(day.messages[index - 1], message)}
                      lastOfRun={!continuesRun(message, day.messages[index + 1])}
                      onEdit={(body) => onEditMessage(message.messageId, body)}
                    />
                  </li>
                ))}
              </Fragment>
            ))}
          </ol>
        )}
      </div>

      {conversation.canPost ? (
        <ChatComposer onSend={onSend} />
      ) : (
        <p className="flex items-center justify-center gap-2 border-t border-slate-200 bg-white px-4 py-4 text-sm text-slate-500">
          <Lock className="h-4 w-4" aria-hidden="true" />
          This conversation is read-only.
        </p>
      )}
    </section>
  );
}
