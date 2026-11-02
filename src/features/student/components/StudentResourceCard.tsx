import { CalendarClock } from "lucide-react";
import { Link } from "react-router";
import type { MyLearningResourceSummaryView } from "@/api/learning";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { ResourceNewPill } from "@/features/student/components/ResourceNewPill";
import { ResourceTypeIcon } from "@/features/student/ResourceTypeIcon";
import { formatInstant } from "@/utils/date";

/**
 * One resource on the student Resources page - a half-width card (two per row from `md`), laid out like
 * `StudentQuizCard`: the type as an icon tile, the title, and the subject (or subject group) it belongs to,
 * with a "New" pill until it's first opened and an "Available until ..." footer when its window has an end.
 */
export function StudentResourceCard({ resource }: { resource: MyLearningResourceSummaryView }) {
  const group = resource.cardName ?? resource.subjectName;

  return (
    <Link to={`/student/resources/${resource.id}`} className="block h-full">
      <Card className="flex h-full cursor-pointer flex-col !p-4 transition-colors hover:border-brand-200 hover:bg-brand-50/40">
        <div className="flex items-start gap-3">
          <ResourceTypeIcon type={resource.resourceType} />
          <div className="min-w-0 flex-1">
            <h3 className="font-display text-base font-medium text-slate-900">{resource.title}</h3>
            <p className="mt-0.5 truncate text-sm text-slate-500">{group}</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {!resource.opened && <ResourceNewPill label="New" />}
            {resource.completed && <Badge variant="success">Completed</Badge>}
          </div>
        </div>

        {resource.availableUntil && (
          <div className="mt-4 border-t border-slate-100 pt-3">
            <span className="flex items-center gap-1.5 text-xs text-slate-500">
              <CalendarClock className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
              Available until {formatInstant(resource.availableUntil)}
            </span>
          </div>
        )}
      </Card>
    </Link>
  );
}
