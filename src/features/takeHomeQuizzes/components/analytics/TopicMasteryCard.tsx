import type { QuizTagStats } from "@/api/takeHomeQuizzes";
import { Card } from "@/components/ui/Card";

/** Below 40% is weak, below 70% developing - the bar's colour only, never a stored judgement. */
function masteryClass(percent: number | null): string {
  if (percent == null) return "bg-slate-300";
  if (percent < 40) return "bg-red-500";
  if (percent < 70) return "bg-amber-500";
  return "bg-green-500";
}

interface TopicMasteryCardProps {
  /** Already ordered weakest first by the server. */
  tags: QuizTagStats[];
}

/**
 * How each topic tag went (interaction-quiz.md §9): the share of its questions' points earned in
 * submitted attempts, pooled across every question carrying the tag.
 */
export function TopicMasteryCard({ tags }: TopicMasteryCardProps) {
  return (
    <Card>
      <h3 className="font-display text-base font-medium text-slate-900">Topic mastery</h3>
      <p className="mt-1 text-xs text-slate-500">
        The share of each topic's points earned, weakest first. A question with several tags counts
        toward each.
      </p>
      <ul className="mt-4 space-y-3 text-sm">
        {tags.map((tag) => (
          <li key={tag.tag} className="space-y-1">
            <div className="flex items-baseline justify-between gap-4">
              <span className="min-w-0 break-words font-medium text-slate-900">{tag.tag}</span>
              <span className="shrink-0 text-xs tabular-nums text-slate-500">
                {tag.questionCount} {tag.questionCount === 1 ? "question" : "questions"} ·{" "}
                {tag.averagePercent == null ? "—" : `${tag.averagePercent}%`}
              </span>
            </div>
            <div
              className="h-2 overflow-hidden rounded-full bg-slate-100"
              role="img"
              aria-label={`${tag.tag}: ${tag.averagePercent == null ? "no submissions" : `${tag.averagePercent}%`}`}
            >
              <div
                className={`h-full rounded-full ${masteryClass(tag.averagePercent)}`}
                style={{ width: `${tag.averagePercent ?? 0}%` }}
              />
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}
