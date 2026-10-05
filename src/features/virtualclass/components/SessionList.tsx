import { CalendarClock, ClipboardList, Video, XCircle } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router";
import {
  type Occurrence,
  type OccurrenceStatus,
  cancelSession,
  rescheduleSession,
} from "@/api/virtualClasses";
import { ActionMenu } from "@/components/ui/ActionMenu";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Textarea } from "@/components/ui/Textarea";
import { dateInZone, longDate, minutesBetween, timeInZone } from "../scheduleUtils";
import { OccurrenceAttendanceModal } from "./AttendanceModals";
import { SessionTimeModal } from "./SessionTimeModal";

const STATUS_BADGES: Record<
  OccurrenceStatus,
  { label: string; variant: "neutral" | "info" | "warning" | "danger" | "success" }
> = {
  SCHEDULED: { label: "Scheduled", variant: "neutral" },
  RESCHEDULED: { label: "Rescheduled", variant: "info" },
  CANCELLED: { label: "Cancelled", variant: "danger" },
  LIVE: { label: "Live", variant: "success" },
  ENDED: { label: "Ended", variant: "neutral" },
};

interface SessionListProps {
  occurrences: Occurrence[];
  timezone: string;
  /** Show each session's class name - off on a single class's own page. */
  showClassName?: boolean;
  emptyMessage: string;
  onChanged: () => void;
}

/**
 * Sessions grouped by local date in the creator's timezone, each with reschedule/cancel actions
 * while it is still upcoming (creators.md §7.1). Either marks the session overridden, so later
 * schedule edits leave it alone. A session inside its join window gets a Start/Join button into
 * the live room, and one that has started or is past offers its attendance (Phase C6).
 */
export function SessionList({
  occurrences,
  timezone,
  showClassName = false,
  emptyMessage,
  onChanged,
}: SessionListProps) {
  const [rescheduling, setRescheduling] = useState<Occurrence | null>(null);
  const [cancelling, setCancelling] = useState<Occurrence | null>(null);
  const [reason, setReason] = useState("");
  const [attendanceFor, setAttendanceFor] = useState<Occurrence | null>(null);
  const navigate = useNavigate();
  // Fixed per mount - the list reloads after every change anyway.
  const [now] = useState(() => Date.now());

  if (occurrences.length === 0) {
    return <p className="py-6 text-center text-sm text-slate-500">{emptyMessage}</p>;
  }

  const groups = new Map<string, Occurrence[]>();
  for (const occurrence of occurrences) {
    const date = dateInZone(occurrence.scheduledStart, timezone);
    groups.set(date, [...(groups.get(date) ?? []), occurrence]);
  }
  const today = dateInZone(new Date(), timezone);
  const hasAttendance = (session: Occurrence) =>
    session.status !== "CANCELLED" && (session.startedAt !== null || Date.parse(session.scheduledStart) <= now);

  return (
    <div className="space-y-5">
      {[...groups.entries()].map(([date, sessions]) => (
        <section key={date} aria-label={longDate(date)}>
          <h3 className="mb-2 text-sm font-semibold text-slate-700">{longDate(date)}</h3>
          <ul className="divide-y divide-slate-100 rounded-card border border-slate-200 bg-white">
            {sessions.map((session) => {
              const badge = STATUS_BADGES[session.status];
              const cancelled = session.status === "CANCELLED";
              return (
                <li key={session.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p
                      className={`text-sm font-medium ${cancelled ? "text-slate-400 line-through" : "text-slate-900"}`}
                    >
                      {timeInZone(session.scheduledStart, timezone)}–
                      {timeInZone(session.scheduledEnd, timezone)}
                      {showClassName && (
                        <span className="font-normal text-slate-600"> · {session.className}</span>
                      )}
                    </p>
                    {session.status === "RESCHEDULED" && (
                      <p className="text-xs text-slate-500">
                        Originally {longDate(dateInZone(session.originalStart, timezone))},{" "}
                        {timeInZone(session.originalStart, timezone)}
                      </p>
                    )}
                    {cancelled && session.cancelReason && (
                      <p className="text-xs text-slate-500">{session.cancelReason}</p>
                    )}
                    {session.slotId === null && !cancelled && session.status !== "RESCHEDULED" && (
                      <p className="text-xs text-slate-500">One-off session</p>
                    )}
                  </div>
                  <Badge variant={badge.variant}>{badge.label}</Badge>
                  {session.joinable && (
                    <Button type="button" size="sm" onClick={() => navigate(`/live/${session.id}`)}>
                      <Video className="h-4 w-4" aria-hidden="true" />
                      {session.status === "LIVE" ? "Join" : "Start"}
                    </Button>
                  )}
                  {(session.editable || hasAttendance(session)) && (
                    <ActionMenu
                      ariaLabel={`Actions for the ${timeInZone(session.scheduledStart, timezone)} session`}
                      items={[
                        ...(hasAttendance(session)
                          ? [
                              {
                                label: "Attendance",
                                icon: ClipboardList,
                                onSelect: () => setAttendanceFor(session),
                              },
                            ]
                          : []),
                        ...(session.editable
                          ? [
                              {
                                label: "Reschedule",
                                icon: CalendarClock,
                                onSelect: () => setRescheduling(session),
                              },
                              {
                                label: "Cancel session",
                                icon: XCircle,
                                variant: "danger" as const,
                                onSelect: () => {
                                  setReason("");
                                  setCancelling(session);
                                },
                              },
                            ]
                          : []),
                      ]}
                    />
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      ))}

      {rescheduling && (
        <SessionTimeModal
          title="Reschedule session"
          submitLabel="Reschedule"
          timezone={timezone}
          minDate={today}
          initial={{
            date: dateInZone(rescheduling.scheduledStart, timezone),
            startTime: timeInZone(rescheduling.scheduledStart, timezone),
            durationMinutes: minutesBetween(rescheduling.scheduledStart, rescheduling.scheduledEnd),
          }}
          onClose={() => setRescheduling(null)}
          onSubmit={async (input) => {
            await rescheduleSession(rescheduling.id, input);
            setRescheduling(null);
            onChanged();
          }}
        />
      )}

      {attendanceFor && (
        <OccurrenceAttendanceModal
          occurrenceId={attendanceFor.id}
          timezone={timezone}
          onClose={() => setAttendanceFor(null)}
        />
      )}

      {cancelling && (
        <ConfirmDialog
          title="Cancel this session?"
          confirmLabel="Cancel session"
          variant="danger"
          message={
            <div className="space-y-3">
              <p>
                {longDate(dateInZone(cancelling.scheduledStart, timezone))},{" "}
                {timeInZone(cancelling.scheduledStart, timezone)}
                {showClassName ? ` · ${cancelling.className}` : ""}. This can't be undone, but you
                can add a one-off session instead.
              </p>
              <label className="block text-sm font-medium text-slate-700" htmlFor="cancel-reason">
                Reason (optional)
              </label>
              <Textarea
                id="cancel-reason"
                rows={2}
                maxLength={500}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </div>
          }
          onClose={() => setCancelling(null)}
          onConfirm={async () => {
            await cancelSession(cancelling.id, reason.trim() || null);
            setCancelling(null);
            onChanged();
          }}
        />
      )}
    </div>
  );
}
