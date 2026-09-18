import { CalendarDays, ClipboardCheck } from "lucide-react";
import { useEffect } from "react";
import { downloadMyPhoto } from "@/api/student";
import { Avatar } from "@/components/ui/Avatar";
import { Card } from "@/components/ui/Card";
import { ErrorState } from "@/components/ui/ErrorState";
import { PageHeader } from "@/components/ui/PageHeader";
import { Spinner } from "@/components/ui/Spinner";
import { StatTile } from "@/components/ui/StatTile";
import { useObjectUrl } from "@/hooks/useObjectUrl";
import { useStudentStore } from "@/stores/studentStore";
import { initialsOfFullName } from "@/utils/initials";

/** `useObjectUrl`'s fetcher must be a stable module-level function - `downloadMyPhoto` itself takes no id, so this just ignores the key `useObjectUrl` passes it. */
function fetchMyPhoto(): Promise<Blob> {
  return downloadMyPhoto();
}

/**
 * The student portal's Home tab - own profile summary plus entry tiles into Results and
 * Timetable. No placeholder tiles for Resources/Quizzes here - those arrive with their own
 * phases (35E/35I) rather than linking somewhere that doesn't exist yet.
 */
export function StudentDashboardPage() {
  const me = useStudentStore((state) => state.me);
  const status = useStudentStore((state) => state.status);
  const errorMessage = useStudentStore((state) => state.errorMessage);
  const fetchIfNeeded = useStudentStore((state) => state.fetchIfNeeded);
  const retry = useStudentStore((state) => state.retry);
  // Gated on hasPhoto so a student with no photo never fires a fetch that can only 404.
  const photoUrl = useObjectUrl(me?.hasPhoto ? me.studentId : undefined, fetchMyPhoto);

  useEffect(() => {
    fetchIfNeeded();
  }, [fetchIfNeeded]);

  if (status === "error") {
    return (
      <div className="space-y-6">
        <PageHeader title="Home" />
        <ErrorState message={errorMessage ?? "Failed to load your profile"} onRetry={retry} />
      </div>
    );
  }

  if (!me) {
    return (
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <Spinner /> Loading…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Home" description={me.schoolName} />

      <Card>
        <div className="flex items-center gap-4">
          <Avatar initials={initialsOfFullName(me.fullName)} url={photoUrl} size="lg" />
          <div className="min-w-0">
            <h2 className="font-display text-lg font-medium text-slate-900">{me.fullName}</h2>
            <p className="text-sm text-slate-500">{me.admissionNumber}</p>
            {me.className && (
              <p className="text-sm text-slate-500">
                {me.className}
                {me.levelName ? ` · ${me.levelName}` : ""}
              </p>
            )}
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-3">
        <StatTile
          label="Session"
          value={me.sessionName ?? "—"}
          hint={me.currentTermName ?? undefined}
          to="/student/results"
          icon={ClipboardCheck}
        />
        <StatTile label="Timetable" value="This term" to="/student/timetable" icon={CalendarDays} />
      </div>
    </div>
  );
}
