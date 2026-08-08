import { type FormEvent, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";
import { listBranches, type BranchView } from "@/api/branches";
import { listClasses, type SchoolClassView } from "@/api/classes";
import { ApiError } from "@/api/client";
import { getStudentMedical as getMyStudentMedical, listClassRoster, listMyClasses, type RosterStudentView, type TeacherClassView } from "@/api/me";
import { listStudents, registerStudent, type StudentMedicalView, type StudentStatus, type StudentView } from "@/api/students";
import type { Page } from "@/api/types";
import { can } from "@/auth/permissions";
import { ArrowLeftRight, GraduationCap, HeartPulse, Users } from "lucide-react";
import { StudentMedicalPanel } from "@/features/students/components/StudentMedicalPanel";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Checkbox } from "@/components/ui/Checkbox";
import { DateInput } from "@/components/ui/DateInput";
import { EmptyState } from "@/components/ui/EmptyState";
import { FormField } from "@/components/ui/FormField";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { PageHeader } from "@/components/ui/PageHeader";
import { Pagination } from "@/components/ui/Pagination";
import { SearchInput } from "@/components/ui/SearchInput";
import { Select } from "@/components/ui/Select";
import { Spinner } from "@/components/ui/Spinner";
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from "@/components/ui/Table";
import { useAuthStore } from "@/stores/authStore";
import { todayIso } from "@/utils/date";

const PAGE_SIZE = 20;

type ListState =
  | { kind: "loading" }
  | { kind: "loaded"; page: Page<StudentView> }
  | { kind: "error"; message: string };

/**
 * The student registry. A TEACHER gets a distinct, read-only view scoped to
 * their own class roster instead of this admin listing - see
 * {@link TeacherRoster}, mirroring how {@code ClassesPage} splits by role.
 */
export function StudentsPage() {
  const role = useAuthStore((state) => state.user?.role);

  if (role === "TEACHER") {
    return <TeacherRoster />;
  }

  return <AdminStudents isBranchScoped={role === "BRANCH_ADMIN"} />;
}

function AdminStudents({ isBranchScoped }: { isBranchScoped: boolean }) {
  const role = useAuthStore((state) => state.user?.role);
  const canManage = can.manageStudents(role);
  const canPromote = can.managePromotions(role);
  const navigate = useNavigate();

  const [branches, setBranches] = useState<BranchView[] | null>(null);
  const [classes, setClasses] = useState<SchoolClassView[] | null>(null);
  const [branchId, setBranchId] = useState("");
  const [classId, setClassId] = useState("");
  const [status, setStatus] = useState<StudentStatus | "">("");
  const [query, setQuery] = useState("");
  const [pageIndex, setPageIndex] = useState(0);
  const [state, setState] = useState<ListState>({ kind: "loading" });
  const [createOpen, setCreateOpen] = useState(false);

  useEffect(() => {
    if (!isBranchScoped) {
      listBranches()
        .then((page) => setBranches(page.content))
        .catch(() => setBranches([]));
    }
    listClasses(undefined, undefined, 0, 200)
      .then((page) => setClasses(page.content))
      .catch(() => setClasses([]));
  }, [isBranchScoped]);

  function fetchStudents() {
    listStudents(
      { branchId: branchId || undefined, classId: classId || undefined, status: status || undefined, q: query || undefined },
      pageIndex,
      PAGE_SIZE,
    )
      .then((page) => setState({ kind: "loaded", page }))
      .catch((error: unknown) =>
        setState({
          kind: "error",
          message: error instanceof ApiError ? error.message : "Failed to load students",
        }),
      );
  }

  useEffect(fetchStudents, [branchId, classId, status, query, pageIndex]);

  function load() {
    setState({ kind: "loading" });
    fetchStudents();
  }

  function resetToFirstPage<T>(setter: (value: T) => void) {
    return (value: T) => {
      setter(value);
      setPageIndex(0);
    };
  }

  const classOptions = (isBranchScoped ? classes?.filter((c) => c.branchId) : classes) ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Students"
        description="Every student registered at your school."
        actions={
          <>
            {canPromote && (
              <Button variant="secondary" onClick={() => navigate("/school/students/promotion")}>
                <ArrowLeftRight className="h-4 w-4" aria-hidden="true" />
                Promote / place students
              </Button>
            )}
            {canManage && <Button onClick={() => setCreateOpen(true)}>Register student</Button>}
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <FormField label="Search" htmlFor="student-search" className="sm:col-span-2 lg:col-span-1">
          <SearchInput
            id="student-search"
            value={query}
            onChange={resetToFirstPage(setQuery)}
            placeholder="Search name or admission no."
          />
        </FormField>
        {!isBranchScoped && (
          <FormField label="Branch" htmlFor="student-branch-filter">
            <Select
              id="student-branch-filter"
              value={branchId}
              onChange={(event) => resetToFirstPage(setBranchId)(event.target.value)}
            >
              <option value="">All branches</option>
              {branches?.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name}
                </option>
              ))}
            </Select>
          </FormField>
        )}
        <FormField label="Class" htmlFor="student-class-filter">
          <Select
            id="student-class-filter"
            value={classId}
            onChange={(event) => resetToFirstPage(setClassId)(event.target.value)}
          >
            <option value="">All classes</option>
            {classOptions.map((schoolClass) => (
              <option key={schoolClass.id} value={schoolClass.id}>
                {schoolClass.name}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField label="Status" htmlFor="student-status-filter">
          <Select
            id="student-status-filter"
            value={status}
            onChange={(event) => resetToFirstPage(setStatus)(event.target.value as StudentStatus | "")}
          >
            <option value="">All statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="GRADUATED">Graduated</option>
            <option value="WITHDRAWN">Withdrawn</option>
          </Select>
        </FormField>
      </div>

      {state.kind === "loading" && (
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Spinner /> Loading students…
        </div>
      )}
      {state.kind === "error" && <Alert variant="error">{state.message}</Alert>}
      {state.kind === "loaded" && state.page.content.length === 0 && (
        <EmptyState
          icon={GraduationCap}
          title="No students found"
          description="Register a student, or adjust your search and filters."
        />
      )}
      {state.kind === "loaded" && state.page.content.length > 0 && (
        <>
          <Card className="p-0">
            <Table>
              <TableHead>
                <TableRow>
                  <TableHeaderCell>Name</TableHeaderCell>
                  <TableHeaderCell>Admission no.</TableHeaderCell>
                  <TableHeaderCell>Class</TableHeaderCell>
                  <TableHeaderCell>Status</TableHeaderCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {state.page.content.map((student) => (
                  <TableRow key={student.id}>
                    <TableCell label="Name" className="font-medium text-slate-900">
                      <Link to={`/school/students/${student.id}`} className="hover:underline">
                        {student.fullName}
                      </Link>
                    </TableCell>
                    <TableCell label="Admission no.">{student.admissionNumber}</TableCell>
                    <TableCell label="Class">{student.currentClassName ?? "—"}</TableCell>
                    <TableCell label="Status">
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
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
          <Pagination page={state.page} onPageChange={setPageIndex} />
        </>
      )}

      {createOpen && (
        <RegisterStudentModal
          branches={branches ?? []}
          classes={classOptions}
          showBranchField={!isBranchScoped}
          onClose={() => setCreateOpen(false)}
          onSaved={() => {
            setCreateOpen(false);
            load();
          }}
        />
      )}
    </div>
  );
}

interface RegisterStudentModalProps {
  branches: BranchView[];
  classes: SchoolClassView[];
  showBranchField: boolean;
  onClose: () => void;
  onSaved: () => void;
}

function RegisterStudentModal({ branches, classes, showBranchField, onClose, onSaved }: RegisterStudentModalProps) {
  const [branchId, setBranchId] = useState(branches[0]?.id ?? "");
  const classesInBranch = showBranchField ? classes.filter((c) => c.branchId === branchId) : classes;
  const [classId, setClassId] = useState(classesInBranch[0]?.id ?? "");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [otherName, setOtherName] = useState("");
  const [gender, setGender] = useState<"FEMALE" | "MALE">("FEMALE");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [manualAdmissionNumber, setManualAdmissionNumber] = useState(false);
  const [admissionNumber, setAdmissionNumber] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await registerStudent({
        branchId: showBranchField ? branchId : undefined,
        classId,
        admissionNumber: manualAdmissionNumber ? admissionNumber : undefined,
        firstName,
        lastName,
        otherName: otherName || undefined,
        gender,
        dateOfBirth: dateOfBirth || undefined,
      });
      onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to register student");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal open onClose={onClose} title="Register student" size="lg">
      <form className="space-y-4" onSubmit={handleSubmit}>
        {error && <Alert variant="error">{error}</Alert>}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {showBranchField && (
            <FormField label="Branch" htmlFor="register-branch">
              <Select
                id="register-branch"
                required
                value={branchId}
                onChange={(event) => {
                  setBranchId(event.target.value);
                  setClassId("");
                }}
              >
                {branches.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name}
                  </option>
                ))}
              </Select>
            </FormField>
          )}
          <FormField label="Class" htmlFor="register-class">
            <Select id="register-class" required value={classId} onChange={(event) => setClassId(event.target.value)}>
              <option value="" disabled>
                Select a class…
              </option>
              {classesInBranch.map((schoolClass) => (
                <option key={schoolClass.id} value={schoolClass.id}>
                  {schoolClass.name}
                </option>
              ))}
            </Select>
          </FormField>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField label="First name" htmlFor="register-first-name">
            <Input id="register-first-name" required value={firstName} onChange={(event) => setFirstName(event.target.value)} />
          </FormField>
          <FormField label="Last name" htmlFor="register-last-name">
            <Input id="register-last-name" required value={lastName} onChange={(event) => setLastName(event.target.value)} />
          </FormField>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField label="Other name" htmlFor="register-other-name">
            <Input id="register-other-name" value={otherName} onChange={(event) => setOtherName(event.target.value)} />
          </FormField>
          <FormField label="Gender" htmlFor="register-gender">
            <Select
              id="register-gender"
              required
              value={gender}
              onChange={(event) => setGender(event.target.value as "FEMALE" | "MALE")}
            >
              <option value="FEMALE">Female</option>
              <option value="MALE">Male</option>
            </Select>
          </FormField>
        </div>
        <FormField label="Date of birth" htmlFor="register-dob">
          <DateInput id="register-dob" max={todayIso()} value={dateOfBirth} onChange={setDateOfBirth} />
        </FormField>
        <div>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <Checkbox checked={manualAdmissionNumber} onChange={(event) => setManualAdmissionNumber(event.target.checked)} />
            Enter admission number manually
          </label>
          {manualAdmissionNumber ? (
            <div className="mt-2">
              <Input
                aria-label="Admission number"
                required
                placeholder="e.g. OLD-1998/77"
                value={admissionNumber}
                onChange={(event) => setAdmissionNumber(event.target.value)}
              />
            </div>
          ) : (
            <p className="mt-1 text-xs text-slate-500">
              Leave unchecked to generate one automatically from the school code and year.
            </p>
          )}
        </div>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={submitting || !classId}>
            {submitting ? "Registering…" : "Register student"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

type TeacherRosterState =
  | { kind: "loading" }
  | { kind: "loaded"; roster: RosterStudentView[] }
  | { kind: "error"; message: string };

/** Read-only: the current session's roster for one class the calling TEACHER is assigned to. */
function TeacherRoster() {
  const [myClasses, setMyClasses] = useState<TeacherClassView[] | null>(null);
  const [classId, setClassId] = useState("");
  const [state, setState] = useState<TeacherRosterState>({ kind: "loading" });
  const [medicalStudent, setMedicalStudent] = useState<RosterStudentView | null>(null);

  useEffect(() => {
    listMyClasses()
      .then((classes) => {
        setMyClasses(classes);
        setClassId(classes[0]?.classId ?? "");
      })
      .catch(() => setMyClasses([]));
  }, []);

  useEffect(() => {
    if (!classId) {
      return;
    }
    listClassRoster(classId)
      .then((roster) => setState({ kind: "loaded", roster }))
      .catch((error: unknown) =>
        setState({
          kind: "error",
          message: error instanceof ApiError ? error.message : "Failed to load the roster",
        }),
      );
  }, [classId]);

  return (
    <div className="space-y-6">
      <PageHeader title="Students" description="The current roster for a class you teach." />

      {myClasses !== null && myClasses.length === 0 && (
        <EmptyState
          icon={Users}
          title="No classes yet"
          description="You have no class-teacher or subject-teacher assignments yet."
        />
      )}

      {myClasses !== null && myClasses.length > 0 && (
        <div className="max-w-xs">
          <FormField label="Class" htmlFor="roster-class">
            <Select id="roster-class" value={classId} onChange={(event) => setClassId(event.target.value)}>
              {myClasses.map((schoolClass) => (
                <option key={schoolClass.classId} value={schoolClass.classId}>
                  {schoolClass.className}
                </option>
              ))}
            </Select>
          </FormField>
        </div>
      )}

      {classId && state.kind === "loading" && (
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Spinner /> Loading roster…
        </div>
      )}
      {classId && state.kind === "error" && <Alert variant="error">{state.message}</Alert>}
      {classId && state.kind === "loaded" && state.roster.length === 0 && (
        <EmptyState icon={GraduationCap} title="No students yet" description="No one is enrolled in this class this session." />
      )}
      {classId && state.kind === "loaded" && state.roster.length > 0 && (
        <Card className="p-0">
          <Table>
            <TableHead>
              <TableRow>
                <TableHeaderCell>Name</TableHeaderCell>
                <TableHeaderCell>Admission no.</TableHeaderCell>
                <TableHeaderCell>Gender</TableHeaderCell>
                <TableHeaderCell></TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {state.roster.map((student) => (
                <TableRow key={student.studentId}>
                  <TableCell label="Name" className="font-medium text-slate-900">
                    {student.fullName}
                  </TableCell>
                  <TableCell label="Admission no.">{student.admissionNumber}</TableCell>
                  <TableCell label="Gender">{student.gender === "FEMALE" ? "Female" : "Male"}</TableCell>
                  <TableCell label="">
                    <button
                      type="button"
                      className="flex items-center gap-1 text-sm font-medium text-brand-500 hover:text-brand-600"
                      onClick={() => setMedicalStudent(student)}
                    >
                      <HeartPulse className="h-4 w-4" aria-hidden="true" />
                      Medical
                    </button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {medicalStudent && (
        <StudentMedicalModal student={medicalStudent} onClose={() => setMedicalStudent(null)} />
      )}
    </div>
  );
}

interface StudentMedicalModalProps {
  student: RosterStudentView;
  onClose: () => void;
}

/** Read-only medical & emergency info for a student on one of the caller's own classes. */
function StudentMedicalModal({ student, onClose }: StudentMedicalModalProps) {
  const [state, setState] = useState<
    { kind: "loading" } | { kind: "loaded"; medical: StudentMedicalView } | { kind: "error"; message: string }
  >({ kind: "loading" });

  useEffect(() => {
    getMyStudentMedical(student.studentId)
      .then((medical) => setState({ kind: "loaded", medical }))
      .catch((error: unknown) =>
        setState({
          kind: "error",
          message: error instanceof ApiError ? error.message : "Failed to load medical information",
        }),
      );
  }, [student.studentId]);

  return (
    <Modal open onClose={onClose} title={`${student.fullName} — Medical & emergency`} size="lg">
      {state.kind === "loading" && (
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Spinner /> Loading…
        </div>
      )}
      {state.kind === "error" && <Alert variant="error">{state.message}</Alert>}
      {state.kind === "loaded" && <StudentMedicalPanel medical={state.medical} />}
    </Modal>
  );
}
