import { Eye, FileText, ListTree, Pencil, Sparkles, Wand2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router";
import { can } from "@/auth/permissions";
import { ApiError } from "@/api/client";
import {
  generateLessonNote,
  getClassWeekGrid,
  getLessonNote,
  type LessonNoteContentView,
  type LessonNoteView,
  reopenLessonNote,
  saveClassWeekNote,
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
import { AuthenticatedRichImage } from "@/components/richText/AuthenticatedRichImage";
import { richTextIsBlank } from "@/components/richText/richTextIsBlank";
import { UnsavedChangesBar } from "@/features/assessments/components/UnsavedChangesBar";
import { AiGenerateSheet } from "@/features/lessonNotes/components/AiGenerateSheet";
import { SCHOOL_AI_COPY } from "@/features/lessonNotes/components/aiGenerateCopy";
import { LessonNoteDocumentEditor } from "@/features/lessonNotes/components/LessonNoteDocumentEditor";
import { lessonNoteContentToHtml } from "@/features/lessonNotes/components/lessonNoteContentToHtml";
import { LessonNoteReadView } from "@/features/lessonNotes/components/LessonNoteReadView";
import { LessonNoteStatusBadge } from "@/features/lessonNotes/components/LessonNoteStatusBadge";
import { MathText } from "@/features/lessonNotes/components/MathText";
import { StructuredLessonNoteForm } from "@/features/lessonNotes/components/StructuredLessonNoteForm";
import { ReviewDecisionModal } from "@/features/lessonNotes/components/ReviewDecisionModal";
import { LESSON_NOTE_FIELD_HELP } from "@/features/lessonNotes/lessonNoteFieldHelp";
import {
  cleanContent,
  EMPTY_CONTENT,
  normalizeForCompare,
  structuredHasContent,
} from "@/features/lessonNotes/lessonNoteFormState";
import { useAuthStore } from "@/stores/authStore";
import { useFeatureStore } from "@/stores/featureStore";
import { usePendingLessonNotesStore } from "@/stores/pendingLessonNotesStore";

function renderStaffImage(fileId: string, alt: string) {
  return <AuthenticatedRichImage fileId={fileId} alt={alt} />;
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** A new whole-class note's starting body - one heading per subject the class takes this term. */
function subjectHeadingsBody(subjectNames: string[]): string {
  return subjectNames.map((name) => `<h2>${escapeHtml(name)}</h2><p></p>`).join("");
}

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
 * <p>
 * Phase 16G added a second authoring mode: `content.mode` picks between the
 * original `StructuredLessonNoteForm` (the twelve-field NERDC form) and the
 * new `LessonNoteDocumentEditor` (one free-form rich-text canvas a teacher
 * types into or pastes a Word lesson plan into). Both halves of `content`
 * persist regardless of which is active, so the toggle below is
 * non-destructive - switching back and forth never loses either half.
 * <p>
 * A whole-class note (`?classId=` instead of `?subjectId=`, or a loaded note
 * carrying `classId`) covers every subject of one class for the week: it is
 * always a document (no format toggle, no AI), and a new one starts with a
 * heading per subject the class takes that term.
 */
export function LessonNoteEditorPage() {
  const { noteId } = useParams<{ noteId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const subjectId = searchParams.get("subjectId") ?? "";
  const classIdParam = searchParams.get("classId") ?? "";
  const termId = searchParams.get("termId") ?? "";
  const weekNumber = Number(searchParams.get("weekNumber") ?? "0");
  const isNew = !noteId || noteId === "new";

  const [note, setNote] = useState<LessonNoteView | null>(null);
  const classId = note?.classId ?? classIdParam;
  const isClassNote = !!classId;
  const [newClassName, setNewClassName] = useState<string | null>(null);
  // Lesson notes are branch-scoped: an existing note carries its own branch; a new week's link
  // carries the branch a SCHOOL_ADMIN was browsing (absent for everyone else - the server uses
  // their own branch).
  const branchId = note?.branchId ?? searchParams.get("branchId") ?? undefined;
  const [topic, setTopic] = useState("");
  const [content, setContent] = useState<LessonNoteContentView>(EMPTY_CONTENT);
  const [aiGenerated, setAiGenerated] = useState(false);
  const [snapshot, setSnapshot] = useState(() => JSON.stringify(normalizeForCompare("", EMPTY_CONTENT)));
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
  // A structured-mode textarea can't render maths, so any non-editable view - a reviewer/
  // guardian-equivalent reading a submitted/approved note, or a teacher previewing their own draft
  // mid-edit - swaps to `LessonNoteReadView` (MathText-rendered) instead. Preview is meaningless
  // once the form itself is already read-only, and document mode is already its own WYSIWYG
  // canvas, so the toggle is offered only for a structured, editable note.
  const documentMode = isClassNote || content.mode === "DOCUMENT";
  const showReadView = readOnly || (previewMode && !documentMode);

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

  // A new whole-class note is seeded with the class's subject headings once the grid tells us them.
  useEffect(() => {
    if (!isNew || !classIdParam || !termId) {
      return;
    }
    getClassWeekGrid(classIdParam, termId)
      .then((grid) => {
        const seeded: LessonNoteContentView = {
          ...EMPTY_CONTENT,
          mode: "DOCUMENT",
          body: subjectHeadingsBody(grid.subjectNames),
        };
        setNewClassName(grid.className);
        setContent(seeded);
        setSnapshot(JSON.stringify(normalizeForCompare("", seeded)));
      })
      .catch((error: unknown) =>
        setLoadError(error instanceof ApiError ? error.message : "Failed to load this class"),
      );
  }, [isNew, classIdParam, termId]);

  const dirty = JSON.stringify(normalizeForCompare(topic, content)) !== snapshot;

  function applyNote(loaded: LessonNoteView) {
    setNote(loaded);
    setTopic(loaded.topic);
    setContent(loaded.content);
    setAiGenerated(loaded.aiGenerated);
    setSnapshot(JSON.stringify(normalizeForCompare(loaded.topic, loaded.content)));
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
      JSON.stringify(normalizeForCompare(note ? note.topic : "", note ? note.content : EMPTY_CONTENT)),
    );
  }

  /**
   * Applies an AI-generated result (Phase 16E's `AiGenerateSheet`) to the form - the teacher still
   * reviews and saves it themselves. The AI wire contract itself is always `STRUCTURED` (see
   * `GenerateLessonNoteService.toContentView`'s Javadoc); a note already in document mode gets the
   * result converted to HTML client-side (`lessonNoteContentToHtml`) rather than silently switching
   * the note back to the structured form.
   */
  function applyGenerated(generatedTopic: string, generatedContent: LessonNoteContentView) {
    if (generatedTopic) {
      setTopic(generatedTopic);
    }
    if (content.mode === "DOCUMENT") {
      setContent({ ...content, body: lessonNoteContentToHtml(generatedContent) });
    } else {
      setContent(generatedContent);
    }
    setAiGenerated(true);
  }

  function convertStructuredToDocument() {
    setContent({ ...content, mode: "DOCUMENT", body: lessonNoteContentToHtml(content) });
  }

  async function save() {
    if (isClassNote) {
      await saveClassNote();
      return;
    }
    if (!subjectId || !termId || !weekNumber) {
      setSaveError(
        "Missing subject, term, or week - go back to the week grid and open this week again.",
      );
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      const cleaned = cleanContent(content);
      const saved = await saveLessonNote(
        subjectId,
        termId,
        weekNumber,
        {
          topic,
          content: cleaned,
          aiGenerated,
        },
        branchId,
      );
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

  async function saveClassNote() {
    if (!termId || !weekNumber) {
      setSaveError("Missing term or week - go back to the week grid and open this week again.");
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      const saved = await saveClassWeekNote(classId, termId, weekNumber, {
        topic,
        content: cleanContent({ ...content, mode: "DOCUMENT" }),
        aiGenerated,
      });
      applyNote(saved);
      if (isNew) {
        navigate(
          `/school/lesson-notes/${saved.id}?classId=${classId}&termId=${termId}&weekNumber=${weekNumber}`,
          { replace: true },
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
    !isClassNote &&
    !readOnly &&
    !!subjectId &&
    !!termId &&
    weekNumber > 0;
  const showConvertPrompt =
    !readOnly &&
    !isClassNote &&
    content.mode === "DOCUMENT" &&
    richTextIsBlank(content.body) &&
    structuredHasContent(content);

  return (
    <div className="space-y-6 pb-24">
      <PageHeader
        title={`Week ${weekNumber} lesson note`}
        description={
          note
            ? `${note.className ?? note.subjectName} · ${note.classId ? "All subjects" : note.levelName}`
            : newClassName
              ? `${newClassName} · All subjects`
              : undefined
        }
        backTo="/school/lesson-notes"
        actions={
          (canGenerateWithAi || note || !readOnly) && (
            <div className="flex flex-wrap items-center gap-2">
              {!readOnly && !documentMode && (
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

      {!readOnly && !isClassNote && (
        <div
          role="radiogroup"
          aria-label="Lesson note format"
          className="inline-flex rounded-control border border-slate-300 bg-white p-0.5"
        >
          <Button
            type="button"
            variant={content.mode === "STRUCTURED" ? "secondary" : "ghost"}
            size="sm"
            aria-pressed={content.mode === "STRUCTURED"}
            onClick={() => setContent({ ...content, mode: "STRUCTURED" })}
          >
            <ListTree className="h-4 w-4" aria-hidden="true" />
            Structured form
          </Button>
          <Button
            type="button"
            variant={content.mode === "DOCUMENT" ? "secondary" : "ghost"}
            size="sm"
            aria-pressed={content.mode === "DOCUMENT"}
            onClick={() => setContent({ ...content, mode: "DOCUMENT" })}
          >
            <FileText className="h-4 w-4" aria-hidden="true" />
            Free-form document
          </Button>
        </div>
      )}

      {showReadView ? (
        <div className="space-y-5">
          <div>
            <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-500">Topic</p>
            <p className="text-sm text-slate-900">
              <MathText text={topic} />
            </p>
          </div>
          <LessonNoteReadView
            content={documentMode ? { ...content, mode: "DOCUMENT" } : content}
            renderImage={renderStaffImage}
          />
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

          {documentMode ? (
            <div className="space-y-3">
              {showConvertPrompt && (
                <Alert variant="info">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span>Your structured content hasn't been copied into this document yet.</span>
                    <Button type="button" variant="secondary" size="sm" onClick={convertStructuredToDocument}>
                      <Wand2 className="h-4 w-4" aria-hidden="true" />
                      Convert now
                    </Button>
                  </div>
                </Alert>
              )}
              <LessonNoteDocumentEditor
                body={content.body ?? ""}
                onChange={(body) => setContent({ ...content, body })}
              />
            </div>
          ) : (
            <StructuredLessonNoteForm content={content} onChange={setContent} />
          )}
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
          generate={(input, handlers, signal) =>
            generateLessonNote(
              subjectId,
              termId,
              weekNumber,
              { topic: input.topic, classHint: input.hint, extraInstructions: input.extraInstructions },
              handlers,
              { signal, branchId },
            )
          }
          copy={SCHOOL_AI_COPY}
          initialTopic={topic}
          onClose={() => setAiSheetOpen(false)}
          onApply={applyGenerated}
        />
      )}
    </div>
  );
}
