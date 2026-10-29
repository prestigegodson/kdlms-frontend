import { Eye, EyeOff } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router";
import { getErrorMessage } from "@/api/client";
import {
  type TopicGradebook,
  TOPIC_COMMENT_MAX,
  TOPIC_GRADE_MAX,
  getTopicGradebook,
  publishTopicGrades,
  saveTopicGrades,
  unpublishTopicGrades,
} from "@/api/classTopics";
import { type VirtualClass, getVirtualClass } from "@/api/virtualClasses";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { PageHeader } from "@/components/ui/PageHeader";
import { Spinner } from "@/components/ui/Spinner";
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from "@/components/ui/Table";
import { Textarea } from "@/components/ui/Textarea";

interface Draft {
  grade: string;
  comment: string;
}

function draftsOf(gradebook: TopicGradebook): Record<string, Draft> {
  return Object.fromEntries(
    gradebook.learners.map((row) => [row.learnerId, { grade: row.grade ?? "", comment: row.comment ?? "" }]),
  );
}

/**
 * The gradebook for one topic of a class: every enrolled learner with a free-text grade and an
 * optional comment. Only changed rows are saved; clearing both fields removes a learner's grade.
 * Learners and their guardians see the grades once the tutor publishes them.
 */
export function TopicGradesPage() {
  const { classId = "", topicId = "" } = useParams();
  const [virtualClass, setVirtualClass] = useState<VirtualClass | null>(null);
  const [gradebook, setGradebook] = useState<TopicGradebook | null>(null);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [loadError, setLoadError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);

  useEffect(() => {
    Promise.all([getVirtualClass(classId), getTopicGradebook(classId, topicId)])
      .then(([loadedClass, loadedGradebook]) => {
        setVirtualClass(loadedClass);
        setGradebook(loadedGradebook);
        setDrafts(draftsOf(loadedGradebook));
      })
      .catch((err: unknown) => setLoadError(getErrorMessage(err, "Failed to load this topic.")));
  }, [classId, topicId]);

  const changed = useMemo(() => {
    if (!gradebook) return [];
    return gradebook.learners
      .filter((row) => {
        const draft = drafts[row.learnerId];
        return draft && (draft.grade.trim() !== (row.grade ?? "") || draft.comment.trim() !== (row.comment ?? ""));
      })
      .map((row) => row.learnerId);
  }, [gradebook, drafts]);

  const backTo = `/tutor/classes/${classId}/topics`;
  if (loadError) {
    return (
      <div className="space-y-6">
        <PageHeader title="Topic grades" backTo={backTo} backLabel="Back to topics" />
        <Alert variant="error">{loadError}</Alert>
      </div>
    );
  }
  if (!virtualClass || !gradebook) {
    return (
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <Spinner /> Loading grades…
      </div>
    );
  }

  const writable = virtualClass.status !== "ARCHIVED" && !virtualClass.overLimit;
  const { topic } = gradebook;
  const published = Boolean(topic.gradesPublishedAt);
  const commentWithoutGrade = changed.some((learnerId) => {
    const draft = drafts[learnerId];
    return draft.comment.trim() !== "" && draft.grade.trim() === "";
  });

  function setDraft(learnerId: string, patch: Partial<Draft>) {
    setSaved(false);
    setDrafts((current) => ({ ...current, [learnerId]: { ...current[learnerId], ...patch } }));
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const updated = await saveTopicGrades(
        classId,
        topicId,
        changed.map((learnerId) => ({ learnerId, ...drafts[learnerId] })),
      );
      setGradebook(updated);
      setDrafts(draftsOf(updated));
      setSaved(true);
    } catch (saveError) {
      setError(getErrorMessage(saveError, "Failed to save grades."));
    } finally {
      setSaving(false);
    }
  }

  async function togglePublished() {
    setPublishing(true);
    setError(null);
    try {
      const updatedTopic = published
        ? await unpublishTopicGrades(classId, topicId)
        : await publishTopicGrades(classId, topicId);
      setGradebook((current) => (current ? { ...current, topic: updatedTopic } : current));
    } catch (publishError) {
      setError(getErrorMessage(publishError, "Failed to change who can see these grades."));
    } finally {
      setPublishing(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={topic.title}
        description={`${virtualClass.name} · topic grades`}
        backTo={backTo}
        backLabel="Back to topics"
        actions={
          writable ? (
            <Button
              variant="secondary"
              onClick={() => void togglePublished()}
              loading={publishing}
              disabled={changed.length > 0}
            >
              {published ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              {published ? "Unpublish grades" : "Publish grades"}
            </Button>
          ) : undefined
        }
      />

      {topic.description && <p className="text-sm whitespace-pre-line text-slate-700">{topic.description}</p>}
      {!writable && (
        <Alert variant="info">This class is archived or over your plan's limit, so its grades are read-only.</Alert>
      )}
      <Alert variant={published ? "success" : "info"} title={published ? "Grades published" : "Not published yet"}>
        {published
          ? "Learners and their guardians can see their own grade and comment. Changes you save are visible straight away."
          : "Only you can see these grades. Publish them when you're ready for learners and their guardians to see them."}
        {writable && changed.length > 0 && " Save your changes before publishing or unpublishing."}
      </Alert>
      {error && <Alert variant="error">{error}</Alert>}

      <Card>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Learners</h2>
            <p className="text-sm text-slate-500">
              A grade can be anything - a letter, a score or a word. The comment is optional.
            </p>
          </div>
          {writable && (
            <Button
              onClick={() => void handleSave()}
              loading={saving}
              disabled={changed.length === 0 || commentWithoutGrade}
            >
              Save grades
            </Button>
          )}
        </div>
        {saved && changed.length === 0 && (
          <Alert variant="success" className="mb-2">
            Grades saved.
          </Alert>
        )}
        {commentWithoutGrade && (
          <Alert variant="error" className="mb-2">
            Enter a grade for every learner you've written a comment for.
          </Alert>
        )}
        {gradebook.learners.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-500">No learners are enrolled in this class.</p>
        ) : (
          <Table>
            <TableHead>
              <TableRow>
                <TableHeaderCell>Learner</TableHeaderCell>
                <TableHeaderCell>Grade</TableHeaderCell>
                <TableHeaderCell>Comment</TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {gradebook.learners.map((row) => {
                const name = `${row.firstName} ${row.lastName}`;
                const draft = drafts[row.learnerId] ?? { grade: "", comment: "" };
                return (
                  <TableRow key={row.learnerId}>
                    <TableCell label="Learner">
                      {name}
                      {changed.includes(row.learnerId) && (
                        <Badge variant="warning" className="ml-2">
                          Unsaved
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell label="Grade" className="sm:w-40">
                      <Input
                        aria-label={`Grade for ${name}`}
                        value={draft.grade}
                        maxLength={TOPIC_GRADE_MAX}
                        disabled={!writable}
                        placeholder="e.g. A, 8/10"
                        onChange={(event) => setDraft(row.learnerId, { grade: event.target.value })}
                      />
                    </TableCell>
                    <TableCell label="Comment">
                      <Textarea
                        aria-label={`Comment for ${name}`}
                        value={draft.comment}
                        maxLength={TOPIC_COMMENT_MAX}
                        disabled={!writable}
                        rows={2}
                        onChange={(event) => setDraft(row.learnerId, { comment: event.target.value })}
                      />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
