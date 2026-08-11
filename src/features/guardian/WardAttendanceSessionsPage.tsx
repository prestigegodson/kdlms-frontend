import type { WardTermView } from "@/api/wards";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { useWardAttendanceContext } from "@/features/guardian/WardAttendanceLayout";
import { DrillRow } from "@/features/guardian/components/DrillRow";
import { WardBreadcrumb } from "@/features/guardian/components/WardBreadcrumb";

interface SessionSummary {
  sessionId: string;
  sessionName: string;
  currentSession: boolean;
  className?: string;
}

function sessionsFrom(terms: WardTermView[]): SessionSummary[] {
  const bySessionId = new Map<string, SessionSummary>();
  for (const term of terms) {
    if (bySessionId.has(term.sessionId)) continue;
    bySessionId.set(term.sessionId, {
      sessionId: term.sessionId,
      sessionName: term.sessionName,
      currentSession: term.currentSession,
      className: term.className,
    });
  }
  return [...bySessionId.values()].sort((a, b) => {
    if (a.currentSession !== b.currentSession) return a.currentSession ? -1 : 1;
    return b.sessionName.localeCompare(a.sessionName);
  });
}

/**
 * Step 2 of the attendance drill-down - every session this ward has been
 * enrolled in, newest/current first. Unlike the results drill-down's
 * equivalent step, every session is tappable here: attendance is
 * deliberately not publication-gated (see CLAUDE.md's Domain Rules), so
 * there's no "nothing published yet" state to disable a row for.
 */
export function WardAttendanceSessionsPage() {
  const { ward, terms } = useWardAttendanceContext();
  const sessions = sessionsFrom(terms);

  return (
    <div className="space-y-6">
      <PageHeader title={ward.fullName} description={ward.schoolName} backTo="/guardian/attendance" />
      <WardBreadcrumb steps={[{ label: ward.schoolName, to: "/guardian/attendance" }, { label: ward.fullName }]} />

      {sessions.length === 0 && (
        <EmptyState title="No enrolment history yet" description="This ward hasn't been enrolled for any session." />
      )}

      <div className="space-y-3">
        {sessions.map((session) => (
          <DrillRow
            key={session.sessionId}
            to={`/guardian/attendance/${ward.studentId}/${session.sessionId}`}
            title={session.sessionName}
            meta={session.className}
            trailing={session.currentSession && <Badge variant="brand">Current</Badge>}
          />
        ))}
      </div>
    </div>
  );
}
