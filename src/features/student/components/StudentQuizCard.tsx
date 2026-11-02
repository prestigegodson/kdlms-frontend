import { Award, CalendarClock, ListChecks, Timer } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router";
import type { MyTakeHomeQuizSummaryView } from "@/api/myTakeHomeQuizzes";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { QUIZ_STATUS, quizStatus } from "@/features/student/dashboard/studentDashboardStats";
import { formatInstant } from "@/utils/date";

type BadgeVariant = "success" | "warning" | "brand" | "neutral" | "danger";

const AWAITING_RESULTS_NOTE = "Results will appear once your teacher releases them";

/** True for a submitted attempt whose score isn't reviewable yet - its card is inert, since opening it would only show "check back later". */
function isAwaitingResults(quiz: MyTakeHomeQuizSummaryView): boolean {
  return quiz.attemptState === "SUBMITTED" && typeof quiz.score !== "number";
}

/** The released score wins, then the dashboard's own status buckets; results out without a submission reads as missed. */
function statusBadge(quiz: MyTakeHomeQuizSummaryView): { variant: BadgeVariant; label: string } {
  if (typeof quiz.score === "number") {
    return { variant: "success", label: `${formatPoints(quiz.score)}/${formatPoints(quiz.totalPoints)}` };
  }
  if (quiz.attemptState === "SUBMITTED") {
    return { variant: "neutral", label: "Awaiting results" };
  }
  if (quiz.resultsPublished) {
    return QUIZ_STATUS.missed;
  }
  return QUIZ_STATUS[quizStatus(quiz)];
}

/** Whole points stay whole ("5"); fractional ones keep up to two decimals ("2.5"). */
function formatPoints(points: number): string {
  return Number.isInteger(points) ? String(points) : String(Math.round(points * 100) / 100);
}

function formatDuration(minutes: number | null | undefined): string {
  if (typeof minutes !== "number" || minutes <= 0) {
    return "Timed";
  }
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) {
    return `Timed · ${rest} min`;
  }
  return rest === 0 ? `Timed · ${hours} h` : `Timed · ${hours} h ${rest} min`;
}

function Fact({ icon: Icon, children }: { icon: typeof Timer; children: ReactNode }) {
  return (
    <li className="flex items-center gap-1.5">
      <Icon className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
      <span>{children}</span>
    </li>
  );
}

/**
 * One take-home quiz on the student Quizzes page - a half-width card (two per row from `md`) with the
 * facts a student weighs before starting: question count, total obtainable score, whether it's timed
 * and for how long, and whether it's a midterm (writes to the gradebook) or a normal quiz.
 */
export function StudentQuizCard({ quiz }: { quiz: MyTakeHomeQuizSummaryView }) {
  const badge = statusBadge(quiz);
  const awaiting = isAwaitingResults(quiz);
  const upcoming = quiz.availability === "SCHEDULED";

  const body = (
    <div className="flex h-full flex-col">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className={`font-display text-base font-medium ${awaiting ? "text-slate-500" : "text-slate-900"}`}>
            {quiz.title}
          </h3>
          <p className="mt-0.5 truncate text-sm text-slate-500">{quiz.subjectName}</p>
        </div>
        <Badge variant={badge.variant} className="shrink-0">
          {badge.label}
        </Badge>
      </div>

      <ul className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-sm text-slate-600">
        <Fact icon={ListChecks}>
          {quiz.questionCount} {quiz.questionCount === 1 ? "question" : "questions"}
        </Fact>
        <Fact icon={Award}>Total score: {formatPoints(quiz.totalPoints)}</Fact>
        <Fact icon={Timer}>{quiz.timed ? formatDuration(quiz.durationMinutes) : "Untimed"}</Fact>
      </ul>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3">
        <span className="flex items-center gap-1.5 text-xs text-slate-500">
          <CalendarClock className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
          {upcoming ? `Opens ${formatInstant(quiz.opensAt)}` : `Closes ${formatInstant(quiz.closesAt)}`}
        </span>
        <Badge variant={quiz.quizType === "MIDTERM" ? "brand" : "neutral"}>
          {quiz.quizType === "MIDTERM" ? "Midterm" : "Normal"}
        </Badge>
      </div>

      {awaiting && <p className="mt-2 text-xs text-slate-500">{AWAITING_RESULTS_NOTE}</p>}
    </div>
  );

  if (awaiting) {
    return (
      <Card aria-disabled="true" className="h-full !p-4 opacity-80">
        {body}
      </Card>
    );
  }

  return (
    <Link to={`/student/quizzes/${quiz.id}`} className="block h-full">
      <Card className="h-full cursor-pointer !p-4 transition-colors hover:border-brand-200 hover:bg-brand-50/40">
        {body}
      </Card>
    </Link>
  );
}
