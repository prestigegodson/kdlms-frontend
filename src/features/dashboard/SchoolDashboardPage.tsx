import { ChevronRight, ClipboardCheck, GraduationCap, Library, UserCheck } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";
import { ApiError } from "@/api/client";
import { getSchoolDashboard, type SchoolDashboardView } from "@/api/dashboard";
import { can } from "@/auth/permissions";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatTile } from "@/components/ui/StatTile";
import { StatTileSkeleton } from "@/components/ui/StatTileSkeleton";
import { AttendanceTodayCard } from "@/features/attendance/components/AttendanceTodayCard";
import { RegisterProgress } from "@/features/attendance/components/RegisterProgress";
import { NeedsAttentionCard } from "@/features/dashboard/components/NeedsAttentionCard";
import { TermProgressCard } from "@/features/dashboard/components/TermProgressCard";
import { AgeDistributionCard } from "@/features/students/components/AgeDistributionCard";
import { UpcomingBirthdaysCard } from "@/features/students/components/UpcomingBirthdaysCard";
import { useAuthStore } from "@/stores/authStore";

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

      {state.kind === "loaded" && state.view.admin && (
        <AdminDashboard admin={state.view.admin} currentTerm={state.view.currentTerm} nextTerm={state.view.nextTerm} />
      )}
      {state.kind === "loaded" && state.view.teacher && <TeacherDashboard teacher={state.view.teacher} />}
    </div>
  );
}

interface AdminDashboardProps {
  admin: NonNullable<SchoolDashboardView["admin"]>;
  currentTerm?: SchoolDashboardView["currentTerm"];
  nextTerm?: SchoolDashboardView["nextTerm"];
}

const MAX_UNPUBLISHED_ROWS = 8;

function AdminDashboard({ admin, currentTerm, nextTerm }: AdminDashboardProps) {
  const role = useAuthStore((state) => state.user?.role);
  const { classesMarked, totalClasses, present, absent, late, excused } = admin.attendanceToday;
  const totalMarked = present + absent + late + excused;
  const attendanceRate = totalMarked === 0 ? null : Math.round(((present + late) / totalMarked) * 100);
  const attendanceCoverageHint =
    totalMarked === 0
      ? undefined
      : classesMarked < totalClasses
        ? `Across ${classesMarked} of ${totalClasses} registers`
        : `${present} present · ${absent} absent · ${late} late · ${excused} excused`;
  const allPublished =
    admin.publicationProgress !== undefined &&
    admin.publicationProgress.totalClasses > 0 &&
    admin.publicationProgress.publishedClasses === admin.publicationProgress.totalClasses;
  const unpublishedClasses = admin.publicationProgress?.unpublishedClasses ?? [];
  const shownUnpublished = unpublishedClasses.slice(0, MAX_UNPUBLISHED_ROWS);
  const hiddenUnpublishedCount = unpublishedClasses.length - shownUnpublished.length;

  return (
    <>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          icon={GraduationCap}
          label="Active students"
          value={
            admin.activeStudentLimit !== undefined
              ? `${admin.activeStudents} / ${admin.activeStudentLimit}`
              : admin.activeStudents
          }
          hint={admin.activeStudents > 0 ? `${admin.activeGirls} girls · ${admin.activeBoys} boys` : undefined}
          to="/school/students"
        />
        <StatTile
          icon={Library}
          label="Active classes"
          value={admin.activeClasses}
          to="/school/academics/classes"
        />
        <StatTile
          icon={UserCheck}
          label="Attendance today"
          value={attendanceRate === null ? "—" : `${attendanceRate}%`}
          hint={attendanceCoverageHint}
          to="/school/attendance"
        />
        <StatTile
          icon={ClipboardCheck}
          label="Registers marked"
          value={admin.registersMarkable ? `${classesMarked} / ${totalClasses}` : "—"}
          hint={admin.registersMarkable ? undefined : "Not a marking day"}
          to="/school/attendance"
        />
      </div>

      {currentTerm && <TermProgressCard currentTerm={currentTerm} nextTerm={nextTerm} />}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-1 lg:grid-cols-2">
        <NeedsAttentionCard setupGaps={admin.setupGaps} />

        <UpcomingBirthdaysCard linkable={can.manageStudents(role)} />
      </div>

      <AgeDistributionCard />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-1 lg:grid-cols-2">
      {admin.publicationProgress && (
        <Card>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-slate-900">
              This term&rsquo;s results published
            </h2>
            {allPublished && <Badge variant="success">All published</Badge>}
          </div>
          <div className="mt-3">
            <RegisterProgress
              markedCount={admin.publicationProgress.publishedClasses}
              totalCount={admin.publicationProgress.totalClasses}
              itemLabel="class"
              itemLabelPlural="classes"
              verbLabel="published"
            />
          </div>
          {shownUnpublished.length > 0 && (
            <ul className="mt-4 divide-y divide-slate-100">
              {shownUnpublished.map((classRef) => (
                <li key={classRef.classId}>
                  <Link
                    to={`/school/academics/classes/${classRef.classId}`}
                    className="flex min-h-11 items-center justify-between gap-2 rounded-control py-2 text-sm text-slate-700 hover:bg-slate-50"
                  >
                    <span className="truncate font-medium text-slate-900">
                      {classRef.className}
                      {classRef.levelName && (
                        <span className="font-normal text-slate-400"> · {classRef.levelName}</span>
                      )}
                    </span>
                    <span className="flex shrink-0 items-center gap-2">
                      <Badge variant="warning">Not published</Badge>
                      <ChevronRight className="h-4 w-4 text-slate-400" aria-hidden="true" />
                    </span>
                  </Link>
                </li>
              ))}
              {hiddenUnpublishedCount > 0 && (
                <li className="py-2 text-xs text-slate-500">+{hiddenUnpublishedCount} more</li>
              )}
            </ul>
          )}
        </Card>
      )}

      {admin.registersMarkable && <AttendanceTodayCard />}
      </div>
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
    <>
      <Card className="p-0">
        <h2 className="p-6 pb-0 text-sm font-semibold text-slate-900">Your classes</h2>
        <ul className="mt-4 divide-y divide-slate-100 pb-2">
          {teacher.classes.map((row) => (
            <li key={row.classId}>
              <button
                type="button"
                className="flex min-h-14 w-full items-center justify-between gap-3 px-6 py-3 text-left hover:bg-slate-50"
                onClick={() => navigate(`/school/academics/classes/${row.classId}`)}
              >
                <span className="text-sm font-medium text-slate-900">{row.className}</span>
                <span className="flex shrink-0 items-center gap-2">
                  <Badge variant={row.registerMarkedToday ? "success" : "warning"}>
                    {row.registerMarkedToday ? "Register marked today" : "Register not marked yet"}
                  </Badge>
                  <ChevronRight className="h-4 w-4 text-slate-400" aria-hidden="true" />
                </span>
              </button>
            </li>
          ))}
        </ul>
      </Card>

      <UpcomingBirthdaysCard />
    </>
  );
}
