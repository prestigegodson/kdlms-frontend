import type { QuestionType, QuizPartStats } from "@/api/takeHomeQuizzes";
import { AuthenticatedRichImage } from "@/components/richText/AuthenticatedRichImage";
import { RichContent } from "@/components/richText/RichContent";

function renderImage(fileId: string, alt: string) {
  return <AuthenticatedRichImage fileId={fileId} alt={alt} />;
}

/** What a part is called when it has no label of its own, and how its expected answer is introduced. */
const PART_WORDING: Partial<Record<QuestionType, { noun: string; expected: string }>> = {
  SEQUENCE: { noun: "Step", expected: "Followed by" },
  MATCHING: { noun: "Pair", expected: "Matches" },
  CATEGORIZE: { noun: "Item", expected: "Belongs in" },
  DIAGRAM_LABEL: { noun: "Zone", expected: "Label" },
  HOTSPOT: { noun: "Target", expected: "Answer" },
};

/** Below 40% correct is hard, below 70% moderate - the same scale as the question bars. */
function barClass(percent: number | null): string {
  if (percent == null) return "bg-slate-300";
  if (percent < 40) return "bg-red-500";
  if (percent < 70) return "bg-amber-500";
  return "bg-green-500";
}

interface PartBreakdownProps {
  questionType: QuestionType;
  parts: QuizPartStats[];
}

/**
 * An interactive question's per-part results (interaction-quiz.md §9): how often each zone, pair or
 * item was right, what it was most often confused with, and how often it was left empty.
 */
export function PartBreakdown({ questionType, parts }: PartBreakdownProps) {
  const wording = PART_WORDING[questionType] ?? { noun: "Part", expected: "Answer" };
  if (parts.length === 0) {
    return null;
  }
  return (
    <div>
      <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">By part</h4>
      <ul className="mt-2 space-y-3">
        {parts.map((part) => (
          <li key={part.partId} className="space-y-1">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 space-y-0.5">
                {part.label ? (
                  <RichContent html={part.label} renderImage={renderImage} className="min-w-0 text-slate-900" />
                ) : (
                  <p className="text-slate-900">
                    {wording.noun} {part.position}
                  </p>
                )}
                {part.expectedLabel && (
                  <div className="flex flex-wrap items-baseline gap-1 text-xs text-slate-500">
                    <span>{wording.expected}:</span>
                    <RichContent html={part.expectedLabel} renderImage={renderImage} className="min-w-0" />
                  </div>
                )}
              </div>
              <span className="shrink-0 tabular-nums text-slate-500">
                {part.correctPercent == null ? "—" : `${part.correctPercent}% correct`}
              </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-slate-200">
              <div
                className={`h-full rounded-full ${barClass(part.correctPercent)}`}
                style={{ width: `${part.correctPercent ?? 0}%` }}
              />
            </div>
            {part.topWrong.length > 0 && (
              <div className="text-xs text-slate-600">
                <span className="text-slate-500">Most often confused with: </span>
                <ul className="inline">
                  {part.topWrong.map((wrong, index) => (
                    <li key={wrong.ref} className="inline">
                      {index > 0 && ", "}
                      <RichContent html={wrong.label} renderImage={renderImage} className="inline [&>p]:inline" />{" "}
                      <span className="tabular-nums text-slate-500">({wrong.count})</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {part.unansweredCount > 0 && (
              <p className="text-xs text-slate-500">{part.unansweredCount} left unanswered</p>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
