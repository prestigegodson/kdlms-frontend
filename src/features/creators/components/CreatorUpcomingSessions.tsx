import { Video, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";
import { getErrorMessage } from "@/api/client";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ErrorState } from "@/components/ui/ErrorState";
import { Skeleton } from "@/components/ui/Skeleton";
import {
  MeetingNote,
  type UpcomingItem,
  type UpcomingSessions,
} from "@/features/virtualclass/components/UpcomingSessionsPanel";
import {
  dateInZone,
  dayParts,
  longDate,
  minutesBetween,
  monthOf,
  timeInZone,
} from "@/features/virtualclass/scheduleUtils";
import { loadCreatorUpcoming } from "@/features/virtualclass/upcomingSessions";
import { initialsOfFullName } from "@/utils/initials";
import { UpcomingMiniCalendar } from "./UpcomingMiniCalendar";

const SESSIONS_PATH = "/creator/sessions";

/** "45 min", "1 h", "1 h 30 min". */
function durationLabel(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`;
}

function groupByDay(sessions: UpcomingItem[], zone: string): [string, UpcomingItem[]][] {
  const groups: [string, UpcomingItem[]][] = [];
  for (const session of sessions) {
    const day = dateInZone(session.scheduledStart, zone);
    const last = groups[groups.length - 1];
    if (last && last[0] === day) {
      last[1].push(session);
    } else {
      groups.push([day, [session]]);
    }
  }
  return groups;
}

function summaryLine(groups: [string, UpcomingItem[]][], today: string): string {
  const todays = groups.find(([day]) => day === today)?.[1].length ?? 0;
  if (todays > 0) return `You have ${todays} session${todays === 1 ? "" : "s"} today`;
  const next = groups[0];
  return next ? `No sessions today · next on ${longDate(next[0])}` : "No sessions in the next 7 days";
}

/**
 * The creator dashboard's "Upcoming sessions": the next week's sessions as day groups, each with a
 * date tile (today's in brand colour) beside its session cards, and a small month calendar that
 * marks session days and filters the list to one. Learners and guardians keep the plainer
 * `UpcomingSessionsPanel`.
 */
export function CreatorUpcomingSessions() {
  const navigate = useNavigate();
  const [data, setData] = useState<UpcomingSessions | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [month, setMonth] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const fetchSessions = useCallback(() => {
    loadCreatorUpcoming()
      .then((loaded) => {
        setData(loaded);
        setError(null);
      })
      .catch((err: unknown) => setError(getErrorMessage(err, "We couldn't load your upcoming sessions.")));
  }, []);

  useEffect(fetchSessions, [fetchSessions]);

  const zone = data?.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
  const today = dateInZone(new Date(), zone);
  const groups = groupByDay(data?.sessions ?? [], zone);
  const visibleGroups = selectedDate ? groups.filter(([day]) => day === selectedDate) : groups;

  const counts = new Map<string, number>();
  for (const [day, sessions] of groups) {
    const active = sessions.filter((s) => s.status !== "CANCELLED").length;
    if (active > 0) counts.set(day, active);
  }
  const minMonth = monthOf(today);
  const maxMonth = groups.length > 0 ? monthOf(groups[groups.length - 1][0]) : minMonth;
  const shownMonth = month ?? minMonth;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-lg font-medium text-slate-900">Upcoming sessions</h2>
            {data && <p className="mt-0.5 text-sm text-slate-500">{summaryLine(groups, today)}</p>}
          </div>
          <Link to={SESSIONS_PATH} className="text-sm font-medium text-brand-500 hover:text-brand-600">
            View all
          </Link>
        </div>

        {selectedDate && (
          <button
            type="button"
            onClick={() => setSelectedDate(null)}
            className="mt-3 inline-flex items-center gap-1 rounded-full bg-brand-50 px-3 py-1 text-xs font-medium text-brand-700 hover:bg-brand-100 mobile:min-h-11"
          >
            {longDate(selectedDate)}
            <X className="h-3.5 w-3.5" aria-hidden="true" />
            <span className="sr-only">- show all days</span>
          </button>
        )}

        {error ? (
          <div className="mt-4">
            <ErrorState message={error} onRetry={fetchSessions} />
          </div>
        ) : data === null ? (
          <Skeleton className="mt-4 h-32" />
        ) : groups.length === 0 ? (
          <p className="mt-4 text-sm text-slate-500">
            No sessions in the next 7 days.{" "}
            <Link to="/creator/classes" className="font-medium text-brand-500 hover:text-brand-600">
              Manage your classes
            </Link>
          </p>
        ) : (
          <div className="mt-5 space-y-5">
            {visibleGroups.map(([day, sessions]) => {
              const isToday = day === today;
              const parts = dayParts(day);
              return (
                <section key={day} aria-label={longDate(day)} className="flex gap-3 sm:gap-4">
                  <div
                    data-testid="date-tile"
                    data-today={isToday}
                    className={`flex w-16 shrink-0 flex-col items-center rounded-lg py-3 sm:w-20 ${
                      isToday ? "bg-brand-600 text-white" : "bg-slate-100 text-slate-700"
                    }`}
                  >
                    <span className="text-2xl font-semibold leading-none">{parts.day}</span>
                    <span
                      className={`mt-1 text-center text-[11px] uppercase ${isToday ? "text-white/90" : "text-slate-500"}`}
                    >
                      {parts.monthYear}
                    </span>
                  </div>
                  <ul className="min-w-0 flex-1 space-y-3">
                    {sessions.map((session) => (
                      <SessionCard
                        key={session.id}
                        session={session}
                        zone={zone}
                        highlighted={isToday}
                        onJoin={() => navigate(`/live/${session.id}`)}
                        onView={() => navigate(SESSIONS_PATH)}
                      />
                    ))}
                  </ul>
                </section>
              );
            })}
            {data.timezone && <p className="text-xs text-slate-500">Times shown in {data.timezone}.</p>}
          </div>
        )}
      </Card>

      <Card>
        <UpcomingMiniCalendar
          month={shownMonth}
          minMonth={minMonth}
          maxMonth={maxMonth}
          onMonthChange={setMonth}
          counts={counts}
          today={today}
          selectedDate={selectedDate}
          onSelectDate={(date) => setSelectedDate((current) => (current === date ? null : date))}
        />
      </Card>
    </div>
  );
}

interface SessionCardProps {
  session: UpcomingItem;
  zone: string;
  highlighted: boolean;
  onJoin: () => void;
  onView: () => void;
}

function SessionCard({ session, zone, highlighted, onJoin, onView }: SessionCardProps) {
  const cancelled = session.status === "CANCELLED";
  return (
    <li
      className={`flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3 sm:p-4 ${
        highlighted ? "border-brand-200 bg-brand-50/30" : "border-slate-200 bg-white"
      }`}
    >
      <div className="flex min-w-0 items-center gap-3">
        <Avatar initials={initialsOfFullName(session.className)} url={null} size="sm" />
        <div className="min-w-0">
          <p className={`truncate text-sm font-medium ${cancelled ? "text-slate-400 line-through" : "text-slate-900"}`}>
            {session.className}
          </p>
          <p className="text-sm text-slate-500">
            {timeInZone(session.scheduledStart, zone)} – {timeInZone(session.scheduledEnd, zone)}
            <span className="text-slate-400"> · {durationLabel(minutesBetween(session.scheduledStart, session.scheduledEnd))}</span>
          </p>
          {session.detail && <p className="truncate text-xs text-slate-500">{session.detail}</p>}
          <MeetingNote meeting={session.meeting} />
        </div>
      </div>
      <div className="flex items-center gap-2">
        {session.status === "RESCHEDULED" && <Badge variant="info">Moved</Badge>}
        {session.status === "LIVE" && <Badge variant="success">Live</Badge>}
        {cancelled && <Badge variant="neutral">Cancelled</Badge>}
        {session.joinable ? (
          <Button type="button" size="sm" onClick={onJoin}>
            <Video className="h-4 w-4" aria-hidden="true" />
            {session.status === "LIVE" ? "Join" : "Start session"}
          </Button>
        ) : (
          !cancelled && (
            <Button type="button" size="sm" variant="secondary" onClick={onView}>
              View
            </Button>
          )
        )}
      </div>
    </li>
  );
}
