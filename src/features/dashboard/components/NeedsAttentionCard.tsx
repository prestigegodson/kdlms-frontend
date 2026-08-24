import { ChevronRight, CircleCheck, TriangleAlert } from "lucide-react";
import { Link } from "react-router";
import type { DashboardSetupGaps } from "@/api/dashboard";
import { Card } from "@/components/ui/Card";

interface NeedsAttentionCardProps {
  setupGaps: DashboardSetupGaps;
}

/**
 * A data-quality roll-up, not a metric: a class with no class teacher can't
 * take attendance or record assessments at all, and a student with no
 * linked guardian never receives the results-published/communication
 * emails. Unlike `SubscriptionBanner`'s "only speak up when there's
 * something to act on" precedent, this card always renders: it shares a
 * `lg:grid-cols-2` row with `UpcomingBirthdaysCard` on the dashboard, so
 * returning nothing left a lopsided half-empty row and read as a rendering
 * failure rather than "nothing's wrong" - it shows a positive all-clear
 * state instead.
 */
export function NeedsAttentionCard({ setupGaps }: NeedsAttentionCardProps) {
  const { classesWithoutClassTeacher, studentsWithoutGuardian } = setupGaps;
  const allClear = classesWithoutClassTeacher.length === 0 && studentsWithoutGuardian === 0;

  return (
    <Card>
      <div className="flex items-center gap-2">
        {allClear ? (
          <CircleCheck className="h-4 w-4 shrink-0 text-green-600" aria-hidden="true" />
        ) : (
          <TriangleAlert className="h-4 w-4 shrink-0 text-amber-600" aria-hidden="true" />
        )}
        <h2 className="text-sm font-semibold text-slate-900">Needs attention</h2>
      </div>

      {allClear && (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <span className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-green-50 text-green-600">
            <CircleCheck className="h-5 w-5" aria-hidden="true" />
          </span>
          <h3 className="text-sm font-semibold text-slate-900">All clear</h3>
          <p className="mt-1 text-sm text-slate-500">
            Every class has a class teacher and every student has a linked guardian.
          </p>
        </div>
      )}

      {!allClear && (
        <div className="mt-3 divide-y divide-slate-100">
          {classesWithoutClassTeacher.length > 0 && (
            <div className="py-2 first:pt-0">
              <p className="text-xs text-slate-500">
                {classesWithoutClassTeacher.length} class{classesWithoutClassTeacher.length === 1 ? "" : "es"} with no
                class teacher
              </p>
              <ul className="mt-1.5 space-y-1">
                {classesWithoutClassTeacher.map((classRef) => (
                  <li key={classRef.classId}>
                    <Link
                      to={`/school/academics/classes/${classRef.classId}`}
                      className="flex min-h-11 items-center justify-between gap-2 rounded-control px-2 -mx-2 text-sm text-slate-700 hover:bg-slate-50"
                    >
                      <span className="truncate">
                        {classRef.className}
                        {classRef.levelName && <span className="text-slate-400"> · {classRef.levelName}</span>}
                      </span>
                      <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {studentsWithoutGuardian > 0 && (
            <div className="py-2 last:pb-0">
              <Link
                to="/school/students?hasGuardian=false"
                className="flex min-h-11 items-center justify-between gap-2 rounded-control px-2 -mx-2 text-sm text-slate-700 hover:bg-slate-50"
              >
                <span>
                  {studentsWithoutGuardian} student{studentsWithoutGuardian === 1 ? "" : "s"} with no linked guardian
                </span>
                <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
              </Link>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
