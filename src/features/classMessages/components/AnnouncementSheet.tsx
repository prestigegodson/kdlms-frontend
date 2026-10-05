import { useState } from "react";
import { type AnnouncementResult, announceToClass } from "@/api/classMessages";
import { getErrorMessage } from "@/api/client";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { FormField } from "@/components/ui/FormField";
import { Modal } from "@/components/ui/Modal";
import { Textarea } from "@/components/ui/Textarea";

interface AnnouncementSheetProps {
  classId: string;
  className: string;
  onClose: () => void;
  onSent: () => void;
}

/**
 * A class-wide announcement (creators Phase C11): one copy lands in every learner's own
 * conversation, so replies stay private, and it's the only class message that emails.
 */
export function AnnouncementSheet({ classId, className, onClose, onSent }: AnnouncementSheetProps) {
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AnnouncementResult | null>(null);

  async function submit() {
    if (!body.trim()) {
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      setResult(await announceToClass(classId, body.trim()));
      onSent();
    } catch (err) {
      setError(getErrorMessage(err, "We couldn't send this announcement."));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal open onClose={onClose} title={`Announce to ${className}`} size="lg">
      {result ? (
        <div className="space-y-4">
          <Alert variant="success">
            Sent to {result.delivered} {result.delivered === 1 ? "learner" : "learners"}
            {result.emailed > 0 && ` · ${result.emailed} ${result.emailed === 1 ? "email" : "emails"} sent`}.
          </Alert>
          <div className="flex justify-end">
            <Button onClick={onClose}>Done</Button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <FormField label="Announcement" htmlFor="announcement-body">
            <Textarea
              id="announcement-body"
              value={body}
              onChange={(event) => setBody(event.target.value)}
              rows={5}
              maxLength={4000}
              placeholder="What does the whole class need to know?"
            />
          </FormField>
          <p className="text-xs text-slate-500">
            Each learner (or their guardian) gets their own copy by email and in their messages. Replies come back to
            you privately.
          </p>
          {error && <Alert variant="error">{error}</Alert>}
          <div
            data-sheet-dock
            className="flex justify-end gap-2 border-t border-slate-100 pt-4 mobile:sticky mobile:bottom-0 mobile:-mx-6 mobile:bg-white/95 mobile:px-6 mobile:pb-4 mobile:backdrop-blur"
          >
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={submit} loading={submitting} disabled={!body.trim()}>
              Send announcement
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
