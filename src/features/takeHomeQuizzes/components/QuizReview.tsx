import { Fragment, type ReactNode, useMemo, useState } from "react";
import type { PublicStimulusView } from "@/api/publicTakeHomeQuiz";
import type { InteractionConfig, InteractionResponse, PartFeedback, QuestionType } from "@/api/takeHomeQuizzes";
import { RichContent } from "@/components/richText/RichContent";
import { Check, X } from "lucide-react";
import { pluginFor } from "@/features/takeHomeQuizzes/interactions/registry";
import { useParticipantNoun } from "@/components/ParticipantNoun";
import { StimulusPanel } from "@/features/takeHomeQuizzes/runner/StimulusPanel";
import { stimulusGroups } from "@/features/takeHomeQuizzes/runner/stimulusGroups";

export interface QuizReviewOption {
  id: string;
  label: string;
  correct: boolean;
}

export interface QuizReviewQuestion {
  id: string;
  position: number;
  questionType: QuestionType;
  prompt: string;
  points: number;
  options: QuizReviewOption[];
  /** Correct answer text for a FILL_IN_THE_GAP question - empty for a choice question. */
  acceptedAnswers: string[];
  selectedOptionIds: string[];
  textAnswer: string | null;
  awardedPoints: number | null;
  /** An interactive question's config (answer included), the response and its frozen per-part feedback. */
  interaction?: InteractionConfig | null;
  response?: InteractionResponse | null;
  parts?: PartFeedback[];
  /** The shared passage this question belongs to (Phase 20L). */
  stimulusId?: string | null;
}

interface QuizReviewProps {
  questions: QuizReviewQuestion[];
  /** The passages `questions` link to - each shown once, collapsed, above its first question. */
  stimuli?: PublicStimulusView[];
  renderImage: (fileId: string, alt: string) => ReactNode;
  /** "staff" (default) reads "Student's answer"; "self" reads "Your answer", for a student's own reveal-on-submit review. */
  perspective?: "staff" | "self";
}

/**
 * A per-question breakdown of one attempt, answer key included - shared by the teacher's
 * `StudentAnswersModal` and a student's own reveal-on-submit review (Phase 20K, both the token
 * and portal paths), so the three surfaces can never render this differently. Extracted from
 * `StudentAnswersModal`, which originally owned this rendering alone.
 */
export function QuizReview({ questions, stimuli, renderImage, perspective = "staff" }: QuizReviewProps) {
  const { Singular } = useParticipantNoun();
  const answerLabel = perspective === "self" ? "Your answer: " : `${Singular}'s answer: `;
  const groups = useMemo(() => stimulusGroups(questions, stimuli), [questions, stimuli]);
  // Collapsed by default here - the answers are what a review is for; the passage is one tap away.
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  return (
    <div className="space-y-6">
      {questions.map((question, index) => {
        const plugin = question.interaction ? pluginFor(question.questionType) : undefined;
        const group = question.stimulusId ? groups.get(question.stimulusId) : undefined;
        return (
          <Fragment key={question.id}>
          {group && group.first === index && (
            <StimulusPanel
              stimulus={group.stimulus}
              name={group.name}
              rangeLabel={group.rangeLabel}
              collapsed={!expanded.has(group.stimulus.id)}
              onToggle={() =>
                setExpanded((current) => {
                  const next = new Set(current);
                  if (next.has(group.stimulus.id)) next.delete(group.stimulus.id);
                  else next.add(group.stimulus.id);
                  return next;
                })
              }
              renderImage={renderImage}
              mode="review"
            />
          )}
          <div className="space-y-2 border-b border-slate-100 pb-4 last:border-0">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 font-medium text-slate-900">
                <span className="block text-xs font-normal text-slate-500">Question {question.position}</span>
                <RichContent html={question.prompt} renderImage={renderImage} className="space-y-2" />
              </div>
              <span className="shrink-0 text-sm text-slate-500">
                {question.awardedPoints ?? 0} / {question.points} pts
              </span>
            </div>

            {plugin && (
              <plugin.Review
                config={question.interaction}
                response={question.response ?? null}
                parts={question.parts ?? []}
                renderImage={renderImage}
                perspective={perspective}
              />
            )}

            {!plugin && question.questionType !== "FILL_IN_THE_GAP" && (
              <ul className="space-y-1 text-sm">
                {question.options.map((option) => {
                  const selected = question.selectedOptionIds.includes(option.id);
                  return (
                    <li
                      key={option.id}
                      className={`flex items-start gap-2 rounded-control border px-3 py-1.5 ${
                        option.correct
                          ? "border-green-300 bg-green-50"
                          : selected
                            ? "border-red-300 bg-red-50"
                            : "border-slate-200"
                      }`}
                    >
                      {option.correct ? (
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-green-600" aria-hidden="true" />
                      ) : selected ? (
                        <X className="mt-0.5 h-4 w-4 shrink-0 text-red-600" aria-hidden="true" />
                      ) : (
                        <span className="mt-0.5 h-4 w-4 shrink-0" />
                      )}
                      <RichContent html={option.label} renderImage={renderImage} className="min-w-0" />
                      {selected && <span className="ml-auto text-xs text-slate-500">Selected</span>}
                    </li>
                  );
                })}
              </ul>
            )}

            {question.questionType === "FILL_IN_THE_GAP" && (
              <div className="space-y-1 text-sm">
                <p>
                  <span className="text-slate-500">{answerLabel}</span>
                  {question.textAnswer ? question.textAnswer : <span className="text-slate-400">No answer</span>}
                </p>
                <p>
                  <span className="text-slate-500">Accepted answer: </span>
                  {question.acceptedAnswers.join(" / ")}
                </p>
              </div>
            )}
          </div>
          </Fragment>
        );
      })}
    </div>
  );
}
