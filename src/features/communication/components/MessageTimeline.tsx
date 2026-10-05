import { PencilLine } from "lucide-react";
import { useState } from "react";
import type { MessageAuthorRole, MessageView } from "@/api/communication";
import { ApiError } from "@/api/client";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Textarea";

const TIME_FORMATTER = new Intl.DateTimeFormat("en-GB", { hour: "numeric", minute: "2-digit" });
const DATE_TIME_FORMATTER = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  hour: "numeric",
  minute: "2-digit",
});

/** The author-role chip: the institution's side (teacher, tutor) in brand colour, the family's side neutral. */
const ROLE_LABELS: Record<MessageAuthorRole, string> = {
  TEACHER: "Teacher",
  CREATOR: "Tutor",
  GUARDIAN: "Guardian",
  LEARNER: "Learner",
};

/**
 * The message pieces shared by a school thread (ThreadCard) and a creator's class conversation
 * (ClassConversationPanel, creators Phase C11): one message with its in-place edit, and the
 * composer docked under a conversation.
 */
export interface MessageRowProps {
  message: MessageView;
  indented: boolean;
  onEdit: (body: string) => Promise<void>;
  /** Show the date as well as the time - a long-running conversation spans many days. */
  showDate?: boolean;
}

export function MessageRow({ message, indented, onEdit, showDate = false }: MessageRowProps) {
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
        <Badge variant={message.authorRole === "TEACHER" || message.authorRole === "CREATOR" ? "brand" : "neutral"}>
          {ROLE_LABELS[message.authorRole]}
        </Badge>
        {message.announcement && <Badge variant="info">Announcement</Badge>}
        <span className="text-slate-400">
          {(showDate ? DATE_TIME_FORMATTER : TIME_FORMATTER).format(new Date(message.createdAt))}
        </span>
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

export interface ReplyComposerProps {
  onReply: (body: string) => Promise<void>;
  placeholder?: string;
  submitLabel?: string;
}

export function ReplyComposer({ onReply, placeholder = "Write a reply…", submitLabel = "Reply" }: ReplyComposerProps) {
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
    <div
      data-sheet-dock
      className="mt-5 border-t border-slate-100 pt-4 mobile:sticky mobile:bottom-0 mobile:-mx-5 mobile:-mb-5 mobile:bg-white/95 mobile:px-5 mobile:pb-5 mobile:backdrop-blur"
    >
      <Textarea
        value={body}
        onChange={(event) => setBody(event.target.value)}
        placeholder={placeholder}
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
          {submitLabel}
        </Button>
      </div>
    </div>
  );
}
