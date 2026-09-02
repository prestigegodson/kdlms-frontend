import { Eye, Pencil, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router";
import { can } from "@/auth/permissions";
import { ApiError } from "@/api/client";
import {
  getLessonNote,
  type LessonNoteContentView,
  type LessonNoteView,
  reopenLessonNote,
  saveLessonNote,
  submitLessonNote,
  withdrawLessonNote,
} from "@/api/lessonNotes";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { FormField } from "@/components/ui/FormField";
import { Input } from "@/components/ui/Input";
import { PageHeader } from "@/components/ui/PageHeader";
import { Spinner } from "@/components/ui/Spinner";
import { Textarea } from "@/components/ui/Textarea";
import { UnsavedChangesBar } from "@/features/assessments/components/UnsavedChangesBar";
import { AiGenerateSheet } from "@/features/lessonNotes/components/AiGenerateSheet";
import { LessonNoteReadView } from "@/features/lessonNotes/components/LessonNoteReadView";
import { LessonNoteStatusBadge } from "@/features/lessonNotes/components/LessonNoteStatusBadge";
import { MathText } from "@/features/lessonNotes/components/MathText";
import { PresentationStepsField } from "@/features/lessonNotes/components/PresentationStepsField";
import { ReviewDecisionModal } from "@/features/lessonNotes/components/ReviewDecisionModal";
import { StringListField } from "@/features/lessonNotes/components/StringListField";
import { LESSON_NOTE_FIELD_HELP } from "@/features/lessonNotes/lessonNoteFieldHelp";
import { useAuthStore } from "@/stores/authStore";
import { useFeatureStore } from "@/stores/featureStore";
import { usePendingLessonNotesStore } from "@/stores/pendingLessonNotesStore";

const EMPTY_CONTENT: LessonNoteContentView = {
  subTopic: "",
  duration: "",
  averageAge: "",
  objectives: [],
  entryBehaviour: "",
  instructionalMaterials: [],
  references: [],
  presentation: [],
  evaluation: "",
  conclusion: "",
  assignment: "",
};

/**
 * Author/edit/review one week's lesson note - addressed either by a real
 * `noteId` (an existing note, hydrated via `getLessonNote`) or the literal
 * `"new"` plus `?subjectId=&termId=&weekNumber=` in the query string (a
 * not-yet-authored week has no id to route on yet - `WeekGridTable`/
 * `ReviewQueueTable` build both shapes). The server's own `actions` flags
 * (`LessonNoteView.ActionsView`) decide which buttons render and whether
 * the form is editable - this page never re-derives the status table
 * itself, the same `canReply`/`canEdit` precedent `communication`'s
 * `ThreadView`/`MessageView` set.
 */
export function LessonNoteEditorPage() {
  const { noteId } = useParams<{ noteId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const subjectId = searchParams.get("subjectId") ?? "";
  const termId = searchParams.get("termId") ?? "";
  const weekNumber = Number(searchParams.get("weekNumber") ?? "0");
  const isNew = !noteId || noteId === "new";

  const [note, setNote] = useState<LessonNoteView | null>(null);
  const [topic, setTopic] = useState("");
  const [content, setContent] = useState<LessonNoteContentView>(EMPTY_CONTENT);
  const [aiGenerated, setAiGenerated] = useState(false);
  const [snapshot, setSnapshot] = useState(() =>
    JSON.stringify({ topic: "", content: EMPTY_CONTENT }),
  );
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [actionError, setActionError] = useState<string | null>(null);
  const [actionPending, setActionPending] = useState(false);
  const [confirmAction, setConfirmAction] = useState<"withdraw" | "reopen" | null>(null);
  const [reviewDecision, setReviewDecision] = useState<"APPROVE" | "REJECT" | null>(null);
  const [aiSheetOpen, setAiSheetOpen] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);
  const refreshPendingCount = usePendingLessonNotesStore((state) => state.refresh);

  const role = useAuthStore((state) => state.user?.role);
  const aiLessonNotesEntitled = useFeatureStore((state) => state.aiLessonNotes);

  // "Still loading" is derived from note/loadError rather than a separate
  // boolean flag (the `classes === null` idiom AdminTimetablePanel uses) -
  // a new note has nothing to fetch, so it never enters the loading state.
  const loading = !isNew && !note && !loadError;
  const readOnly = note ? !note.actions.canEdit : false;
  // A textarea can't render maths, so any non-editable view - a reviewer/guardian-equivalent
  // reading a submitted/approved note, or a teacher previewing their own draft mid-edit - swaps
  // to `LessonNoteReadView` (MathText-rendered) instead. Preview is meaningless once the form
  // itself is already read-only.
  const showReadView = readOnly || previewMode;

  useEffect(() => {
    if (isNew || !noteId) {
      return;
    }
    getLessonNote(noteId)
      .then((loaded) => applyNote(loaded))
      .catch((error: unknown) =>
        setLoadError(error instanceof ApiError ? error.message : "Failed to load this lesson note"),
      );
  }, [isNew, noteId]);

  const dirty = JSON.stringify({ topic, content }) !== snapshot;

  function applyNote(loaded: LessonNoteView) {
    setNote(loaded);
    setTopic(loaded.topic);
    setContent(loaded.content);
    setAiGenerated(loaded.aiGenerated);
    setSnapshot(JSON.stringify({ topic: loaded.topic, content: loaded.content }));
  }

  function discard() {
    if (note) {
      setTopic(note.topic);
      setContent(note.content);
      setAiGenerated(note.aiGenerated);
    } else {
      setTopic("");
      setContent(EMPTY_CONTENT);
      setAiGenerated(false);
    }
    setSnapshot(
      JSON.stringify({
        topic: note ? note.topic : "",
        content: note ? note.content : EMPTY_CONTENT,
      }),
    );
  }

  /** Applies an AI-generated result (Phase 16E's `AiGenerateSheet`) to the form - the teacher still reviews and saves it themselves. */
  function applyGenerated(generatedTopic: string, generatedContent: LessonNoteContentView) {
    if (generatedTopic) {
      setTopic(generatedTopic);
    }
    setContent(generatedContent);
    setAiGenerated(true);
  }

  async function save() {
    if (!subjectId || !termId || !weekNumber) {
      setSaveError(
        "Missing subject, term, or week - go back to the week grid and open this week again.",
      );
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      const cleaned: LessonNoteContentView = {
        ...content,
        objectives: content.objectives.filter((value) => value.trim() !== ""),
        instructionalMaterials: content.instructionalMaterials.filter(
          (value) => value.trim() !== "",
        ),
        references: content.references.filter((value) => value.trim() !== ""),
        presentation: content.presentation.filter(
          (step) =>
            step.label.trim() !== "" ||
            step.teacherActivity.trim() !== "" ||
            step.learnerActivity.trim() !== "",
        ),
      };
      const saved = await saveLessonNote(subjectId, termId, weekNumber, {
        topic,
        content: cleaned,
        aiGenerated,
      });
      applyNote(saved);
      if (isNew) {
        navigate(
          `/school/lesson-notes/${saved.id}?subjectId=${subjectId}&termId=${termId}&weekNumber=${weekNumber}`,
          {
            replace: true,
          },
        );
      }
    } catch (error) {
      setSaveError(error instanceof ApiError ? error.message : "Failed to save this lesson note");
    } finally {
      setSaving(false);
    }
  }

  async function submit() {
    if (!note) return;
    setActionPending(true);
    setActionError(null);
    try {
      applyNote(await submitLessonNote(note.id));
      refreshPendingCount();
    } catch (error) {
      setActionError(
        error instanceof ApiError ? error.message : "Failed to submit this lesson note",
      );
    } finally {
      setActionPending(false);
    }
  }

  async function withdraw() {
    if (!note) return;
    const updated = await withdrawLessonNote(note.id);
    applyNote(updated);
    refreshPendingCount();
    setConfirmAction(null);
  }

  async function reopen() {
    if (!note) return;
    const updated = await reopenLessonNote(note.id);
    applyNote(updated);
    refreshPendingCount();
    setConfirmAction(null);
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <Spinner /> Loading lesson note…
      </div>
    );
  }

  if (loadError) {
    return <Alert variant="error">{loadError}</Alert>;
  }

  const serverActions = note?.actions;
  // A brand-new, not-yet-saved note has no `actions` to read `canEdit` from - it's editable by
  // definition (nothing exists yet to be read-only), matching `readOnly`'s own `note ? ... : false`
  // fallback above. Generation writes nothing itself (see `AiGenerateSheet`'s Javadoc), so it's
  // offered whenever the form itself would accept the result, isNew or not.
  const canGenerateWithAi =
    can.generateLessonNotesWithAi(role, aiLessonNotesEntitled) &&
    !readOnly &&
    !!subjectId &&
    !!termId &&
    weekNumber > 0;

  return (
    <div className="space-y-6 pb-24">
      <PageHeader
        title={`Week ${weekNumber} lesson note`}
        description={note ? `${note.subjectName} · ${note.levelName}` : undefined}
        backTo="/school/lesson-notes"
        actions={
          (canGenerateWithAi || note || !readOnly) && (
            <div className="flex flex-wrap items-center gap-2">
              {!readOnly && (
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setPreviewMode((current) => !current)}
                >
                  {previewMode ? (
                    <>
                      <Pencil className="h-4 w-4" aria-hidden="true" />
                      Edit
                    </>
                  ) : (
                    <>
                      <Eye className="h-4 w-4" aria-hidden="true" />
                      Preview
                    </>
                  )}
                </Button>
              )}
              {canGenerateWithAi && (
                <Button type="button" variant="accent" onClick={() => setAiSheetOpen(true)}>
                  <Sparkles className="h-4 w-4" aria-hidden="true" />
                  Generate with AI
                </Button>
              )}
              {note && (
                <>
                  <LessonNoteStatusBadge status={note.status} />
                  {serverActions?.canSubmit && (
                    <Button
                      type="button"
                      variant="primary"
                      loading={actionPending}
                      onClick={submit}
                    >
                      Submit
                    </Button>
                  )}
                  {serverActions?.canWithdraw && (
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => setConfirmAction("withdraw")}
                    >
                      Withdraw
                    </Button>
                  )}
                  {serverActions?.canReview && (
                    <>
                      <Button
                        type="button"
                        variant="danger"
                        onClick={() => setReviewDecision("REJECT")}
                      >
                        Reject
                      </Button>
                      <Button
                        type="button"
                        variant="primary"
                        onClick={() => setReviewDecision("APPROVE")}
                      >
                        Approve
                      </Button>
                    </>
                  )}
                  {serverActions?.canReopen && (
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => setConfirmAction("reopen")}
                    >
                      Reopen
                    </Button>
                  )}
                </>
              )}
            </div>
          )
        }
      />

      {actionError && <Alert variant="error">{actionError}</Alert>}
      {saveError && <Alert variant="error">{saveError}</Alert>}

      {note?.status === "REJECTED" && note.review.reviewComment && (
        <Alert variant="warning">
          <span className="font-medium">
            Rejected{note.review.reviewedByName ? ` by ${note.review.reviewedByName}` : ""}:
          </span>{" "}
          {note.review.reviewComment}
        </Alert>
      )}
      {note?.status === "APPROVED" && (
        <p className="text-sm text-slate-500">
          Approved{note.review.reviewedByName ? ` by ${note.review.reviewedByName}` : ""}
          {note.review.reviewComment ? ` — ${note.review.reviewComment}` : ""}
        </p>
      )}

      {showReadView ? (
        <div className="space-y-5">
          <div>
            <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-500">Topic</p>
            <p className="text-sm text-slate-900">
              <MathText text={topic} />
            </p>
          </div>
          <LessonNoteReadView content={content} />
        </div>
      ) : (
        <>
          <FormField
            label="Topic"
            htmlFor="lesson-note-topic"
            description={LESSON_NOTE_FIELD_HELP.topic}
          >
            <Input
              id="lesson-note-topic"
              value={topic}
              onChange={(event) => setTopic(event.target.value)}
              required
              enterKeyHint="next"
              aria-describedby="lesson-note-topic-description"
            />
          </FormField>

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              label="Sub-topic"
              htmlFor="lesson-note-subtopic"
              description={LESSON_NOTE_FIELD_HELP.subTopic}
            >
              <Input
                id="lesson-note-subtopic"
                value={content.subTopic ?? ""}
                onChange={(event) => setContent({ ...content, subTopic: event.target.value })}
                aria-describedby="lesson-note-subtopic-description"
              />
            </FormField>
            <FormField
              label="Duration"
              htmlFor="lesson-note-duration"
              description={LESSON_NOTE_FIELD_HELP.duration}
            >
              <Input
                id="lesson-note-duration"
                placeholder="e.g. 40 minutes"
                value={content.duration ?? ""}
                onChange={(event) => setContent({ ...content, duration: event.target.value })}
                aria-describedby="lesson-note-duration-description"
              />
            </FormField>
            <FormField
              label="Average age"
              htmlFor="lesson-note-average-age"
              description={LESSON_NOTE_FIELD_HELP.averageAge}
            >
              <Input
                id="lesson-note-average-age"
                placeholder="e.g. 12 years"
                value={content.averageAge ?? ""}
                onChange={(event) => setContent({ ...content, averageAge: event.target.value })}
                aria-describedby="lesson-note-average-age-description"
              />
            </FormField>
          </div>

          <FormField
            label="Entry behaviour"
            htmlFor="lesson-note-entry-behaviour"
            description={LESSON_NOTE_FIELD_HELP.entryBehaviour}
          >
            <Textarea
              id="lesson-note-entry-behaviour"
              rows={2}
              value={content.entryBehaviour ?? ""}
              onChange={(event) => setContent({ ...content, entryBehaviour: event.target.value })}
              aria-describedby="lesson-note-entry-behaviour-description"
            />
          </FormField>

          <StringListField
            label="Behavioural objectives"
            description={LESSON_NOTE_FIELD_HELP.objectives}
            values={content.objectives}
            onChange={(objectives) => setContent({ ...content, objectives })}
          />
          <StringListField
            label="Instructional materials"
            description={LESSON_NOTE_FIELD_HELP.instructionalMaterials}
            values={content.instructionalMaterials}
            onChange={(instructionalMaterials) =>
              setContent({ ...content, instructionalMaterials })
            }
          />
          <StringListField
            label="References"
            description={LESSON_NOTE_FIELD_HELP.references}
            values={content.references}
            onChange={(references) => setContent({ ...content, references })}
          />

          <PresentationStepsField
            description={LESSON_NOTE_FIELD_HELP.presentation}
            steps={content.presentation}
            onChange={(presentation) => setContent({ ...content, presentation })}
          />

          <FormField
            label="Evaluation"
            htmlFor="lesson-note-evaluation"
            description={LESSON_NOTE_FIELD_HELP.evaluation}
          >
            <Textarea
              id="lesson-note-evaluation"
              rows={3}
              value={content.evaluation ?? ""}
              onChange={(event) => setContent({ ...content, evaluation: event.target.value })}
              aria-describedby="lesson-note-evaluation-description"
            />
          </FormField>
          <FormField
            label="Conclusion"
            htmlFor="lesson-note-conclusion"
            description={LESSON_NOTE_FIELD_HELP.conclusion}
          >
            <Textarea
              id="lesson-note-conclusion"
              rows={2}
              value={content.conclusion ?? ""}
              onChange={(event) => setContent({ ...content, conclusion: event.target.value })}
              aria-describedby="lesson-note-conclusion-description"
            />
          </FormField>
          <FormField
            label="Assignment"
            htmlFor="lesson-note-assignment"
            description={LESSON_NOTE_FIELD_HELP.assignment}
          >
            <Textarea
              id="lesson-note-assignment"
              rows={2}
              value={content.assignment ?? ""}
              onChange={(event) => setContent({ ...content, assignment: event.target.value })}
              aria-describedby="lesson-note-assignment-description"
            />
          </FormField>
        </>
      )}

      {!readOnly && (
        <UnsavedChangesBar
          count={dirty ? 1 : 0}
          saving={saving}
          onSave={save}
          onDiscard={discard}
          saveVariant="primary"
        />
      )}

      {confirmAction === "withdraw" && (
        <ConfirmDialog
          title="Withdraw this submission?"
          message="This returns the note to Draft so you can keep editing it. You'll need to submit it again when it's ready."
          confirmLabel="Withdraw"
          onConfirm={withdraw}
          onClose={() => setConfirmAction(null)}
        />
      )}
      {confirmAction === "reopen" && (
        <ConfirmDialog
          title="Reopen this note?"
          message="This returns the approved note to Draft so its author can make further changes."
          confirmLabel="Reopen"
          onConfirm={reopen}
          onClose={() => setConfirmAction(null)}
        />
      )}
      {reviewDecision && note && (
        <ReviewDecisionModal
          noteId={note.id}
          decision={reviewDecision}
          onClose={() => setReviewDecision(null)}
          onReviewed={(updated) => {
            applyNote(updated);
            refreshPendingCount();
            setReviewDecision(null);
          }}
        />
      )}
      {aiSheetOpen && (
        <AiGenerateSheet
          subjectId={subjectId}
          termId={termId}
          weekNumber={weekNumber}
          initialTopic={topic}
          onClose={() => setAiSheetOpen(false)}
          onApply={applyGenerated}
        />
      )}
    </div>
  );
}
