import { Check } from "lucide-react";

interface QuestionNavStripProps {
  count: number;
  currentIndex: number;
  answeredIndexes: Set<number>;
  onSelect: (index: number) => void;
}

/**
 * The answered/unanswered number strip replacing a long scroll (Phase 20D).
 * Each button is a real button with an accessible name, not a bare
 * colour-coded dot - colour is never the only signal here either.
 */
export function QuestionNavStrip({ count, currentIndex, answeredIndexes, onSelect }: QuestionNavStripProps) {
  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label="Question navigator">
      {Array.from({ length: count }, (_, index) => {
        const answered = answeredIndexes.has(index);
        const current = index === currentIndex;
        return (
          <button
            key={index}
            type="button"
            onClick={() => onSelect(index)}
            aria-current={current ? "step" : undefined}
            aria-label={`Question ${index + 1}${answered ? ", answered" : ", not answered"}`}
            className={`flex h-9 w-9 items-center justify-center rounded-full border text-sm font-medium transition-colors ${
              current
                ? "border-brand-500 bg-brand-500 text-white"
                : answered
                  ? "border-brand-200 bg-brand-50 text-brand-700"
                  : "border-slate-200 bg-white text-slate-600"
            }`}
          >
            {answered && !current ? <Check className="h-4 w-4" aria-hidden="true" /> : index + 1}
          </button>
        );
      })}
    </div>
  );
}
