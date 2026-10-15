import { useMemo, useState } from "react";
import type { RosterStudentView } from "@/api/classes";
import { GraduationCap } from "lucide-react";
import { StudentLoginStatusBadge } from "@/features/students/components/StudentLoginStatusBadge";
import { StudentMedicalModal } from "@/features/students/components/StudentMedicalModal";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { SearchInput } from "@/components/ui/SearchInput";
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from "@/components/ui/Table";
import { formatInstant } from "@/utils/date";

interface ClassRosterPanelProps {
  students: RosterStudentView[];
  /** Admins get a tap-through to the full student record; a TEACHER gets the read-only medical modal instead - see StudentsPage's TeacherRoster. */
  canManage: boolean;
  /** Adds the Portal login and Last login columns - only when the school's package includes student logins. */
  showLogins?: boolean;
  onRegister?: () => void;
}

function initialsOf(student: RosterStudentView): string {
  const first = student.firstName.charAt(0);
  const last = student.lastName.charAt(0);
  return `${first}${last}`.toUpperCase();
}

/**
 * The class-detail page's enrolled-students section - shared between the
 * admin and teacher views of {@code ClassDetailPage}. Presentational only:
 * the page owns the fetch and passes the current session's roster down.
 */
export function ClassRosterPanel({ students, canManage, showLogins = false, onRegister }: ClassRosterPanelProps) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return students;
    return students.filter(
      (student) =>
        student.fullName.toLowerCase().includes(normalized) ||
        student.admissionNumber.toLowerCase().includes(normalized),
    );
  }, [students, query]);

  const [medicalStudent, setMedicalStudent] = useState<RosterStudentView | null>(null);

  if (students.length === 0) {
    return (
      <EmptyState
        icon={GraduationCap}
        title="No pupils enrolled"
        description="No one is enrolled in this class for the current session."
        action={
          canManage && onRegister ? (
            <Button type="button" variant="secondary" onClick={onRegister}>
              Register pupil
            </Button>
          ) : undefined
        }
      />
    );
  }

  return (
    <div className="space-y-4">
      {students.length >= 10 && (
        <SearchInput value={query} onChange={setQuery} placeholder="Search name or admission no." />
      )}
      <Table>
        <TableHead>
          <TableRow>
            <TableHeaderCell>Name</TableHeaderCell>
            <TableHeaderCell>Admission no.</TableHeaderCell>
            <TableHeaderCell>Gender</TableHeaderCell>
            {showLogins && <TableHeaderCell>Portal login</TableHeaderCell>}
            {showLogins && <TableHeaderCell>Last login</TableHeaderCell>}
            <TableHeaderCell></TableHeaderCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {filtered.map((student) =>
            canManage ? (
              <TableRow key={student.studentId} to={`/school/students/${student.studentId}`}>
                <TableCell label="Name" className="font-medium text-slate-900">
                  <RosterName student={student} />
                </TableCell>
                <TableCell label="Admission no.">{student.admissionNumber}</TableCell>
                <TableCell label="Gender">{student.gender === "FEMALE" ? "Female" : "Male"}</TableCell>
                {showLogins && <RosterLoginCells student={student} />}
              </TableRow>
            ) : (
              <TableRow key={student.studentId} onClick={() => setMedicalStudent(student)}>
                <TableCell label="Name" className="font-medium text-slate-900">
                  <RosterName student={student} />
                </TableCell>
                <TableCell label="Admission no.">{student.admissionNumber}</TableCell>
                <TableCell label="Gender">{student.gender === "FEMALE" ? "Female" : "Male"}</TableCell>
                {showLogins && <RosterLoginCells student={student} />}
              </TableRow>
            ),
          )}
        </TableBody>
      </Table>
      {filtered.length === 0 && (
        <p className="py-4 text-center text-sm text-slate-500">No pupils match "{query}".</p>
      )}

      {medicalStudent && (
        <StudentMedicalModal student={medicalStudent} onClose={() => setMedicalStudent(null)} />
      )}
    </div>
  );
}

function RosterName({ student }: { student: RosterStudentView }) {
  return (
    <span className="flex items-center gap-3">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-50 text-xs font-semibold text-brand-600">
        {initialsOf(student)}
      </span>
      {student.fullName}
    </span>
  );
}

/** The Portal login badge and Last login cells - "Never" for a login that has never signed in, "—" for no login at all. */
function RosterLoginCells({ student }: { student: RosterStudentView }) {
  return (
    <>
      <TableCell label="Portal login">
        <StudentLoginStatusBadge status={student.loginStatus} />
      </TableCell>
      <TableCell label="Last login">
        {student.loginStatus === "NONE"
          ? "—"
          : student.lastLoginAt
            ? formatInstant(student.lastLoginAt)
            : "Never"}
      </TableCell>
    </>
  );
}
