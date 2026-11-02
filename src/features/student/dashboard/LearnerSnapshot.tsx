import { BookOpenCheck, ClipboardCheck, TrendingUp } from "lucide-react";
import type { MyLearningResourceSummaryView } from "@/api/learning";
import type { MyTakeHomeQuizSummaryView } from "@/api/myTakeHomeQuizzes";
import { StatTile } from "@/components/ui/StatTile";
import { ProgressBar } from "@/features/student/dashboard/ProgressBar";
import { Sparkline } from "@/features/student/dashboard/Sparkline";
import { percentOf, quizProgress, scoreTrend } from "@/features/student/dashboard/studentDashboardStats";

interface LearnerSnapshotProps {
  /** null = the list isn't available (feature off or failed to load), so its tiles are left out. */
  quizzes: MyTakeHomeQuizSummaryView[] | null;
  resources: MyLearningResourceSummaryView[] | null;
}

/** The "Learner Snapshot" tile row - each tile appears only when its source list is available. */
export function LearnerSnapshot({ quizzes, resources }: LearnerSnapshotProps) {
  const tiles = [];

  if (resources) {
    const completed = resources.filter((resource) => resource.completed).length;
    tiles.push(
      <StatTile
        key="lessons"
        label="Lessons completed"
        value={
          <>
            {completed}
            <span className="text-base text-slate-400">/{resources.length}</span>
            <ProgressBar
              percent={percentOf(completed, resources.length)}
              label="Lessons completed"
              tone="accent"
              className="mt-2"
            />
          </>
        }
        to="/student/resources"
        icon={BookOpenCheck}
      />,
    );
  }

  if (quizzes) {
    const progress = quizProgress(quizzes);
    const trend = scoreTrend(quizzes);
    tiles.push(
      <StatTile
        key="quizzes"
        label="Quizzes completed"
        value={progress.submitted}
        hint={`of ${progress.available} available so far`}
        to="/student/quizzes"
        icon={ClipboardCheck}
      />,
      <StatTile
        key="performance"
        label="Quiz performance"
        value={
          trend.length >= 2 ? (
            <Sparkline points={trend} label={`Quiz scores over time, latest ${trend[trend.length - 1]}%`} />
          ) : trend.length === 1 ? (
            `${trend[0]}%`
          ) : (
            "—"
          )
        }
        hint={trend.length >= 2 ? `Latest score ${trend[trend.length - 1]}%` : "Scores appear once your teacher releases them"}
        icon={TrendingUp}
      />,
    );
  }

  if (tiles.length === 0) {
    return null;
  }

  return (
    <section aria-labelledby="learner-snapshot-heading" className="space-y-3">
      <h2 id="learner-snapshot-heading" className="font-display text-base font-medium text-slate-900">
        Learner snapshot
      </h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">{tiles}</div>
    </section>
  );
}
