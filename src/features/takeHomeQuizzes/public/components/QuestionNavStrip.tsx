import { Check } from "lucide-react";
import type { ReactNode } from "react";
import { questionRangeLabel } from "@/features/takeHomeQuizzes/editableStimulus";

interface QuestionNavStripProps {
  count: number;
  currentIndex: number;
  answeredIndexes: Set<number>;
  onSelect: (index: number) => void;
  /**
   * Runs of questions sharing a passage (quiz-module.md Phase 20L), 0-based and inclusive - drawn
   * joined on one tinted band so a student can see which numbers belong together.
   */
  groups?: { first: number; last: number; name: string }[];
}

/**
 * The answered/unanswered number strip replacing a long scroll (Phase 20D).
 * Each button is a real button with an accessible name, not a bare
 * colour-coded dot - colour is never the only signal here either.
 */
export function QuestionNavStrip({ count, currentIndex, answeredIndexes, onSelect, groups = [] }: QuestionNavStripProps) {
  const groupAt = new Map<number, { first: number; last: number; name: string }>();
  for (const group of groups) groupAt.set(group.first, group);

  function numberButton(index: number, groupName?: string) {
    const answered = answeredIndexes.has(index);
    const current = index === currentIndex;
    return (
      <button
        key={index}
        type="button"
        onClick={() => onSelect(index)}
        aria-current={current ? "step" : undefined}
        aria-label={`Question ${index + 1}${groupName ? `, ${groupName}` : ""}${answered ? ", answered" : ", not answered"}`}
        className={`flex h-10 w-10 items-center justify-center rounded-full border-2 text-sm font-semibold transition-colors ${
          current
            ? "border-brand-500 bg-brand-500 text-white"
            : answered
              ? "border-brand-200 bg-brand-100 text-brand-800"
              : "border-slate-200 bg-white text-slate-600"
        }`}
      >
        {answered && !current ? <Check className="h-4 w-4" aria-hidden="true" /> : index + 1}
      </button>
    );
  }

  const items: ReactNode[] = [];
  for (let index = 0; index < count; index++) {
    const group = groupAt.get(index);
    if (group && group.last > group.first) {
      const indexes = Array.from({ length: group.last - group.first + 1 }, (_, i) => group.first + i);
      items.push(
        <div
          key={`group-${index}`}
          role="group"
          aria-label={`${group.name}, ${questionRangeLabel(group.first + 1, group.last + 1).toLowerCase()}`}
          className="flex flex-wrap gap-2 rounded-full bg-brand-50 p-1 ring-1 ring-brand-100"
        >
          {indexes.map((i) => numberButton(i, group.name))}
        </div>,
      );
      index = group.last;
    } else {
      items.push(numberButton(index, group?.name));
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Question navigator">
      {items}
    </div>
  );
}
