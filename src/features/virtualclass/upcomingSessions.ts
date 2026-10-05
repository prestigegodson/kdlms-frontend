import { listMyUpcomingSessions, listWardUpcomingSessions, type UpcomingSession } from "@/api/onlineClasses";
import { listUpcomingOccurrences } from "@/api/virtualClasses";
import type { UpcomingItem, UpcomingSessions } from "./components/UpcomingSessionsPanel";

/** Loaders feeding `UpcomingSessionsPanel` for each portal (creators.md Phase C7). */

export async function loadCreatorUpcoming(): Promise<UpcomingSessions> {
  const calendar = await listUpcomingOccurrences();
  return {
    timezone: calendar.timezone,
    sessions: calendar.occurrences.map((occurrence) => ({
      id: occurrence.id,
      className: occurrence.className,
      scheduledStart: occurrence.scheduledStart,
      scheduledEnd: occurrence.scheduledEnd,
      status: occurrence.status,
      joinable: occurrence.joinable,
    })),
  };
}

export async function loadLearnerUpcoming(): Promise<UpcomingSessions> {
  return { sessions: (await listMyUpcomingSessions()).map((session) => toItem(session, session.creatorName)) };
}

export async function loadGuardianUpcoming(): Promise<UpcomingSessions> {
  return {
    sessions: (await listWardUpcomingSessions()).map((session) =>
      toItem(session, session.learnerNames.join(", ") || null),
    ),
  };
}

function toItem(session: UpcomingSession, detail: string | null): UpcomingItem {
  return {
    id: session.id,
    className: session.className,
    detail,
    scheduledStart: session.scheduledStart,
    scheduledEnd: session.scheduledEnd,
    status: session.status,
    joinable: session.joinable,
  };
}
