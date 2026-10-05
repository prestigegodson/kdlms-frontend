import { BookOpen, ClipboardCheck, ClipboardList, NotebookPen, Video } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router";
import type { AttendanceHistory } from "@/api/liveSessions";
import { getErrorMessage } from "@/api/client";
import type { OnlineClass, OnlineSession, ReminderPreference } from "@/api/onlineClasses";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Checkbox } from "@/components/ui/Checkbox";
import { dateInZone, longDate, scheduleSummary, timeInZone } from "../scheduleUtils";
import { AttendanceHistoryModal } from "./AttendanceModals";

const UPCOMING_SHOWN = 5;

/** The viewer's own timezone - upcoming sessions are shown in it, since a learner may be anywhere. */
function viewerZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

interface OnlineClassCardProps {
  onlineClass: OnlineClass;
  /** The live-room button's label - "Join" for a learner, "Watch" for a guardian observer. */
  joinLabel?: string;
  /** Loads the viewer's attendance history in this class - the learner's own, or a guardian's learner's. */
  loadAttendance: () => Promise<AttendanceHistory>;
  /** Saves the viewer's reminder-email choice for this class (Phase C7); omitted hides the toggle. */
  saveReminders?: (enabled: boolean) => Promise<ReminderPreference>;
  /** Where this class's published lesson notes open (Phase C12); omitted hides the link. */
  lessonNotesHref?: string;
  /** Where this class's quizzes open (Phase C13); omitted hides the link. */
  quizzesHref?: string;
  /** Where this class's learning resources open (Phase C14); omitted hides the link. */
  resourcesHref?: string;
}

/**
 * One online class as a learner or guardian sees it (creators.md Phase C5): who runs it, its weekly
 * schedule in the creator's own timezone, and the next few sessions in the viewer's timezone. A
 * session inside its join window gets a button into the live room, and the class's attendance
 * history is a click away (Phase C6). The viewer can turn this class's reminder emails off and on
 * again (Phase C7) - saved straight away, and put back if the save fails. Since Phase C12 the card
 * also links to the class's published lesson notes, since Phase C13 to its quizzes, and since
 * Phase C14 to its learning resources.
 */
export function OnlineClassCard({
  onlineClass,
  joinLabel = "Join",
  loadAttendance,
  saveReminders,
  lessonNotesHref,
  quizzesHref,
  resourcesHref,
}: OnlineClassCardProps) {
  const navigate = useNavigate();
  const zone = viewerZone();
  const upcoming = onlineClass.upcoming.slice(0, UPCOMING_SHOWN);
  const [showAttendance, setShowAttendance] = useState(false);
  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="font-display text-base font-medium text-slate-900">{onlineClass.name}</h3>
          <p className="text-sm text-slate-500">
            {onlineClass.creatorName ?? "Your tutor"}
            {onlineClass.subjectLabel ? ` · ${onlineClass.subjectLabel}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-1">
          {lessonNotesHref && (
            <Button type="button" variant="ghost" size="sm" onClick={() => navigate(lessonNotesHref)}>
              <NotebookPen className="h-4 w-4" aria-hidden="true" />
              Lesson notes
            </Button>
          )}
          {quizzesHref && (
            <Button type="button" variant="ghost" size="sm" onClick={() => navigate(quizzesHref)}>
              <ClipboardCheck className="h-4 w-4" aria-hidden="true" />
              Quizzes
            </Button>
          )}
          {resourcesHref && (
            <Button type="button" variant="ghost" size="sm" onClick={() => navigate(resourcesHref)}>
              <BookOpen className="h-4 w-4" aria-hidden="true" />
              Resources
            </Button>
          )}
          <Button type="button" variant="ghost" size="sm" onClick={() => setShowAttendance(true)}>
            <ClipboardList className="h-4 w-4" aria-hidden="true" />
            Attendance
          </Button>
        </div>
      </div>
      {onlineClass.description && <p className="mt-3 text-sm text-slate-700">{onlineClass.description}</p>}
      {onlineClass.slots.length > 0 && (
        <p className="mt-3 text-sm text-slate-700">
          <span className="font-medium">Weekly: </span>
          {scheduleSummary(onlineClass.slots)}
          {onlineClass.timezone && <span className="text-slate-500"> ({onlineClass.timezone} time)</span>}
        </p>
      )}
      <div className="mt-4">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Upcoming sessions</h4>
        {upcoming.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">No sessions in the next two weeks.</p>
        ) : (
          <ul className="mt-2 divide-y divide-slate-100">
            {upcoming.map((session) => (
              <SessionRow key={session.id} session={session} zone={zone} joinLabel={joinLabel} />
            ))}
          </ul>
        )}
      </div>
      {saveReminders && <ReminderToggle initial={onlineClass.remindersEnabled} save={saveReminders} />}
      {showAttendance && (
        <AttendanceHistoryModal
          title={`Attendance · ${onlineClass.name}`}
          timezone={zone}
          load={loadAttendance}
          onClose={() => setShowAttendance(false)}
        />
      )}
    </Card>
  );
}

function SessionRow({ session, zone, joinLabel }: { session: OnlineSession; zone: string; joinLabel: string }) {
  const navigate = useNavigate();
  const cancelled = session.status === "CANCELLED";
  return (
    <li className="flex items-center justify-between gap-3 py-2">
      <div className="min-w-0">
        <p className={`text-sm ${cancelled ? "text-slate-400 line-through" : "text-slate-900"}`}>
          {longDate(dateInZone(session.scheduledStart, zone))}, {timeInZone(session.scheduledStart, zone)}–
          {timeInZone(session.scheduledEnd, zone)}
        </p>
        {cancelled && session.cancelReason && <p className="text-xs text-slate-500">{session.cancelReason}</p>}
      </div>
      {cancelled && <Badge variant="danger">Cancelled</Badge>}
      {session.status === "RESCHEDULED" && <Badge variant="info">Moved</Badge>}
      {session.status === "LIVE" && <Badge variant="success">Live</Badge>}
      {session.joinable && (
        <Button type="button" size="sm" onClick={() => navigate(`/live/${session.id}`)}>
          <Video className="h-4 w-4" aria-hidden="true" />
          {joinLabel}
        </Button>
      )}
    </li>
  );
}

function ReminderToggle({
  initial,
  save,
}: {
  initial: boolean;
  save: (enabled: boolean) => Promise<ReminderPreference>;
}) {
  const [enabled, setEnabled] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggle(next: boolean) {
    setEnabled(next);
    setSaving(true);
    setError(null);
    save(next)
      .then((saved) => setEnabled(saved.remindersEnabled))
      .catch((err: unknown) => {
        setEnabled(!next);
        setError(getErrorMessage(err, "We couldn't save your reminder setting."));
      })
      .finally(() => setSaving(false));
  }

  return (
    <div className="mt-4 border-t border-slate-100 pt-3">
      <label className="flex items-center gap-2 text-sm text-slate-700">
        <Checkbox checked={enabled} disabled={saving} onChange={(event) => toggle(event.target.checked)} />
        Email me a reminder 30 minutes before each session
      </label>
      {error && (
        <p role="alert" className="mt-1 text-xs text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
