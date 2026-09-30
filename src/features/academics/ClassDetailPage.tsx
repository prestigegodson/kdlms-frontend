import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router";
import type { UserSummary } from "@/api/auth";
import { listBranches, type BranchView } from "@/api/branches";
import {
  assignAssistantTeacher,
  assignClassTeacher,
  assignSubjectTeacher,
  getClass,
  listClassStudents,
  listSubjectTeachers,
  type RosterStudentView,
  type SchoolClassView,
  type SubjectTeacherView,
  unassignAssistantTeacher,
  unassignClassTeacher,
  unassignSubjectTeacher,
} from "@/api/classes";
import { ApiError } from "@/api/client";
import { listRecordableSubjects } from "@/api/me";
import { listSubjects, type SubjectView } from "@/api/subjects";
import { listTeachers } from "@/api/users";
import { can } from "@/auth/permissions";
import { BookOpen, UserCheck, Users } from "lucide-react";
import { ClassRosterPanel } from "@/features/academics/components/ClassRosterPanel";
import { SubjectTeachersPanel } from "@/features/academics/components/SubjectTeachersPanel";
import { ProvisionClassLoginsModal } from "@/features/students/components/ProvisionClassLoginsModal";
import { RegisterStudentModal } from "@/features/students/components/RegisterStudentModal";
import { UpcomingBirthdaysCard } from "@/features/students/components/UpcomingBirthdaysCard";
import { Accordion } from "@/components/ui/Accordion";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { FormField } from "@/components/ui/FormField";
import { PageHeader } from "@/components/ui/PageHeader";
import { Select } from "@/components/ui/Select";
import { Skeleton } from "@/components/ui/Skeleton";
import { StatTile } from "@/components/ui/StatTile";
import { TableSkeleton } from "@/components/ui/TableSkeleton";
import { useAuthStore } from "@/stores/authStore";
import { useFeatureStore } from "@/stores/featureStore";
import { useLevelStore } from "@/stores/levelStore";
import { useTeacherScopeStore } from "@/stores/teacherScopeStore";

/** Which teacher slot an unassign confirmation is for. */
type TeacherSlotKind = "classTeacher" | "assistant";

const SLOT_COPY: Record<TeacherSlotKind, { title: string; noun: string }> = {
  classTeacher: { title: "Class teacher", noun: "class teacher" },
  assistant: { title: "Co-Teacher", noun: "co-teacher" },
};

type LoadState =
  | { kind: "loading" }
  | { kind: "loaded"; schoolClass: SchoolClassView }
  | { kind: "error"; message: string };

/**
 * Class detail: an at-a-glance summary, class-teacher and assistant-teacher
 * assignment (the assistant holds identical class-teacher access), the
 * enrolled-students roster, and the per-subject teacher assignment grid. A
 * TEACHER only ever reaches a class they're assigned to (the backend 404s
 * otherwise - see ClassAccessGuard) and sees everything here read-only;
 * assignment/registration controls stay admin-only.
 */
export function ClassDetailPage() {
  const { classId } = useParams<{ classId: string }>();
  const navigate = useNavigate();
  const role = useAuthStore((state) => state.user?.role);
  const currentUserId = useAuthStore((state) => state.user?.id);
  const teacherCapabilities = useTeacherScopeStore((state) => state.capabilities);
  const canManage = can.manageAcademics(role, teacherCapabilities);
  const canManageSubjectRegistrations = can.manageStudentSubjects(role, teacherCapabilities);
  const showAttendanceLink = can.viewAttendance(role, teacherCapabilities);
  const showResultsLink = can.viewResults(role);
  const studentLoginsEntitled = useFeatureStore((state) => state.studentLogins);
  const canProvisionLogins = can.manageStudentLogins(role, teacherCapabilities, studentLoginsEntitled);
  // Branch name is only fetched for a SCHOOL_ADMIN (the one role that spans
  // branches) - a BRANCH_ADMIN/TEACHER already knows they're confined to a
  // single branch, the same reasoning StudentsPage hides the branch filter
  // for them entirely.
  const showBranchName = can.manageBranches(role);

  const levels = useLevelStore((state) => state.levels);
  const fetchLevels = useLevelStore((state) => state.fetchIfNeeded);

  const [state, setState] = useState<LoadState>({ kind: "loading" });
  const [teachers, setTeachers] = useState<UserSummary[] | null>(null);
  const [branches, setBranches] = useState<BranchView[] | null>(null);
  const [roster, setRoster] = useState<RosterStudentView[] | null>(null);
  const [assignments, setAssignments] = useState<SubjectTeacherView[] | null>(null);
  const [subjects, setSubjects] = useState<SubjectView[] | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [unassigningSlot, setUnassigningSlot] = useState<TeacherSlotKind | null>(null);
  const [registerOpen, setRegisterOpen] = useState(false);
  const [provisionLoginsOpen, setProvisionLoginsOpen] = useState(false);

  function fetchClass() {
    if (!classId) return;
    getClass(classId)
      .then((schoolClass) => setState({ kind: "loaded", schoolClass }))
      .catch((error: unknown) =>
        setState({
          kind: "error",
          message: error instanceof ApiError ? error.message : "Failed to load classroom",
        }),
      );
  }

  useEffect(fetchClass, [classId]);
  useEffect(() => {
    fetchLevels();
  }, [fetchLevels]);

  function fetchRoster() {
    if (!classId) return;
    listClassStudents(classId)
      .then(setRoster)
      .catch((error: unknown) =>
        setActionError(error instanceof ApiError ? error.message : "Failed to load the classroom roster"),
      );
  }

  useEffect(fetchRoster, [classId]);

  function fetchAssignments() {
    if (!classId) return;
    listSubjectTeachers(classId)
      .then(setAssignments)
      .catch((error: unknown) =>
        setActionError(error instanceof ApiError ? error.message : "Failed to load subject teachers"),
      );
  }

  useEffect(fetchAssignments, [classId]);

  useEffect(() => {
    // GET /api/v1/users/teachers is admin-only - a TEACHER can't pick a
    // teacher to assign anyway, so skip the call entirely rather than let
    // it 403 and silently fall back to an empty list.
    if (!canManage) return;
    listTeachers(undefined, 0, 200)
      .then((page) => setTeachers(page.content))
      .catch(() => setTeachers([]));
  }, [canManage]);

  useEffect(() => {
    if (!showBranchName) return;
    listBranches()
      .then((page) => setBranches(page.content))
      .catch(() => setBranches([]));
  }, [showBranchName]);

  const levelId = state.kind === "loaded" ? state.schoolClass.levelId : undefined;
  useEffect(() => {
    if (!levelId || !classId) return;
    // GET /api/v1/subjects is the admin catalogue (levelId-wide, not
    // teacher-accessible); a TEACHER instead gets exactly the subjects they
    // may be shown for this class from the /me endpoint - every subject of
    // the level if they're its class teacher, else only their own assigned
    // subject(s) (see backend TeacherAssignmentsService).
    const subjectsForCard = canManage
      ? listSubjects(levelId, 0, 100).then((page) => page.content)
      : listRecordableSubjects(classId);
    subjectsForCard.then(setSubjects).catch(() => setSubjects([]));
  }, [levelId, classId, canManage]);

  function load() {
    setState({ kind: "loading" });
    fetchClass();
  }

  async function handleAssignTeacher(slot: TeacherSlotKind, teacherId: string) {
    if (!classId) return;
    setActionError(null);
    try {
      await (slot === "classTeacher" ? assignClassTeacher : assignAssistantTeacher)(classId, teacherId);
      load();
    } catch (error) {
      setActionError(error instanceof ApiError ? error.message : "That action failed");
    }
  }

  async function confirmUnassignTeacher() {
    if (!classId || !unassigningSlot) return;
    // Deliberately not caught here - ConfirmDialog's own onConfirm handling
    // surfaces a rejection inline in the dialog and keeps it open, the same
    // pattern BranchesPage's confirmDeactivate uses.
    await (unassigningSlot === "classTeacher" ? unassignClassTeacher : unassignAssistantTeacher)(classId);
    setUnassigningSlot(null);
    load();
  }

  async function handleAssignSubjectTeacher(subjectId: string, teacherId: string) {
    if (!classId) return;
    await assignSubjectTeacher(classId, subjectId, teacherId);
    fetchAssignments();
  }

  async function handleUnassignSubjectTeacher(assignment: SubjectTeacherView) {
    if (!classId) return;
    await unassignSubjectTeacher(classId, assignment.subjectId);
    fetchAssignments();
  }

  if (state.kind === "loading") {
    return (
      <div className="space-y-6">
        <PageHeader title="Classroom details" backTo="/school/academics/classrooms" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
        <TableSkeleton columns={3} />
      </div>
    );
  }
  if (state.kind === "error") {
    return (
      <div className="space-y-6">
        <PageHeader title="Classroom details" backTo="/school/academics/classrooms" />
        <Alert variant="error">{state.message}</Alert>
      </div>
    );
  }

  const { schoolClass } = state;
  const branchTeachers = teachers?.filter((teacher) => teacher.branchId === schoolClass.branchId) ?? [];
  const levelName = levels.find((level) => level.id === schoolClass.levelId)?.displayName;
  const branchName = branches?.find((branch) => branch.id === schoolClass.branchId)?.name;
  const description = [levelName, branchName].filter(Boolean).join(" · ") || undefined;

  const boys = roster?.filter((student) => student.gender === "MALE").length ?? 0;
  const girls = roster?.filter((student) => student.gender === "FEMALE").length ?? 0;
  const assignedSubjectCount = assignments?.length ?? 0;
  const showBirthdays = can.viewClassBirthdays(
    role,
    currentUserId !== undefined &&
      (schoolClass.classTeacherId === currentUserId || schoolClass.assistantTeacherId === currentUserId),
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title={schoolClass.name}
        description={description}
        backTo="/school/academics/classrooms"
        actions={
          <Badge variant={schoolClass.status === "ACTIVE" ? "success" : "neutral"}>
            {schoolClass.status}
          </Badge>
        }
      />

      {actionError && <Alert variant="error">{actionError}</Alert>}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatTile
          label="Students"
          value={roster ? roster.length : <Skeleton className="h-8 w-12" />}
          icon={Users}
          hint={roster ? `${boys} boys · ${girls} girls` : undefined}
        />
        <StatTile
          label="Subjects"
          value={subjects ? subjects.length : <Skeleton className="h-8 w-12" />}
          icon={BookOpen}
          hint={subjects ? `${assignedSubjectCount} with a teacher` : undefined}
        />
        <StatTile
          label="Class teacher"
          value={schoolClass.classTeacherName ?? "Unassigned"}
          icon={UserCheck}
          hint={schoolClass.assistantTeacherName ? `Co-Teacher: ${schoolClass.assistantTeacherName}` : undefined}
        />
      </div>

      {(showAttendanceLink || showResultsLink || canProvisionLogins) && (
        <div className="flex flex-wrap justify-end gap-2">
          {showAttendanceLink && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => navigate(`/school/attendance?classId=${schoolClass.id}`)}
            >
              Attendance register
            </Button>
          )}
          {showResultsLink && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => navigate(`/school/assessments?classId=${schoolClass.id}`)}
            >
              Results & broadsheet
            </Button>
          )}
          {canProvisionLogins && (
            <Button variant="secondary" size="sm" onClick={() => setProvisionLoginsOpen(true)}>
              Provision portal logins
            </Button>
          )}
        </div>
      )}

      <Accordion title="Class teacher" defaultOpen>
        <TeacherSlot
          slot="classTeacher"
          teacherId={schoolClass.classTeacherId}
          teacherName={schoolClass.classTeacherName}
          // The other slot's teacher can't fill this one too - the backend rejects it.
          candidates={branchTeachers.filter((teacher) => teacher.id !== schoolClass.assistantTeacherId)}
          canManage={canManage && teachers !== null}
          onAssign={(teacherId) => handleAssignTeacher("classTeacher", teacherId)}
          onUnassign={() => setUnassigningSlot("classTeacher")}
        />
      </Accordion>

      <Accordion title="Co-Teacher" defaultOpen={canManage || Boolean(schoolClass.assistantTeacherId)}>
        <p className="mb-3 text-xs text-slate-500">
          A co-teacher can do everything the class teacher can. Printed reports name the class teacher only.
        </p>
        <TeacherSlot
          slot="assistant"
          teacherId={schoolClass.assistantTeacherId}
          teacherName={schoolClass.assistantTeacherName}
          candidates={branchTeachers.filter((teacher) => teacher.id !== schoolClass.classTeacherId)}
          canManage={canManage && teachers !== null}
          onAssign={(teacherId) => handleAssignTeacher("assistant", teacherId)}
          onUnassign={() => setUnassigningSlot("assistant")}
        />
      </Accordion>

      <Accordion
        title={`Enrolled students${roster ? ` (${roster.length})` : ""}`}
        defaultOpen
        actions={
          canManage && roster && roster.length > 0 ? (
            <Button variant="secondary" onClick={() => setRegisterOpen(true)}>
              Register student
            </Button>
          ) : undefined
        }
      >
        {roster === null ? (
          <TableSkeleton columns={4} />
        ) : (
          <ClassRosterPanel students={roster} canManage={canManage} onRegister={() => setRegisterOpen(true)} />
        )}
      </Accordion>

      {showBirthdays && (
        <Accordion title="Upcoming birthdays">
          <UpcomingBirthdaysCard classId={schoolClass.id} linkable={can.manageStudents(role, teacherCapabilities)} showHeader={false} />
        </Accordion>
      )}

      <Accordion title={`Subject teachers${subjects ? ` (${subjects.length})` : ""}`}>
        {subjects === null || assignments === null ? (
          <TableSkeleton columns={canManage ? 3 : 2} />
        ) : (
          <SubjectTeachersPanel
            classId={schoolClass.id}
            subjects={subjects}
            assignments={assignments}
            branchTeachers={branchTeachers}
            canManage={canManage}
            canManageRegistrations={canManageSubjectRegistrations}
            onAssign={handleAssignSubjectTeacher}
            onUnassign={handleUnassignSubjectTeacher}
            onActionError={setActionError}
          />
        )}
      </Accordion>

      {unassigningSlot && (
        <ConfirmDialog
          title={`Unassign the ${SLOT_COPY[unassigningSlot].noun}?`}
          message={
            <>
              {unassigningSlot === "classTeacher" ? schoolClass.classTeacherName : schoolClass.assistantTeacherName}{" "}
              will no longer be this classroom's {SLOT_COPY[unassigningSlot].noun}.
            </>
          }
          confirmLabel="Unassign"
          variant="danger"
          onConfirm={confirmUnassignTeacher}
          onClose={() => setUnassigningSlot(null)}
        />
      )}

      {registerOpen && (
        <RegisterStudentModal
          fixedClass={{ id: schoolClass.id, name: schoolClass.name, branchId: schoolClass.branchId }}
          onClose={() => setRegisterOpen(false)}
          onSaved={() => {
            setRegisterOpen(false);
            fetchRoster();
          }}
        />
      )}

      <ProvisionClassLoginsModal
        open={provisionLoginsOpen}
        onClose={() => setProvisionLoginsOpen(false)}
        classId={schoolClass.id}
        onProvisioned={() => {
          /* no roster reload needed - login status isn't shown on this page's roster */
        }}
      />
    </div>
  );
}

interface TeacherSlotProps {
  slot: TeacherSlotKind;
  teacherId?: string;
  teacherName?: string;
  /** Branch teachers eligible for this slot - already excludes whoever holds the other slot. */
  candidates: UserSummary[];
  canManage: boolean;
  onAssign: (teacherId: string) => void;
  onUnassign: () => void;
}

/** One teacher slot on a classroom - the class teacher or the assistant teacher - with its assign/unassign controls. */
function TeacherSlot({ slot, teacherId, teacherName, candidates, canManage, onAssign, onUnassign }: TeacherSlotProps) {
  const { noun } = SLOT_COPY[slot];
  const selectId = `${slot}-select`;
  return (
    <>
      {teacherName ? (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-slate-900">{teacherName}</p>
          {canManage && (
            <Button variant="secondary" onClick={onUnassign}>
              Unassign
            </Button>
          )}
        </div>
      ) : (
        <p className="text-sm text-slate-500">No {noun} assigned yet.</p>
      )}

      {canManage && !teacherId && (
        <div className="mt-4 max-w-sm">
          <FormField label={`Assign a ${noun}`} htmlFor={selectId}>
            <Select
              id={selectId}
              value=""
              onChange={(event) => event.target.value && onAssign(event.target.value)}
            >
              <option value="">Select a teacher…</option>
              {candidates.map((teacher) => (
                <option key={teacher.id} value={teacher.id}>
                  {teacher.firstName} {teacher.lastName}
                </option>
              ))}
            </Select>
          </FormField>
          {candidates.length === 0 && (
            <p className="mt-1 text-xs text-slate-500">
              No other teachers in this branch yet - add one on the Teachers page.
            </p>
          )}
        </div>
      )}
    </>
  );
}
