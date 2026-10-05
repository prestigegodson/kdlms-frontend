import { Eye, FileText, ListTree, Pencil, Sparkles, Trash2, Wand2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { ApiError, getErrorMessage } from "@/api/client";
import {
  type ClassLessonNoteView,
  createClassLessonNote,
  deleteClassLessonNote,
  generateClassLessonNote,
  getClassLessonNote,
  type LessonNoteContentView,
  publishClassLessonNote,
  unpublishClassLessonNote,
  updateClassLessonNote,
} from "@/api/lessonNotes";
import { getVirtualClass } from "@/api/virtualClasses";
import { can } from "@/auth/permissions";
import { AuthenticatedRichImage } from "@/components/richText/AuthenticatedRichImage";
import { richTextIsBlank } from "@/components/richText/richTextIsBlank";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { DateInput } from "@/components/ui/DateInput";
import { FormField } from "@/components/ui/FormField";
import { Input } from "@/components/ui/Input";
import { PageHeader } from "@/components/ui/PageHeader";
import { Spinner } from "@/components/ui/Spinner";
import { UnsavedChangesBar } from "@/features/assessments/components/UnsavedChangesBar";
import { AiGenerateSheet } from "@/features/lessonNotes/components/AiGenerateSheet";
import { CREATOR_AI_COPY } from "@/features/lessonNotes/components/aiGenerateCopy";
import { LessonNoteDocumentEditor } from "@/features/lessonNotes/components/LessonNoteDocumentEditor";
import { lessonNoteContentToHtml } from "@/features/lessonNotes/components/lessonNoteContentToHtml";
import { LessonNoteReadView } from "@/features/lessonNotes/components/LessonNoteReadView";
import { MathText } from "@/features/lessonNotes/components/MathText";
import { StructuredLessonNoteForm } from "@/features/lessonNotes/components/StructuredLessonNoteForm";
import { ClassLessonNoteStatusBadge } from "@/features/lessonNotes/creator/ClassLessonNoteStatusBadge";
import {
  cleanContent,
  EMPTY_CONTENT,
  normalizeForCompare,
  structuredHasContent,
} from "@/features/lessonNotes/lessonNoteFormState";
import { useCreatorPlanStore } from "@/stores/creatorPlanStore";
import { formatLongDate } from "@/utils/date";

function renderCreatorImage(fileId: string, alt: string) {
  return <AuthenticatedRichImage fileId={fileId} alt={alt} />;
}

function snapshotOf(sessionDate: string, topic: string, content: LessonNoteContentView): string {
  return JSON.stringify({ sessionDate, ...normalizeForCompare(topic, content) });
}

/**
 * Author or edit one of a creator's class lesson notes (creators Phase C12), addressed by
 * `/creator/lesson-notes/:classId/:noteId` - or `new` for a note not yet saved. There is no review
 * step: Publish shares the note with the class's learners at once, a published note stays editable
 * (learners see each saved change), and Unpublish takes it back to a draft. The server's `actions`
 * flags decide which buttons show and whether the form is editable, so an archived or over-limit
 * class's notes open read-only. Reuses the school editor's structured form, document canvas and AI
 * sheet; only the session date and the publish actions are its own.
 */
export function CreatorLessonNoteEditorPage() {
  const { classId = "", noteId } = useParams<{ classId: string; noteId: string }>();
  const navigate = useNavigate();
  const isNew = noteId === "new";
  const fetchPlan = useCreatorPlanStore((state) => state.fetchIfNeeded);
  const plan = useCreatorPlanStore((state) => state.plan);

  const [className, setClassName] = useState<string | null>(null);
  const [note, setNote] = useState<ClassLessonNoteView | null>(null);
  const [sessionDate, setSessionDate] = useState("");
  const [topic, setTopic] = useState("");
  const [content, setContent] = useState<LessonNoteContentView>(EMPTY_CONTENT);
  const [aiGenerated, setAiGenerated] = useState(false);
  const [snapshot, setSnapshot] = useState(() => snapshotOf("", "", EMPTY_CONTENT));
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionPending, setActionPending] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [aiSheetOpen, setAiSheetOpen] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);

  const loading = !isNew && !note && !loadError;
  const readOnly = note ? !note.actions.canEdit : false;
  const showReadView = readOnly || (previewMode && content.mode === "STRUCTURED");
  const dirty = snapshotOf(sessionDate, topic, content) !== snapshot;
  const listPath = `/creator/lesson-notes?classId=${classId}`;

  useEffect(() => {
    fetchPlan();
  }, [fetchPlan]);

  useEffect(() => {
    getVirtualClass(classId)
      .then((loaded) => setClassName(loaded.name))
      .catch(() => undefined);
  }, [classId]);

  useEffect(() => {
    if (isNew || !noteId) {
      return;
    }
    getClassLessonNote(classId, noteId)
      .then(applyNote)
      .catch((err: unknown) => setLoadError(getErrorMessage(err, "We couldn't load this lesson note.")));
  }, [classId, noteId, isNew]);

  function applyNote(loaded: ClassLessonNoteView) {
    setNote(loaded);
    setSessionDate(loaded.sessionDate ?? "");
    setTopic(loaded.topic);
    setContent(loaded.content);
    setAiGenerated(loaded.aiGenerated);
    setSnapshot(snapshotOf(loaded.sessionDate ?? "", loaded.topic, loaded.content));
  }

  function discard() {
    if (note) {
      applyNote(note);
      return;
    }
    setSessionDate("");
    setTopic("");
    setContent(EMPTY_CONTENT);
    setAiGenerated(false);
  }

  /** A generated draft is always structured; a document-mode note gets it converted, as in the school editor. */
  function applyGenerated(generatedTopic: string, generatedContent: LessonNoteContentView) {
    if (generatedTopic) {
      setTopic(generatedTopic);
    }
    setContent(
      content.mode === "DOCUMENT" ? { ...content, body: lessonNoteContentToHtml(generatedContent) } : generatedContent,
    );
    setAiGenerated(true);
  }

  async function save(): Promise<ClassLessonNoteView | null> {
    setSaving(true);
    setError(null);
    try {
      const request = { sessionDate: sessionDate || null, topic, content: cleanContent(content), aiGenerated };
      const saved = note
        ? await updateClassLessonNote(classId, note.id, request)
        : await createClassLessonNote(classId, request);
      applyNote(saved);
      if (isNew) {
        navigate(`/creator/lesson-notes/${classId}/${saved.id}`, { replace: true });
      }
      return saved;
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "We couldn't save this lesson note.");
      return null;
    } finally {
      setSaving(false);
    }
  }

  /** Publishing with unsaved changes saves them first, so learners never get an older version than the screen shows. */
  async function publish() {
    if (!note) return;
    setActionPending(true);
    setError(null);
    try {
      if (dirty && !(await save())) {
        return;
      }
      applyNote(await publishClassLessonNote(classId, note.id));
    } catch (err) {
      setError(getErrorMessage(err, "We couldn't publish this lesson note."));
    } finally {
      setActionPending(false);
    }
  }

  async function unpublish() {
    if (!note) return;
    setActionPending(true);
    setError(null);
    try {
      applyNote(await unpublishClassLessonNote(classId, note.id));
    } catch (err) {
      setError(getErrorMessage(err, "We couldn't unpublish this lesson note."));
    } finally {
      setActionPending(false);
    }
  }

  async function remove() {
    if (!note) return;
    await deleteClassLessonNote(classId, note.id);
    navigate(listPath, { replace: true });
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

  const actions = note?.actions;
  const canGenerateWithAi = !readOnly && can.authorClassLessonNotes("CREATOR", plan?.aiLessonNotes ?? false);
  const showConvertPrompt =
    !readOnly && content.mode === "DOCUMENT" && richTextIsBlank(content.body) && structuredHasContent(content);

  return (
    <div className="space-y-6 pb-24">
      <PageHeader
        title={note ? "Lesson note" : "New lesson note"}
        description={note?.className ?? className ?? undefined}
        backTo={listPath}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {note && <ClassLessonNoteStatusBadge status={note.status} />}
            {!readOnly && content.mode === "STRUCTURED" && (
              <Button type="button" variant="secondary" onClick={() => setPreviewMode((current) => !current)}>
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
            {actions?.canPublish && (
              <Button type="button" variant="primary" loading={actionPending} onClick={publish}>
                Publish
              </Button>
            )}
            {actions?.canUnpublish && (
              <Button type="button" variant="secondary" loading={actionPending} onClick={unpublish}>
                Unpublish
              </Button>
            )}
            {actions?.canDelete && (
              <Button type="button" variant="danger" onClick={() => setConfirmDelete(true)}>
                <Trash2 className="h-4 w-4" aria-hidden="true" />
                Delete
              </Button>
            )}
          </div>
        }
      />

      {error && <Alert variant="error">{error}</Alert>}
      {note?.status === "PUBLISHED" && !readOnly && (
        <p className="text-sm text-slate-500">
          Published - your learners see each change as soon as you save it.
        </p>
      )}
      {readOnly && (
        <Alert variant="info">
          This class is archived or beyond your plan's class limit, so this note is read-only.
        </Alert>
      )}

      {!readOnly && (
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
          {sessionDate && <p className="text-sm text-slate-500">Session: {formatLongDate(sessionDate)}</p>}
          <div>
            <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-500">Topic</p>
            <p className="text-sm text-slate-900">
              <MathText text={topic} />
            </p>
          </div>
          <LessonNoteReadView content={content} renderImage={renderCreatorImage} />
        </div>
      ) : (
        <>
          <FormField
            label="Session date (optional)"
            htmlFor="class-note-session-date"
            description="The day this note is for. Leave it empty for a note about the class as a whole."
          >
            <div className="flex items-center gap-2">
              <DateInput id="class-note-session-date" value={sessionDate} onChange={setSessionDate} />
              {sessionDate && (
                <Button type="button" variant="ghost" size="sm" onClick={() => setSessionDate("")}>
                  <X className="h-4 w-4" aria-hidden="true" />
                  Clear
                </Button>
              )}
            </div>
          </FormField>

          <FormField label="Topic" htmlFor="class-note-topic">
            <Input
              id="class-note-topic"
              value={topic}
              onChange={(event) => setTopic(event.target.value)}
              required
              enterKeyHint="next"
            />
          </FormField>

          {content.mode === "DOCUMENT" ? (
            <div className="space-y-3">
              {showConvertPrompt && (
                <Alert variant="info">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span>Your structured content hasn't been copied into this document yet.</span>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => setContent({ ...content, mode: "DOCUMENT", body: lessonNoteContentToHtml(content) })}
                    >
                      <Wand2 className="h-4 w-4" aria-hidden="true" />
                      Convert now
                    </Button>
                  </div>
                </Alert>
              )}
              <LessonNoteDocumentEditor body={content.body ?? ""} onChange={(body) => setContent({ ...content, body })} />
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
          onSave={() => void save()}
          onDiscard={discard}
          saveVariant="primary"
        />
      )}

      {confirmDelete && (
        <ConfirmDialog
          title="Delete this lesson note?"
          message={
            note?.status === "PUBLISHED"
              ? "Your learners will no longer see it. This can't be undone."
              : "This can't be undone."
          }
          confirmLabel="Delete"
          variant="danger"
          onConfirm={remove}
          onClose={() => setConfirmDelete(false)}
        />
      )}
      {aiSheetOpen && (
        <AiGenerateSheet
          generate={(input, handlers, signal) =>
            generateClassLessonNote(
              classId,
              {
                topic: input.topic,
                sessionDate: sessionDate || null,
                audienceHint: input.hint,
                extraInstructions: input.extraInstructions,
              },
              handlers,
              signal,
            )
          }
          copy={CREATOR_AI_COPY}
          initialTopic={topic}
          onClose={() => setAiSheetOpen(false)}
          onApply={applyGenerated}
        />
      )}
    </div>
  );
}
