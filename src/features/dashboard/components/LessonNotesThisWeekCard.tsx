import { ChevronRight } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";
import type { DashboardLessonNoteTodo } from "@/api/dashboard";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

/** Rows shown before "View more" - and the increment revealed per click. */
const PAGE_SIZE = 10;

/** Which of the teacher's subjects still have no lesson note for the current week of term. */
export function LessonNotesThisWeekCard({ lessonNotes }: { lessonNotes: DashboardLessonNoteTodo }) {
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  if (lessonNotes.currentWeek === undefined) {
    return null;
  }
  const missing = lessonNotes.missingThisWeek;
  const shown = missing.slice(0, visibleCount);
  const remaining = missing.length - shown.length;
  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-slate-900">Lesson notes for week {lessonNotes.currentWeek}</h2>
        {missing.length === 0 && <Badge variant="success">All written</Badge>}
      </div>
      {missing.length === 0 ? (
        <p className="mt-3 text-sm text-slate-500">Every subject you teach has a note for this week.</p>
      ) : (
        <>
          <ul className="mt-3 divide-y divide-slate-100">
            {shown.map((subject) => (
              <li key={subject.subjectId}>
                <Link
                  to={`/school/lesson-notes?subjectId=${subject.subjectId}`}
                  className="flex min-h-11 items-center justify-between gap-2 rounded-control py-2 text-sm hover:bg-slate-50"
                >
                  <span className="truncate font-medium text-slate-900">
                    {subject.subjectName}
                    <span className="font-normal text-slate-400"> · {subject.levelName}</span>
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    <Badge variant="warning">Not written</Badge>
                    <ChevronRight className="h-4 w-4 text-slate-400" aria-hidden="true" />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          {missing.length > PAGE_SIZE && (
            <div className="flex justify-center border-t border-slate-100 pt-2">
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
        </>
      )}
    </Card>
  );
}
