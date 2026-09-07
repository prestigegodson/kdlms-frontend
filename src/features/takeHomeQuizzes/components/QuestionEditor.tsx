import { ChevronDown, ChevronUp, Plus, X } from "lucide-react";
import type { QuestionType } from "@/api/takeHomeQuizzes";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { FormField } from "@/components/ui/FormField";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { ChoiceOptionsField } from "@/features/takeHomeQuizzes/components/ChoiceOptionsField";
import { FillInTheGapField } from "@/features/takeHomeQuizzes/components/FillInTheGapField";
import { blankQuestion, type EditableQuestion } from "@/features/takeHomeQuizzes/editableQuestion";

const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  SINGLE_CHOICE: "Single choice",
  MULTI_CHOICE: "Multiple choice",
  FILL_IN_THE_GAP: "Fill in the gap",
};

interface QuestionEditorProps {
  questions: EditableQuestion[];
  onChange: (questions: EditableQuestion[]) => void;
  disabled?: boolean;
}

/**
 * The full ordered question list - each row keyed by the question's own
 * `key` (server id or local uid), never by index, since these rows carry
 * stable server identity under `ManageTakeHomeQuizzesUseCase`'s
 * id-preservation rule (unlike `PresentationStepsField`'s purely
 * positional rows, which key by index deliberately). Reordering is
 * up/down buttons rather than drag-and-drop - simpler, and the
 * `TemplateDesignerPage` canvas is this app's one drag-and-drop precedent,
 * reserved for a genuinely spatial layout tool.
 */
export function QuestionEditor({ questions, onChange, disabled = false }: QuestionEditorProps) {
  function updateAt(index: number, patch: Partial<EditableQuestion>) {
    onChange(questions.map((question, i) => (i === index ? { ...question, ...patch } : question)));
  }

  function removeAt(index: number) {
    onChange(questions.filter((_, i) => i !== index));
  }

  function moveUp(index: number) {
    if (index === 0) return;
    const next = [...questions];
    [next[index - 1], next[index]] = [next[index], next[index - 1]];
    onChange(next);
  }

  function moveDown(index: number) {
    if (index === questions.length - 1) return;
    const next = [...questions];
    [next[index], next[index + 1]] = [next[index + 1], next[index]];
    onChange(next);
  }

  function changeType(index: number, questionType: QuestionType) {
    const question = questions[index];
    if (questionType === question.questionType) return;
    if (questionType === "FILL_IN_THE_GAP") {
      updateAt(index, { questionType, options: [] });
    } else {
      updateAt(index, {
        questionType,
        answerKeys: [],
        options:
          question.options.length > 0
            ? question.options
            : [
                { key: crypto.randomUUID(), id: null, label: "", correct: false },
                { key: crypto.randomUUID(), id: null, label: "", correct: false },
              ],
      });
    }
  }

  return (
    <div className="space-y-4">
      {questions.map((question, index) => (
        <Card key={question.key} className="space-y-4">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-display text-sm font-medium text-slate-700">Question {index + 1}</h3>
            {!disabled && (
              <div className="flex gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  aria-label={`Move question ${index + 1} up`}
                  disabled={index === 0}
                  onClick={() => moveUp(index)}
                >
                  <ChevronUp className="h-4 w-4" aria-hidden="true" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  aria-label={`Move question ${index + 1} down`}
                  disabled={index === questions.length - 1}
                  onClick={() => moveDown(index)}
                >
                  <ChevronDown className="h-4 w-4" aria-hidden="true" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  aria-label={`Remove question ${index + 1}`}
                  onClick={() => removeAt(index)}
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </Button>
              </div>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
            <FormField label="Question type" htmlFor={`question-type-${question.key}`}>
              <Select
                id={`question-type-${question.key}`}
                value={question.questionType}
                onChange={(event) => changeType(index, event.target.value as QuestionType)}
                disabled={disabled}
              >
                {(Object.keys(QUESTION_TYPE_LABELS) as QuestionType[]).map((type) => (
                  <option key={type} value={type}>
                    {QUESTION_TYPE_LABELS[type]}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField label="Points" htmlFor={`question-points-${question.key}`} className="w-28">
              <Input
                id={`question-points-${question.key}`}
                type="number"
                min={1}
                step="1"
                value={question.points}
                onChange={(event) => updateAt(index, { points: event.target.value })}
                disabled={disabled}
              />
            </FormField>
          </div>

          <FormField label="Prompt" htmlFor={`question-prompt-${question.key}`}>
            <Textarea
              id={`question-prompt-${question.key}`}
              rows={2}
              value={question.prompt}
              onChange={(event) => updateAt(index, { prompt: event.target.value })}
              disabled={disabled}
            />
          </FormField>

          {question.questionType === "FILL_IN_THE_GAP" ? (
            <FillInTheGapField
              answerKeys={question.answerKeys}
              onChange={(answerKeys) => updateAt(index, { answerKeys })}
              disabled={disabled}
            />
          ) : (
            <ChoiceOptionsField
              questionType={question.questionType}
              options={question.options}
              onChange={(options) => updateAt(index, { options })}
              groupName={question.key}
              disabled={disabled}
            />
          )}
        </Card>
      ))}

      {!disabled && (
        <Button type="button" variant="secondary" onClick={() => onChange([...questions, blankQuestion()])}>
          <Plus className="h-4 w-4" aria-hidden="true" /> Add question
        </Button>
      )}
    </div>
  );
}
