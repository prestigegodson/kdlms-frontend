import { ChevronRight } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";
import type { DashboardEntryProgress, DashboardSubjectClassRow } from "@/api/dashboard";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

/** Rows shown before "View more" - and the increment revealed per click. */
const PAGE_SIZE = 10;

/**
 * A teacher's subject-teaching assignments with this term's score-entry progress - one row per
 * class + subject, linking straight to that sheet on the Assessments page. A period the subject
 * isn't assessed in (or any period, with no current term) is simply not shown.
 */
export function SubjectClassesCard({ rows }: { rows: DashboardSubjectClassRow[] }) {
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const shown = rows.slice(0, visibleCount);
  const remaining = rows.length - shown.length;

  return (
    <Card className="p-0 sm:p-0">
      <h2 className="p-4 pb-0 text-sm font-semibold text-slate-900 sm:p-6 sm:pb-0">Your subjects</h2>
      <ul className="mt-3 divide-y divide-slate-100 pb-2">
        {shown.map((row) => (
          <li key={`${row.classId}:${row.subjectId}`}>
            <Link
              to={`/school/assessments?classId=${row.classId}&subjectId=${row.subjectId}`}
              className="flex min-h-14 flex-col gap-3 px-4 py-3 hover:bg-slate-50 sm:flex-row sm:items-center sm:justify-between sm:px-6"
            >
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium text-slate-900">{row.subjectName}</span>
                <span className="block truncate text-xs text-slate-500">
                  {row.className}
                  {row.levelName && ` · ${row.levelName}`} · {row.studentCount}{" "}
                  {row.studentCount === 1 ? "student" : "students"}
                </span>
              </span>
              <span className="flex shrink-0 items-center gap-3">
                {row.midterm && <EntryMeter label="Midterm" progress={row.midterm} />}
                {row.exam && <EntryMeter label="Exam" progress={row.exam} />}
                <PublicationBadge row={row} />
                <ChevronRight className="hidden h-4 w-4 text-slate-400 sm:block" aria-hidden="true" />
              </span>
            </Link>
          </li>
        ))}
      </ul>
      {rows.length > PAGE_SIZE && (
        <div className="flex justify-center border-t border-slate-100 px-4 py-2 sm:px-6">
          {remaining > 0 ? (
            <Button variant="ghost" size="sm" onClick={() => setVisibleCount((count) => count + PAGE_SIZE)}>
              View more ({remaining})
            </Button>
          ) : (
            <Button variant="ghost" size="sm" onClick={() => setVisibleCount(PAGE_SIZE)}>
              Show less
            </Button>
          )}
        </div>
      )}
    </Card>
  );
}

function EntryMeter({ label, progress }: { label: string; progress: DashboardEntryProgress }) {
  const { recorded, total } = progress;
  const percent = total === 0 ? 0 : Math.round((recorded / total) * 100);
  const complete = total > 0 && recorded === total;
  return (
    <span className="w-24 space-y-1">
      <span className="flex items-center justify-between text-xs text-slate-500">
        <span>{label}</span>
        <span className="tabular-nums">
          {recorded}/{total}
        </span>
      </span>
      <span className="block h-1 w-full overflow-hidden rounded-full bg-slate-100">
        <span
          className={`block h-full rounded-full ${complete ? "bg-green-600" : "bg-brand-500"}`}
          style={{ width: `${percent}%` }}
          role="progressbar"
          aria-label={`${label} scores entered`}
          aria-valuenow={recorded}
          aria-valuemin={0}
          aria-valuemax={total}
        />
      </span>
    </span>
  );
}

function PublicationBadge({ row }: { row: DashboardSubjectClassRow }) {
  if (row.termResultsPublished) {
    return <Badge variant="success">Results published</Badge>;
  }
  if (row.midtermResultsPublished) {
    return <Badge variant="info">Midterm published</Badge>;
  }
  return null;
}
