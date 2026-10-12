import { Check, Library, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { getErrorMessage } from "@/api/client";
import type {
  QuestionBankItemView,
  QuestionBankQuery,
  QuestionCommand,
  QuestionType,
} from "@/api/takeHomeQuizzes";
import type { Page } from "@/api/types";
import { AuthenticatedRichImage } from "@/components/richText/AuthenticatedRichImage";
import { RichContent } from "@/components/richText/RichContent";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { FormField } from "@/components/ui/FormField";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Pagination } from "@/components/ui/Pagination";
import { SearchInput } from "@/components/ui/SearchInput";
import { Select } from "@/components/ui/Select";
import { Spinner } from "@/components/ui/Spinner";
import { QUESTION_TYPE_LABELS } from "@/features/takeHomeQuizzes/editableQuestion";
import { isInteractive } from "@/features/takeHomeQuizzes/interactions/registry";

/**
 * The calls the question bank needs - the school and creator editors pass their own endpoints (the
 * `QuestionImporter` precedent), so one modal and one "Save to bank" button serve both.
 */
export interface QuestionBankSource {
  search: (query: QuestionBankQuery, page: number) => Promise<Page<QuestionBankItemView>>;
  /** Copies the chosen items out as new, unsaved questions, in the order given. */
  add: (itemIds: string[]) => Promise<QuestionCommand[]>;
  /** Copies one editor question into the bank. */
  save: (question: QuestionCommand) => Promise<QuestionBankItemView>;
  remove: (itemId: string) => Promise<void>;
  /**
   * The quiz's own context the search starts narrowed to (its subject), with a label for the
   * filter - omitted when there's none to narrow by, such as a subject-group quiz.
   */
  context?: { label: string; query: QuestionBankQuery };
  /** Offer the "Only mine" filter - pointless in a creator's single-author bank. */
  offerMine?: boolean;
}

interface QuestionBankModalProps {
  open: boolean;
  onClose: () => void;
  bank: QuestionBankSource;
  /** Hands the copied, unsaved questions to the editor - the author saves them with the quiz. */
  onAdd: (questions: QuestionCommand[]) => void;
  /**
   * False when the plan lacks the interactive-questions add-on: interactive items stay listed but
   * can't be selected, since the server would refuse adding them (interaction-quiz.md §12).
   */
  interactiveAllowed?: boolean;
}

const TYPES = Object.keys(QUESTION_TYPE_LABELS) as QuestionType[];

/**
 * Search the question bank and add copies of the chosen questions to the quiz. A copy is never
 * linked to its bank item, so later edits on either side stay on that side.
 */
export function QuestionBankModal({
  open,
  onClose,
  bank,
  onAdd,
  interactiveAllowed = true,
}: QuestionBankModalProps) {
  const [scoped, setScoped] = useState(true);
  const [questionType, setQuestionType] = useState<QuestionType | "">("");
  const [tag, setTag] = useState("");
  const [text, setText] = useState("");
  const [mine, setMine] = useState(false);
  const [pageNumber, setPageNumber] = useState(0);
  // Bumped to search again with unchanged filters (after a delete).
  const [refreshToken, setRefreshToken] = useState(0);
  const [result, setResult] = useState<{
    key: string;
    page: Page<QuestionBankItemView> | null;
    error: string | null;
  }>({ key: "", page: null, error: null });
  const [actionError, setActionError] = useState<string | null>(null);
  // Selection order is the order the copies are added in.
  const [selected, setSelected] = useState<string[]>([]);
  const [adding, setAdding] = useState(false);
  const [deleting, setDeleting] = useState<QuestionBankItemView | null>(null);

  const { search, context } = bank;
  const query = useMemo<QuestionBankQuery>(
    () => ({
      ...(scoped && context ? context.query : {}),
      questionType: questionType || null,
      tag: tag.trim() || null,
      q: text.trim() || null,
      mine,
    }),
    [scoped, context, questionType, tag, text, mine],
  );
  const requestKey = `${JSON.stringify(query)}|${pageNumber}|${refreshToken}`;

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    search(query, pageNumber)
      .then((page) => {
        if (!cancelled) setResult({ key: requestKey, page, error: null });
      })
      .catch((loadError: unknown) => {
        if (!cancelled) {
          setResult({
            key: requestKey,
            page: null,
            error: getErrorMessage(loadError, "Failed to load the question bank."),
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [open, search, query, pageNumber, requestKey]);

  const loading = result.key !== requestKey;
  const page = result.page;
  const error = actionError ?? (loading ? null : result.error);

  function close() {
    setSelected([]);
    setActionError(null);
    onClose();
  }

  function filterChanged<T>(setter: (value: T) => void) {
    return (value: T) => {
      setter(value);
      setPageNumber(0);
    };
  }

  function toggle(itemId: string) {
    setSelected((current) =>
      current.includes(itemId) ? current.filter((id) => id !== itemId) : [...current, itemId],
    );
  }

  async function addSelected() {
    setAdding(true);
    setActionError(null);
    try {
      onAdd(await bank.add(selected));
      close();
    } catch (addError) {
      setActionError(getErrorMessage(addError, "Failed to add these questions."));
    } finally {
      setAdding(false);
    }
  }

  async function confirmDelete() {
    if (!deleting) return;
    await bank.remove(deleting.id);
    setSelected((current) => current.filter((id) => id !== deleting.id));
    setRefreshToken((token) => token + 1);
  }

  return (
    <Modal
      open={open}
      onClose={close}
      title="Add questions from the bank"
      size="xxl"
      fullScreenOnMobile
    >
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          {context && (
            <FormField label="Show" htmlFor="question-bank-scope">
              <Select
                id="question-bank-scope"
                value={scoped ? "context" : "all"}
                onChange={(event) => filterChanged(setScoped)(event.target.value === "context")}
              >
                <option value="context">{context.label} only</option>
                <option value="all">The whole bank</option>
              </Select>
            </FormField>
          )}
          <FormField label="Question type" htmlFor="question-bank-type">
            <Select
              id="question-bank-type"
              value={questionType}
              onChange={(event) =>
                filterChanged(setQuestionType)(event.target.value as QuestionType | "")
              }
            >
              <option value="">Any type</option>
              {TYPES.map((type) => (
                <option key={type} value={type}>
                  {QUESTION_TYPE_LABELS[type]}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label="Tag" htmlFor="question-bank-tag">
            <Input
              id="question-bank-tag"
              value={tag}
              placeholder="e.g. fractions"
              onChange={(event) => filterChanged(setTag)(event.target.value)}
            />
          </FormField>
          <FormField label="Search" htmlFor="question-bank-text">
            <SearchInput
              id="question-bank-text"
              value={text}
              onChange={filterChanged(setText)}
              placeholder="Words in the question"
            />
          </FormField>
        </div>
        {bank.offerMine && (
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <Checkbox
              checked={mine}
              onChange={(event) => filterChanged(setMine)(event.target.checked)}
            />
            Only questions I saved
          </label>
        )}

        {error && <Alert variant="error">{error}</Alert>}

        {loading && !page ? (
          <div className="flex justify-center py-8">
            <Spinner />
          </div>
        ) : page && page.content.length === 0 ? (
          <EmptyState
            icon={Library}
            title="No questions found"
            description="Save a question to the bank from any quiz, then add it to other quizzes from here."
          />
        ) : (
          page && (
            <ul className="space-y-3" aria-busy={loading}>
              {page.content.map((item) => (
                <BankItemRow
                  key={item.id}
                  item={item}
                  selected={selected.includes(item.id)}
                  locked={!interactiveAllowed && isInteractive(item.questionType)}
                  onToggle={() => toggle(item.id)}
                  onDelete={() => setDeleting(item)}
                />
              ))}
            </ul>
          )
        )}
        {page && page.totalPages > 1 && <Pagination page={page} onPageChange={setPageNumber} />}

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="secondary" onClick={close}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={() => void addSelected()}
            disabled={selected.length === 0}
            loading={adding}
          >
            {selected.length === 1 ? "Add 1 question" : `Add ${selected.length} questions`}
          </Button>
        </div>
      </div>

      {deleting && (
        <ConfirmDialog
          title="Delete from the bank?"
          message="Quizzes that already use this question keep their own copy."
          confirmLabel="Delete"
          variant="danger"
          onConfirm={confirmDelete}
          onClose={() => setDeleting(null)}
        />
      )}
    </Modal>
  );
}

interface BankItemRowProps {
  item: QuestionBankItemView;
  selected: boolean;
  /** An interactive item the plan can't add - shown, but not selectable. */
  locked: boolean;
  onToggle: () => void;
  onDelete: () => void;
}

function BankItemRow({ item, selected, locked, onToggle, onDelete }: BankItemRowProps) {
  const renderImage = (fileId: string, alt: string) => (
    <AuthenticatedRichImage fileId={fileId} alt={alt} />
  );
  const context =
    item.subjectLabel ?? [item.subjectName, item.levelName].filter(Boolean).join(" · ");
  const checkboxId = `question-bank-item-${item.id}`;
  return (
    <li
      className={`rounded-lg border p-3 sm:p-4 ${selected ? "border-brand-400 bg-brand-50/40" : "border-slate-200"}`}
    >
      <div className="flex items-start gap-3">
        <Checkbox
          id={checkboxId}
          checked={selected}
          disabled={locked}
          onChange={onToggle}
          aria-label={`Select question: ${item.prompt.replace(/<[^>]*>/g, " ").trim()}`}
          className="mt-1"
        />
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
            <Badge variant="brand">{QUESTION_TYPE_LABELS[item.questionType]}</Badge>
            {locked && <Badge variant="neutral">Not in your plan</Badge>}
            <span>
              {item.points} {Number(item.points) === 1 ? "point" : "points"}
            </span>
            {context && <span>· {context}</span>}
            {item.createdByName && <span>· by {item.createdByName}</span>}
          </div>
          <label htmlFor={checkboxId} className="block cursor-pointer text-sm text-slate-900">
            <RichContent html={item.prompt} renderImage={renderImage} />
          </label>
          {item.options.length > 0 && (
            <ul className="space-y-1 text-sm">
              {item.options.map((option, index) => (
                <li key={index} className="flex items-start gap-2">
                  {option.correct ? (
                    <Check
                      className="mt-0.5 h-4 w-4 shrink-0 text-green-600"
                      aria-label="Correct"
                    />
                  ) : (
                    <span className="h-4 w-4 shrink-0" aria-hidden="true" />
                  )}
                  <RichContent html={option.label} renderImage={renderImage} className="min-w-0" />
                </li>
              ))}
            </ul>
          )}
          {item.interaction && (
            <p className="text-sm text-slate-600">
              An interactive question - add it to the quiz to see and edit its parts.
            </p>
          )}
          {item.answerKeys.length > 0 && (
            <p className="text-sm text-slate-700">
              Answer: <span className="font-medium">{item.answerKeys.join(", ")}</span>
            </p>
          )}
          {item.tags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {item.tags.map((tag) => (
                <Badge key={tag}>{tag}</Badge>
              ))}
            </div>
          )}
        </div>
        {item.deletable && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-label="Delete from the bank"
            onClick={onDelete}
          >
            <Trash2 className="h-4 w-4" aria-hidden="true" />
          </Button>
        )}
      </div>
    </li>
  );
}
