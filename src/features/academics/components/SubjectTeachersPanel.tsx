import { useEffect, useState } from "react";
import type { UserSummary } from "@/api/auth";
import {
  getSubjectRegistrations,
  type SubjectRegistrationView,
  setSubjectRegistrations,
  type SubjectTeacherView,
} from "@/api/classes";
import { ApiError } from "@/api/client";
import type { MovementResult } from "@/api/students";
import type { SubjectView } from "@/api/subjects";
import { BookOpen } from "lucide-react";
import { OutcomeList } from "@/features/students/components/OutcomeList";
import { StudentPicker } from "@/features/students/components/StudentPicker";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { Modal } from "@/components/ui/Modal";
import { Select } from "@/components/ui/Select";
import { Spinner } from "@/components/ui/Spinner";
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from "@/components/ui/Table";

interface SubjectTeachersPanelProps {
  classId: string;
  subjects: SubjectView[];
  assignments: SubjectTeacherView[];
  branchTeachers: UserSummary[];
  canManage: boolean;
  canManageRegistrations: boolean;
  onAssign: (subjectId: string, teacherId: string) => Promise<void>;
  onUnassign: (assignment: SubjectTeacherView) => Promise<void>;
  onActionError: (message: string) => void;
}

/**
 * The per-subject teacher assignment grid, plus (for a selective subject)
 * its registered-students roster - moved out of {@code ClassDetailPage} so
 * the page can own the class-wide data fetch/refetch and this stays
 * presentational, mirroring {@code ClassRosterPanel}.
 */
export function SubjectTeachersPanel({
  classId,
  subjects,
  assignments,
  branchTeachers,
  canManage,
  canManageRegistrations,
  onAssign,
  onUnassign,
  onActionError,
}: SubjectTeachersPanelProps) {
  const [removing, setRemoving] = useState<SubjectTeacherView | null>(null);
  const [registering, setRegistering] = useState<SubjectView | null>(null);

  const assignedBySubject = new Map(assignments.map((assignment) => [assignment.subjectId, assignment]));
  const showRegistrationsColumn = canManageRegistrations && subjects.some((subject) => subject.selective);

  async function handleAssign(subjectId: string, teacherId: string) {
    try {
      await onAssign(subjectId, teacherId);
    } catch (error) {
      onActionError(error instanceof ApiError ? error.message : "That action failed");
    }
  }

  async function confirmRemove() {
    if (!removing) return;
    await onUnassign(removing);
    setRemoving(null);
  }

  if (subjects.length === 0) {
    return (
      <EmptyState
        icon={BookOpen}
        title="No subjects for this level yet"
        description="Add subjects on the Subjects page before assigning teachers."
      />
    );
  }

  return (
    <>
      <Table>
        <TableHead>
          <TableRow>
            <TableHeaderCell>Subject</TableHeaderCell>
            <TableHeaderCell>Teacher</TableHeaderCell>
            {canManage && <TableHeaderCell>Actions</TableHeaderCell>}
            {showRegistrationsColumn && <TableHeaderCell>Registered students</TableHeaderCell>}
          </TableRow>
        </TableHead>
        <TableBody>
          {subjects.map((subject) => {
            const assignment = assignedBySubject.get(subject.id);
            return (
              <TableRow key={subject.id}>
                <TableCell label="Subject" className="font-medium text-slate-900">
                  {subject.name}
                  {subject.selective && (
                    <Badge variant="neutral" className="ml-2">
                      Selective
                    </Badge>
                  )}
                </TableCell>
                <TableCell label="Teacher">{assignment?.teacherName ?? "—"}</TableCell>
                {canManage && (
                  <TableCell label="Actions">
                    <div className="flex flex-wrap items-center gap-3">
                      <Select
                        value=""
                        onChange={(event) => event.target.value && handleAssign(subject.id, event.target.value)}
                      >
                        <option value="">{assignment ? "Reassign…" : "Assign…"}</option>
                        {branchTeachers.map((teacher) => (
                          <option key={teacher.id} value={teacher.id}>
                            {teacher.firstName} {teacher.lastName}
                          </option>
                        ))}
                      </Select>
                      {assignment && (
                        <button
                          type="button"
                          className="text-slate-500 hover:text-slate-700"
                          onClick={() => setRemoving(assignment)}
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  </TableCell>
                )}
                {showRegistrationsColumn && (
                  <TableCell label="Registered students">
                    {subject.selective ? (
                      <button
                        type="button"
                        className="text-brand-500 hover:text-brand-600"
                        onClick={() => setRegistering(subject)}
                      >
                        Manage
                      </button>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                )}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      {removing && (
        <ConfirmDialog
          title="Remove this subject teacher?"
          message={
            <>
              {removing.teacherName} will no longer teach {removing.subjectName} in this class.
            </>
          }
          confirmLabel="Remove"
          variant="danger"
          onConfirm={confirmRemove}
          onClose={() => setRemoving(null)}
        />
      )}

      {registering && (
        <SubjectRegistrationModal classId={classId} subject={registering} onClose={() => setRegistering(null)} />
      )}
    </>
  );
}

interface SubjectRegistrationModalProps {
  classId: string;
  subject: SubjectView;
  onClose: () => void;
}

/**
 * Bulk-sets which students on this class's current roster take a selective
 * subject - a full replace, same "checked set is the complete desired
 * membership" contract as StudentDetailPage's per-student equivalent.
 */
function SubjectRegistrationModal({ classId, subject, onClose }: SubjectRegistrationModalProps) {
  const [view, setView] = useState<SubjectRegistrationView | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<MovementResult | null>(null);

  useEffect(() => {
    getSubjectRegistrations(classId, subject.id)
      .then((data) => {
        setView(data);
        setSelected(new Set(data.students.filter((student) => student.registered).map((student) => student.studentId)));
      })
      .catch((err: unknown) => setError(err instanceof ApiError ? err.message : "Failed to load the class roster"));
  }, [classId, subject.id]);

  function toggle(studentId: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(studentId)) {
        next.delete(studentId);
      } else {
        next.add(studentId);
      }
      return next;
    });
  }

  async function handleSave() {
    setSubmitting(true);
    setError(null);
    try {
      const outcome = await setSubjectRegistrations(classId, subject.id, [...selected]);
      setResult(outcome);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to save registrations");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal open onClose={onClose} title={`Registered students — ${subject.name}`}>
      <div className="space-y-4">
        {error && <Alert variant="error">{error}</Alert>}
        {view === null && (
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Spinner /> Loading roster…
          </div>
        )}
        {view !== null && view.students.length === 0 && (
          <EmptyState
            title="No students on this class's current roster"
            description="Nothing to register yet."
          />
        )}
        {view !== null && view.students.length > 0 && (
          <StudentPicker
            rows={view.students.map((student) => ({
              id: student.studentId,
              name: student.studentName,
              admissionNumber: student.admissionNumber,
            }))}
            selected={selected}
            onToggle={toggle}
            onSelectAll={() => setSelected(new Set(view.students.map((student) => student.studentId)))}
            onSelectNone={() => setSelected(new Set())}
          />
        )}
        {result && (
          <OutcomeList
            result={result}
            nameOf={(id) => view?.students.find((student) => student.studentId === id)?.studentName ?? id}
          />
        )}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Close
          </Button>
          {view !== null && view.students.length > 0 && (
            <Button type="button" disabled={submitting} onClick={handleSave}>
              {submitting ? "Saving…" : "Save"}
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
}
