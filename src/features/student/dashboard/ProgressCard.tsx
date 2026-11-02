import type { MyLearningResourceSummaryView } from "@/api/learning";
import type { MyTakeHomeQuizSummaryView } from "@/api/myTakeHomeQuizzes";
import { Card } from "@/components/ui/Card";
import { ProgressBar } from "@/features/student/dashboard/ProgressBar";
import { ProgressRing } from "@/features/student/dashboard/ProgressRing";
import {
  MASTERY_THRESHOLD_PERCENT,
  percentOf,
  quizProgress,
  subjectProgress,
} from "@/features/student/dashboard/studentDashboardStats";

interface ProgressCardProps {
  quizzes: MyTakeHomeQuizSummaryView[] | null;
  resources: MyLearningResourceSummaryView[] | null;
}

/** Quiz completion/mastery rings beside per-subject lesson progress - either half drops out when its data isn't available. */
export function ProgressCard({ quizzes, resources }: ProgressCardProps) {
  const subjects = resources ? subjectProgress(resources) : [];
  const showQuizzes = quizzes !== null && quizzes.length > 0;
  const showSubjects = subjects.length > 0;
  if (!showQuizzes && !showSubjects) {
    return null;
  }
  const progress = quizzes ? quizProgress(quizzes) : null;

  return (
    <Card>
      <div className={`grid grid-cols-1 gap-6 ${showQuizzes && showSubjects ? "lg:grid-cols-2" : ""}`}>
        {showQuizzes && progress && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:border-r lg:border-slate-100 lg:pr-6">
            <RingStat
              percent={percentOf(progress.submitted, progress.available)}
              title="Quizzes completed"
              detail={`${progress.submitted} of ${progress.available}`}
            />
            <RingStat
              percent={percentOf(progress.mastered, progress.released)}
              title="Quizzes mastered"
              detail={
                progress.released > 0
                  ? `${progress.mastered} of ${progress.released} scored ${MASTERY_THRESHOLD_PERCENT}%+`
                  : "No scores released yet"
              }
            />
          </div>
        )}
        {showSubjects && (
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Lesson progress by subject</h3>
            <ul className="mt-3 space-y-3">
              {subjects.map((subject) => (
                <li key={subject.subjectName}>
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span className="min-w-0 truncate text-slate-700">{subject.subjectName}</span>
                    <span className="ml-3 shrink-0 tabular-nums text-slate-500">
                      {subject.completed}/{subject.total}
                    </span>
                  </div>
                  <ProgressBar percent={subject.percent} label={`${subject.subjectName} lessons completed`} />
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </Card>
  );
}

function RingStat({ percent, title, detail }: { percent: number; title: string; detail: string }) {
  return (
    <div className="flex items-center">
      <ProgressRing percent={percent} label={title} />
      <div className="ml-4 min-w-0">
        <p className="text-sm font-medium text-slate-900">{title}</p>
        <p className="text-xs text-slate-500">{detail}</p>
      </div>
    </div>
  );
}
