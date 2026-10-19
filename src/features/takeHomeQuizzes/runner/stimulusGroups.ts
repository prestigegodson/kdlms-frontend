import type { PublicStimulusView } from "@/api/publicTakeHomeQuiz";
import { questionRangeLabel } from "@/features/takeHomeQuizzes/editableStimulus";

/** One passage's run in display order - `first`/`last` are 0-based indexes into the displayed questions. */
export interface StimulusGroup {
  stimulus: PublicStimulusView;
  first: number;
  last: number;
  /** "Questions 3-7" in the student's own numbering. */
  rangeLabel: string;
  /** "Passage 2" / "Instruction 1" - numbered among its own kind, in display order. */
  name: string;
}

/**
 * Each linked stimulus's run in the order the questions are displayed (quiz-module.md Phase 20L). The
 * server shuffles a passage's questions as one block, so a run is contiguous; `first`/`last` still
 * take the min/max so a range label can never be wrong.
 */
export function stimulusGroups(
  questions: { stimulusId?: string | null }[],
  stimuli: PublicStimulusView[] | undefined,
): Map<string, StimulusGroup> {
  const byId = new Map((stimuli ?? []).map((stimulus) => [stimulus.id, stimulus]));
  const groups = new Map<string, StimulusGroup>();
  const counts = { PASSAGE: 0, INSTRUCTION: 0 };
  questions.forEach((question, index) => {
    const stimulus = question.stimulusId ? byId.get(question.stimulusId) : undefined;
    if (!stimulus) return;
    const existing = groups.get(stimulus.id);
    if (existing) {
      existing.last = index;
      existing.rangeLabel = questionRangeLabel(existing.first + 1, index + 1);
      return;
    }
    counts[stimulus.kind] += 1;
    groups.set(stimulus.id, {
      stimulus,
      first: index,
      last: index,
      rangeLabel: questionRangeLabel(index + 1, index + 1),
      name: `${stimulus.kind === "PASSAGE" ? "Passage" : "Instruction"} ${counts[stimulus.kind]}`,
    });
  });
  return groups;
}

/** Whether any displayed question reads from a passage - the hosts widen their column for the split view. */
export function hasPassages(attempt: { questions: { stimulusId?: string | null }[]; stimuli?: PublicStimulusView[] }) {
  const passageIds = new Set((attempt.stimuli ?? []).filter((s) => s.kind === "PASSAGE").map((s) => s.id));
  return attempt.questions.some((question) => !!question.stimulusId && passageIds.has(question.stimulusId));
}
