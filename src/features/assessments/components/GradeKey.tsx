import type { GradingSystemView } from "@/api/gradingSystems";

interface GradeKeyProps {
  system: GradingSystemView;
}

/** The grade-boundary key (NUMERIC) or rating-scale legend (QUALITATIVE) for a broadsheet. */
export function GradeKey({ system }: GradeKeyProps) {
  const chips =
    system.assessmentMode === "NUMERIC"
      ? [...system.boundaries]
          .sort((a, b) => b.minScore - a.minScore)
          .map((boundary) => (
            <span
              key={boundary.grade}
              className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs text-slate-700"
            >
              <strong className="text-slate-900">{boundary.grade}</strong>
              {boundary.minScore}&ndash;{boundary.maxScore} &middot; {boundary.remark}
            </span>
          ))
      : [...system.ratingOptions]
          .sort((a, b) => a.rank - b.rank)
          .map((option) => (
            <span key={option.id} className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs text-slate-700">
              {option.label}
            </span>
          ));

  return <div className="flex flex-wrap gap-2">{chips}</div>;
}
