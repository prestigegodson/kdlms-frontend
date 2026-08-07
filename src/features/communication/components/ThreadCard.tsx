import { PencilLine } from "lucide-react";
import { useState } from "react";
import type { MessageView, ThreadView } from "@/api/communication";
import { ApiError } from "@/api/client";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Textarea";
import { CategoryBadge } from "@/features/communication/components/CategoryBadge";
import { categoryRailClass } from "@/features/communication/messageCategory";
import { formatLongDate } from "@/utils/date";

const TIME_FORMATTER = new Intl.DateTimeFormat("en-GB", { hour: "numeric", minute: "2-digit" });

function formatTime(iso: string): string {
  return TIME_FORMATTER.format(new Date(iso));
}

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

interface MessageRowProps {
  message: MessageView;
  indented: boolean;
  onEdit: (body: string) => Promise<void>;
}

function MessageRow({ message, indented, onEdit }: MessageRowProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(message.body);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setSubmitting(true);
    setError(null);
    try {
      await onEdit(draft);
      setEditing(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save your edit");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className={indented ? "ml-4 border-l border-slate-100 pl-4 sm:ml-6 sm:pl-6" : ""}>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="font-medium text-slate-900">{message.authorName ?? "Unknown"}</span>
        <Badge variant={message.authorRole === "TEACHER" ? "brand" : "neutral"}>
          {message.authorRole === "TEACHER" ? "Teacher" : "Guardian"}
        </Badge>
        <span className="text-slate-400">{formatTime(message.createdAt)}</span>
        {message.editedAt && <span className="text-xs text-slate-400">(edited)</span>}
        {message.canEdit && !editing && (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="ml-auto flex items-center gap-1 text-xs font-medium text-brand-600 hover:text-brand-800"
          >
            <PencilLine className="h-3.5 w-3.5" aria-hidden="true" />
            Edit
          </button>
        )}
      </div>

      {editing ? (
        <div className="mt-2 space-y-2">
          <Textarea value={draft} onChange={(event) => setDraft(event.target.value)} rows={3} maxLength={4000} />
          {error && <Alert variant="error">{error}</Alert>}
          <div className="flex gap-2">
            <Button size="sm" onClick={save} loading={submitting} disabled={!draft.trim()}>
              Save
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                setEditing(false);
                setDraft(message.body);
                setError(null);
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">{message.body}</p>
      )}
    </div>
  );
}

function ReplyComposer({ onReply }: { onReply: (body: string) => Promise<void> }) {
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!body.trim()) {
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await onReply(body.trim());
      setBody("");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not send your reply");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mt-5 border-t border-slate-100 pt-4">
      <Textarea
        value={body}
        onChange={(event) => setBody(event.target.value)}
        placeholder="Write a reply…"
        rows={2}
        maxLength={4000}
      />
      {error && (
        <div className="mt-2">
          <Alert variant="error">{error}</Alert>
        </div>
      )}
      <div className="mt-2 flex justify-end">
        <Button size="sm" onClick={submit} loading={submitting} disabled={!body.trim()}>
          Reply
        </Button>
      </div>
    </div>
  );
}
