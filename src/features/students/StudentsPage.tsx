import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { listBranches, type BranchView } from "@/api/branches";
import { listClasses, type SchoolClassView } from "@/api/classes";
import { ApiError } from "@/api/client";
import { listClassRoster, listMyClasses, type RosterStudentView, type TeacherClassView } from "@/api/me";
import { listStudents, type StudentStatus, type StudentView } from "@/api/students";
import type { Page } from "@/api/types";
import { can } from "@/auth/permissions";
import { ArrowLeftRight, GraduationCap, SlidersHorizontal, Users } from "lucide-react";
import { RegisterStudentModal } from "@/features/students/components/RegisterStudentModal";
import { StudentMedicalModal } from "@/features/students/components/StudentMedicalModal";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { FormField } from "@/components/ui/FormField";
import { Modal } from "@/components/ui/Modal";
import { PageHeader } from "@/components/ui/PageHeader";
import { Pagination } from "@/components/ui/Pagination";
import { SearchInput } from "@/components/ui/SearchInput";
import { Select } from "@/components/ui/Select";
import { Spinner } from "@/components/ui/Spinner";
import { StickySubHeader } from "@/components/ui/StickySubHeader";
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from "@/components/ui/Table";
import { useAuthStore } from "@/stores/authStore";

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
  const [filtersOpen, setFiltersOpen] = useState(false);

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
  const activeFilterCount = [branchId, classId, status].filter(Boolean).length;

  function clearFilters() {
    resetToFirstPage(setBranchId)("");
    resetToFirstPage(setClassId)("");
    resetToFirstPage(setStatus)("");
  }

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

      <StickySubHeader>
        <FormField
          label="Search"
          htmlFor="student-search"
          className="min-w-0 flex-1 lg:max-w-xs"
          labelClassName="sr-only lg:not-sr-only"
        >
          <SearchInput
            id="student-search"
            value={query}
            onChange={resetToFirstPage(setQuery)}
            placeholder="Search name or admission no."
          />
        </FormField>
        <Button
          type="button"
          variant="secondary"
          className="relative shrink-0 lg:hidden"
          onClick={() => setFiltersOpen(true)}
        >
          <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
          Filters
          {activeFilterCount > 0 && (
            <Badge variant="brand" className="absolute -right-2 -top-2">
              {activeFilterCount}
            </Badge>
          )}
        </Button>
      </StickySubHeader>

      <div className="hidden gap-4 lg:grid lg:grid-cols-3">
        <StudentFilterFields
          idPrefix="student-filter"
          isBranchScoped={isBranchScoped}
          branches={branches}
          classOptions={classOptions}
          branchId={branchId}
          onBranchChange={resetToFirstPage(setBranchId)}
          classId={classId}
          onClassChange={resetToFirstPage(setClassId)}
          status={status}
          onStatusChange={resetToFirstPage(setStatus)}
        />
      </div>

      {filtersOpen && (
        <Modal open onClose={() => setFiltersOpen(false)} title="Filters" size="md">
          <div className="space-y-4">
            <StudentFilterFields
              idPrefix="student-filter-sheet"
              isBranchScoped={isBranchScoped}
              branches={branches}
              classOptions={classOptions}
              branchId={branchId}
              onBranchChange={resetToFirstPage(setBranchId)}
              classId={classId}
              onClassChange={resetToFirstPage(setClassId)}
              status={status}
              onStatusChange={resetToFirstPage(setStatus)}
            />
          </div>
          <div
            data-sheet-dock
            className="mt-6 flex flex-col-reverse gap-2 border-t border-slate-100 pt-4 sm:flex-row sm:justify-end mobile:sticky mobile:bottom-0 mobile:-mx-6 mobile:bg-white/95 mobile:px-6 mobile:pb-4 mobile:backdrop-blur"
          >
            <Button type="button" variant="secondary" onClick={clearFilters}>
              Clear all
            </Button>
            <Button type="button" onClick={() => setFiltersOpen(false)}>
              Done
            </Button>
          </div>
        </Modal>
      )}

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
                  <TableHeaderCell></TableHeaderCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {state.page.content.map((student) => (
                  <TableRow key={student.id} to={`/school/students/${student.id}`}>
                    <TableCell label="Name" className="font-medium text-slate-900">
                      {student.fullName}
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

interface StudentFilterFieldsProps {
  /** Distinguishes the desktop inline grid's ids from the mobile filter sheet's - both render at once. */
  idPrefix: string;
  isBranchScoped: boolean;
  branches: BranchView[] | null;
  classOptions: SchoolClassView[];
  branchId: string;
  onBranchChange: (value: string) => void;
  classId: string;
  onClassChange: (value: string) => void;
  status: StudentStatus | "";
  onStatusChange: (value: StudentStatus | "") => void;
}

/** Branch/Class/Status filters - rendered once inline at `lg` and up, once inside the mobile Filters sheet. */
function StudentFilterFields({
  idPrefix,
  isBranchScoped,
  branches,
  classOptions,
  branchId,
  onBranchChange,
  classId,
  onClassChange,
  status,
  onStatusChange,
}: StudentFilterFieldsProps) {
  return (
    <>
      {!isBranchScoped && (
        <FormField label="Branch" htmlFor={`${idPrefix}-branch`}>
          <Select
            id={`${idPrefix}-branch`}
            value={branchId}
            onChange={(event) => onBranchChange(event.target.value)}
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
      <FormField label="Class" htmlFor={`${idPrefix}-class`}>
        <Select id={`${idPrefix}-class`} value={classId} onChange={(event) => onClassChange(event.target.value)}>
          <option value="">All classes</option>
          {classOptions.map((schoolClass) => (
            <option key={schoolClass.id} value={schoolClass.id}>
              {schoolClass.name}
            </option>
          ))}
        </Select>
      </FormField>
      <FormField label="Status" htmlFor={`${idPrefix}-status`}>
        <Select
          id={`${idPrefix}-status`}
          value={status}
          onChange={(event) => onStatusChange(event.target.value as StudentStatus | "")}
        >
          <option value="">All statuses</option>
          <option value="ACTIVE">Active</option>
          <option value="GRADUATED">Graduated</option>
          <option value="WITHDRAWN">Withdrawn</option>
        </Select>
      </FormField>
    </>
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
        <StickySubHeader>
          <FormField
            label="Class"
            htmlFor="roster-class"
            className="min-w-0 flex-1 lg:max-w-xs"
            labelClassName="sr-only lg:not-sr-only"
          >
            <Select id="roster-class" value={classId} onChange={(event) => setClassId(event.target.value)}>
              {myClasses.map((schoolClass) => (
                <option key={schoolClass.classId} value={schoolClass.classId}>
                  {schoolClass.className}
                </option>
              ))}
            </Select>
          </FormField>
        </StickySubHeader>
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
                <TableRow key={student.studentId} onClick={() => setMedicalStudent(student)}>
                  <TableCell label="Name" className="font-medium text-slate-900">
                    {student.fullName}
                  </TableCell>
                  <TableCell label="Admission no.">{student.admissionNumber}</TableCell>
                  <TableCell label="Gender">{student.gender === "FEMALE" ? "Female" : "Male"}</TableCell>
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

