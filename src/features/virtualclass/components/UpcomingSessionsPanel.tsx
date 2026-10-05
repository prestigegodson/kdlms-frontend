import { CalendarClock, Video } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { getErrorMessage } from "@/api/client";
import type { OccurrenceStatus } from "@/api/virtualClasses";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ErrorState } from "@/components/ui/ErrorState";
import { Skeleton } from "@/components/ui/Skeleton";
import { dateInZone, longDate, timeInZone } from "../scheduleUtils";

/** One row of the panel - a creator occurrence or a learner/guardian upcoming session, normalized. */
export interface UpcomingItem {
  id: string;
  className: string;
  /** A secondary line: the tutor's name for a learner, the learners' names for a guardian. */
  detail?: string | null;
  scheduledStart: string;
  scheduledEnd: string;
  status: OccurrenceStatus;
  joinable: boolean;
}

export interface UpcomingSessions {
  /** The zone times are shown in - the creator's own; omitted to use the viewer's. */
  timezone?: string | null;
  sessions: UpcomingItem[];
}

interface UpcomingSessionsPanelProps {
  load: () => Promise<UpcomingSessions>;
  /** The live-room button's label for a joinable session. */
  joinLabel: (session: UpcomingItem) => string;
  /** Renders nothing at all when there's nothing upcoming (or it failed) - for a dashboard where online classes are a side feature. */
  hideWhenEmpty?: boolean;
}

function viewerZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

/**
 * The "Upcoming sessions" panel on the creator, learner and guardian dashboards (creators.md
 * Phase C7): the next week's sessions across every class, soonest first, grouped by day, with a
 * button into the live room once a session's join window opens.
 */
export function UpcomingSessionsPanel({ load, joinLabel, hideWhenEmpty = false }: UpcomingSessionsPanelProps) {
  const navigate = useNavigate();
  const [data, setData] = useState<UpcomingSessions | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchSessions = useCallback(() => {
    load()
      .then((loaded) => {
        setData(loaded);
        setError(null);
      })
      .catch((err: unknown) => setError(getErrorMessage(err, "We couldn't load your upcoming sessions.")));
  }, [load]);

  useEffect(fetchSessions, [fetchSessions]);

  if (hideWhenEmpty && (error !== null || data === null || data.sessions.length === 0)) {
    return null;
  }

  const zone = data?.timezone ?? viewerZone();
  const groups: [string, UpcomingItem[]][] = [];
  for (const session of data?.sessions ?? []) {
    const day = dateInZone(session.scheduledStart, zone);
    const last = groups[groups.length - 1];
    if (last && last[0] === day) {
      last[1].push(session);
    } else {
      groups.push([day, [session]]);
    }
  }

  return (
    <Card>
      <div className="flex items-center gap-2">
        <CalendarClock className="h-5 w-5 text-brand-500" aria-hidden="true" />
        <h2 className="font-display text-base font-medium text-slate-900">Upcoming sessions</h2>
      </div>
      {error ? (
        <div className="mt-4">
          <ErrorState message={error} onRetry={fetchSessions} />
        </div>
      ) : data === null ? (
        <Skeleton className="mt-4 h-24" />
      ) : data.sessions.length === 0 ? (
        <p className="mt-3 text-sm text-slate-500">No sessions in the next 7 days.</p>
      ) : (
        <div className="mt-3 space-y-4">
          {groups.map(([day, sessions]) => (
            <section key={day} aria-label={longDate(day)}>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">{longDate(day)}</h3>
              <ul className="mt-1 divide-y divide-slate-100">
                {sessions.map((session) => (
                  <li key={session.id} className="flex flex-wrap items-center justify-between gap-3 py-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-900">
                        {timeInZone(session.scheduledStart, zone)}–{timeInZone(session.scheduledEnd, zone)} ·{" "}
                        {session.className}
                      </p>
                      {session.detail && <p className="text-xs text-slate-500">{session.detail}</p>}
                    </div>
                    <div className="flex items-center gap-2">
                      {session.status === "RESCHEDULED" && <Badge variant="info">Moved</Badge>}
                      {session.status === "LIVE" && <Badge variant="success">Live</Badge>}
                      {session.joinable && (
                        <Button type="button" size="sm" onClick={() => navigate(`/live/${session.id}`)}>
                          <Video className="h-4 w-4" aria-hidden="true" />
                          {joinLabel(session)}
                        </Button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ))}
          {data.timezone && <p className="text-xs text-slate-500">Times shown in {data.timezone}.</p>}
        </div>
      )}
    </Card>
  );
}
