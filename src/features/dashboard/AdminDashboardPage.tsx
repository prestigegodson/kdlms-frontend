import {
  AlertTriangle,
  Archive,
  BookOpenCheck,
  Building2,
  CheckCircle2,
  ClipboardList,
  FileCheck2,
  GraduationCap,
  Layers,
  Package,
  PauseCircle,
  Receipt,
  ScrollText,
  UserRound,
  Users,
  XCircle,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { ApiError } from "@/api/client";
import { type AdminDashboardPlatformImpact, type AdminDashboardView, getAdminDashboard } from "@/api/dashboard";
import { Card } from "@/components/ui/Card";
import { ErrorState } from "@/components/ui/ErrorState";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatTile } from "@/components/ui/StatTile";
import { StatTileSkeleton } from "@/components/ui/StatTileSkeleton";
import { TableSkeleton } from "@/components/ui/TableSkeleton";
import { ExpiringSubscriptionsCard } from "@/features/dashboard/components/ExpiringSubscriptionsCard";

type LoadState =
  | { kind: "loading" }
  | { kind: "loaded"; view: AdminDashboardView }
  | { kind: "error"; message: string };

/**
 * A back-compat fallback for `impact` being absent from the response - never happens against the real
 * API (the backend always sends every field), but several tests stub any post-navigation fetch with a
 * generic, minimal JSON body for a page they don't otherwise care about; this keeps that pattern from
 * crashing the page instead of requiring every such test to know this page's own response shape.
 */
const EMPTY_IMPACT: AdminDashboardPlatformImpact = {
  students: 0,
  studentsWithLogin: 0,
  staff: 0,
  teachers: 0,
  guardians: 0,
  takeHomeQuizzes: 0,
  quizQuestions: 0,
  learningResources: 0,
  lessonNotes: 0,
  aiGenerations: 0,
  classes: 0,
  subjects: 0,
  billPublications: 0,
  stockIssues: 0,
  requisitions: 0,
};

/** SYSTEM_ADMIN landing page - platform-wide school and subscription counts. */
export function AdminDashboardPage() {
  const [state, setState] = useState<LoadState>({ kind: "loading" });
  const [retrying, setRetrying] = useState(false);

  const load = useCallback(() => {
    return getAdminDashboard()
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

  const impact = (state.kind === "loaded" && state.view.impact) || EMPTY_IMPACT;

  return (
    <div className="space-y-6">
      <PageHeader title="Dashboard" description="Platform-wide schools and subscriptions." />

      {state.kind === "error" && <ErrorState message={state.message} onRetry={retryLoad} retrying={retrying} />}

      {state.kind === "loading" && (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <StatTileSkeleton key={index} />
            ))}
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <StatTileSkeleton key={index} />
            ))}
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <StatTileSkeleton key={index} />
            ))}
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <StatTileSkeleton key={index} />
            ))}
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <StatTileSkeleton key={index} />
            ))}
          </div>
          <Card className="p-0">
            <div className="mt-3">
              <TableSkeleton rows={3} columns={4} />
            </div>
          </Card>
        </>
      )}

      {state.kind === "loaded" && (
        <>
          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-slate-900">Schools</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatTile icon={Building2} label="Total schools" value={state.view.totalSchools} to="/admin/schools" />
              <StatTile icon={CheckCircle2} label="Active" value={state.view.activeSchools} to="/admin/schools" />
              <StatTile icon={PauseCircle} label="Suspended" value={state.view.suspendedSchools} to="/admin/schools" />
              <StatTile icon={Archive} label="Archived" value={state.view.archivedSchools} to="/admin/schools" />
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-slate-900">Subscriptions</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <StatTile icon={CheckCircle2} label="Active" value={state.view.activeSubscriptions} />
              <StatTile
                icon={AlertTriangle}
                label="Expiring within 14 days"
                value={state.view.expiringSoonSubscriptions}
              />
              <StatTile icon={XCircle} label="Expired" value={state.view.expiredSubscriptions} />
            </div>
          </section>

          <ExpiringSubscriptionsCard schools={state.view.expiringSchools ?? []} />

          <section className="space-y-3">
            <div className="flex items-baseline justify-between gap-2">
              <h2 className="text-sm font-semibold text-slate-900">People</h2>
              <p className="text-xs text-slate-500">Lifetime totals across every school &middot; updated every few minutes</p>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatTile icon={GraduationCap} label="Students" value={impact.students.toLocaleString()} />
              <StatTile
                icon={UserRound}
                label="Student logins"
                value={impact.studentsWithLogin.toLocaleString()}
                hint="Provisioned with a portal login"
              />
              <StatTile
                icon={Users}
                label="Staff"
                value={impact.staff.toLocaleString()}
                hint={`${impact.teachers.toLocaleString()} teachers`}
              />
              <StatTile icon={UserRound} label="Guardians" value={impact.guardians.toLocaleString()} />
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-slate-900">Content created</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatTile
                icon={FileCheck2}
                label="CBT/Quizzes"
                value={impact.takeHomeQuizzes.toLocaleString()}
                hint={`${impact.quizQuestions.toLocaleString()} questions`}
              />
              <StatTile
                icon={BookOpenCheck}
                label="Learning resources"
                value={impact.learningResources.toLocaleString()}
              />
              <StatTile
                icon={ScrollText}
                label="Lesson notes"
                value={impact.lessonNotes.toLocaleString()}
                hint={`${impact.aiGenerations.toLocaleString()} AI generations`}
              />
              <StatTile
                icon={Layers}
                label="Classes &middot; Subjects"
                value={`${impact.classes.toLocaleString()} / ${impact.subjects.toLocaleString()}`}
              />
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-slate-900">Activity</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <StatTile
                icon={Receipt}
                label="Bill publications"
                value={impact.billPublications.toLocaleString()}
              />
              <StatTile icon={Package} label="Stock issues" value={impact.stockIssues.toLocaleString()} />
              <StatTile
                icon={ClipboardList}
                label="Requisitions raised"
                value={impact.requisitions.toLocaleString()}
              />
            </div>
          </section>
        </>
      )}
    </div>
  );
}
