import { BookmarkPlus, BookOpen, ChevronDown, ChevronUp, FileSpreadsheet, Library, Play, Plus, X } from "lucide-react";
import { Suspense, useState } from "react";
import { getErrorMessage } from "@/api/client";
import type { QuestionType, ScoringMode } from "@/api/takeHomeQuizzes";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { FormField } from "@/components/ui/FormField";
import { Input } from "@/components/ui/Input";
import { RichTextField } from "@/components/richText/RichTextField";
import { Select } from "@/components/ui/Select";
import { ChoiceOptionsField } from "@/features/takeHomeQuizzes/components/ChoiceOptionsField";
import { FillInTheGapField } from "@/features/takeHomeQuizzes/components/FillInTheGapField";
import { QuestionBankModal, type QuestionBankSource } from "@/features/takeHomeQuizzes/components/QuestionBankModal";
import { QuestionImportModal, type QuestionImporter } from "@/features/takeHomeQuizzes/components/QuestionImportModal";
import { QuestionTagsField } from "@/features/takeHomeQuizzes/components/QuestionTagsField";
import { TryInteractionModal } from "@/features/takeHomeQuizzes/components/TryInteractionModal";
import {
  blankQuestion,
  type EditableQuestion,
  fromQuestionCommand,
  isUntouchedQuestion,
  QUESTION_TYPE_LABELS,
  toQuestionCommand,
} from "@/features/takeHomeQuizzes/editableQuestion";
import {
  addQuestionToStimulus,
  blankStimulus,
  canMoveQuestion,
  type EditableStimulus,
  editorSections,
  moveQuestion,
  moveStimulusRun,
  questionRangeLabel,
  relinkQuestion,
  removeStimulus,
} from "@/features/takeHomeQuizzes/editableStimulus";
import { StimulusSectionHeader } from "@/features/takeHomeQuizzes/components/StimulusFields";
import { isInteractive, pluginFor } from "@/features/takeHomeQuizzes/interactions/registry";
import { useFeatureStore } from "@/stores/featureStore";

interface QuestionEditorProps {
  questions: EditableQuestion[];
  onChange: (questions: EditableQuestion[]) => void;
  disabled?: boolean;
  /**
   * Answer-key correction mode, once a quiz has submissions: only which answer is right and each
   * question's points stay editable - nothing a student sees, and no question added, removed or moved.
   */
  answerKeyOnly?: boolean;
  /** Offers "Import from file" (a csv/xlsx/xls bulk upload) when given - see `QuestionImportModal`. */
  importer?: QuestionImporter;
  /**
   * Offers "Add from bank" and a per-question "Save to bank" when given - see `QuestionBankModal`.
   * Saving stays available while the questions are read-only, since anyone who can read a quiz may
   * bank its questions.
   */
  bank?: QuestionBankSource;
  /**
   * The quiz's shared passages and group instructions (Phase 20L). Offering "Add passage" and each
   * question's "Passage" link needs `onStimuliChange` too; without it the editor shows no passages.
   */
  stimuli?: EditableStimulus[];
  /**
   * Called alongside `onChange` whenever passages change - both in the same handler, so React
   * batches them into one render and the two lists never disagree.
   */
  onStimuliChange?: (stimuli: EditableStimulus[]) => void;
}

type BankSaveStatus = { kind: "saving" } | { kind: "saved" } | { kind: "error"; message: string };

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
export function QuestionEditor({
  questions,
  onChange,
  disabled = false,
  answerKeyOnly = false,
  importer,
  bank,
  stimuli = [],
  onStimuliChange,
}: QuestionEditorProps) {
  // What a student sees - the question set, prompts, options, tags - stays locked while correcting.
  const structureDisabled = disabled || answerKeyOnly;
  const [importOpen, setImportOpen] = useState(false);
  const [bankOpen, setBankOpen] = useState(false);
  const [bankStatus, setBankStatus] = useState<Record<string, BankSaveStatus>>({});
  const [tryingKey, setTryingKey] = useState<string | null>(null);
  const trying = questions.find((question) => question.key === tryingKey);
  // The INTERACTIVE_QUESTIONS add-on gates authoring them; a question keeps showing its own type,
  // so a downgraded tenant can still keep the ones a quiz already holds (interaction-quiz.md §12).
  const interactiveAllowed = useFeatureStore((state) => state.interactiveQuestions);

  function setStatus(key: string, status: BankSaveStatus) {
    setBankStatus((current) => ({ ...current, [key]: status }));
  }

  async function saveToBank(question: EditableQuestion) {
    if (!bank) return;
    setStatus(question.key, { kind: "saving" });
    try {
      await bank.save(toQuestionCommand(question));
      setStatus(question.key, { kind: "saved" });
    } catch (error) {
      setStatus(question.key, { kind: "error", message: getErrorMessage(error, "Failed to save to the bank.") });
    }
  }

  /** Appended after the questions already written; an empty row never filled in is dropped rather than left above them. */
  function append(added: EditableQuestion[]) {
    onChange([...questions.filter((question) => !isUntouchedQuestion(question)), ...added]);
  }

  function updateAt(index: number, patch: Partial<EditableQuestion>) {
    onChange(questions.map((question, i) => (i === index ? { ...question, ...patch } : question)));
  }

  function removeAt(index: number) {
    onChange(questions.filter((_, i) => i !== index));
  }

  const passagesEnabled = onStimuliChange !== undefined;

  function addStimulus() {
    if (!onStimuliChange) return;
    const stimulus = blankStimulus("PASSAGE");
    onStimuliChange([...stimuli, stimulus]);
    // A new passage starts with one question of its own, so it is never an empty, unpublishable shell.
    onChange([
      ...questions.filter((question) => !isUntouchedQuestion(question)),
      { ...blankQuestion(), stimulusKey: stimulus.key },
    ]);
  }

  function updateStimulus(key: string, patch: Partial<EditableStimulus>) {
    onStimuliChange?.(stimuli.map((stimulus) => (stimulus.key === key ? { ...stimulus, ...patch } : stimulus)));
  }

  function deleteStimulus(key: string, keepQuestions: boolean) {
    const next = removeStimulus(stimuli, questions, key, keepQuestions);
    onStimuliChange?.(next.stimuli);
    onChange(next.questions);
  }

  const sections = editorSections(stimuli, questions);
  // Passages are numbered among themselves, instructions among themselves - "Passage 2", "Instruction 1".
  const stimulusNumbers = new Map<string, number>();
  const kindCounts = { PASSAGE: 0, INSTRUCTION: 0 };
  for (const section of sections) {
    if (section.kind === "stimulus") {
      kindCounts[section.stimulus.kind] += 1;
      stimulusNumbers.set(section.stimulus.key, kindCounts[section.stimulus.kind]);
    }
  }
  const stimulusName = (stimulus: EditableStimulus) =>
    `${stimulus.kind === "PASSAGE" ? "Passage" : "Instruction"} ${stimulusNumbers.get(stimulus.key) ?? ""}`.trim();
  const stimulusSections = sections.filter((section) => section.kind === "stimulus");

  function changeType(index: number, questionType: QuestionType) {
    const question = questions[index];
    if (questionType === question.questionType) return;
    const plugin = pluginFor(questionType);
    if (plugin) {
      updateAt(index, { questionType, options: [], answerKeys: [], interaction: plugin.blank(), scoring: "PARTIAL" });
    } else if (questionType === "FILL_IN_THE_GAP") {
      updateAt(index, { questionType, options: [], interaction: null, scoring: null });
    } else {
      updateAt(index, {
        questionType,
        answerKeys: [],
        interaction: null,
        scoring: null,
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

  function renderQuestion(question: EditableQuestion, index: number) {
    return (
    <Card key={question.key} className="space-y-4">
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-display text-sm font-medium text-slate-700">Question {index + 1}</h3>
        <div className="flex flex-wrap items-center justify-end gap-1">
          {bank && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              aria-label={`Save question ${index + 1} to the bank`}
              loading={bankStatus[question.key]?.kind === "saving"}
              onClick={() => void saveToBank(question)}
            >
              <BookmarkPlus className="h-4 w-4" aria-hidden="true" />
              <span className="hidden sm:inline">Save to bank</span>
            </Button>
          )}
          {!structureDisabled && (
            <div className="flex gap-1">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                aria-label={`Move question ${index + 1} up`}
                disabled={!canMoveQuestion(questions, index, -1)}
                onClick={() => onChange(moveQuestion(questions, index, -1))}
              >
                <ChevronUp className="h-4 w-4" aria-hidden="true" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                aria-label={`Move question ${index + 1} down`}
                disabled={!canMoveQuestion(questions, index, 1)}
                onClick={() => onChange(moveQuestion(questions, index, 1))}
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
      </div>
      <BankStatusMessage status={bankStatus[question.key]} />

      <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
        <FormField label="Question type" htmlFor={`question-type-${question.key}`}>
          <Select
            id={`question-type-${question.key}`}
            value={question.questionType}
            onChange={(event) => changeType(index, event.target.value as QuestionType)}
            disabled={structureDisabled}
          >
            {(Object.keys(QUESTION_TYPE_LABELS) as QuestionType[])
              .filter(
                (type) =>
                  interactiveAllowed || !isInteractive(type) || type === question.questionType,
              )
              .map((type) => (
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
        <RichTextField
          id={`question-prompt-${question.key}`}
          value={question.prompt}
          onChange={(prompt) => updateAt(index, { prompt })}
          allowImages
          disabled={structureDisabled}
          ariaLabel={`Question ${index + 1} prompt`}
        />
      </FormField>

      {question.interaction && pluginFor(question.questionType) ? (
        <InteractionFields
          question={question}
          index={index}
          disabled={disabled}
          answerOnly={answerKeyOnly}
          onChange={(patch) => updateAt(index, patch)}
          onTry={() => setTryingKey(question.key)}
        />
      ) : question.questionType === "FILL_IN_THE_GAP" ? (
        <FillInTheGapField
          answerKeys={question.answerKeys}
          onChange={(answerKeys) => updateAt(index, { answerKeys })}
          disabled={disabled}
        />
      ) : (
        <ChoiceOptionsField
          questionType={question.questionType as "SINGLE_CHOICE" | "MULTI_CHOICE"}
          options={question.options}
          onChange={(options) => updateAt(index, { options })}
          groupName={question.key}
          disabled={disabled}
          answerOnly={answerKeyOnly}
        />
      )}

      {passagesEnabled && stimuli.length > 0 && (
        <FormField label="Passage" htmlFor={`question-stimulus-${question.key}`} className="sm:max-w-sm">
          <Select
            id={`question-stimulus-${question.key}`}
            value={question.stimulusKey ?? ""}
            onChange={(event) => onChange(relinkQuestion(questions, index, event.target.value || null))}
            disabled={structureDisabled}
          >
            <option value="">None - a standalone question</option>
            {stimulusSections.map((section) => (
              <option key={section.stimulus.key} value={section.stimulus.key}>
                {stimulusName(section.stimulus)}
                {section.stimulus.title.trim() ? ` - ${section.stimulus.title.trim()}` : ""}
              </option>
            ))}
          </Select>
        </FormField>
      )}

      <QuestionTagsField
        id={`question-tags-${question.key}`}
        tags={question.tags}
        onChange={(tags) => updateAt(index, { tags })}
        disabled={structureDisabled}
      />
    </Card>
    );
  }

  return (
    <div className="space-y-4">
      {sections.map((section) => {
        if (section.kind === "question") return renderQuestion(section.question, section.index);
        const { stimulus } = section;
        const first = section.questions[0]?.index;
        const last = section.questions[section.questions.length - 1]?.index;
        const range = first === undefined || last === undefined ? null : questionRangeLabel(first + 1, last + 1);
        return (
          <section
            key={stimulus.key}
            aria-label={stimulusName(stimulus)}
            className="space-y-4 rounded-card border-2 border-brand-100 bg-brand-50/40 p-2 sm:p-4"
          >
            <StimulusSectionHeader
              stimulus={stimulus}
              name={stimulusName(stimulus)}
              range={range}
              disabled={structureDisabled}
              canMoveUp={first !== undefined && first > 0}
              canMoveDown={last !== undefined && last < questions.length - 1}
              onMove={(direction) => onChange(moveStimulusRun(questions, stimulus.key, direction))}
              onChange={(patch) => updateStimulus(stimulus.key, patch)}
              onRemove={(keepQuestions) => deleteStimulus(stimulus.key, keepQuestions)}
              questionCount={section.questions.length}
            />
            {section.questions.map(({ question, index }) => renderQuestion(question, index))}
            {section.questions.length === 0 && (
              <p className="px-2 text-sm text-slate-600">
                This {stimulus.kind === "PASSAGE" ? "passage" : "instruction"} has no questions yet.
              </p>
            )}
            {!structureDisabled && (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => onChange(addQuestionToStimulus(questions, stimulus.key))}
              >
                <Plus className="h-4 w-4" aria-hidden="true" /> Add question to {stimulusName(stimulus).toLowerCase()}
              </Button>
            )}
          </section>
        );
      })}

      {!structureDisabled && (
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="secondary" onClick={() => onChange([...questions, blankQuestion()])}>
            <Plus className="h-4 w-4" aria-hidden="true" /> Add question
          </Button>
          {passagesEnabled && (
            <Button type="button" variant="secondary" onClick={addStimulus}>
              <BookOpen className="h-4 w-4" aria-hidden="true" /> Add passage / instruction
            </Button>
          )}
          {importer && (
            <Button type="button" variant="secondary" onClick={() => setImportOpen(true)}>
              <FileSpreadsheet className="h-4 w-4" aria-hidden="true" /> Import from file
            </Button>
          )}
          {bank && (
            <Button type="button" variant="secondary" onClick={() => setBankOpen(true)}>
              <Library className="h-4 w-4" aria-hidden="true" /> Add from bank
            </Button>
          )}
        </div>
      )}

      {importer && (
        <QuestionImportModal
          open={importOpen}
          onClose={() => setImportOpen(false)}
          importer={importer}
          onImport={(imported) => append(imported.map(fromQuestionCommand))}
        />
      )}

      {trying && <TryInteractionModal question={trying} onClose={() => setTryingKey(null)} />}

      {bank && (
        <QuestionBankModal
          open={bankOpen}
          onClose={() => setBankOpen(false)}
          bank={bank}
          interactiveAllowed={interactiveAllowed}
          onAdd={(added) => append(added.map(fromQuestionCommand))}
        />
      )}
    </div>
  );
}

/** An interactive question's own fields - its plugin's `Author`, its scoring mode and a "Try it" preview. */
function InteractionFields({
  question,
  index,
  disabled,
  answerOnly,
  onChange,
  onTry,
}: {
  question: EditableQuestion;
  index: number;
  disabled: boolean;
  answerOnly: boolean;
  onChange: (patch: Partial<EditableQuestion>) => void;
  onTry: () => void;
}) {
  const plugin = pluginFor(question.questionType);
  if (!plugin) return null;
  const { Author } = plugin;
  return (
    <div className="space-y-4">
      <Suspense fallback={<p className="text-sm text-slate-500">Loading...</p>}>
        <Author
          value={question.interaction}
          onChange={(interaction) => onChange({ interaction })}
          disabled={disabled}
          answerOnly={answerOnly}
          idPrefix={`question-${question.key}`}
        />
      </Suspense>
      <div className="flex flex-wrap items-end gap-3">
        <FormField label="Scoring" htmlFor={`question-scoring-${question.key}`} className="w-64">
          <Select
            id={`question-scoring-${question.key}`}
            value={question.scoring ?? "PARTIAL"}
            onChange={(event) => onChange({ scoring: event.target.value as ScoringMode })}
            disabled={disabled || answerOnly}
          >
            <option value="PARTIAL">Partial credit for each part right</option>
            <option value="ALL_OR_NOTHING">All or nothing</option>
          </Select>
        </FormField>
        <Button type="button" variant="secondary" size="sm" onClick={onTry} aria-label={`Try question ${index + 1}`}>
          <Play className="h-4 w-4" aria-hidden="true" /> Try it
        </Button>
      </div>
    </div>
  );
}

function BankStatusMessage({ status }: { status: BankSaveStatus | undefined }) {
  if (status?.kind === "saved") {
    return (
      <p role="status" className="text-xs text-green-700">
        Saved to the question bank.
      </p>
    );
  }
  if (status?.kind === "error") {
    return (
      <p role="alert" className="text-xs text-red-700">
        {status.message}
      </p>
    );
  }
  return null;
}
