import { SendHorizontal } from "lucide-react";
import { type KeyboardEvent, useLayoutEffect, useRef, useState } from "react";
import { ApiError } from "@/api/client";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";

const MAX_LENGTH = 4000;
const COUNTER_FROM = 3500;
const MAX_HEIGHT_PX = 140;

interface ChatComposerProps {
  onSend: (body: string) => Promise<void>;
  placeholder?: string;
}

/**
 * The composer docked under a class conversation: a growing text field where Enter sends and
 * Shift+Enter starts a new line. The field clears only once the message is accepted.
 */
export function ChatComposer({ onSend, placeholder = "Write a message…" }: ChatComposerProps) {
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fieldRef = useRef<HTMLTextAreaElement>(null);

  // Grow with the text up to a cap, then scroll inside the field.
  useLayoutEffect(() => {
    const field = fieldRef.current;
    if (!field) return;
    field.style.height = "auto";
    field.style.height = `${Math.min(field.scrollHeight, MAX_HEIGHT_PX)}px`;
  }, [body]);

  async function submit() {
    const trimmed = body.trim();
    if (!trimmed || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      await onSend(trimmed);
      setBody("");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not send your message");
    } finally {
      setSubmitting(false);
      fieldRef.current?.focus();
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      void submit();
    }
  }

  return (
    <div data-sheet-dock className="border-t border-slate-200 bg-white px-3 py-3 sm:px-4">
      {error && (
        <div className="mb-2">
          <Alert variant="error">{error}</Alert>
        </div>
      )}
      <div className="flex items-end gap-2">
        <div className="flex min-w-0 flex-1 items-end rounded-3xl border border-slate-300 bg-slate-50 px-4 py-2 transition-colors focus-within:border-brand-500 focus-within:bg-white">
          <textarea
            ref={fieldRef}
            aria-label="Message"
            value={body}
            onChange={(event) => setBody(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            rows={1}
            maxLength={MAX_LENGTH}
            className="block max-h-[140px] w-full resize-none bg-transparent py-1 text-sm text-slate-900 outline-none placeholder:text-slate-400 mobile:text-base"
          />
          {body.length >= COUNTER_FROM && (
            <span className="ml-2 shrink-0 pb-1 text-xs text-slate-400">
              {body.length}/{MAX_LENGTH}
            </span>
          )}
        </div>
        <Button onClick={submit} loading={submitting} disabled={!body.trim()}>
          <SendHorizontal className="h-4 w-4" aria-hidden="true" />
          Send
        </Button>
      </div>
      <p className="mt-1.5 hidden px-4 text-xs text-slate-400 lg:block">Enter to send · Shift+Enter for a new line</p>
    </div>
  );
}
