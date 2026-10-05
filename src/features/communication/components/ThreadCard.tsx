import type { ThreadView } from "@/api/communication";
import { CategoryBadge } from "@/features/communication/components/CategoryBadge";
import { MessageRow, ReplyComposer } from "@/features/communication/components/MessageTimeline";
import { categoryRailClass } from "@/features/communication/messageCategory";
import { formatLongDate } from "@/utils/date";

interface ThreadCardProps {
  thread: ThreadView;
  onReply: (body: string) => Promise<void>;
  onEditMessage: (messageId: string, body: string) => Promise<void>;
}

/**
 * A thread's record card - the category rail carries the meaning (see
 * messageCategory.ts), the root note is the body, and replies stack below
 * it quietly and flatly (never nested - there is no reply-to-a-reply in
 * this feature). Shared by the staff board's thread view and the guardian
 * ward view - `thread.canReply` (server-derived) is what actually decides
 * whether the composer at the bottom renders, so this component doesn't
 * need to know which side of the conversation is viewing it.
 */
export function ThreadCard({ thread, onReply, onEditMessage }: ThreadCardProps) {
  return (
    <div className={`rounded-card border border-slate-200 border-l-4 bg-white p-5 ${categoryRailClass(thread.category)}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <CategoryBadge category={thread.category} />
          <span className="text-sm text-slate-500">{formatLongDate(thread.logDate)}</span>
        </div>
        <span className="text-sm text-slate-500">
          {thread.studentName} · {thread.admissionNumber}
        </span>
      </div>

      <div className="mt-4 space-y-4">
        {thread.messages.map((message, index) => (
          <MessageRow
            key={message.messageId}
            message={message}
            indented={index > 0}
            onEdit={(body) => onEditMessage(message.messageId, body)}
          />
        ))}
      </div>

      {thread.canReply && <ReplyComposer onReply={onReply} />}
    </div>
  );
}
