import { useEffect, useState } from "react";
import { listClasses, type SchoolClassView } from "@/api/classes";
import { ApiError } from "@/api/client";
import { listSessions, type AcademicSessionView } from "@/api/sessions";
import {
  graduateClass,
  listStudents,
  placeStudents,
  promoteStudents,
  type MovementResult,
  type StudentView,
} from "@/api/students";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { FormField } from "@/components/ui/FormField";
import { PageHeader } from "@/components/ui/PageHeader";
import { SearchInput } from "@/components/ui/SearchInput";
import { Select } from "@/components/ui/Select";
import { Spinner } from "@/components/ui/Spinner";
import { StickySubHeader, useFilterChip } from "@/components/ui/StickySubHeader";
import { OutcomeList } from "@/features/students/components/OutcomeList";
import { StudentPicker, type StudentPickerRow } from "@/features/students/components/StudentPicker";

function toPickerRow(student: StudentView, showCurrentClass?: boolean): StudentPickerRow {
  return {
    id: student.id,
    name: student.fullName,
    admissionNumber: student.admissionNumber,
    secondaryLabel: showCurrentClass ? (student.currentClassName ?? "—") : undefined,
  };
}

/** The sub-header grid idiom `ClassTermPicker`/`ClassDatePicker` established - stacked, labelled rows below `lg`, one equal-width row from `lg` up. */
const PICKER_GRID_CLASS = "grid min-w-0 flex-1 gap-2 lg:grid-flow-col lg:auto-cols-fr lg:gap-4";

type Mode = "promote" | "place" | "graduate";

/**
 * Three ways to move students at the end of a session: bulk-promoting a
 * whole source class's roster, searching for and placing individually
 * selected students (typically from a lower level/class), or bulk-graduating
 * a whole exit class. All three submit to a per-student outcome rather than
 * an all-or-nothing result - see api/students.ts's {@link MovementResult}.
 */
export function PromotionPage() {
  const [mode, setMode] = useState<Mode>("promote");

  const [classes, setClasses] = useState<SchoolClassView[] | null>(null);
  const [sessions, setSessions] = useState<AcademicSessionView[] | null>(null);

  useEffect(() => {
    listClasses(undefined, undefined, 0, 200).then((page) => setClasses(page.content)).catch(() => setClasses([]));
    listSessions(0, 50).then((page) => setSessions(page.content)).catch(() => setSessions([]));
  }, []);

  const referenceDataLoaded = classes !== null && sessions !== null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Promote, place or graduate students"
        description="Move a whole class into a new session, search for and place individual students, or graduate an exit class."
        backTo="/school/students"
      />

      <div className="flex flex-wrap gap-2">
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
        <button
          type="button"
          onClick={() => setMode("graduate")}
          className={`rounded-control px-3 py-1.5 text-sm font-medium ${mode === "graduate" ? "bg-brand-50 text-brand-800" : "text-slate-500 hover:bg-slate-100"}`}
        >
          Graduate a class
        </button>
      </div>

      {!referenceDataLoaded && (
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Spinner /> Loading…
        </div>
      )}

      {referenceDataLoaded && mode === "promote" && (
        <PromoteClassPanel classes={classes ?? []} sessions={sessions ?? []} />
      )}
      {referenceDataLoaded && mode === "place" && (
        <PlaceStudentsPanel classes={classes ?? []} sessions={sessions ?? []} />
      )}
      {referenceDataLoaded && mode === "graduate" && <GraduateClassPanel classes={classes ?? []} />}
    </div>
  );
}

function PromoteClassPanel({ classes, sessions }: { classes: SchoolClassView[]; sessions: AcademicSessionView[] }) {
  const [sourceClassId, setSourceClassId] = useState("");
  const [targetClassId, setTargetClassId] = useState("");
  const [sourceSessionId, setSourceSessionId] = useState("");
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
    listStudents({ classId: sourceClassId, sessionId: sourceSessionId }, 0, 200)
      .then((page) => {
        setRoster(page.content);
        setSelected(new Set(page.content.map((student) => student.id)));
      })
      .catch((err: unknown) => setError(err instanceof ApiError ? err.message : "Failed to load the class roster"));
  }, [sourceClassId, sourceSessionId]);

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

  useFilterChip("promote-source-session", sessions.find((session) => session.id === sourceSessionId)?.name);
  useFilterChip("promote-source-class", classes.find((schoolClass) => schoolClass.id === sourceClassId)?.name);
  useFilterChip("promote-target-session", sessions.find((session) => session.id === targetSessionId)?.name);
  useFilterChip("promote-target-class", classes.find((schoolClass) => schoolClass.id === targetClassId)?.name);

  return (
    <div className="space-y-6">
      <StickySubHeader collapsible>
        <div className={PICKER_GRID_CLASS}>
          <FormField label="Source session" htmlFor="promote-source-session">
            <Select
              id="promote-source-session"
              value={sourceSessionId}
              onChange={(event) => setSourceSessionId(event.target.value)}
            >
              <option value="">Select a session…</option>
              {sessions.map((session) => (
                <option key={session.id} value={session.id}>
                  {session.name}
                </option>
              ))}
            </Select>
          </FormField>
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
      </StickySubHeader>

      {error && <Alert variant="error">{error}</Alert>}

      {sourceClassId && roster === null && (
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Spinner /> Loading roster…
        </div>
      )}
      {sourceClassId && roster !== null && roster.length === 0 && (
        <EmptyState
          title="No active students in this class"
          description="Choose a different source class."
        />
      )}
      {sourceClassId && roster !== null && roster.length > 0 && (
        <StudentPicker
          rows={roster.map((student) => toPickerRow(student))}
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
            {submitting
              ? "Promoting…"
              : `Promote ${selected.size} student${selected.size === 1 ? "" : "s"}`}
          </Button>
        </div>
      )}

      {result && (
        <OutcomeList
          result={result}
          nameOf={(id) => (roster ?? []).find((student) => student.id === id)?.fullName ?? id}
        />
      )}
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

  useFilterChip("place-search", query);
  useFilterChip("place-target-session", sessions.find((session) => session.id === sessionId)?.name);
  useFilterChip("place-target-class", classes.find((schoolClass) => schoolClass.id === targetClassId)?.name);

  return (
    <div className="space-y-6">
      <StickySubHeader collapsible>
        <div className={PICKER_GRID_CLASS}>
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
      </StickySubHeader>

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
          rows={candidates.map((student) => toPickerRow(student, true))}
          selected={selected}
          onToggle={toggle}
          onSelectAll={() => setSelected(new Set(candidates.map((student) => student.id)))}
          onSelectNone={() => setSelected(new Set())}
          secondaryColumnLabel="Current class"
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

      {result && (
        <OutcomeList
          result={result}
          nameOf={(id) => (candidates ?? []).find((student) => student.id === id)?.fullName ?? id}
        />
      )}
    </div>
  );
}

function GraduateClassPanel({ classes }: { classes: SchoolClassView[] }) {
  const [classId, setClassId] = useState("");
  const [roster, setRoster] = useState<StudentView[] | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<MovementResult | null>(null);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    if (!classId) {
      return;
    }
    listStudents({ classId, status: "ACTIVE" }, 0, 200)
      .then((page) => {
        setRoster(page.content);
        setSelected(new Set(page.content.map((student) => student.id)));
      })
      .catch((err: unknown) => setError(err instanceof ApiError ? err.message : "Failed to load the class roster"));
  }, [classId]);

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

  async function confirmGraduate() {
    const outcome = await graduateClass({ classId, studentIds: [...selected] });
    setResult(outcome);
    setConfirming(false);
  }

  const className = classes.find((schoolClass) => schoolClass.id === classId)?.name ?? "this class";

  useFilterChip("graduate-class", classes.find((schoolClass) => schoolClass.id === classId)?.name);

  return (
    <div className="space-y-6">
      <StickySubHeader>
        <div className={PICKER_GRID_CLASS}>
          <FormField label="Class" htmlFor="graduate-class">
            <Select
              id="graduate-class"
              value={classId}
              onChange={(event) => {
                setClassId(event.target.value);
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
        </div>
      </StickySubHeader>

      {error && <Alert variant="error">{error}</Alert>}

      {classId && roster === null && (
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Spinner /> Loading roster…
        </div>
      )}
      {classId && roster !== null && roster.length === 0 && (
        <EmptyState title="No active students in this class" description="Choose a different class." />
      )}
      {classId && roster !== null && roster.length > 0 && (
        <StudentPicker
          rows={roster.map((student) => toPickerRow(student))}
          selected={selected}
          onToggle={toggle}
          onSelectAll={() => setSelected(new Set(roster.map((student) => student.id)))}
          onSelectNone={() => setSelected(new Set())}
        />
      )}

      {classId && roster !== null && roster.length > 0 && (
        <div className="flex justify-end">
          <Button variant="danger" disabled={selected.size === 0} onClick={() => setConfirming(true)}>
            {`Graduate ${selected.size} student${selected.size === 1 ? "" : "s"}`}
          </Button>
        </div>
      )}

      {result && (
        <OutcomeList
          result={result}
          nameOf={(id) => (roster ?? []).find((student) => student.id === id)?.fullName ?? id}
        />
      )}

      {confirming && (
        <ConfirmDialog
          title={`Graduate ${selected.size} student${selected.size === 1 ? "" : "s"}?`}
          message={
            <>
              <strong>
                {selected.size} student{selected.size === 1 ? "" : "s"}
              </strong>{" "}
              in <strong>{className}</strong> will be marked graduated and their current enrollments closed. This
              can't be undone.
            </>
          }
          confirmLabel="Graduate"
          variant="danger"
          onConfirm={confirmGraduate}
          onClose={() => setConfirming(false)}
        />
      )}
    </div>
  );
}
