import { Eye, EyeOff, MessageSquare } from "lucide-react";
import { type KeyboardEvent, useEffect, useMemo, useState } from "react";
import { Link, useBlocker } from "react-router";
import { getErrorMessage } from "@/api/client";
import {
  type ClassGradebook,
  type ClassTopic,
  TOPIC_COMMENT_MAX,
  TOPIC_GRADE_MAX,
  publishTopicGrades,
  saveClassGrades,
  unpublishTopicGrades,
} from "@/api/classTopics";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from "@/components/ui/Table";
import { Textarea } from "@/components/ui/Textarea";
import { UnsavedChangesBar } from "@/features/assessments/components/UnsavedChangesBar";

interface Draft {
  grade: string;
  comment: string;
}

/**
 * Pins a header cell to the top of the grid's scroll box. The background and inset bottom rule sit
 * on the `th` itself - the thead's own background and border don't travel with sticky cells.
 */
const STICKY_HEADER_CELL = "sticky top-0 bg-slate-50 shadow-[inset_0_-1px_0_theme(colors.slate.200)]";

/** A (learner, topic) cell's draft key - both ids are UUIDs, so `:` never collides. */
function cellKey(learnerId: string, topicId: string): string {
  return `${learnerId}:${topicId}`;
}

/** Every cell of the broadsheet, graded or not, as its saved grade and comment. */
function savedDrafts(gradebook: ClassGradebook): Record<string, Draft> {
  const drafts: Record<string, Draft> = {};
  for (const learner of gradebook.learners) {
    for (const topic of gradebook.topics) {
      drafts[cellKey(learner.learnerId, topic.id)] = { grade: "", comment: "" };
    }
  }
  for (const cell of gradebook.grades) {
    drafts[cellKey(cell.learnerId, cell.topicId)] = { grade: cell.grade, comment: cell.comment ?? "" };
  }
  return drafts;
}

interface CommentEditor {
  key: string;
  learnerName: string;
  topicTitle: string;
  value: string;
}

interface ClassGradesGridProps {
  classId: string;
  gradebook: ClassGradebook;
  /** False for an archived or over-limit class - every cell and publish control is then read-only. */
  writable: boolean;
  /** A saved or published change - the parent adopts the refreshed broadsheet. */
  onChange: (gradebook: ClassGradebook) => void;
}

/**
 * The class broadsheet: topics down the left, learners across the top, each cell a free-text grade
 * with an optional comment (edited in a small dialog, flagged by a dot once written). Changed cells
 * batch into the sticky save bar and go out in one all-or-nothing save; leaving with unsaved cells
 * asks first. Each topic row publishes or unpublishes its own grades, only once nothing is
 * unsaved. From `md` up the grid scrolls inside a viewport-high box with the learner row and topic
 * column pinned; below `md` the shared Table collapses each topic into a card of its learners.
 */
export function ClassGradesGrid({ classId, gradebook, writable, onChange }: ClassGradesGridProps) {
  const [drafts, setDrafts] = useState<Record<string, Draft>>(() => savedDrafts(gradebook));
  const [saving, setSaving] = useState(false);
  const [publishingTopicId, setPublishingTopicId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [commentEditor, setCommentEditor] = useState<CommentEditor | null>(null);

  // A new broadsheet (after a save or a publish) is adopted during render rather than in an effect,
  // so the grid never paints one frame of stale drafts against fresh data.
  const [lastGradebook, setLastGradebook] = useState(gradebook);
  if (gradebook !== lastGradebook) {
    setLastGradebook(gradebook);
    setDrafts(savedDrafts(gradebook));
  }

  const saved = useMemo(() => savedDrafts(gradebook), [gradebook]);
  const changed = useMemo(
    () =>
      Object.keys(drafts).filter((key) => {
        const draft = drafts[key];
        const current = saved[key] ?? { grade: "", comment: "" };
        return draft.grade.trim() !== current.grade || draft.comment.trim() !== current.comment;
      }),
    [drafts, saved],
  );
  const changedKeys = useMemo(() => new Set(changed), [changed]);
  const commentWithoutGrade = changed.some((key) => {
    const draft = drafts[key];
    return draft.comment.trim() !== "" && draft.grade.trim() === "";
  });

  const blocker = useBlocker(changed.length > 0);

  useEffect(() => {
    function handler(event: BeforeUnloadEvent) {
      if (changed.length > 0) {
        event.preventDefault();
      }
    }
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [changed]);

  function updateCell(key: string, patch: Partial<Draft>) {
    setDrafts((current) => ({ ...current, [key]: { ...current[key], ...patch } }));
  }

  function discard() {
    setDrafts(savedDrafts(gradebook));
    setError(null);
  }

  function focusCell(rowIndex: number, columnIndex: number) {
    document.getElementById(`class-grade-${rowIndex}-${columnIndex}`)?.focus();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>, rowIndex: number, columnIndex: number) {
    if (event.key === "Enter" || event.key === "ArrowDown") {
      event.preventDefault();
      focusCell(rowIndex + 1, columnIndex);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      focusCell(rowIndex - 1, columnIndex);
    }
  }

  async function handleSave() {
    if (commentWithoutGrade) return;
    setSaving(true);
    setError(null);
    try {
      const updated = await saveClassGrades(
        classId,
        changed.map((key) => {
          const [learnerId, topicId] = key.split(":");
          return { learnerId, topicId, ...drafts[key] };
        }),
      );
      onChange(updated);
    } catch (saveError) {
      setError(getErrorMessage(saveError, "Failed to save grades."));
    } finally {
      setSaving(false);
    }
  }

  async function togglePublished(topic: ClassTopic) {
    setPublishingTopicId(topic.id);
    setError(null);
    try {
      const updatedTopic = topic.gradesPublishedAt
        ? await unpublishTopicGrades(classId, topic.id)
        : await publishTopicGrades(classId, topic.id);
      onChange({
        ...gradebook,
        topics: gradebook.topics.map((current) => (current.id === updatedTopic.id ? updatedTopic : current)),
      });
    } catch (publishError) {
      setError(getErrorMessage(publishError, "Failed to change who can see these grades."));
    } finally {
      setPublishingTopicId(null);
    }
  }

  if (gradebook.topics.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-slate-500">
        Add topics to start grading.{" "}
        <Link to={`/tutor/classes/${classId}/topics`} className="font-medium text-brand-700 hover:underline">
          Go to topics
        </Link>
      </p>
    );
  }
  if (gradebook.learners.length === 0) {
    return <p className="py-6 text-center text-sm text-slate-500">No learners are enrolled in this class.</p>;
  }

  return (
    <div className="space-y-4 pb-4">
      {error && <Alert variant="error">{error}</Alert>}
      {commentWithoutGrade && (
        <Alert variant="error">Enter a grade for every cell you've written a comment for.</Alert>
      )}

      <Table containerClassName="md:max-h-[75vh] md:overflow-auto">
        <TableHead>
          <TableRow>
            <TableHeaderCell className={`left-0 z-30 min-w-[12rem] ${STICKY_HEADER_CELL}`}>Topic</TableHeaderCell>
            {gradebook.learners.map((learner, columnIndex) => (
              <TableHeaderCell
                key={learner.learnerId}
                className={`z-20 min-w-[11rem] normal-case tracking-normal ${STICKY_HEADER_CELL}`}
              >
                <span className="mr-2 tabular-nums text-slate-400">{columnIndex + 1}.</span>
                <span className="text-sm font-medium text-slate-900">
                  {learner.firstName} {learner.lastName}
                </span>
              </TableHeaderCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {gradebook.topics.map((topic, rowIndex) => {
            const published = Boolean(topic.gradesPublishedAt);
            return (
              <TableRow key={topic.id}>
                <TableCell className="sticky left-0 z-10 bg-white">
                  <span className="block font-medium text-slate-900">{topic.title}</span>
                  <span className="mt-1 flex items-center gap-1">
                    {published ? (
                      <Badge variant="success">Published</Badge>
                    ) : (
                      <Badge variant="neutral">Draft</Badge>
                    )}
                    {writable && (
                      <Button
                        variant="ghost"
                        size="sm"
                        aria-label={`${published ? "Unpublish" : "Publish"} grades for ${topic.title}`}
                        title={
                          changed.length > 0
                            ? "Save your changes first"
                            : published
                              ? "Unpublish grades"
                              : "Publish grades"
                        }
                        disabled={changed.length > 0 || publishingTopicId !== null}
                        loading={publishingTopicId === topic.id}
                        onClick={() => void togglePublished(topic)}
                      >
                        {published ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                    )}
                  </span>
                </TableCell>
                {gradebook.learners.map((learner, columnIndex) => {
                  const learnerName = `${learner.firstName} ${learner.lastName}`;
                  const key = cellKey(learner.learnerId, topic.id);
                  const draft = drafts[key] ?? { grade: "", comment: "" };
                  const hasComment = draft.comment.trim() !== "";
                  return (
                    <TableCell key={key} label={learnerName}>
                      <div className="flex items-center gap-1">
                        <Input
                          id={`class-grade-${rowIndex}-${columnIndex}`}
                          aria-label={`Grade for ${learnerName} on ${topic.title}`}
                          className={changedKeys.has(key) ? "border-brand-400" : ""}
                          value={draft.grade}
                          maxLength={TOPIC_GRADE_MAX}
                          placeholder="Grade"
                          enterKeyHint="next"
                          disabled={!writable}
                          onChange={(event) => updateCell(key, { grade: event.target.value })}
                          onKeyDown={(event) => handleKeyDown(event, rowIndex, columnIndex)}
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          className="relative shrink-0"
                          aria-label={`${hasComment ? "Comment" : "Add a comment"} for ${learnerName} on ${topic.title}`}
                          title={hasComment ? draft.comment : "Add a comment"}
                          disabled={!writable && !hasComment}
                          onClick={() =>
                            setCommentEditor({ key, learnerName, topicTitle: topic.title, value: draft.comment })
                          }
                        >
                          <MessageSquare className="h-4 w-4" />
                          {hasComment && (
                            <span
                              aria-hidden="true"
                              className="absolute right-1 top-1 h-2 w-2 rounded-full bg-brand-600"
                            />
                          )}
                        </Button>
                      </div>
                    </TableCell>
                  );
                })}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      {writable && (
        <UnsavedChangesBar count={changed.length} saving={saving} onSave={handleSave} onDiscard={discard} />
      )}

      {commentEditor && (
        <Modal
          open
          size="md"
          title={`Comment for ${commentEditor.learnerName}`}
          onClose={() => setCommentEditor(null)}
        >
          <div className="space-y-4">
            <p className="text-sm text-slate-500">{commentEditor.topicTitle}</p>
            <Textarea
              aria-label={`Comment for ${commentEditor.learnerName} on ${commentEditor.topicTitle}`}
              value={commentEditor.value}
              maxLength={TOPIC_COMMENT_MAX}
              rows={4}
              disabled={!writable}
              autoFocus
              onChange={(event) => setCommentEditor({ ...commentEditor, value: event.target.value })}
            />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setCommentEditor(null)}>
                {writable ? "Cancel" : "Close"}
              </Button>
              {writable && (
                <Button
                  onClick={() => {
                    updateCell(commentEditor.key, { comment: commentEditor.value });
                    setCommentEditor(null);
                  }}
                >
                  Done
                </Button>
              )}
            </div>
          </div>
        </Modal>
      )}

      {blocker.state === "blocked" && (
        <ConfirmDialog
          title="Leave without saving?"
          message="You have unsaved grades on this broadsheet that will be lost."
          confirmLabel="Leave"
          variant="danger"
          onConfirm={async () => {
            blocker.proceed();
          }}
          onClose={() => blocker.reset()}
        />
      )}
    </div>
  );
}
