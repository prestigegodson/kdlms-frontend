import { ClipboardCheck, GraduationCap, Library, UserCheck } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { ApiError } from "@/api/client";
import { getSchoolDashboard, type SchoolDashboardView } from "@/api/dashboard";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatTile } from "@/components/ui/StatTile";
import { StatTileSkeleton } from "@/components/ui/StatTileSkeleton";
import { AttendanceTodayCard } from "@/features/attendance/components/AttendanceTodayCard";
import { RegisterProgress } from "@/features/attendance/components/RegisterProgress";

type LoadState =
  | { kind: "loading" }
  | { kind: "loaded"; view: SchoolDashboardView }
  | { kind: "error"; message: string };

/**
 * The school portal landing page - the payload itself is already shaped by
 * caller role server-side (`SchoolDashboardView`'s Javadoc), so this
 * component only decides which section to render, never re-derives role
 * logic client-side.
 */
export function SchoolDashboardPage() {
  const [state, setState] = useState<LoadState>({ kind: "loading" });
  const [retrying, setRetrying] = useState(false);

  const load = useCallback(() => {
    return getSchoolDashboard()
      .then((view) => setState({ kind: "loaded", view }))
      .catch((error: unknown) =>
        setState({
          kind: "error",
          message: error instanceof ApiError ? error.message : "Failed to load the dashboard",
        }),
      );
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function retryLoad() {
    setRetrying(true);
    load().finally(() => setRetrying(false));
  }

  const description = [
    state.kind === "loaded" ? state.view.currentSessionName : undefined,
    state.kind === "loaded" ? state.view.currentTermName : undefined,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="space-y-6">
      <PageHeader title="Dashboard" description={description || "Your school at a glance."} />

      {state.kind === "error" && (
        <ErrorState message={state.message} onRetry={retryLoad} retrying={retrying} />
      )}

      {state.kind === "loading" && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <StatTileSkeleton key={index} />
          ))}
        </div>
      )}

      {state.kind === "loaded" && state.view.admin && <AdminDashboard admin={state.view.admin} />}
      {state.kind === "loaded" && state.view.teacher && <TeacherDashboard teacher={state.view.teacher} />}
    </div>
  );
}

function AdminDashboard({ admin }: { admin: NonNullable<SchoolDashboardView["admin"]> }) {
  return (
    <>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile icon={GraduationCap} label="Active students" value={admin.activeStudents} />
        <StatTile icon={Library} label="Active classes" value={admin.activeClasses} />
        <StatTile icon={UserCheck} label="Present today" value={admin.attendanceToday.present} />
        <StatTile
          icon={ClipboardCheck}
          label="Registers marked"
          value={`${admin.attendanceToday.classesMarked} / ${admin.attendanceToday.totalClasses}`}
        />
      </div>

      {admin.publicationProgress && (
        <Card>
          <h2 className="text-sm font-semibold text-slate-900">This term&rsquo;s results published</h2>
          <div className="mt-3">
            <RegisterProgress
              markedCount={admin.publicationProgress.publishedClasses}
              totalCount={admin.publicationProgress.totalClasses}
              itemLabel="class"
            />
          </div>
        </Card>
      )}

      <AttendanceTodayCard />
    </>
  );
}

function TeacherDashboard({ teacher }: { teacher: NonNullable<SchoolDashboardView["teacher"]> }) {
  const navigate = useNavigate();

  if (teacher.classes.length === 0) {
    return (
      <EmptyState
        icon={Library}
        title="No classes assigned yet"
        description="Once you're assigned as a class teacher or subject teacher, your classes will show up here."
      />
    );
  }

  return (
    <Card>
      <h2 className="text-sm font-semibold text-slate-900">Your classes</h2>
      <ul className="mt-4 divide-y divide-slate-100">
        {teacher.classes.map((row) => (
          <li key={row.classId} className="flex items-center justify-between gap-3 py-3">
            <button
              type="button"
              className="text-left text-sm font-medium text-slate-900 hover:text-brand-600"
              onClick={() => navigate(`/school/academics/classes/${row.classId}`)}
            >
              {row.className}
            </button>
            <Badge variant={row.registerMarkedToday ? "success" : "warning"}>
              {row.registerMarkedToday ? "Register marked today" : "Register not marked yet"}
            </Badge>
          </li>
        ))}
      </ul>
    </Card>
  );
}
