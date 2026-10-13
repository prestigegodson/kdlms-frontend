import { Megaphone, PencilLine } from "lucide-react";
import { useState } from "react";
import type { MessageAuthorRole, MessageView } from "@/api/communication";
import { ApiError } from "@/api/client";
import { Alert } from "@/components/ui/Alert";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Textarea";
import { bubbleTime } from "@/features/classMessages/components/chatTimeline";
import { initialsOfFullName } from "@/utils/initials";

const ROLE_LABELS: Record<MessageAuthorRole, string> = {
  TEACHER: "Teacher",
  CREATOR: "Tutor",
  GUARDIAN: "Guardian",
  LEARNER: "Learner",
};

interface MessageBubbleProps {
  message: MessageView;
  /** The signed-in user wrote it - right-aligned in the brand colour. */
  own: boolean;
  /** First bubble of a run - shows the author's name above someone else's message. */
  firstOfRun: boolean;
  /** Last bubble of a run - carries the avatar and the time. */
  lastOfRun: boolean;
  onEdit: (body: string) => Promise<void>;
}

/**
 * One chat bubble in a class conversation (creators Phase C11), with its in-place edit while the
 * server's edit window is open (`message.canEdit`).
 */
export function MessageBubble({ message, own, firstOfRun, lastOfRun, onEdit }: MessageBubbleProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(message.body);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const authorName = message.authorName ?? "Unknown";

  async function save() {
    setSubmitting(true);
    setError(null);
    try {
      await onEdit(draft.trim());
      setEditing(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save your edit");
    } finally {
      setSubmitting(false);
    }
  }

  function cancel() {
    setEditing(false);
    setDraft(message.body);
    setError(null);
  }

  const avatar = lastOfRun ? (
    <Avatar initials={initialsOfFullName(authorName)} url={null} size="sm" />
  ) : (
    <span className="w-8 shrink-0" aria-hidden="true" />
  );

  const tone = message.announcement
    ? own
      ? "bg-brand-600 text-white ring-2 ring-accent-200"
      : "bg-accent-50 text-slate-800 ring-1 ring-accent-200"
    : own
      ? "bg-brand-500 text-white"
      : "bg-slate-100 text-slate-800";
  const tail = lastOfRun ? (own ? "rounded-br-md" : "rounded-bl-md") : "";

  return (
    <div className={`group flex items-end gap-2 ${own ? "flex-row-reverse" : ""} ${lastOfRun ? "" : "mb-1"}`}>
      {avatar}
      <div className={`flex min-w-0 max-w-[85%] flex-col sm:max-w-[75%] ${own ? "items-end" : "items-start"}`}>
        {firstOfRun && !own && (
          <span className="mb-1 flex items-center gap-1.5 px-1 text-xs text-slate-500">
            <span className="font-medium text-slate-700">{authorName}</span>
            <span aria-hidden="true">·</span>
            {ROLE_LABELS[message.authorRole]}
          </span>
        )}

        {editing ? (
          <div className="w-72 max-w-full space-y-2 rounded-2xl border border-slate-200 bg-white p-3 sm:w-96">
            <Textarea
              aria-label="Edit message"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              rows={3}
              maxLength={4000}
            />
            {error && <Alert variant="error">{error}</Alert>}
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="secondary" onClick={cancel}>
                Cancel
              </Button>
              <Button size="sm" onClick={save} loading={submitting} disabled={!draft.trim()}>
                Save
              </Button>
            </div>
          </div>
        ) : (
          <div className={`flex items-center gap-1 ${own ? "flex-row-reverse" : ""}`}>
            <div className={`rounded-2xl px-4 py-2.5 text-sm shadow-sm ${tone} ${tail}`}>
              {message.announcement && (
                <span
                  className={`mb-1 flex items-center gap-1 text-xs font-semibold ${own ? "text-brand-100" : "text-accent-800"}`}
                >
                  <Megaphone className="h-3.5 w-3.5" aria-hidden="true" />
                  Announcement to class
                </span>
              )}
              <p className="whitespace-pre-wrap break-words">{message.body}</p>
            </div>
            {message.canEdit && (
              <button
                type="button"
                onClick={() => setEditing(true)}
                aria-label="Edit message"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-brand-600 focus-visible:opacity-100 lg:opacity-0 lg:group-hover:opacity-100"
              >
                <PencilLine className="h-4 w-4" aria-hidden="true" />
              </button>
            )}
          </div>
        )}

        {lastOfRun && (
          <span className="mt-1 px-1 text-xs text-slate-400">
            <time dateTime={message.createdAt}>{bubbleTime(message.createdAt)}</time>
            {message.editedAt && " · edited"}
          </span>
        )}
      </div>
    </div>
  );
}
