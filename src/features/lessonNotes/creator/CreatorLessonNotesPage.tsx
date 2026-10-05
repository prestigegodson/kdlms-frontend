import { NotebookPen, Plus } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { getErrorMessage } from "@/api/client";
import { type ClassLessonNoteListView, listClassLessonNotes } from "@/api/lessonNotes";
import { listVirtualClasses, type VirtualClass } from "@/api/virtualClasses";
import { can } from "@/auth/permissions";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { FormField } from "@/components/ui/FormField";
import { PageHeader } from "@/components/ui/PageHeader";
import { Select } from "@/components/ui/Select";
import { Skeleton } from "@/components/ui/Skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from "@/components/ui/Table";
import { ClassLessonNoteStatusBadge } from "@/features/lessonNotes/creator/ClassLessonNoteStatusBadge";
import { MathText } from "@/features/lessonNotes/components/MathText";
import { useCreatorPlanStore } from "@/stores/creatorPlanStore";
import { formatInstant, formatLongDate } from "@/utils/date";

/**
 * A creator's lesson notes (creators Phase C12): pick a class, see its notes newest session first,
 * and open one to edit, publish or unpublish it. The class lives in the URL (`?classId=`), so a
 * class page's "Lesson notes" link lands straight on it. Without lesson notes in the plan, an
 * upgrade notice replaces the page, the C11 Messages pattern.
 */
export function CreatorLessonNotesPage() {
  const fetchPlan = useCreatorPlanStore((state) => state.fetchIfNeeded);
  const plan = useCreatorPlanStore((state) => state.plan);
  const planStatus = useCreatorPlanStore((state) => state.status);
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const classId = searchParams.get("classId");

  const [classes, setClasses] = useState<VirtualClass[] | null>(null);
  const [loadedNotes, setNotes] = useState<ClassLessonNoteListView | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Shown only while it still matches the URL - a class switch shows a skeleton until its own list arrives.
  const notes = loadedNotes?.classId === classId ? loadedNotes : null;

  useEffect(() => {
    fetchPlan();
  }, [fetchPlan]);

  // Unknown while the plan loads; if it can't be loaded, carry on and let the server's own answer show.
  const entitled =
    planStatus === "loaded"
      ? can.viewClassLessonNotes("CREATOR", plan?.lessonNotes ?? false)
      : planStatus === "error"
        ? true
        : null;

  useEffect(() => {
    if (entitled !== true) {
      return;
    }
    listVirtualClasses()
      .then((list) =>
        setClasses(
          [...list.classes].sort((a, b) =>
            a.status === b.status ? a.name.localeCompare(b.name) : a.status === "ACTIVE" ? -1 : 1,
          ),
        ),
      )
      .catch((err: unknown) => setError(getErrorMessage(err, "We couldn't load your classes.")));
  }, [entitled]);

  // Land on the first class when none is chosen yet.
  useEffect(() => {
    if (!classId && classes && classes.length > 0) {
      setSearchParams({ classId: classes[0].id }, { replace: true });
    }
  }, [classId, classes, setSearchParams]);

  const loadNotes = useCallback(() => {
    if (!classId) {
      return;
    }
    listClassLessonNotes(classId)
      .then((loaded) => {
        setNotes(loaded);
        setError(null);
      })
      .catch((err: unknown) => setError(getErrorMessage(err, "We couldn't load this class's lesson notes.")));
  }, [classId]);

  useEffect(() => {
    if (entitled === true) {
      loadNotes();
    }
  }, [entitled, loadNotes]);

  if (entitled === false) {
    return (
      <div className="space-y-6">
        <PageHeader title="Lesson notes" />
        <EmptyState
          icon={NotebookPen}
          title="Lesson notes aren't in your plan"
          description="Upgrade to a plan with lesson notes to prepare and share notes for each of your classes."
          action={
            <Link
              to="/creator/billing"
              className="inline-flex min-h-11 items-center rounded-control bg-brand-500 px-4 text-sm font-medium text-white hover:bg-brand-600"
            >
              See plans
            </Link>
          }
        />
      </div>
    );
  }

  const canAdd = !!notes?.writable && can.authorClassLessonNotes("CREATOR", true);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Lesson notes"
        description="Prepare a note for each session. Publishing shares it with the class's learners straight away."
        actions={
          canAdd && classId ? (
            <Button onClick={() => navigate(`/creator/lesson-notes/${classId}/new`)}>
              <Plus className="h-4 w-4" aria-hidden="true" />
              New note
            </Button>
          ) : undefined
        }
      />

      {error ? (
        <ErrorState message={error} onRetry={loadNotes} />
      ) : classes === null ? (
        <Skeleton className="h-40" />
      ) : classes.length === 0 ? (
        <EmptyState
          icon={NotebookPen}
          title="No classes yet"
          description="Create a class to start writing lesson notes for it."
        />
      ) : (
        <>
          <FormField label="Class" htmlFor="lesson-notes-class">
            <Select
              id="lesson-notes-class"
              value={classId ?? ""}
              onChange={(event) => setSearchParams({ classId: event.target.value })}
            >
              {classes.map((virtualClass) => (
                <option key={virtualClass.id} value={virtualClass.id}>
                  {virtualClass.name}
                  {virtualClass.status === "ARCHIVED" ? " (archived)" : ""}
                </option>
              ))}
            </Select>
          </FormField>

          {notes && !notes.writable && (
            <Alert variant="info">
              This class is archived or beyond your plan's class limit, so its notes are read-only.
            </Alert>
          )}

          {notes === null ? (
            <Skeleton className="h-40" />
          ) : notes.notes.length === 0 ? (
            <EmptyState
              icon={NotebookPen}
              title="No lesson notes yet"
              description={
                notes.writable ? "Write your first note for this class." : "This class has no lesson notes."
              }
            />
          ) : (
            <Table>
              <TableHead>
                <TableRow>
                  <TableHeaderCell>Session</TableHeaderCell>
                  <TableHeaderCell>Topic</TableHeaderCell>
                  <TableHeaderCell>Status</TableHeaderCell>
                  <TableHeaderCell className="max-sm:hidden">Updated</TableHeaderCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {notes.notes.map((note) => (
                  <TableRow key={note.id} to={`/creator/lesson-notes/${notes.classId}/${note.id}`}>
                    <TableCell label="Session">{note.sessionDate ? formatLongDate(note.sessionDate) : "Any session"}</TableCell>
                    <TableCell label="Topic">
                      <span className="font-medium text-slate-900">
                        <MathText text={note.topic} />
                      </span>
                      {note.aiGenerated && (
                        <Badge variant="neutral" className="ml-2">
                          AI-assisted
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell label="Status">
                      <ClassLessonNoteStatusBadge status={note.status} />
                    </TableCell>
                    <TableCell label="Updated" className="max-sm:hidden">{formatInstant(note.updatedAt)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </>
      )}
    </div>
  );
}
