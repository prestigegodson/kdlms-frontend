import { useEffect, useState } from "react";
import { useParams } from "react-router";
import type { UserSummary } from "@/api/auth";
import {
  assignClassTeacher,
  assignSubjectTeacher,
  getClass,
  listSubjectTeachers,
  type SchoolClassView,
  type SubjectTeacherView,
  unassignClassTeacher,
  unassignSubjectTeacher,
} from "@/api/classes";
import { ApiError } from "@/api/client";
import { listRecordableSubjects } from "@/api/me";
import { listSubjects, type SubjectView } from "@/api/subjects";
import { listTeachers } from "@/api/users";
import { can } from "@/auth/permissions";
import { BookOpen } from "lucide-react";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { FormField } from "@/components/ui/FormField";
import { PageHeader } from "@/components/ui/PageHeader";
import { Select } from "@/components/ui/Select";
import { Spinner } from "@/components/ui/Spinner";
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from "@/components/ui/Table";
import { useAuthStore } from "@/stores/authStore";

type LoadState =
  | { kind: "loading" }
  | { kind: "loaded"; schoolClass: SchoolClassView }
  | { kind: "error"; message: string };

/**
 * Class detail: class-teacher assignment and the per-subject teacher
 * assignment grid. A TEACHER only ever reaches a class they're assigned to
 * (the backend 404s otherwise - see ClassAccessGuard) and sees everything
 * here read-only; assignment controls stay admin-only.
 */
export function ClassDetailPage() {
  const { classId } = useParams<{ classId: string }>();
  const role = useAuthStore((state) => state.user?.role);
  const canManage = can.manageAcademics(role);

  const [state, setState] = useState<LoadState>({ kind: "loading" });
  const [teachers, setTeachers] = useState<UserSummary[] | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [unassigningTeacher, setUnassigningTeacher] = useState(false);

  function fetchClass() {
    if (!classId) return;
    getClass(classId)
      .then((schoolClass) => setState({ kind: "loaded", schoolClass }))
      .catch((error: unknown) =>
        setState({
          kind: "error",
          message: error instanceof ApiError ? error.message : "Failed to load class",
        }),
      );
  }

  useEffect(fetchClass, [classId]);

  useEffect(() => {
    // GET /api/v1/users/teachers is admin-only - a TEACHER can't pick a
    // teacher to assign anyway, so skip the call entirely rather than let
    // it 403 and silently fall back to an empty list.
    if (!canManage) return;
    listTeachers(0, 200)
      .then((page) => setTeachers(page.content))
      .catch(() => setTeachers([]));
  }, [canManage]);

  function load() {
    setState({ kind: "loading" });
    fetchClass();
  }

  async function handleAssignClassTeacher(teacherId: string) {
    if (!classId) return;
    setActionError(null);
    try {
      await assignClassTeacher(classId, teacherId);
      load();
    } catch (error) {
      setActionError(error instanceof ApiError ? error.message : "That action failed");
    }
  }

  async function confirmUnassignClassTeacher() {
    if (!classId) return;
    // Deliberately not caught here - ConfirmDialog's own onConfirm handling
    // surfaces a rejection inline in the dialog and keeps it open, the same
    // pattern BranchesPage's confirmDeactivate uses.
    await unassignClassTeacher(classId);
    setUnassigningTeacher(false);
    load();
  }

  if (state.kind === "loading") {
    return (
      <div className="space-y-6">
        <PageHeader title="Class details" backTo="/school/academics/classes" />
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Spinner /> Loading…
        </div>
      </div>
    );
  }
  if (state.kind === "error") {
    return (
      <div className="space-y-6">
        <PageHeader title="Class details" backTo="/school/academics/classes" />
        <Alert variant="error">{state.message}</Alert>
      </div>
    );
  }

  const { schoolClass } = state;
  const branchTeachers = teachers?.filter((teacher) => teacher.branchId === schoolClass.branchId) ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title={schoolClass.name}
        backTo="/school/academics/classes"
        actions={
          <Badge variant={schoolClass.status === "ACTIVE" ? "success" : "neutral"}>
            {schoolClass.status}
          </Badge>
        }
      />

      {actionError && <Alert variant="error">{actionError}</Alert>}

      <Card>
        <h2 className="text-sm font-semibold text-slate-900">Class teacher</h2>
        {schoolClass.classTeacherName ? (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-slate-900">{schoolClass.classTeacherName}</p>
            {canManage && (
              <Button variant="secondary" onClick={() => setUnassigningTeacher(true)}>
                Unassign
              </Button>
            )}
          </div>
        ) : (
          <p className="mt-1 text-sm text-slate-500">No class teacher assigned yet.</p>
        )}

        {canManage && teachers !== null && !schoolClass.classTeacherId && (
          <div className="mt-4 max-w-sm">
            <FormField label="Assign a class teacher" htmlFor="class-teacher-select">
              <Select
                id="class-teacher-select"
                value=""
                onChange={(event) => event.target.value && handleAssignClassTeacher(event.target.value)}
              >
                <option value="">Select a teacher…</option>
                {branchTeachers.map((teacher) => (
                  <option key={teacher.id} value={teacher.id}>
                    {teacher.firstName} {teacher.lastName}
                  </option>
                ))}
              </Select>
            </FormField>
            {branchTeachers.length === 0 && (
              <p className="mt-1 text-xs text-slate-500">
                No teachers in this branch yet - add one on the Teachers page.
              </p>
            )}
          </div>
        )}
      </Card>

      <SubjectTeachersCard
        classId={schoolClass.id}
        levelId={schoolClass.levelId}
        branchTeachers={branchTeachers}
        canManage={canManage}
        onActionError={setActionError}
      />

      {unassigningTeacher && (
        <ConfirmDialog
          title="Unassign the class teacher?"
          message={<>{schoolClass.classTeacherName} will no longer be this class's teacher.</>}
          confirmLabel="Unassign"
          variant="danger"
          onConfirm={confirmUnassignClassTeacher}
          onClose={() => setUnassigningTeacher(false)}
        />
      )}
    </div>
  );
}

interface SubjectTeachersCardProps {
  classId: string;
  levelId: string;
  branchTeachers: UserSummary[];
  canManage: boolean;
  onActionError: (message: string) => void;
}

function SubjectTeachersCard({
  classId,
  levelId,
  branchTeachers,
  canManage,
  onActionError,
}: SubjectTeachersCardProps) {
  const [assignments, setAssignments] = useState<SubjectTeacherView[] | null>(null);
  const [subjects, setSubjects] = useState<SubjectView[] | null>(null);
  const [removing, setRemoving] = useState<SubjectTeacherView | null>(null);

  function fetchAssignments() {
    listSubjectTeachers(classId)
      .then(setAssignments)
      .catch((error: unknown) =>
        onActionError(error instanceof ApiError ? error.message : "Failed to load subject teachers"),
      );
  }

  useEffect(fetchAssignments, [classId, onActionError]);

  useEffect(() => {
    // GET /api/v1/subjects is the admin catalogue (levelId-wide, not
    // teacher-accessible); a TEACHER instead gets exactly the subjects
    // they may be shown for this class from the /me endpoint - every
    // subject of the level if they're its class teacher, else only their
    // own assigned subject(s) (see backend TeacherAssignmentsService).
    const subjectsForCard = canManage
      ? listSubjects(levelId, 0, 100).then((page) => page.content)
      : listRecordableSubjects(classId);
    subjectsForCard.then(setSubjects).catch(() => setSubjects([]));
  }, [levelId, classId, canManage]);

  async function handleAssign(subjectId: string, teacherId: string) {
    try {
      await assignSubjectTeacher(classId, subjectId, teacherId);
      fetchAssignments();
    } catch (error) {
      onActionError(error instanceof ApiError ? error.message : "That action failed");
    }
  }

  async function confirmRemove() {
    if (!removing) return;
    await unassignSubjectTeacher(classId, removing.subjectId);
    setRemoving(null);
    fetchAssignments();
  }

  if (assignments === null || subjects === null) {
    return (
      <Card>
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Spinner /> Loading subject teachers…
        </div>
      </Card>
    );
  }

  const assignedBySubject = new Map(assignments.map((assignment) => [assignment.subjectId, assignment]));

  return (
    <Card className="p-0">
      <div className="p-6 pb-0">
        <h2 className="text-sm font-semibold text-slate-900">Subject teachers</h2>
      </div>
      <div className="p-6">
        {subjects.length === 0 ? (
          <EmptyState
            icon={BookOpen}
            title="No subjects for this level yet"
            description="Add subjects on the Subjects page before assigning teachers."
          />
        ) : (
          <Table>
            <TableHead>
              <TableRow>
                <TableHeaderCell>Subject</TableHeaderCell>
                <TableHeaderCell>Teacher</TableHeaderCell>
                {canManage && <TableHeaderCell>Actions</TableHeaderCell>}
              </TableRow>
            </TableHead>
            <TableBody>
              {subjects.map((subject) => {
                const assignment = assignedBySubject.get(subject.id);
                return (
                  <TableRow key={subject.id}>
                    <TableCell label="Subject" className="font-medium text-slate-900">
                      {subject.name}
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
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>

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
    </Card>
  );
}
