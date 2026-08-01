import { type FormEvent, useEffect, useState } from "react";
import { Link, useParams } from "react-router";
import { listClasses, type SchoolClassView } from "@/api/classes";
import { ApiError } from "@/api/client";
import {
  createGuardian,
  type GuardianView,
  linkGuardianToStudent,
  listGuardians,
  unlinkGuardianFromStudent,
} from "@/api/guardians";
import { listSessions, type AcademicSessionView } from "@/api/sessions";
import {
  type EnrollmentView,
  getStudent,
  graduateStudent,
  listStudentEnrollments,
  listStudentGuardians,
  reinstateStudent,
  type StudentGuardianView,
  transferStudentClass,
  updateStudent,
  withdrawStudent,
  type StudentView,
} from "@/api/students";
import { can } from "@/auth/permissions";
import { StudentAttendanceCard } from "@/features/attendance/components/StudentAttendanceCard";
import { UserPlus } from "lucide-react";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { FormField } from "@/components/ui/FormField";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { SearchInput } from "@/components/ui/SearchInput";
import { Select } from "@/components/ui/Select";
import { Spinner } from "@/components/ui/Spinner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
} from "@/components/ui/Table";
import { useAuthStore } from "@/stores/authStore";
import { formatLongDate } from "@/utils/date";

type LoadState =
  | { kind: "loading" }
  | { kind: "loaded"; student: StudentView }
  | { kind: "error"; message: string };

const RELATIONSHIPS = ["FATHER", "MOTHER", "GUARDIAN", "OTHER"] as const;

/** Student bio, enrollment history, and linked guardians. */
export function StudentDetailPage() {
  const { studentId } = useParams<{ studentId: string }>();
  const role = useAuthStore((state) => state.user?.role);
  const canManage = can.manageStudents(role);

  const [state, setState] = useState<LoadState>({ kind: "loading" });
  const [actionError, setActionError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [confirmingGraduate, setConfirmingGraduate] = useState(false);
  const [confirmingWithdraw, setConfirmingWithdraw] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  function fetchStudent() {
    if (!studentId) return;
    getStudent(studentId)
      .then((student) => setState({ kind: "loaded", student }))
      .catch((error: unknown) =>
        setState({
          kind: "error",
          message: error instanceof ApiError ? error.message : "Failed to load student",
        }),
      );
  }

  useEffect(fetchStudent, [studentId]);

  function load() {
    fetchStudent();
    setRefreshKey((key) => key + 1);
  }

  async function confirmGraduate() {
    if (!studentId) return;
    await graduateStudent(studentId);
    setConfirmingGraduate(false);
    load();
  }

  async function confirmWithdraw() {
    if (!studentId) return;
    await withdrawStudent(studentId);
    setConfirmingWithdraw(false);
    load();
  }

  async function handleReinstate() {
    if (!studentId) return;
    setActionError(null);
    try {
      await reinstateStudent(studentId);
      load();
    } catch (error) {
      setActionError(error instanceof ApiError ? error.message : "That action failed");
    }
  }

  if (state.kind === "loading") {
    return (
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <Spinner /> Loading…
      </div>
    );
  }
  if (state.kind === "error") {
    return <Alert variant="error">{state.message}</Alert>;
  }

  const { student } = state;

  return (
    <div className="space-y-6">
      <Link to="/school/students" className="text-sm text-brand-500 hover:text-brand-600">
        &larr; All students
      </Link>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-medium text-slate-900">{student.fullName}</h1>
          <p className="mt-1 text-sm text-slate-500">{student.admissionNumber}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge
            variant={
              student.status === "ACTIVE"
                ? "success"
                : student.status === "WITHDRAWN"
                  ? "danger"
                  : "neutral"
            }
          >
            {student.status}
          </Badge>
          {canManage && (
            <Button variant="secondary" onClick={() => setEditing(true)}>
              Edit
            </Button>
          )}
          {canManage && student.status === "ACTIVE" && (
            <>
              <Button variant="secondary" onClick={() => setConfirmingWithdraw(true)}>
                Withdraw
              </Button>
              <Button variant="secondary" onClick={() => setConfirmingGraduate(true)}>
                Graduate
              </Button>
            </>
          )}
          {canManage && student.status === "WITHDRAWN" && (
            <Button variant="secondary" onClick={handleReinstate}>
              Reinstate
            </Button>
          )}
        </div>
      </div>

      {actionError && <Alert variant="error">{actionError}</Alert>}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="text-sm font-semibold text-slate-900">Bio</h2>
          <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
            <div>
              <dt className="text-slate-500">Branch</dt>
              <dd className="text-slate-900">{student.branchName ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Current class</dt>
              <dd className="text-slate-900">{student.currentClassName ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Gender</dt>
              <dd className="text-slate-900">{student.gender === "FEMALE" ? "Female" : "Male"}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Date of birth</dt>
              <dd className="text-slate-900">{formatLongDate(student.dateOfBirth)}</dd>
            </div>
            {student.otherName && (
              <div className="col-span-2">
                <dt className="text-slate-500">Other name</dt>
                <dd className="text-slate-900">{student.otherName}</dd>
              </div>
            )}
          </dl>
        </Card>

        <GuardiansCard
          studentId={student.id}
          canManage={canManage}
          onActionError={setActionError}
        />
      </div>

      <EnrollmentHistoryCard
        key={refreshKey}
        student={student}
        canManage={canManage}
        onTransferred={load}
        onActionError={setActionError}
      />

      <StudentAttendanceCard studentId={student.id} />

      {editing && (
        <EditStudentModal
          student={student}
          onClose={() => setEditing(false)}
          onSaved={() => {
            setEditing(false);
            load();
          }}
        />
      )}
      {confirmingGraduate && (
        <ConfirmDialog
          title="Graduate this student?"
          message={
            <>
              <strong>{student.fullName}</strong> will be marked graduated and their current
              enrollment closed. This can't be undone from here.
            </>
          }
          confirmLabel="Graduate"
          variant="danger"
          onConfirm={confirmGraduate}
          onClose={() => setConfirmingGraduate(false)}
        />
      )}
      {confirmingWithdraw && (
        <ConfirmDialog
          title="Withdraw this student?"
          message={
            <>
              <strong>{student.fullName}</strong> will be marked withdrawn and their current
              enrollment closed. They can be reinstated later.
            </>
          }
          confirmLabel="Withdraw"
          variant="danger"
          onConfirm={confirmWithdraw}
          onClose={() => setConfirmingWithdraw(false)}
        />
      )}
    </div>
  );
}

interface EditStudentModalProps {
  student: StudentView;
  onClose: () => void;
  onSaved: () => void;
}

function EditStudentModal({ student, onClose, onSaved }: EditStudentModalProps) {
  const [firstName, setFirstName] = useState(student.firstName);
  const [lastName, setLastName] = useState(student.lastName);
  const [otherName, setOtherName] = useState(student.otherName ?? "");
  const [gender, setGender] = useState<"FEMALE" | "MALE">(student.gender);
  const [dateOfBirth, setDateOfBirth] = useState(student.dateOfBirth ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await updateStudent(student.id, {
        firstName,
        lastName,
        otherName: otherName || undefined,
        gender,
        dateOfBirth: dateOfBirth || undefined,
      });
      onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to save student");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal open onClose={onClose} title="Edit student">
      <form className="space-y-4" onSubmit={handleSubmit}>
        {error && <Alert variant="error">{error}</Alert>}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField label="First name" htmlFor="edit-first-name">
            <Input
              id="edit-first-name"
              required
              value={firstName}
              onChange={(event) => setFirstName(event.target.value)}
            />
          </FormField>
          <FormField label="Last name" htmlFor="edit-last-name">
            <Input
              id="edit-last-name"
              required
              value={lastName}
              onChange={(event) => setLastName(event.target.value)}
            />
          </FormField>
        </div>
        <FormField label="Other name" htmlFor="edit-other-name">
          <Input
            id="edit-other-name"
            value={otherName}
            onChange={(event) => setOtherName(event.target.value)}
          />
        </FormField>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField label="Gender" htmlFor="edit-gender">
            <Select
              id="edit-gender"
              required
              value={gender}
              onChange={(event) => setGender(event.target.value as "FEMALE" | "MALE")}
            >
              <option value="FEMALE">Female</option>
              <option value="MALE">Male</option>
            </Select>
          </FormField>
          <FormField label="Date of birth" htmlFor="edit-dob">
            <Input
              id="edit-dob"
              type="date"
              value={dateOfBirth}
              onChange={(event) => setDateOfBirth(event.target.value)}
            />
          </FormField>
        </div>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting ? "Saving…" : "Save changes"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

interface EnrollmentHistoryCardProps {
  student: StudentView;
  canManage: boolean;
  onTransferred: () => void;
  onActionError: (message: string) => void;
}

function EnrollmentHistoryCard({
  student,
  canManage,
  onTransferred,
  onActionError,
}: EnrollmentHistoryCardProps) {
  const [history, setHistory] = useState<EnrollmentView[] | null>(null);
  const [sessions, setSessions] = useState<AcademicSessionView[] | null>(null);
  const [transferring, setTransferring] = useState(false);

  useEffect(() => {
    listStudentEnrollments(student.id)
      .then(setHistory)
      .catch((error: unknown) =>
        onActionError(
          error instanceof ApiError ? error.message : "Failed to load enrollment history",
        ),
      );
    listSessions(0, 50)
      .then((page) => setSessions(page.content))
      .catch(() => setSessions([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- onActionError is a stable setState setter
  }, [student.id]);

  function sessionName(sessionId: string) {
    return sessions?.find((session) => session.id === sessionId)?.name ?? "—";
  }

  return (
    <Card className="p-0">
      <div className="flex items-center justify-between p-6 pb-0">
        <h2 className="text-sm font-semibold text-slate-900">Enrollment history</h2>
        {canManage && student.status === "ACTIVE" && (
          <button
            type="button"
            className="text-sm font-medium text-brand-500 hover:text-brand-600"
            onClick={() => setTransferring(true)}
          >
            Transfer class
          </button>
        )}
      </div>
      <div className="p-6">
        {history === null && (
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Spinner /> Loading…
          </div>
        )}
        {history !== null && history.length === 0 && (
          <EmptyState
            title="No enrollment history"
            description="This student has never been enrolled in a class."
          />
        )}
        {history !== null && history.length > 0 && (
          <Table>
            <TableHead>
              <TableRow>
                <TableHeaderCell>Session</TableHeaderCell>
                <TableHeaderCell>Class</TableHeaderCell>
                <TableHeaderCell>Type</TableHeaderCell>
                <TableHeaderCell>Status</TableHeaderCell>
                <TableHeaderCell>Enrolled</TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {history.map((enrollment) => (
                <TableRow key={enrollment.id}>
                  <TableCell label="Session">{sessionName(enrollment.sessionId)}</TableCell>
                  <TableCell label="Class">{enrollment.className ?? "—"}</TableCell>
                  <TableCell label="Type">{enrollment.enrollmentType}</TableCell>
                  <TableCell label="Status">
                    <Badge variant={enrollment.status === "ACTIVE" ? "success" : "neutral"}>
                      {enrollment.status}
                    </Badge>
                  </TableCell>
                  <TableCell label="Enrolled">{formatLongDate(enrollment.enrolledAt)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {transferring && (
        <TransferClassModal
          student={student}
          onClose={() => setTransferring(false)}
          onSaved={() => {
            setTransferring(false);
            onTransferred();
          }}
        />
      )}
    </Card>
  );
}

interface TransferClassModalProps {
  student: StudentView;
  onClose: () => void;
  onSaved: () => void;
}

function TransferClassModal({ student, onClose, onSaved }: TransferClassModalProps) {
  const [classes, setClasses] = useState<SchoolClassView[] | null>(null);
  const [classId, setClassId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listClasses(student.branchId, undefined, 0, 200)
      .then((page) => {
        const options = page.content.filter(
          (schoolClass) =>
            schoolClass.status === "ACTIVE" && schoolClass.id !== student.currentClassId,
        );
        setClasses(options);
        setClassId(options[0]?.id ?? "");
      })
      .catch(() => setClasses([]));
  }, [student.branchId, student.currentClassId]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await transferStudentClass(student.id, classId);
      onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to transfer student");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal open onClose={onClose} title="Transfer to another class">
      <form className="space-y-4" onSubmit={handleSubmit}>
        {error && <Alert variant="error">{error}</Alert>}
        <p className="text-sm text-slate-500">
          Moves {student.fullName} to a different class in the same branch, within the current
          session.
        </p>
        {classes !== null && classes.length === 0 && (
          <Alert variant="warning">No other active classes are available in this branch.</Alert>
        )}
        {classes !== null && classes.length > 0 && (
          <FormField label="Target class" htmlFor="transfer-class">
            <Select
              id="transfer-class"
              required
              value={classId}
              onChange={(event) => setClassId(event.target.value)}
            >
              {classes.map((schoolClass) => (
                <option key={schoolClass.id} value={schoolClass.id}>
                  {schoolClass.name}
                </option>
              ))}
            </Select>
          </FormField>
        )}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={submitting || !classId}>
            {submitting ? "Transferring…" : "Transfer"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

interface GuardiansCardProps {
  studentId: string;
  canManage: boolean;
  onActionError: (message: string) => void;
}

function GuardiansCard({ studentId, canManage, onActionError }: GuardiansCardProps) {
  const [guardians, setGuardians] = useState<StudentGuardianView[] | null>(null);
  const [linking, setLinking] = useState(false);
  const [unlinking, setUnlinking] = useState<StudentGuardianView | null>(null);

  function fetchGuardians() {
    listStudentGuardians(studentId)
      .then(setGuardians)
      .catch((error: unknown) =>
        onActionError(error instanceof ApiError ? error.message : "Failed to load guardians"),
      );
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps -- onActionError is a stable setState setter
  useEffect(fetchGuardians, [studentId]);

  async function confirmUnlink() {
    if (!unlinking) return;
    await unlinkGuardianFromStudent(unlinking.guardianId, studentId);
    setUnlinking(null);
    fetchGuardians();
  }

  return (
    <Card className="p-0">
      <div className="flex items-center justify-between p-6 pb-0">
        <h2 className="text-sm font-semibold text-slate-900">Guardians</h2>
        {canManage && (
          <button
            type="button"
            className="flex items-center gap-1 text-sm font-medium text-brand-500 hover:text-brand-600"
            onClick={() => setLinking(true)}
          >
            <UserPlus className="h-4 w-4" aria-hidden="true" />
            Link guardian
          </button>
        )}
      </div>
      <div className="p-6">
        {guardians === null && (
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Spinner /> Loading…
          </div>
        )}
        {guardians !== null && guardians.length === 0 && (
          <EmptyState
            title="No guardians linked"
            description="Link an existing guardian or add a new one."
          />
        )}
        {guardians !== null && guardians.length > 0 && (
          <ul className="space-y-3">
            {guardians.map((guardian) => (
              <li
                key={guardian.guardianId}
                className="flex items-center justify-between gap-3 text-sm"
              >
                <div>
                  <p className="font-medium text-slate-900">{guardian.guardianName}</p>
                  <p className="text-slate-500">
                    {guardian.email} &middot; {guardian.relationship}
                  </p>
                </div>
                {canManage && (
                  <button
                    type="button"
                    className="text-slate-500 hover:text-slate-700"
                    onClick={() => setUnlinking(guardian)}
                  >
                    Unlink
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {linking && (
        <LinkGuardianModal
          studentId={studentId}
          onClose={() => setLinking(false)}
          onSaved={() => {
            setLinking(false);
            fetchGuardians();
          }}
        />
      )}
      {unlinking && (
        <ConfirmDialog
          title="Unlink this guardian?"
          message={
            <>
              <strong>{unlinking.guardianName}</strong> will no longer be linked to this student.
              Their account is unaffected.
            </>
          }
          confirmLabel="Unlink"
          variant="danger"
          onConfirm={confirmUnlink}
          onClose={() => setUnlinking(null)}
        />
      )}
    </Card>
  );
}

interface LinkGuardianModalProps {
  studentId: string;
  onClose: () => void;
  onSaved: () => void;
}

/** Two ways to add a guardian: search for and link an existing one, or provision a brand-new account. */
function LinkGuardianModal({ studentId, onClose, onSaved }: LinkGuardianModalProps) {
  const [mode, setMode] = useState<"existing" | "new">("existing");

  return (
    <Modal open onClose={onClose} title="Link a guardian">
      <div className="mb-4 flex gap-2">
        <button
          type="button"
          onClick={() => setMode("existing")}
          className={`rounded-control px-3 py-1.5 text-sm font-medium ${mode === "existing" ? "bg-brand-50 text-brand-800" : "text-slate-500 hover:bg-slate-100"}`}
        >
          Existing guardian
        </button>
        <button
          type="button"
          onClick={() => setMode("new")}
          className={`rounded-control px-3 py-1.5 text-sm font-medium ${mode === "new" ? "bg-brand-50 text-brand-800" : "text-slate-500 hover:bg-slate-100"}`}
        >
          New guardian
        </button>
      </div>
      {mode === "existing" ? (
        <LinkExistingGuardianForm studentId={studentId} onSaved={onSaved} onCancel={onClose} />
      ) : (
        <LinkNewGuardianForm studentId={studentId} onSaved={onSaved} onCancel={onClose} />
      )}
    </Modal>
  );
}

function LinkExistingGuardianForm({
  studentId,
  onSaved,
  onCancel,
}: {
  studentId: string;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GuardianView[] | null>(null);
  const [selected, setSelected] = useState<GuardianView | null>(null);
  const [relationship, setRelationship] = useState<(typeof RELATIONSHIPS)[number]>("MOTHER");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!query) {
      return;
    }
    listGuardians(query, 0, 5)
      .then((page) => setResults(page.content))
      .catch(() => setResults([]));
  }, [query]);

  async function handleLink() {
    if (!selected) return;
    setSubmitting(true);
    setError(null);
    try {
      await linkGuardianToStudent(selected.id, studentId, relationship);
      onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to link guardian");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-4">
      {error && <Alert variant="error">{error}</Alert>}
      <SearchInput value={query} onChange={setQuery} placeholder="Search by name or email" />
      {query && results !== null && results.length === 0 && (
        <p className="text-sm text-slate-500">No matching guardians.</p>
      )}
      {query && results !== null && results.length > 0 && (
        <ul className="divide-y divide-slate-100 rounded-panel border border-slate-200">
          {results.map((guardian) => (
            <li key={guardian.id}>
              <button
                type="button"
                onClick={() => setSelected(guardian)}
                className={`block w-full px-3 py-2 text-left text-sm hover:bg-slate-50 ${selected?.id === guardian.id ? "bg-brand-50" : ""}`}
              >
                <p className="font-medium text-slate-900">{guardian.fullName}</p>
                <p className="text-slate-500">{guardian.email}</p>
              </button>
            </li>
          ))}
        </ul>
      )}
      {selected && (
        <FormField label="Relationship" htmlFor="link-relationship">
          <Select
            id="link-relationship"
            value={relationship}
            onChange={(event) =>
              setRelationship(event.target.value as (typeof RELATIONSHIPS)[number])
            }
          >
            {RELATIONSHIPS.map((option) => (
              <option key={option} value={option}>
                {option.charAt(0) + option.slice(1).toLowerCase()}
              </option>
            ))}
          </Select>
        </FormField>
      )}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="button" disabled={!selected || submitting} onClick={handleLink}>
          {submitting ? "Linking…" : "Link guardian"}
        </Button>
      </div>
    </div>
  );
}

function LinkNewGuardianForm({
  studentId,
  onSaved,
  onCancel,
}: {
  studentId: string;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [relationship, setRelationship] = useState<(typeof RELATIONSHIPS)[number]>("MOTHER");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await createGuardian({
        email,
        firstName,
        lastName,
        phone: phone || undefined,
        wards: [{ studentId, relationship }],
      });
      onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to create guardian");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      {error && <Alert variant="error">{error}</Alert>}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FormField label="First name" htmlFor="new-guardian-first-name">
          <Input
            id="new-guardian-first-name"
            required
            value={firstName}
            onChange={(event) => setFirstName(event.target.value)}
          />
        </FormField>
        <FormField label="Last name" htmlFor="new-guardian-last-name">
          <Input
            id="new-guardian-last-name"
            required
            value={lastName}
            onChange={(event) => setLastName(event.target.value)}
          />
        </FormField>
      </div>
      <FormField label="Email" htmlFor="new-guardian-email">
        <Input
          id="new-guardian-email"
          type="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
      </FormField>
      <FormField label="Phone" htmlFor="new-guardian-phone">
        <Input
          id="new-guardian-phone"
          value={phone}
          onChange={(event) => setPhone(event.target.value)}
        />
      </FormField>
      <FormField label="Relationship" htmlFor="new-guardian-relationship">
        <Select
          id="new-guardian-relationship"
          value={relationship}
          onChange={(event) =>
            setRelationship(event.target.value as (typeof RELATIONSHIPS)[number])
          }
        >
          {RELATIONSHIPS.map((option) => (
            <option key={option} value={option}>
              {option.charAt(0) + option.slice(1).toLowerCase()}
            </option>
          ))}
        </Select>
      </FormField>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={submitting}>
          {submitting ? "Creating…" : "Create and link"}
        </Button>
      </div>
    </form>
  );
}
