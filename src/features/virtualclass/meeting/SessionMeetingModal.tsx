import { type FormEvent, useState } from "react";
import { getErrorMessage } from "@/api/client";
import {
  type MeetingMode,
  type Occurrence,
  clearSessionMeeting,
  setSessionMeeting,
} from "@/api/virtualClasses";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { MeetingFields } from "./MeetingFields";
import { meetingLinkError } from "./meetingLink";

interface SessionMeetingModalProps {
  session: Occurrence;
  /** Whether the plan includes Platform Video Conferencing. */
  platformVideo: boolean;
  onSaved: () => void;
  onClose: () => void;
}

/**
 * Holds one session somewhere other than its class's meeting - a different Google Meet/Zoom link,
 * or the built-in room - or puts it back on the class's. Unlike a reschedule, this doesn't stop
 * later schedule edits from moving the session.
 */
export function SessionMeetingModal({ session, platformVideo, onSaved, onClose }: SessionMeetingModalProps) {
  const [own, setOwn] = useState(session.meetingOverridden);
  const [mode, setMode] = useState<MeetingMode>(
    session.meetingOverridden ? session.meetingMode : platformVideo ? "PLATFORM" : "EXTERNAL",
  );
  const [url, setUrl] = useState(session.meetingOverridden ? (session.meetingUrl ?? "") : "");
  const [urlError, setUrlError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const linkError = own && mode === "EXTERNAL" ? meetingLinkError(url) : null;
    setUrlError(linkError);
    if (linkError) return;
    setSaving(true);
    setError(null);
    try {
      if (own) {
        await setSessionMeeting(session.id, {
          meetingMode: mode,
          meetingUrl: mode === "EXTERNAL" ? url.trim() : null,
        });
      } else if (session.meetingOverridden) {
        await clearSessionMeeting(session.id);
      }
      onSaved();
    } catch (submitError) {
      setError(getErrorMessage(submitError, "Failed to save the meeting."));
      setSaving(false);
    }
  }

  return (
    <Modal open onClose={onClose} title="Session meeting">
      <form className="space-y-4" onSubmit={handleSubmit}>
        {error && <Alert variant="error">{error}</Alert>}
        <fieldset>
          <legend className="mb-2 text-sm font-medium text-slate-700">This session is held</legend>
          <div className="flex flex-col gap-2">
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="radio" name="session-meeting-source" checked={!own} onChange={() => setOwn(false)} />
              Where the class's sessions are held
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="radio" name="session-meeting-source" checked={own} onChange={() => setOwn(true)} />
              Somewhere else, for this session only
            </label>
          </div>
        </fieldset>
        {own && (
          <MeetingFields
            idPrefix="session"
            legend="Meeting for this session"
            mode={mode}
            url={url}
            onModeChange={(next) => {
              setMode(next);
              setUrlError(null);
            }}
            onUrlChange={setUrl}
            platformVideo={platformVideo}
            urlError={urlError}
          />
        )}
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" loading={saving}>
            Save
          </Button>
        </div>
      </form>
    </Modal>
  );
}
