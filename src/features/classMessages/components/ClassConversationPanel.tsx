import { MessageSquare } from "lucide-react";
import type { ClassConversation } from "@/api/classMessages";
import { MessageRow, ReplyComposer } from "@/features/communication/components/MessageTimeline";

interface ClassConversationPanelProps {
  conversation: ClassConversation;
  /** The heading line - the learner's name for a creator, the class (and tutor) for a learner or guardian. */
  title: string;
  subtitle?: string;
  onSend: (body: string) => Promise<void>;
  onEditMessage: (messageId: string, body: string) => Promise<void>;
}

/**
 * One creator-learner class conversation (creators Phase C11): a flat, chronological message list
 * with the composer docked under it. `conversation.canPost` (server-derived - archived or over-limit
 * class, over-limit enrollment, or a learner no longer in the class) decides whether the composer
 * renders, so the same panel serves the creator, the learner, and a guardian.
 */
export function ClassConversationPanel({
  conversation,
  title,
  subtitle,
  onSend,
  onEditMessage,
}: ClassConversationPanelProps) {
  return (
    <div className="rounded-card border border-slate-200 bg-white p-5">
      <div>
        <h2 className="text-base font-semibold text-slate-900">{title}</h2>
        {subtitle && <p className="text-sm text-slate-500">{subtitle}</p>}
      </div>

      {conversation.messages.length === 0 ? (
        <div className="mt-6 flex flex-col items-center gap-2 py-6 text-center text-sm text-slate-500">
          <MessageSquare className="h-6 w-6 text-slate-300" aria-hidden="true" />
          No messages yet.
        </div>
      ) : (
        <div className="mt-4 space-y-4">
          {conversation.messages.map((message) => (
            <MessageRow
              key={message.messageId}
              message={message}
              indented={false}
              showDate
              onEdit={(body) => onEditMessage(message.messageId, body)}
            />
          ))}
        </div>
      )}

      {conversation.canPost ? (
        <ReplyComposer onReply={onSend} placeholder="Write a message…" submitLabel="Send" />
      ) : (
        <p className="mt-5 border-t border-slate-100 pt-4 text-sm text-slate-500">
          This conversation is read-only.
        </p>
      )}
    </div>
  );
}
