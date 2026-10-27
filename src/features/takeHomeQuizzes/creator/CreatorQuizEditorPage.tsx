import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { ApiError } from "@/api/client";
import {
  addClassQuizQuestionsFromBank,
  type ClassQuizView,
  correctClassQuizAnswerKey,
  createClassQuiz,
  deleteClassQuiz,
  deleteCreatorQuestionBankItem,
  fetchClassQuestionTemplate,
  getClassQuiz,
  getClassQuizValidation,
  importClassQuizQuestions,
  previewClassQuizAnswerKeyCorrection,
  publishClassQuiz,
  saveClassQuizQuestions,
  saveClassQuizQuestionToBank,
  searchCreatorQuestionBank,
  updateClassQuiz,
} from "@/api/classTakeHomeQuizzes";
import type { AnswerCorrectionView, PublishReadinessView } from "@/api/takeHomeQuizzes";
import { useParticipantNoun } from "@/components/ParticipantNoun";
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
import { describeAnswerCorrection } from "@/features/takeHomeQuizzes/answerCorrection";
import { AnswerCorrectionDialog } from "@/features/takeHomeQuizzes/components/AnswerCorrectionDialog";
import { PublishReadinessPanel } from "@/features/takeHomeQuizzes/components/PublishReadinessPanel";
import type { QuestionBankSource } from "@/features/takeHomeQuizzes/components/QuestionBankModal";
import { QuestionEditor } from "@/features/takeHomeQuizzes/components/QuestionEditor";
import { QuizPreviewModal } from "@/features/takeHomeQuizzes/components/QuizPreviewModal";
import { QuestionTemplateDownload } from "@/features/takeHomeQuizzes/components/QuestionImportModal";
import { QuizWindowFields } from "@/features/takeHomeQuizzes/components/QuizWindowFields";
import { isQuizOpenNow } from "@/features/takeHomeQuizzes/takeHomeQuizStatus";
import { ShuffleFields } from "@/features/takeHomeQuizzes/components/ShuffleFields";
import { NO_THEME, type ThemeChoice } from "@/features/takeHomeQuizzes/theme/themeChoice";
import { ThemeSection } from "@/features/takeHomeQuizzes/theme/ThemeSection";
import { type EditableQuestion, toEditableQuestion } from "@/features/takeHomeQuizzes/editableQuestion";
import {
  type EditableStimulus,
  toContentCommands,
  toEditableStimulus,
} from "@/features/takeHomeQuizzes/editableStimulus";

interface FormState {
  title: string;
  instructions: string;
  timed: boolean;
  durationMinutes: string;
  pauseTimerOnLeave: boolean;
  opensAt: string;
  closesAt: string;
  revealResultsOnSubmit: boolean;
  shuffleQuestions: boolean;
  shuffleChoices: boolean;
  theme: ThemeChoice;
  questions: EditableQuestion[];
  /** Shared passages and group instructions (Phase 20L) - saved together with `questions`. */
  stimuli: EditableStimulus[];
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
    pauseTimerOnLeave: false,
    opensAt: nowPlusHours(1),
    closesAt: nowPlusHours(24 * 7),
    revealResultsOnSubmit: false,
    shuffleQuestions: false,
    shuffleChoices: false,
    theme: NO_THEME,
    questions: [],
    stimuli: [],
  };
}

function fromView(view: ClassQuizView): FormState {
  return {
    title: view.title,
    instructions: view.instructions ?? "",
    timed: view.timed,
    durationMinutes: view.durationMinutes !== null ? String(view.durationMinutes) : "",
    pauseTimerOnLeave: view.pauseTimerOnLeave ?? false,
    opensAt: view.opensAt,
    closesAt: view.closesAt,
    revealResultsOnSubmit: view.revealResultsOnSubmit,
    shuffleQuestions: view.shuffleQuestions,
    shuffleChoices: view.shuffleChoices,
    theme: { themeId: view.themeId ?? null, themePreset: view.themePreset ?? null },
    questions: view.questions.map(toEditableQuestion),
    stimuli: (view.stimuli ?? []).map(toEditableStimulus),
  };
}

function snapshotOf(form: FormState): string {
  return JSON.stringify(form);
}

/**
 * Author/edit one class quiz (creators Phase C13) at `/tutor/quizzes/:classId/:quizId`, where
 * `quizId` is `"new"` for a quiz not yet created. The school editor's own form, minus what a class
 * quiz doesn't have: no subject/term, no quiz type (always normal), and no student links - learners
 * take it in their portal. Save is one action across the metadata and question-set endpoints, as in
 * `TakeHomeQuizEditorPage` - including its previewed answer-key correction once learners have
 * submitted; Publish is a plain confirmation, since nothing is minted or emailed.
 */
export function CreatorQuizEditorPage() {
  const { classId = "", quizId } = useParams<{ classId: string; quizId: string }>();
  const navigate = useNavigate();
  const isNew = !quizId || quizId === "new";
  const listPath = `/tutor/quizzes?classId=${classId}`;

  const [quiz, setQuiz] = useState<ClassQuizView | null>(null);
  const [form, setForm] = useState<FormState>(blankForm());
  const [snapshot, setSnapshot] = useState(() => snapshotOf(blankForm()));
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveNotice, setSaveNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [correctionPreview, setCorrectionPreview] = useState<AnswerCorrectionView<ClassQuizView> | null>(null);
  const nouns = useParticipantNoun();
  const [readiness, setReadiness] = useState<PublishReadinessView | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [confirmPublish, setConfirmPublish] = useState(false);

  // Memoized: the bank modal re-searches whenever its `search` changes identity. A creator's bank
  // is theirs alone, so there's no "only mine" filter.
  const quizIdForBank = quiz?.id ?? null;
  const bank = useMemo<QuestionBankSource | undefined>(() => {
    if (!quizIdForBank) return undefined;
    return {
      search: searchCreatorQuestionBank,
      add: (itemIds) => addClassQuizQuestionsFromBank(classId, quizIdForBank, itemIds),
      save: (question) => saveClassQuizQuestionToBank(classId, quizIdForBank, question),
      remove: deleteCreatorQuestionBankItem,
    };
  }, [classId, quizIdForBank]);

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
  // Once a learner has submitted, the questions' wording, answers and points can still be corrected.
  const correctingAnswers = quiz?.actions.canCorrectAnswers ?? false;
  // Once a learner has submitted, only `closesAt` (extend-only), the timer and the reveal setting stay editable.
  const locked = readOnly || questionsReadOnly;
  const dirty = snapshotOf(form) !== snapshot;
  // Questions or passages - both go through the correction once a submission exists.
  const questionsDirty = useMemo(() => {
    const saved = JSON.parse(snapshot) as FormState;
    return (
      JSON.stringify(form.questions) !== JSON.stringify(saved.questions) ||
      JSON.stringify(form.stimuli) !== JSON.stringify(saved.stimuli)
    );
  }, [form.questions, form.stimuli, snapshot]);

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
    setSaveNotice(null);
  }

  /** Saves, first previewing an answer-key correction - which `saveWithCorrection` then applies - when there is one. */
  async function save() {
    if (quiz && correctingAnswers && questionsDirty) {
      setSaving(true);
      setSaveError(null);
      setSaveNotice(null);
      try {
        const content = toContentCommands(form.stimuli, form.questions);
        setCorrectionPreview(
          await previewClassQuizAnswerKeyCorrection(classId, quiz.id, content.questions, content.stimuli),
        );
      } catch (error) {
        setSaveError(error instanceof ApiError ? error.message : "Failed to check this correction");
      } finally {
        setSaving(false);
      }
      return;
    }
    await saveAll(false);
  }

  /** The confirmed correction: errors stay in the dialog, which closes only on success. */
  async function saveWithCorrection() {
    await saveAll(true);
    setCorrectionPreview(null);
  }

  async function saveAll(correcting: boolean) {
    setSaving(true);
    setSaveError(null);
    setSaveNotice(null);
    try {
      const request = {
        title: form.title,
        instructions: form.instructions || null,
        timed: form.timed,
        durationMinutes: form.timed && form.durationMinutes ? Number(form.durationMinutes) : null,
        pauseTimerOnLeave: form.timed && form.pauseTimerOnLeave,
        opensAt: form.opensAt,
        closesAt: form.closesAt,
        revealResultsOnSubmit: form.revealResultsOnSubmit,
        shuffleQuestions: form.shuffleQuestions,
        shuffleChoices: form.shuffleChoices,
        ...form.theme,
      };
      let saved = isNew ? await createClassQuiz(classId, request) : await updateClassQuiz(classId, quiz!.id, request);
      if (correcting) {
        const content = toContentCommands(form.stimuli, form.questions);
        const correction = await correctClassQuizAnswerKey(classId, saved.id, content.questions, content.stimuli);
        saved = correction.quiz ?? saved;
        setSaveNotice(describeAnswerCorrection(correction, nouns));
      } else if (
        !questionsReadOnly &&
        (form.questions.length > 0 ||
          form.stimuli.length > 0 ||
          (quiz && (quiz.questions.length > 0 || (quiz.stimuli ?? []).length > 0)))
      ) {
        const content = toContentCommands(form.stimuli, form.questions);
        saved = await saveClassQuizQuestions(classId, saved.id, content.questions, content.stimuli);
      }
      applyQuiz(saved);
      if (isNew) {
        navigate(`/tutor/quizzes/${classId}/${saved.id}`, { replace: true });
      }
    } catch (error) {
      // A failed correction is shown in its dialog, which stays open.
      if (correcting) throw error;
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
        backLabel="Back to quizzes"
        actions={
          quiz && (
            <div className="flex flex-wrap items-center gap-2">
              {form.questions.length > 0 && (
                <Button variant="secondary" onClick={() => setPreviewOpen(true)}>
                  Preview
                </Button>
              )}
              {quiz.status !== "DRAFT" && (
                <Button variant="secondary" onClick={() => navigate(`/tutor/quizzes/${classId}/${quiz.id}/results`)}>
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
      {saveNotice && !dirty && <Alert variant="success">{saveNotice}</Alert>}

      {showForm && (
        <div className="max-w-2xl space-y-6">
          {readOnly && (
            <Alert variant="info">
              This class is archived or beyond your plan's class limit, so this quiz is read-only.
            </Alert>
          )}
          {questionsReadOnly && !readOnly && (
            <Alert variant="info">
              Learners have already submitted this quiz. The closing date (later only), the timer and the
              reveal setting below can still be changed - a new timer applies to learners who haven&apos;t
              started yet.
              {correctingAnswers &&
                " Each question's wording, correct answer and points, and each passage's text, can be corrected too - a changed answer or points re-scores every submitted attempt; a wording fix re-scores nothing."}
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
            pauseTimerOnLeave={form.pauseTimerOnLeave}
            onPauseTimerOnLeaveChange={(value) => setForm({ ...form, pauseTimerOnLeave: value })}
            disabled={readOnly}
            opensAtDisabled={questionsReadOnly}
            onCloseNow={
              quiz && isQuizOpenNow(quiz.status, quiz.opensAt, quiz.closesAt)
                ? () => setForm({ ...form, closesAt: new Date().toISOString() })
                : undefined
            }
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

          <ShuffleFields
            shuffleQuestions={form.shuffleQuestions}
            shuffleChoices={form.shuffleChoices}
            onChange={(value) => setForm({ ...form, ...value })}
          />

          <ThemeSection
            choice={form.theme}
            resolved={quiz?.theme ?? null}
            onChange={(theme) => setForm({ ...form, theme })}
            disabled={readOnly}
            libraryLabel="My themes"
            offerMine={false}
            quizTitle={form.title}
          />
        </div>
      )}

      {showForm && !isNew && (
        <div className="space-y-4">
          <h2 className="font-display text-lg font-medium text-slate-900">Questions</h2>
          <QuestionEditor
            questions={form.questions}
            onChange={(questions) => setForm((current) => ({ ...current, questions }))}
            stimuli={form.stimuli}
            onStimuliChange={(stimuli) => setForm((current) => ({ ...current, stimuli }))}
            disabled={questionsReadOnly && !correctingAnswers}
            answerKeyOnly={correctingAnswers}
            importer={{
              importFile: (file) => importClassQuizQuestions(classId, quiz?.id ?? "", file),
              fetchTemplate: (format) => fetchClassQuestionTemplate(classId, format),
            }}
            bank={bank}
          />
          <PublishReadinessPanel readiness={readiness} quizType="NORMAL" />
        </div>
      )}

      {showForm && isNew && (
        <div className="space-y-3">
          <Alert variant="info">Save the quiz's details first, then add questions.</Alert>
          <QuestionTemplateDownload fetchTemplate={(format) => fetchClassQuestionTemplate(classId, format)} />
        </div>
      )}

      {showForm && !readOnly && (
        <UnsavedChangesBar count={dirty ? 1 : 0} saving={saving} onSave={save} onDiscard={discard} saveVariant="primary" />
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
          stimuli={form.stimuli}
          theme={quiz.theme ?? null}
          themeUnsaved={
            (form.theme.themeId ?? null) !== (quiz.themeId ?? null) ||
            (form.theme.themePreset ?? null) !== (quiz.themePreset ?? null)
          }
          onClose={() => setPreviewOpen(false)}
        />
      )}

      {correctionPreview && (
        <AnswerCorrectionDialog
          preview={correctionPreview}
          onConfirm={saveWithCorrection}
          onClose={() => setCorrectionPreview(null)}
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
