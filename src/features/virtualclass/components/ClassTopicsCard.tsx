import { ArrowDown, ArrowUp, ClipboardPen, Pencil, Plus, Sheet, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router";
import { getErrorMessage } from "@/api/client";
import {
  type ClassTopic,
  createClassTopic,
  deleteClassTopic,
  listClassTopics,
  reorderClassTopics,
  updateClassTopic,
} from "@/api/classTopics";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Spinner } from "@/components/ui/Spinner";
import { TopicFormModal } from "./TopicFormModal";

interface ClassTopicsCardProps {
  classId: string;
  /** False for an archived or over-limit class - topics and grades are then read-only. */
  writable: boolean;
}

/**
 * The topics a class covers, in the tutor's order. Each topic opens a gradebook where the tutor
 * gives every enrolled learner a free-text grade and an optional comment; learners see them once
 * the tutor publishes that topic's grades.
 */
export function ClassTopicsCard({ classId, writable }: ClassTopicsCardProps) {
  const [topics, setTopics] = useState<ClassTopic[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<ClassTopic | "new" | null>(null);
  const [deleting, setDeleting] = useState<ClassTopic | null>(null);
  const [moving, setMoving] = useState(false);

  const load = useCallback(() => {
    listClassTopics(classId)
      .then(setTopics)
      .catch((loadError: unknown) => setError(getErrorMessage(loadError, "Failed to load topics.")));
  }, [classId]);

  useEffect(load, [load]);

  async function move(index: number, offset: -1 | 1) {
    if (!topics) return;
    const ids = topics.map((topic) => topic.id);
    [ids[index], ids[index + offset]] = [ids[index + offset], ids[index]];
    setMoving(true);
    setError(null);
    try {
      setTopics(await reorderClassTopics(classId, ids));
    } catch (moveError) {
      setError(getErrorMessage(moveError, "Failed to reorder topics."));
    } finally {
      setMoving(false);
    }
  }

  return (
    <Card>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Topics</h2>
          <p className="text-sm text-slate-500">
            What this class covers. Grade learners on each topic, then publish the grades for them to see.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {topics && topics.length > 0 && (
            <Link
              to={`/tutor/classes/${classId}/grades`}
              className="inline-flex items-center gap-2 rounded-control border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-900 hover:bg-slate-50 mobile:min-h-11"
            >
              <Sheet className="h-4 w-4" /> Grade all topics
            </Link>
          )}
          {writable && (
            <Button variant="secondary" onClick={() => setEditing("new")}>
              <Plus className="h-4 w-4" /> Add topic
            </Button>
          )}
        </div>
      </div>
      {error && (
        <Alert variant="error" className="mb-2">
          {error}
        </Alert>
      )}
      {topics === null && !error ? (
        <Spinner />
      ) : topics && topics.length === 0 ? (
        <p className="py-6 text-center text-sm text-slate-500">
          {writable ? "No topics yet. Add the first topic this class will cover." : "No topics yet."}
        </p>
      ) : (
        topics && (
          <ol className="divide-y divide-slate-100">
            {topics.map((topic, index) => (
              <li key={topic.id} className="flex flex-wrap items-center gap-2 py-2">
                <span className="w-6 shrink-0 text-sm text-slate-400">{index + 1}.</span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-slate-900">{topic.title}</p>
                  {topic.description && (
                    <p className="text-sm whitespace-pre-line text-slate-500">{topic.description}</p>
                  )}
                </div>
                {topic.gradesPublishedAt ? (
                  <Badge variant="success">Grades published</Badge>
                ) : (
                  <Badge variant="neutral">Draft</Badge>
                )}
                <Link
                  to={`/tutor/classes/${classId}/topics/${topic.id}`}
                  aria-label={`Grade learners on ${topic.title}`}
                  className="inline-flex items-center gap-1 rounded-control px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 mobile:min-h-11"
                >
                  <ClipboardPen className="h-4 w-4" /> Grade
                </Link>
                {writable && (
                  <>
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-label={`Move ${topic.title} up`}
                      disabled={index === 0 || moving}
                      onClick={() => void move(index, -1)}
                    >
                      <ArrowUp className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-label={`Move ${topic.title} down`}
                      disabled={index === topics.length - 1 || moving}
                      onClick={() => void move(index, 1)}
                    >
                      <ArrowDown className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-label={`Edit ${topic.title}`}
                      onClick={() => setEditing(topic)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-label={`Delete ${topic.title}`}
                      onClick={() => setDeleting(topic)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </>
                )}
              </li>
            ))}
          </ol>
        )
      )}
      {editing && (
        <TopicFormModal
          existing={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSubmit={async (input) => {
            if (editing === "new") {
              await createClassTopic(classId, input);
            } else {
              await updateClassTopic(classId, editing.id, input);
            }
            setEditing(null);
            load();
          }}
        />
      )}
      {deleting && (
        <ConfirmDialog
          title="Delete this topic?"
          message={`"${deleting.title}" and every grade given on it are permanently deleted.`}
          confirmLabel="Delete topic"
          variant="danger"
          onClose={() => setDeleting(null)}
          onConfirm={async () => {
            await deleteClassTopic(classId, deleting.id);
            setDeleting(null);
            load();
          }}
        />
      )}
    </Card>
  );
}
