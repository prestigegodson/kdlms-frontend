import { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router";
import {
  createTakeHomeQuiz,
  deleteTakeHomeQuiz,
  getShareableClasses,
  getTakeHomeQuiz,
  getTakeHomeQuizValidation,
  type PublishReadinessView,
  type QuizType,
  saveTakeHomeQuizQuestions,
  type SharedClassView,
  type TakeHomeQuizView,
  updateTakeHomeQuiz,
} from "@/api/takeHomeQuizzes";
import { ApiError } from "@/api/client";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { FormField } from "@/components/ui/FormField";
import { Input } from "@/components/ui/Input";
import { PageHeader } from "@/components/ui/PageHeader";
import { Select } from "@/components/ui/Select";
import { Spinner } from "@/components/ui/Spinner";
import { Textarea } from "@/components/ui/Textarea";
import { UnsavedChangesBar } from "@/features/assessments/components/UnsavedChangesBar";
import { PublishQuizModal } from "@/features/takeHomeQuizzes/components/PublishQuizModal";
import { PublishReadinessPanel } from "@/features/takeHomeQuizzes/components/PublishReadinessPanel";
import { QuestionEditor } from "@/features/takeHomeQuizzes/components/QuestionEditor";
import { QuizWindowFields } from "@/features/takeHomeQuizzes/components/QuizWindowFields";
import { StudentLinksPanel } from "@/features/takeHomeQuizzes/components/StudentLinksPanel";
import { type EditableQuestion, toEditableQuestion } from "@/features/takeHomeQuizzes/editableQuestion";
import { TAKE_HOME_QUIZ_FIELD_HELP } from "@/features/takeHomeQuizzes/takeHomeQuizFieldHelp";

interface FormState {
  title: string;
  instructions: string;
  quizType: QuizType;
  timed: boolean;
  durationMinutes: string;
  opensAt: string;
  closesAt: string;
  revealResultsOnSubmit: boolean;
  /** The other arms of the home class's level a Normal quiz is shared with - never the home class itself. */
  sharedClassIds: string[];
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
    sharedClassIds: [],
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
    sharedClassIds: (view.classes ?? [])
      .map((sharedClass) => sharedClass.classId)
      .filter((id) => id !== view.classId),
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
  const [saving, setSaving] = useState(false);
  const [readiness, setReadiness] = useState<PublishReadinessView | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [publishModalOpen, setPublishModalOpen] = useState(false);
  const [linksRefreshToken, setLinksRefreshToken] = useState(0);

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
  }

  async function save() {
    setSaving(true);
    setSaveError(null);
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
          classIds: chosenClassIds(),
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
          classIds: chosenClassIds(),
        });
      }
      if (form.questions.length > 0 || (quiz && quiz.questions.length > 0)) {
        saved = await saveTakeHomeQuizQuestions(
          saved.id,
          form.questions.map((question) => ({
            id: question.id,
            questionType: question.questionType,
            prompt: question.prompt,
            points: Number(question.points) || 0,
            options: question.options.map((option) => ({ id: option.id, label: option.label, correct: option.correct })),
            answerKeys: question.answerKeys
              .filter((key) => key.expectedAnswer.trim() !== "")
              .map((key) => ({ id: key.id, expectedAnswer: key.expectedAnswer })),
          })),
        );
      }
      applyQuiz(saved);
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
    }
  }

  async function handleDelete() {
    if (!quiz) return;
    await deleteTakeHomeQuiz(quiz.id);
    setConfirmDelete(false);
    navigate("/school/take-home-quizzes");
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
        backTo="/school/take-home-quizzes"
        actions={
          quiz && (
            <div className="flex flex-wrap items-center gap-2">
              {quiz.status !== "DRAFT" && (
                <Button variant="secondary" onClick={() => navigate(`/school/take-home-quizzes/${quiz.id}/results`)}>
                  Results
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

      {loadError && <Alert variant="error">{loadError}</Alert>}
      {saveError && <Alert variant="error">{saveError}</Alert>}

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
              Students have already submitted this quiz. Only the closing date (later only) and the
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
            Show students their score and correct answers after they submit
          </label>
          <p className="text-xs text-slate-500">{TAKE_HOME_QUIZ_FIELD_HELP.revealResultsOnSubmit}</p>
        </div>
      )}

      {showForm && !isNew && (
        <div className="space-y-4">
          <h2 className="font-display text-lg font-medium text-slate-900">Questions</h2>
          <QuestionEditor
            questions={form.questions}
            onChange={(questions) => setForm({ ...form, questions })}
            disabled={questionsReadOnly}
          />
          <PublishReadinessPanel readiness={readiness} quizType={form.quizType} />
        </div>
      )}

      {showForm && !isNew && quiz && quiz.writable && quiz.status !== "DRAFT" && (
        <StudentLinksPanel quizId={quiz.id} refreshToken={linksRefreshToken} />
      )}

      {showForm && isNew && (
        <Alert variant="info">Save the quiz's details first, then add questions.</Alert>
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
