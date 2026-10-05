import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { ApiError } from "@/api/client";
import {
  type ClassQuizView,
  createClassQuiz,
  deleteClassQuiz,
  getClassQuiz,
  getClassQuizValidation,
  publishClassQuiz,
  saveClassQuizQuestions,
  updateClassQuiz,
} from "@/api/classTakeHomeQuizzes";
import type { PublishReadinessView } from "@/api/takeHomeQuizzes";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { FormField } from "@/components/ui/FormField";
import { Input } from "@/components/ui/Input";
import { PageHeader } from "@/components/ui/PageHeader";
import { Spinner } from "@/components/ui/Spinner";
import { Textarea } from "@/components/ui/Textarea";
import { UnsavedChangesBar } from "@/features/assessments/components/UnsavedChangesBar";
import { PublishReadinessPanel } from "@/features/takeHomeQuizzes/components/PublishReadinessPanel";
import { QuestionEditor } from "@/features/takeHomeQuizzes/components/QuestionEditor";
import { QuizWindowFields } from "@/features/takeHomeQuizzes/components/QuizWindowFields";
import { type EditableQuestion, toEditableQuestion } from "@/features/takeHomeQuizzes/editableQuestion";

interface FormState {
  title: string;
  instructions: string;
  timed: boolean;
  durationMinutes: string;
  opensAt: string;
  closesAt: string;
  revealResultsOnSubmit: boolean;
  questions: EditableQuestion[];
}

function nowPlusHours(hours: number): string {
  return new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
}

function blankForm(): FormState {
  return {
    title: "",
    instructions: "",
    timed: false,
    durationMinutes: "",
    opensAt: nowPlusHours(1),
    closesAt: nowPlusHours(24 * 7),
    revealResultsOnSubmit: false,
    questions: [],
  };
}

function fromView(view: ClassQuizView): FormState {
  return {
    title: view.title,
    instructions: view.instructions ?? "",
    timed: view.timed,
    durationMinutes: view.durationMinutes !== null ? String(view.durationMinutes) : "",
    opensAt: view.opensAt,
    closesAt: view.closesAt,
    revealResultsOnSubmit: view.revealResultsOnSubmit,
    questions: view.questions.map(toEditableQuestion),
  };
}

function snapshotOf(form: FormState): string {
  return JSON.stringify(form);
}

/**
 * Author/edit one class quiz (creators Phase C13) at `/creator/quizzes/:classId/:quizId`, where
 * `quizId` is `"new"` for a quiz not yet created. The school editor's own form, minus what a class
 * quiz doesn't have: no subject/term, no quiz type (always normal), and no student links - learners
 * take it in their portal. Save is one action across the metadata and question-set endpoints, as in
 * `TakeHomeQuizEditorPage`; Publish is a plain confirmation, since nothing is minted or emailed.
 */
export function CreatorQuizEditorPage() {
  const { classId = "", quizId } = useParams<{ classId: string; quizId: string }>();
  const navigate = useNavigate();
  const isNew = !quizId || quizId === "new";
  const listPath = `/creator/quizzes?classId=${classId}`;

  const [quiz, setQuiz] = useState<ClassQuizView | null>(null);
  const [form, setForm] = useState<FormState>(blankForm());
  const [snapshot, setSnapshot] = useState(() => snapshotOf(blankForm()));
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [readiness, setReadiness] = useState<PublishReadinessView | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmPublish, setConfirmPublish] = useState(false);

  useEffect(() => {
    if (isNew) return;
    getClassQuiz(classId, quizId)
      .then(applyQuiz)
      .catch((error: unknown) => {
        setLoadError(error instanceof ApiError ? error.message : "Failed to load this quiz");
      });
  }, [classId, quizId, isNew]);

  useEffect(() => {
    if (isNew || !quiz) return;
    getClassQuizValidation(classId, quiz.id).then(setReadiness).catch(() => setReadiness(null));
  }, [classId, isNew, quiz]);

  const loading = !isNew && !quiz && !loadError;
  const showForm = !loadError && (isNew || quiz !== null);
  const readOnly = quiz ? !quiz.actions.canEditMetadata : false;
  const questionsReadOnly = quiz ? !quiz.actions.canEditQuestions : false;
  // Once a learner has submitted, only `closesAt` (extend-only) and the reveal setting stay editable.
  const locked = readOnly || questionsReadOnly;
  const dirty = snapshotOf(form) !== snapshot;

  function applyQuiz(loaded: ClassQuizView) {
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
      const request = {
        title: form.title,
        instructions: form.instructions || null,
        timed: form.timed,
        durationMinutes: form.timed && form.durationMinutes ? Number(form.durationMinutes) : null,
        opensAt: form.opensAt,
        closesAt: form.closesAt,
        revealResultsOnSubmit: form.revealResultsOnSubmit,
      };
      let saved = isNew ? await createClassQuiz(classId, request) : await updateClassQuiz(classId, quiz!.id, request);
      if (form.questions.length > 0 || (quiz && quiz.questions.length > 0)) {
        saved = await saveClassQuizQuestions(
          classId,
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
        navigate(`/creator/quizzes/${classId}/${saved.id}`, { replace: true });
      }
    } catch (error) {
      setSaveError(error instanceof ApiError ? error.message : "Failed to save this quiz");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!quiz) return;
    await deleteClassQuiz(classId, quiz.id);
    setConfirmDelete(false);
    navigate(listPath);
  }

  async function handlePublish() {
    if (!quiz) return;
    applyQuiz(await publishClassQuiz(classId, quiz.id));
    setConfirmPublish(false);
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
        title={isNew ? "New quiz" : form.title || "Quiz"}
        description={quiz ? quiz.className : "Set up a new auto-marked quiz for this class."}
        backTo={listPath}
        actions={
          quiz && (
            <div className="flex flex-wrap items-center gap-2">
              {quiz.status !== "DRAFT" && (
                <Button variant="secondary" onClick={() => navigate(`/creator/quizzes/${classId}/${quiz.id}/results`)}>
                  Results
                </Button>
              )}
              {quiz.actions.canPublish && quiz.status === "DRAFT" && (
                <Button variant="accent" onClick={() => setConfirmPublish(true)} disabled={dirty}>
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
          {readOnly && (
            <Alert variant="info">
              This class is archived or beyond your plan's class limit, so this quiz is read-only.
            </Alert>
          )}
          {questionsReadOnly && !readOnly && (
            <Alert variant="info">
              Learners have already submitted this quiz. Only the closing date (later only) and the reveal
              setting below can still be changed.
            </Alert>
          )}

          <FormField label="Title" htmlFor="quiz-title" description="What learners see as the quiz's name.">
            <Input
              id="quiz-title"
              value={form.title}
              onChange={(event) => setForm({ ...form, title: event.target.value })}
              disabled={locked}
            />
          </FormField>

          <FormField
            label="Instructions"
            htmlFor="quiz-instructions"
            description="Anything learners should know before starting."
          >
            <Textarea
              id="quiz-instructions"
              rows={3}
              value={form.instructions}
              onChange={(event) => setForm({ ...form, instructions: event.target.value })}
              disabled={locked}
            />
          </FormField>

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
            Show learners their score and correct answers after they submit
          </label>
          <p className="text-xs text-slate-500">
            Off by default. When on, a learner who finishes early could share the answers with the rest of the
            class.
          </p>
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
          <PublishReadinessPanel readiness={readiness} quizType="NORMAL" />
        </div>
      )}

      {showForm && isNew && <Alert variant="info">Save the quiz's details first, then add questions.</Alert>}

      {showForm && !readOnly && (
        <UnsavedChangesBar count={dirty ? 1 : 0} saving={saving} onSave={save} onDiscard={discard} saveVariant="primary" />
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

      {confirmPublish && quiz && (
        <ConfirmDialog
          title="Publish this quiz?"
          message={`The ${readiness?.rosterSize ?? 0} learner(s) in ${quiz.className} will see it in their Quizzes from when it opens. Questions lock once anyone submits.`}
          confirmLabel="Publish"
          onConfirm={handlePublish}
          onClose={() => setConfirmPublish(false)}
        />
      )}
    </div>
  );
}
