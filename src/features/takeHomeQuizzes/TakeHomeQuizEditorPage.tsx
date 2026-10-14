import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router";
import {
  addTakeHomeQuizQuestionsFromBank,
  createTakeHomeQuiz,
  deleteQuestionBankItem,
  deleteTakeHomeQuiz,
  fetchQuestionTemplate,
  getShareableClasses,
  getTakeHomeQuiz,
  getTakeHomeQuizValidation,
  importTakeHomeQuizQuestions,
  type PublishReadinessView,
  type QuizType,
  saveTakeHomeQuizQuestions,
  saveTakeHomeQuizQuestionToBank,
  searchQuestionBank,
  type SharedClassView,
  type TakeHomeQuizView,
  updateTakeHomeQuiz,
} from "@/api/takeHomeQuizzes";
import { ApiError } from "@/api/client";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { ShuffleFields } from "@/features/takeHomeQuizzes/components/ShuffleFields";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { FormField } from "@/components/ui/FormField";
import { Input } from "@/components/ui/Input";
import { PageHeader } from "@/components/ui/PageHeader";
import { targetKeyOf } from "@/features/academics/subjectTarget";
import { Select } from "@/components/ui/Select";
import { Spinner } from "@/components/ui/Spinner";
import { Textarea } from "@/components/ui/Textarea";
import { UnsavedChangesBar } from "@/features/assessments/components/UnsavedChangesBar";
import { PublishQuizModal } from "@/features/takeHomeQuizzes/components/PublishQuizModal";
import { PublishReadinessPanel } from "@/features/takeHomeQuizzes/components/PublishReadinessPanel";
import type { QuestionBankSource } from "@/features/takeHomeQuizzes/components/QuestionBankModal";
import { QuestionEditor } from "@/features/takeHomeQuizzes/components/QuestionEditor";
import { QuizPreviewModal } from "@/features/takeHomeQuizzes/components/QuizPreviewModal";
import { QuestionTemplateDownload } from "@/features/takeHomeQuizzes/components/QuestionImportModal";
import { QuizWindowFields } from "@/features/takeHomeQuizzes/components/QuizWindowFields";
import { ShareQuizModal } from "@/features/takeHomeQuizzes/components/ShareQuizModal";
import { StudentLinksPanel } from "@/features/takeHomeQuizzes/components/StudentLinksPanel";
import { type EditableQuestion, toEditableQuestion, toQuestionCommand } from "@/features/takeHomeQuizzes/editableQuestion";
import { TAKE_HOME_QUIZ_FIELD_HELP } from "@/features/takeHomeQuizzes/takeHomeQuizFieldHelp";
import { NO_THEME, type ThemeChoice } from "@/features/takeHomeQuizzes/theme/themeChoice";
import { ThemeSection } from "@/features/takeHomeQuizzes/theme/ThemeSection";

interface FormState {
  title: string;
  instructions: string;
  quizType: QuizType;
  timed: boolean;
  durationMinutes: string;
  opensAt: string;
  closesAt: string;
  revealResultsOnSubmit: boolean;
  shuffleQuestions: boolean;
  shuffleChoices: boolean;
  /** The other arms of the home class's level a Normal quiz is shared with - never the home class itself. */
  sharedClassIds: string[];
  theme: ThemeChoice;
  questions: EditableQuestion[];
}

function nowPlusHours(hours: number): string {
  return new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
}

function blankForm(): FormState {
  return {
    title: "",
    instructions: "",
    quizType: "NORMAL",
    timed: false,
    durationMinutes: "",
    opensAt: nowPlusHours(24),
    closesAt: nowPlusHours(24 * 8),
    revealResultsOnSubmit: false,
    shuffleQuestions: false,
    shuffleChoices: false,
    sharedClassIds: [],
    theme: NO_THEME,
    questions: [],
  };
}

function fromView(view: TakeHomeQuizView): FormState {
  return {
    title: view.title,
    instructions: view.instructions ?? "",
    quizType: view.quizType,
    timed: view.timed,
    durationMinutes: view.durationMinutes !== null ? String(view.durationMinutes) : "",
    opensAt: view.opensAt,
    closesAt: view.closesAt,
    revealResultsOnSubmit: view.revealResultsOnSubmit,
    shuffleQuestions: view.shuffleQuestions,
    shuffleChoices: view.shuffleChoices,
    sharedClassIds: (view.classes ?? [])
      .map((sharedClass) => sharedClass.classId)
      .filter((id) => id !== view.classId),
    theme: { themeId: view.themeId ?? null, themePreset: view.themePreset ?? null },
    questions: view.questions.map(toEditableQuestion),
  };
}

function snapshotOf(form: FormState): string {
  return JSON.stringify(form);
}

/**
 * Author/edit one take-home quiz - addressed either by a real `quizId`
 * (hydrated via `getTakeHomeQuiz`) or the literal `"new"` plus
 * `?classId=&subjectId=&termId=` (or `subjectGroupId=` for a subject-group
 * quiz, which is always Normal) in the query string (a not-yet-created
 * quiz has no id to route on yet), the `LessonNoteEditorPage` pattern. A
 * `JSON.stringify` snapshot drives `dirty`, not per-field flags - same
 * reason: fewer places a field can be added and forgotten.
 * <p>
 * Save is one combined action across two backend endpoints (metadata,
 * then the question set) - `ManageTakeHomeQuizzesUseCase.update`/`create`
 * followed by `saveQuestions` - since the teacher experiences this as one
 * "Save" rather than two independent forms.
 */
export function TakeHomeQuizEditorPage() {
  const { quizId } = useParams<{ quizId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const classId = searchParams.get("classId") ?? "";
  const subjectId = searchParams.get("subjectId") ?? "";
  const subjectGroupId = searchParams.get("subjectGroupId") ?? "";
  const termId = searchParams.get("termId") ?? "";
  const isNew = !quizId || quizId === "new";

  const [quiz, setQuiz] = useState<TakeHomeQuizView | null>(null);
  const [form, setForm] = useState<FormState>(blankForm());
  const [snapshot, setSnapshot] = useState(() => snapshotOf(blankForm()));
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveNotice, setSaveNotice] = useState<string | null>(null);
  // Bumped on every save outcome so a repeated, identical error still scrolls back into view -
  // Save lives in the sticky bar at the bottom, the feedback under the page header.
  const [feedbackSeq, setFeedbackSeq] = useState(0);
  const feedbackRef = useRef<HTMLDivElement>(null);
  const [saving, setSaving] = useState(false);
  const [readiness, setReadiness] = useState<PublishReadinessView | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [publishModalOpen, setPublishModalOpen] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [shareNotice, setShareNotice] = useState<string | null>(null);
  const [linksRefreshToken, setLinksRefreshToken] = useState(0);

  // Memoized: the bank modal re-searches whenever its `search` or `context` changes identity.
  const quizIdForBank = quiz?.id ?? null;
  const bankSubjectId = quiz?.subjectId ?? null;
  const bankSubjectName = quiz?.subjectName ?? "";
  const bank = useMemo<QuestionBankSource | undefined>(() => {
    if (!quizIdForBank) return undefined;
    return {
      search: searchQuestionBank,
      add: (itemIds) => addTakeHomeQuizQuestionsFromBank(quizIdForBank, itemIds),
      save: (question) => saveTakeHomeQuizQuestionToBank(quizIdForBank, question),
      remove: deleteQuestionBankItem,
      // A subject-group quiz has no one subject to narrow the bank to.
      context: bankSubjectId ? { label: bankSubjectName, query: { subjectId: bankSubjectId } } : undefined,
      offerMine: true,
    };
  }, [quizIdForBank, bankSubjectId, bankSubjectName]);

  useEffect(() => {
    if (feedbackSeq === 0) return;
    // jsdom (the test environment) has no scrollIntoView implementation at all - guard past it
    feedbackRef.current?.scrollIntoView?.({ behavior: "smooth", block: "center" });
  }, [feedbackSeq]);

  useEffect(() => {
    if (isNew) return;
    getTakeHomeQuiz(quizId).then(applyQuiz).catch((error: unknown) => {
      setLoadError(error instanceof ApiError ? error.message : "Failed to load this quiz");
    });
  }, [quizId, isNew]);

  useEffect(() => {
    if (isNew || !quiz) return;
    getTakeHomeQuizValidation(quiz.id).then(setReadiness).catch(() => setReadiness(null));
  }, [isNew, quiz]);

  const loading = !isNew && !quiz && !loadError;
  const showForm = !loadError && (isNew || quiz !== null);
  const readOnly = quiz ? !quiz.actions.canEditMetadata : false;
  const questionsReadOnly = quiz ? !quiz.actions.canEditQuestions : false;
  // Once a submission exists, only `closesAt` (extend-only) and `revealResultsOnSubmit` stay
  // editable - everything else metadata-shaped locks alongside the question set. `readOnly` (the
  // quiz is archived) locks every field including those two.
  const locked = readOnly || questionsReadOnly;
  const dirty = snapshotOf(form) !== snapshot;
  // A subject-group quiz is always Normal - a midterm score belongs to exactly one subject.
  const isGroupQuiz = isNew ? subjectGroupId !== "" : quiz?.subjectGroupId != null;

  // The other arms of the level a Normal quiz may be shared with, loaded for whoever may change it.
  // A quiz shared with other classes is always Normal - a midterm score belongs to one class.
  const homeClassId = quiz?.classId ?? classId;
  const targetSubjectId = quiz ? quiz.subjectId : subjectGroupId ? null : subjectId || null;
  const targetGroupId = quiz ? quiz.subjectGroupId : subjectGroupId || null;
  const shareKey =
    homeClassId && (targetSubjectId || targetGroupId) && (isNew || quiz?.writable)
      ? `${homeClassId}|${targetSubjectId ?? ""}|${targetGroupId ?? ""}`
      : null;
  const [loadedArms, setLoadedArms] = useState<{ key: string; classes: SharedClassView[] } | null>(null);
  const shareableClasses = shareKey && loadedArms?.key === shareKey ? loadedArms.classes : [];
  const isShared = form.sharedClassIds.length > 0;
  useEffect(() => {
    if (!shareKey) return;
    let cancelled = false;
    getShareableClasses(homeClassId, { subjectId: targetSubjectId, subjectGroupId: targetGroupId })
      .then((classes) => {
        if (!cancelled) setLoadedArms({ key: shareKey, classes });
      })
      .catch(() => {
        // Not being able to list the other arms only hides the picker; the quiz still saves for its home class.
        if (!cancelled) setLoadedArms({ key: shareKey, classes: [] });
      });
    return () => {
      cancelled = true;
    };
    // `homeClassId` and the target are both encoded in `shareKey`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shareKey]);

  function toggleSharedClass(sharedClassId: string) {
    const next = form.sharedClassIds.includes(sharedClassId)
      ? form.sharedClassIds.filter((id) => id !== sharedClassId)
      : [...form.sharedClassIds, sharedClassId];
    setForm({ ...form, sharedClassIds: next });
  }

  /** Every class the quiz should reach, the home class first - `undefined` (leave unchanged) when the arms couldn't be listed. */
  function chosenClassIds(): string[] | undefined {
    if (shareableClasses.length === 0) return undefined;
    if (form.quizType !== "NORMAL") return [homeClassId];
    const offered = new Set(shareableClasses.map((sharedClass) => sharedClass.classId));
    return [homeClassId, ...form.sharedClassIds.filter((id) => id !== homeClassId && offered.has(id))];
  }

  function applyQuiz(loaded: TakeHomeQuizView) {
    setQuiz(loaded);
    const next = fromView(loaded);
    setForm(next);
    setSnapshot(snapshotOf(next));
  }

  function discard() {
    const next = quiz ? fromView(quiz) : blankForm();
    setForm(next);
    setSnapshot(snapshotOf(next));
    setSaveNotice(null);
  }

  async function save() {
    setSaving(true);
    setSaveError(null);
    setSaveNotice(null);
    try {
      const durationMinutes = form.timed && form.durationMinutes ? Number(form.durationMinutes) : null;
      let saved: TakeHomeQuizView;
      if (isNew) {
        saved = await createTakeHomeQuiz({
          classId,
          subjectId: subjectGroupId ? null : subjectId,
          subjectGroupId: subjectGroupId || null,
          termId,
          title: form.title,
          instructions: form.instructions || null,
          quizType: form.quizType,
          timed: form.timed,
          durationMinutes,
          opensAt: form.opensAt,
          closesAt: form.closesAt,
          revealResultsOnSubmit: form.revealResultsOnSubmit,
          shuffleQuestions: form.shuffleQuestions,
          shuffleChoices: form.shuffleChoices,
          classIds: chosenClassIds(),
          ...form.theme,
        });
      } else {
        saved = await updateTakeHomeQuiz(quiz!.id, {
          title: form.title,
          instructions: form.instructions || null,
          quizType: form.quizType,
          timed: form.timed,
          durationMinutes,
          opensAt: form.opensAt,
          closesAt: form.closesAt,
          revealResultsOnSubmit: form.revealResultsOnSubmit,
          shuffleQuestions: form.shuffleQuestions,
          shuffleChoices: form.shuffleChoices,
          classIds: chosenClassIds(),
          ...form.theme,
        });
      }
      if (form.questions.length > 0 || (quiz && quiz.questions.length > 0)) {
        saved = await saveTakeHomeQuizQuestions(
          saved.id,
          form.questions.map(toQuestionCommand),
        );
      }
      applyQuiz(saved);
      setSaveNotice("Quiz saved.");
      if (isNew) {
        const target = subjectGroupId ? `subjectGroupId=${subjectGroupId}` : `subjectId=${subjectId}`;
        navigate(`/school/take-home-quizzes/${saved.id}?classId=${classId}&${target}&termId=${termId}`, {
          replace: true,
        });
      }
    } catch (error) {
      setSaveError(error instanceof ApiError ? error.message : "Failed to save this quiz");
    } finally {
      setSaving(false);
      setFeedbackSeq((seq) => seq + 1);
    }
  }

  // Back to the list filtered to this quiz's class (and, when we came from the list's own
  // filters, its subject) - `TakeHomeQuizzesPage` seeds its filters from these params.
  const listClassId = classId || quiz?.classId || "";
  const listTargetKey = targetKeyOf({ subjectId: subjectId || null, subjectGroupId: subjectGroupId || null });
  const listParams = new URLSearchParams();
  if (listClassId) listParams.set("classId", listClassId);
  if (listClassId && listTargetKey) listParams.set("subjectId", listTargetKey);
  const listPath = `/school/take-home-quizzes${listParams.size ? `?${listParams.toString()}` : ""}`;

  async function handleDelete() {
    if (!quiz) return;
    await deleteTakeHomeQuiz(quiz.id);
    setConfirmDelete(false);
    navigate(listPath);
  }

  /** The modal itself stays open to show the outcome - closed only when the user dismisses it. */
  function handlePublished() {
    setLinksRefreshToken((token) => token + 1);
    if (quiz) {
      getTakeHomeQuiz(quiz.id).then(applyQuiz);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <Spinner /> Loading quiz…
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-24">
      <PageHeader
        title={isNew ? "New CBT/Quiz" : form.title || "CBT/Quiz"}
        description={isNew ? "Set up a new CBT/Quiz for this class." : undefined}
        backTo={listPath}
        backLabel="Back to CBT/Quizzes"
        actions={
          quiz && (
            <div className="flex flex-wrap items-center gap-2">
              {form.questions.length > 0 && (
                <Button variant="secondary" onClick={() => setPreviewOpen(true)}>
                  Preview
                </Button>
              )}
              {quiz.status !== "DRAFT" && (
                <Button variant="secondary" onClick={() => navigate(`/school/take-home-quizzes/${quiz.id}/results`)}>
                  Results
                </Button>
              )}
              {quiz.actions.canShare && (
                <Button
                  variant="secondary"
                  onClick={() => setSharing(true)}
                  disabled={dirty}
                  title={dirty ? "Save your changes first - the saved quiz is what gets shared." : undefined}
                >
                  Share to another class
                </Button>
              )}
              {quiz.actions.canPublish && (
                <Button variant="accent" onClick={() => setPublishModalOpen(true)}>
                  Publish
                </Button>
              )}
              {quiz.actions.canDelete && (
                <Button variant="danger" onClick={() => setConfirmDelete(true)}>
                  Delete
                </Button>
              )}
            </div>
          )
        }
      />

      <div ref={feedbackRef} className="space-y-6 empty:hidden">
        {loadError && <Alert variant="error">{loadError}</Alert>}
        {saveError && <Alert variant="error">{saveError}</Alert>}
        {/* Hidden again once there are fresh unsaved changes, so it never claims stale edits are saved. */}
        {saveNotice && !dirty && <Alert variant="success">{saveNotice}</Alert>}
        {shareNotice && <Alert variant="success">{shareNotice}</Alert>}
      </div>

      {showForm && (
        <div className="max-w-2xl space-y-6">
          {quiz && !quiz.writable && quiz.subjectGroupId && (
            <Alert variant="info">
              This quiz covers the whole {quiz.subjectName} subject group. Only the class teacher or an
              administrator can change it.
            </Alert>
          )}
          {quiz && !quiz.writable && !quiz.subjectGroupId && (
            <Alert variant="info">
              This quiz is shared with your class from {quiz.className}. Only its own teacher or an
              administrator can change it.
            </Alert>
          )}
          {questionsReadOnly && !readOnly && (
            <Alert variant="info">
              Pupils have already submitted this quiz. Only the closing date (later only) and the
              reveal setting below can still be changed.
            </Alert>
          )}

          <FormField label="Title" htmlFor="quiz-title" description={TAKE_HOME_QUIZ_FIELD_HELP.title}>
            <Input
              id="quiz-title"
              value={form.title}
              onChange={(event) => setForm({ ...form, title: event.target.value })}
              disabled={locked}
            />
          </FormField>

          <FormField label="Instructions" htmlFor="quiz-instructions" description={TAKE_HOME_QUIZ_FIELD_HELP.instructions}>
            <Textarea
              id="quiz-instructions"
              rows={3}
              value={form.instructions}
              onChange={(event) => setForm({ ...form, instructions: event.target.value })}
              disabled={locked}
            />
          </FormField>

          <FormField label="Quiz type" htmlFor="quiz-type" description={TAKE_HOME_QUIZ_FIELD_HELP.quizType}>
            <Select
              id="quiz-type"
              value={form.quizType}
              onChange={(event) => setForm({ ...form, quizType: event.target.value as QuizType })}
              disabled={questionsReadOnly || isGroupQuiz}
            >
              <option value="NORMAL">Normal</option>
              {!isGroupQuiz && (
                <option value="MIDTERM" disabled={isShared}>
                  Midterm{isShared ? " (not for a quiz shared with other classes)" : ""}
                </option>
              )}
            </Select>
          </FormField>

          {shareableClasses.length > 1 && form.quizType === "NORMAL" && (
            <FormField label="Classes" htmlFor={`quiz-class-${homeClassId}`}>
              <div className="flex flex-wrap gap-x-4 gap-y-2">
                {shareableClasses.map((sharedClass) => {
                  const isHome = sharedClass.classId === homeClassId;
                  const checked = isHome || form.sharedClassIds.includes(sharedClass.classId);
                  // Once students have submitted, a class can be added but not removed.
                  const keptBySubmissions =
                    questionsReadOnly && (quiz?.classes ?? []).some((c) => c.classId === sharedClass.classId);
                  return (
                    <label key={sharedClass.classId} className="flex items-center gap-2 text-sm text-slate-700">
                      <Checkbox
                        id={`quiz-class-${sharedClass.classId}`}
                        checked={checked}
                        disabled={isHome || readOnly || keptBySubmissions}
                        onChange={() => toggleSharedClass(sharedClass.classId)}
                      />
                      {sharedClass.className}
                    </label>
                  );
                })}
              </div>
              <p className="mt-1 text-xs text-slate-500">
                One quiz for every class you tick - edits, publishing and results are shared.
              </p>
            </FormField>
          )}

          <QuizWindowFields
            opensAt={form.opensAt}
            onOpensAtChange={(value) => setForm({ ...form, opensAt: value })}
            closesAt={form.closesAt}
            onClosesAtChange={(value) => setForm({ ...form, closesAt: value })}
            timed={form.timed}
            onTimedChange={(value) => setForm({ ...form, timed: value })}
            durationMinutes={form.durationMinutes}
            onDurationMinutesChange={(value) => setForm({ ...form, durationMinutes: value })}
            disabled={readOnly}
            opensAtDisabled={questionsReadOnly}
          />

          <label className="flex items-center gap-2 text-sm text-slate-700">
            <Checkbox
              checked={form.revealResultsOnSubmit}
              onChange={(event) => setForm({ ...form, revealResultsOnSubmit: event.target.checked })}
              disabled={readOnly}
            />
            Show pupils their score and correct answers after they submit
          </label>
          <p className="text-xs text-slate-500">{TAKE_HOME_QUIZ_FIELD_HELP.revealResultsOnSubmit}</p>

          <ShuffleFields
            shuffleQuestions={form.shuffleQuestions}
            shuffleChoices={form.shuffleChoices}
            onChange={(value) => setForm({ ...form, ...value })}
            disabled={locked}
          />

          <ThemeSection
            choice={form.theme}
            resolved={quiz?.theme ?? null}
            onChange={(theme) => setForm({ ...form, theme })}
            disabled={readOnly}
            libraryLabel="School themes"
            offerMine
            quizTitle={form.title}
          />
        </div>
      )}

      {showForm && !isNew && (
        <div className="space-y-4">
          <h2 className="font-display text-lg font-medium text-slate-900">Questions</h2>
          <QuestionEditor
            questions={form.questions}
            onChange={(questions) => setForm({ ...form, questions })}
            disabled={questionsReadOnly}
            importer={{
              importFile: (file) => importTakeHomeQuizQuestions(quiz?.id ?? "", file),
              fetchTemplate: fetchQuestionTemplate,
            }}
            bank={bank}
          />
          <PublishReadinessPanel readiness={readiness} quizType={form.quizType} />
        </div>
      )}

      {showForm && !isNew && quiz && quiz.writable && quiz.status !== "DRAFT" && (
        <StudentLinksPanel quizId={quiz.id} refreshToken={linksRefreshToken} />
      )}

      {showForm && isNew && (
        <div className="space-y-3">
          <Alert variant="info">Save the quiz's details first, then add questions.</Alert>
          <QuestionTemplateDownload fetchTemplate={fetchQuestionTemplate} />
        </div>
      )}

      {showForm && !readOnly && (
        <UnsavedChangesBar
          count={dirty ? 1 : 0}
          saving={saving}
          onSave={save}
          onDiscard={discard}
          saveVariant="primary"
        />
      )}

      {previewOpen && quiz && (
        <QuizPreviewModal
          title={form.title}
          instructions={form.instructions}
          timed={form.timed}
          durationMinutes={form.durationMinutes ? Number(form.durationMinutes) : null}
          shuffleQuestions={form.shuffleQuestions}
          shuffleChoices={form.shuffleChoices}
          questions={form.questions}
          theme={quiz.theme ?? null}
          themeUnsaved={
            (form.theme.themeId ?? null) !== (quiz.themeId ?? null) ||
            (form.theme.themePreset ?? null) !== (quiz.themePreset ?? null)
          }
          onClose={() => setPreviewOpen(false)}
        />
      )}

      {confirmDelete && (
        <ConfirmDialog
          title="Delete this quiz?"
          message="This can't be undone. Only a draft quiz can be deleted."
          confirmLabel="Delete"
          variant="danger"
          onConfirm={handleDelete}
          onClose={() => setConfirmDelete(false)}
        />
      )}

      {sharing && quiz && (
        <ShareQuizModal
          quiz={quiz}
          onClose={() => setSharing(false)}
          onShared={(result) =>
            setShareNotice(
              `Shared "${quiz.title}" with ${result.classes.map((sharedClass) => sharedClass.className).join(", ")}` +
                ` and published it. ${result.guardiansNotified} guardian${result.guardiansNotified === 1 ? "" : "s"} emailed.`,
            )
          }
        />
      )}

      {quiz && (
        <PublishQuizModal
          open={publishModalOpen}
          onClose={() => setPublishModalOpen(false)}
          quizId={quiz.id}
          rosterSize={readiness?.rosterSize ?? 0}
          closesAt={quiz.closesAt}
          onPublished={handlePublished}
        />
      )}
    </div>
  );
}
