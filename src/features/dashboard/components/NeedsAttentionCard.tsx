import { ChevronRight, TriangleAlert } from "lucide-react";
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
 * emails. Renders nothing when both gaps are clear - following
 * `SubscriptionBanner`'s "only speak up when there's something to act on"
 * precedent, so a well-set-up school never sees an empty card.
 */
export function NeedsAttentionCard({ setupGaps }: NeedsAttentionCardProps) {
  const { classesWithoutClassTeacher, studentsWithoutGuardian } = setupGaps;
  if (classesWithoutClassTeacher.length === 0 && studentsWithoutGuardian === 0) {
    return null;
  }

  return (
    <Card>
      <div className="flex items-center gap-2">
        <TriangleAlert className="h-4 w-4 shrink-0 text-amber-600" aria-hidden="true" />
        <h2 className="text-sm font-semibold text-slate-900">Needs attention</h2>
      </div>

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
              to="/school/guardians"
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
    </Card>
  );
}
