import { useEffect, useState } from "react";
import { getErrorMessage } from "@/api/client";
import {
  getOccurrenceAttendance,
  type AttendanceHistory,
  type OccurrenceAttendance,
} from "@/api/liveSessions";
import { Badge } from "@/components/ui/Badge";
import { ErrorState } from "@/components/ui/ErrorState";
import { Modal } from "@/components/ui/Modal";
import { Skeleton } from "@/components/ui/Skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from "@/components/ui/Table";
import { dateInZone, longDate, timeInZone } from "../scheduleUtils";

/** Loads once per open (and on retry); `load` is captured on first render. */
function useLoaded<T>(load: () => Promise<T>, fallback: string) {
  const [loader] = useState(() => load);
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let current = true;
    loader()
      .then((value) => current && setData(value))
      .catch((err: unknown) => current && setError(getErrorMessage(err, fallback)));
    return () => {
      current = false;
    };
  }, [loader, fallback, attempt]);
  return {
    data,
    error,
    retry: () => {
      setError(null);
      setAttempt((n) => n + 1);
    },
  };
}

function PresentBadge({ present }: { present: boolean }) {
  return present ? <Badge variant="success">Present</Badge> : <Badge variant="neutral">Absent</Badge>;
}

/**
 * Who attended one live session (creators.md Phase C6) - every enrolled learner present or absent,
 * with connected minutes and when they first joined, plus any guardians who watched. Derived by the
 * server from LiveKit's connection events.
 */
export function OccurrenceAttendanceModal({
  occurrenceId,
  timezone,
  onClose,
}: {
  occurrenceId: string;
  timezone: string;
  onClose: () => void;
}) {
  const { data, error, retry } = useLoaded<OccurrenceAttendance>(
    () => getOccurrenceAttendance(occurrenceId),
    "We couldn't load this session's attendance.",
  );
  return (
    <Modal open onClose={onClose} title="Session attendance" size="xl" fullScreenOnMobile>
      {error && <ErrorState message={error} onRetry={retry} />}
      {!error && !data && <Skeleton className="h-40" />}
      {data && (
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            {data.className} · {longDate(dateInZone(data.scheduledStart, timezone))},{" "}
            {timeInZone(data.scheduledStart, timezone)}
            {data.startedAt ? "" : " · the live room was never opened"}
          </p>
          {data.learners.length === 0 ? (
            <p className="text-sm text-slate-500">No learners are enrolled in this class.</p>
          ) : (
            <Table>
              <TableHead>
                <TableRow>
                  <TableHeaderCell>Learner</TableHeaderCell>
                  <TableHeaderCell>Attendance</TableHeaderCell>
                  <TableHeaderCell numeric>Minutes</TableHeaderCell>
                  <TableHeaderCell>First joined</TableHeaderCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {data.learners.map((row) => (
                  <TableRow key={row.learnerId}>
                    <TableCell label="Learner">
                      {row.firstName} {row.lastName}
                      {!row.enrolled && <span className="text-xs text-slate-500"> (no longer enrolled)</span>}
                    </TableCell>
                    <TableCell label="Attendance">
                      <PresentBadge present={row.present} />
                    </TableCell>
                    <TableCell label="Minutes" numeric>
                      {row.minutes}
                    </TableCell>
                    <TableCell label="First joined">
                      {row.firstJoinedAt ? timeInZone(row.firstJoinedAt, timezone) : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          {data.observers.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Guardians watching</h4>
              <ul className="mt-2 space-y-1 text-sm text-slate-700">
                {data.observers.map((observer) => (
                  <li key={observer.userId}>
                    {observer.name} · {observer.minutes} min
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}

/**
 * One learner's attendance across a class's sessions (creators.md Phase C6) - opened by the creator
 * from the class roster, by a learner for themselves, and by a guardian for a learner they follow.
 * `load` picks the endpoint for the viewer.
 */
export function AttendanceHistoryModal({
  title,
  timezone,
  load,
  onClose,
}: {
  title: string;
  /** The zone dates and times are shown in. */
  timezone: string;
  load: () => Promise<AttendanceHistory>;
  onClose: () => void;
}) {
  const { data, error, retry } = useLoaded<AttendanceHistory>(load, "We couldn't load attendance.");
  return (
    <Modal open onClose={onClose} title={title} size="xl" fullScreenOnMobile>
      {error && <ErrorState message={error} onRetry={retry} />}
      {!error && !data && <Skeleton className="h-40" />}
      {data && (
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            {data.firstName} {data.lastName} attended {data.sessionsAttended} of {data.sessionsHeld}{" "}
            {data.sessionsHeld === 1 ? "session" : "sessions"} of {data.className}.
          </p>
          {data.sessions.length > 0 && (
            <Table>
              <TableHead>
                <TableRow>
                  <TableHeaderCell>Session</TableHeaderCell>
                  <TableHeaderCell>Attendance</TableHeaderCell>
                  <TableHeaderCell numeric>Minutes</TableHeaderCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {data.sessions.map((row) => (
                  <TableRow key={row.occurrenceId}>
                    <TableCell label="Session">
                      {longDate(dateInZone(row.scheduledStart, timezone))}, {timeInZone(row.scheduledStart, timezone)}
                    </TableCell>
                    <TableCell label="Attendance">
                      <PresentBadge present={row.present} />
                    </TableCell>
                    <TableCell label="Minutes" numeric>
                      {row.minutes}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      )}
    </Modal>
  );
}
