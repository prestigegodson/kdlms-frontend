import { useEffect, useState } from "react";
import { Link } from "react-router";
import { listBranches, type BranchView } from "@/api/branches";
import { listClasses, type SchoolClassView } from "@/api/classes";
import { ApiError } from "@/api/client";
import { listSessions, type AcademicSessionView } from "@/api/sessions";
import {
  listStudents,
  placeStudents,
  promoteStudents,
  type MovementResult,
  type StudentView,
} from "@/api/students";
import { CheckCircle2, XCircle } from "lucide-react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Checkbox } from "@/components/ui/Checkbox";
import { EmptyState } from "@/components/ui/EmptyState";
import { FormField } from "@/components/ui/FormField";
import { PageHeader } from "@/components/ui/PageHeader";
import { SearchInput } from "@/components/ui/SearchInput";
import { Select } from "@/components/ui/Select";
import { Spinner } from "@/components/ui/Spinner";
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from "@/components/ui/Table";
import { useAuthStore } from "@/stores/authStore";

type Mode = "promote" | "place";

/**
 * Two ways to move students into a new session's class: bulk-promoting a
 * whole source class's roster, or searching for and placing individually
 * selected students (typically from a lower level/class). Both submit to a
 * per-student outcome rather than an all-or-nothing result - see
 * api/students.ts's {@link MovementResult}.
 */
export function PromotionPage() {
  const role = useAuthStore((state) => state.user?.role);
  const isBranchScoped = role === "BRANCH_ADMIN";
  const [mode, setMode] = useState<Mode>("promote");

  const [branches, setBranches] = useState<BranchView[] | null>(null);
  const [classes, setClasses] = useState<SchoolClassView[] | null>(null);
  const [sessions, setSessions] = useState<AcademicSessionView[] | null>(null);

  useEffect(() => {
    if (!isBranchScoped) {
      listBranches().then((page) => setBranches(page.content)).catch(() => setBranches([]));
    }
    listClasses(undefined, undefined, 0, 200).then((page) => setClasses(page.content)).catch(() => setClasses([]));
    listSessions(0, 50).then((page) => setSessions(page.content)).catch(() => setSessions([]));
  }, [isBranchScoped]);

  const referenceDataLoaded = classes !== null && sessions !== null && (isBranchScoped || branches !== null);

  return (
    <div className="space-y-6">
      <Link to="/school/students" className="text-sm text-brand-500 hover:text-brand-600">
        &larr; All students
      </Link>

      <PageHeader
        title="Promote or place students"
        description="Move a whole class into a new session, or search for and place individual students."
      />

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setMode("promote")}
          className={`rounded-control px-3 py-1.5 text-sm font-medium ${mode === "promote" ? "bg-brand-50 text-brand-800" : "text-slate-500 hover:bg-slate-100"}`}
        >
          Promote a class
        </button>
        <button
          type="button"
          onClick={() => setMode("place")}
          className={`rounded-control px-3 py-1.5 text-sm font-medium ${mode === "place" ? "bg-brand-50 text-brand-800" : "text-slate-500 hover:bg-slate-100"}`}
        >
          Place students
        </button>
      </div>

      {!referenceDataLoaded && (
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Spinner /> Loading…
        </div>
      )}

      {referenceDataLoaded &&
        (mode === "promote" ? (
          <PromoteClassPanel classes={classes ?? []} sessions={sessions ?? []} />
        ) : (
          <PlaceStudentsPanel classes={classes ?? []} sessions={sessions ?? []} />
        ))}
    </div>
  );
}

function PromoteClassPanel({ classes, sessions }: { classes: SchoolClassView[]; sessions: AcademicSessionView[] }) {
  const [sourceClassId, setSourceClassId] = useState("");
  const [targetClassId, setTargetClassId] = useState("");
  const [targetSessionId, setTargetSessionId] = useState("");
  const [roster, setRoster] = useState<StudentView[] | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<MovementResult | null>(null);

  useEffect(() => {
    if (!sourceClassId) {
      return;
    }
    listStudents({ classId: sourceClassId, status: "ACTIVE" }, 0, 200)
      .then((page) => {
        setRoster(page.content);
        setSelected(new Set(page.content.map((student) => student.id)));
      })
      .catch((err: unknown) => setError(err instanceof ApiError ? err.message : "Failed to load the class roster"));
  }, [sourceClassId]);

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

  async function handlePromote() {
    setSubmitting(true);
    setError(null);
    try {
      const outcome = await promoteStudents({
        sourceClassId,
        targetClassId,
        targetSessionId,
        studentIds: [...selected],
      });
      setResult(outcome);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Promotion failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <FormField label="Source class" htmlFor="promote-source-class">
            <Select
              id="promote-source-class"
              value={sourceClassId}
              onChange={(event) => {
                setSourceClassId(event.target.value);
                setResult(null);
              }}
            >
              <option value="">Select a class…</option>
              {classes.map((schoolClass) => (
                <option key={schoolClass.id} value={schoolClass.id}>
                  {schoolClass.name}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label="Target session" htmlFor="promote-target-session">
            <Select
              id="promote-target-session"
              value={targetSessionId}
              onChange={(event) => setTargetSessionId(event.target.value)}
            >
              <option value="">Select a session…</option>
              {sessions.map((session) => (
                <option key={session.id} value={session.id}>
                  {session.name}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label="Target class" htmlFor="promote-target-class">
            <Select
              id="promote-target-class"
              value={targetClassId}
              onChange={(event) => setTargetClassId(event.target.value)}
            >
              <option value="">Select a class…</option>
              {classes.map((schoolClass) => (
                <option key={schoolClass.id} value={schoolClass.id}>
                  {schoolClass.name}
                </option>
              ))}
            </Select>
          </FormField>
        </div>
      </Card>

      {error && <Alert variant="error">{error}</Alert>}

      {sourceClassId && roster === null && (
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Spinner /> Loading roster…
        </div>
      )}
      {sourceClassId && roster !== null && roster.length === 0 && (
        <EmptyState title="No active students in this class" description="Choose a different source class." />
      )}
      {sourceClassId && roster !== null && roster.length > 0 && (
        <StudentPicker
          students={roster}
          selected={selected}
          onToggle={toggle}
          onSelectAll={() => setSelected(new Set(roster.map((student) => student.id)))}
          onSelectNone={() => setSelected(new Set())}
        />
      )}

      {sourceClassId && roster !== null && roster.length > 0 && (
        <div className="flex justify-end">
          <Button
            disabled={submitting || selected.size === 0 || !targetClassId || !targetSessionId}
            onClick={handlePromote}
          >
            {submitting ? "Promoting…" : `Promote ${selected.size} student${selected.size === 1 ? "" : "s"}`}
          </Button>
        </div>
      )}

      {result && <OutcomeList result={result} students={roster ?? []} />}
    </div>
  );
}

function PlaceStudentsPanel({ classes, sessions }: { classes: SchoolClassView[]; sessions: AcademicSessionView[] }) {
  const [query, setQuery] = useState("");
  const [candidates, setCandidates] = useState<StudentView[] | null>(null);
  const [targetClassId, setTargetClassId] = useState("");
  const [sessionId, setSessionId] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<MovementResult | null>(null);

  useEffect(() => {
    if (!query) {
      return;
    }
    listStudents({ q: query, status: "ACTIVE" }, 0, 50)
      .then((page) => setCandidates(page.content))
      .catch((err: unknown) => setError(err instanceof ApiError ? err.message : "Search failed"));
  }, [query]);

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

  async function handlePlace() {
    setSubmitting(true);
    setError(null);
    try {
      const outcome = await placeStudents({ targetClassId, sessionId, studentIds: [...selected] });
      setResult(outcome);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Placement failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="sm:col-span-1">
            <FormField label="Search students" htmlFor="place-search">
              <SearchInput
                id="place-search"
                value={query}
                onChange={(value) => {
                  setQuery(value);
                  setResult(null);
                }}
                placeholder="Name or admission no."
              />
            </FormField>
          </div>
          <FormField label="Target session" htmlFor="place-target-session">
            <Select id="place-target-session" value={sessionId} onChange={(event) => setSessionId(event.target.value)}>
              <option value="">Select a session…</option>
              {sessions.map((session) => (
                <option key={session.id} value={session.id}>
                  {session.name}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label="Target class" htmlFor="place-target-class">
            <Select id="place-target-class" value={targetClassId} onChange={(event) => setTargetClassId(event.target.value)}>
              <option value="">Select a class…</option>
              {classes.map((schoolClass) => (
                <option key={schoolClass.id} value={schoolClass.id}>
                  {schoolClass.name}
                </option>
              ))}
            </Select>
          </FormField>
        </div>
      </Card>

      {error && <Alert variant="error">{error}</Alert>}

      {!query && (
        <EmptyState title="Search for students to place" description="Search by name or admission number to find candidates." />
      )}
      {query && candidates === null && (
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Spinner /> Searching…
        </div>
      )}
      {query && candidates !== null && candidates.length === 0 && (
        <EmptyState title="No matching students" description="Try a different name or admission number." />
      )}
      {query && candidates !== null && candidates.length > 0 && (
        <StudentPicker
          students={candidates}
          selected={selected}
          onToggle={toggle}
          onSelectAll={() => setSelected(new Set(candidates.map((student) => student.id)))}
          onSelectNone={() => setSelected(new Set())}
          showCurrentClass
        />
      )}

      {query && candidates !== null && candidates.length > 0 && (
        <div className="flex justify-end">
          <Button
            disabled={submitting || selected.size === 0 || !targetClassId || !sessionId}
            onClick={handlePlace}
          >
            {submitting ? "Placing…" : `Place ${selected.size} student${selected.size === 1 ? "" : "s"}`}
          </Button>
        </div>
      )}

      {result && <OutcomeList result={result} students={candidates ?? []} />}
    </div>
  );
}

interface StudentPickerProps {
  students: StudentView[];
  selected: Set<string>;
  onToggle: (studentId: string) => void;
  onSelectAll: () => void;
  onSelectNone: () => void;
  showCurrentClass?: boolean;
}

function StudentPicker({ students, selected, onToggle, onSelectAll, onSelectNone, showCurrentClass }: StudentPickerProps) {
  const allSelected = students.length > 0 && students.every((student) => selected.has(student.id));

  return (
    <Card className="p-0">
      <Table>
        <TableHead>
          <TableRow>
            <TableHeaderCell>
              <Checkbox
                checked={allSelected}
                onChange={() => (allSelected ? onSelectNone() : onSelectAll())}
                aria-label="Select all"
              />
            </TableHeaderCell>
            <TableHeaderCell>Name</TableHeaderCell>
            <TableHeaderCell>Admission no.</TableHeaderCell>
            {showCurrentClass && <TableHeaderCell>Current class</TableHeaderCell>}
          </TableRow>
        </TableHead>
        <TableBody>
          {students.map((student) => (
            <TableRow key={student.id}>
              <TableCell label="Select">
                <Checkbox
                  checked={selected.has(student.id)}
                  onChange={() => onToggle(student.id)}
                  aria-label={`Select ${student.fullName}`}
                />
              </TableCell>
              <TableCell label="Name" className="font-medium text-slate-900">
                {student.fullName}
              </TableCell>
              <TableCell label="Admission no.">{student.admissionNumber}</TableCell>
              {showCurrentClass && <TableCell label="Current class">{student.currentClassName ?? "—"}</TableCell>}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}

function OutcomeList({ result, students }: { result: MovementResult; students: StudentView[] }) {
  const nameOf = (studentId: string) => students.find((student) => student.id === studentId)?.fullName ?? studentId;
  const successCount = result.outcomes.filter((outcome) => outcome.success).length;

  return (
    <Card>
      <h2 className="text-sm font-semibold text-slate-900">Result</h2>
      <p className="mt-1 text-sm text-slate-500">
        {successCount} of {result.outcomes.length} moved successfully.
      </p>
      <ul className="mt-3 space-y-2">
        {result.outcomes.map((outcome) => (
          <li key={outcome.studentId} className="flex items-start gap-2 text-sm">
            {outcome.success ? (
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-600" aria-hidden="true" />
            ) : (
              <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" aria-hidden="true" />
            )}
            <span>
              <span className="font-medium text-slate-900">{nameOf(outcome.studentId)}</span>
              {!outcome.success && outcome.message && (
                <span className="text-slate-500"> &mdash; {outcome.message}</span>
              )}
            </span>
          </li>
        ))}
      </ul>
    </Card>
  );
}
