import { useEffect, useState } from "react";
import { useBlocker } from "react-router";
import {
  type CellCommand,
  type ClassTimetableView,
  type EntryKind,
  saveClassTimetable,
  type TimetableCellView,
  type TimetableRowOutcome,
} from "@/api/timetable";
import { ApiError } from "@/api/client";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Select } from "@/components/ui/Select";
import { useSchoolSettingsStore } from "@/stores/schoolSettingsStore";
import { formatClockTime } from "@/utils/date";
import { XCircle } from "lucide-react";

const DAYS: { value: number; label: string }[] = [
  { value: 1, label: "Mon" },
  { value: 2, label: "Tue" },
  { value: 3, label: "Wed" },
  { value: 4, label: "Thu" },
  { value: 5, label: "Fri" },
  { value: 6, label: "Sat" },
  { value: 7, label: "Sun" },
];

interface CellDraft {
  entryKind: EntryKind | "";
  subjectId: string | null;
  teacherId: string | null;
  label: string | null;
}

const EMPTY_DRAFT: CellDraft = { entryKind: "", subjectId: null, teacherId: null, label: null };

function cellKey(dayOfWeek: number, periodId: string): string {
  return `${dayOfWeek}:${periodId}`;
}

function draftsFromView(view: ClassTimetableView): Record<string, CellDraft> {
  const drafts: Record<string, CellDraft> = {};
  for (const period of view.periods) {
    for (const day of DAYS) {
      const cell = period.cellsByDay[String(day.value)];
      drafts[cellKey(day.value, period.periodId)] = cell
        ? { entryKind: cell.entryKind, subjectId: cell.subjectId, teacherId: cell.teacherId, label: cell.label }
        : { ...EMPTY_DRAFT };
    }
  }
  return drafts;
}

export interface TeacherOption {
  id: string;
  name: string;
}

export interface SubjectOption {
  id: string;
  name: string;
}

interface TimetableGridProps {
  view: ClassTimetableView;
  subjects: SubjectOption[];
  teachers: TeacherOption[];
  onSaved: (outcomes: TimetableRowOutcome[]) => void;
}

/**
 * A class's weekly grid for one term - days as columns, the level's periods
 * as rows. Read-only when `!view.editable` (an admin outside their branch,
 * or a caller resolved via a guard that denied write access). Drafts + dirty
 * set + `useBlocker` + `beforeunload` + a sticky save bar, all mirroring
 * `attendance/components/AttendanceRegisterGrid.tsx`. A genuinely wide grid
 * (5-7 day columns) follows `BroadsheetTable`'s documented below-`lg`
 * exception: a plain `<table>` in its own `overflow-x-auto overscroll-x-contain`
 * wrapper with a sticky period column, not `Table`'s `.responsive-table`.
 */
export function TimetableGrid({ view, subjects, teachers, onSaved }: TimetableGridProps) {
  const [drafts, setDrafts] = useState<Record<string, CellDraft>>(() => draftsFromView(view));
  const [dirty, setDirty] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Adopt a newly loaded view (new class/term selection, or a post-save reload) by comparing
  // against the last-seen view during render, same technique ScoreEntryGrid/AttendanceRegisterGrid use.
  const [lastView, setLastView] = useState(view);
  if (view !== lastView) {
    setLastView(view);
    setDrafts(draftsFromView(view));
    setDirty(new Set());
  }

  const allowWeekend = useSchoolSettingsStore((state) => state.settings?.allowWeekendTimetable ?? false);
  const fetchSettings = useSchoolSettingsStore((state) => state.fetchIfNeeded);
  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const blocker = useBlocker(dirty.size > 0);

  useEffect(() => {
    function handler(event: BeforeUnloadEvent) {
      if (dirty.size > 0) event.preventDefault();
    }
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  function updateCell(dayOfWeek: number, periodId: string, next: CellDraft) {
    const key = cellKey(dayOfWeek, periodId);
    setDrafts((current) => ({ ...current, [key]: next }));
    setDirty((current) => new Set(current).add(key));
  }

  function discard() {
    setDrafts(draftsFromView(view));
    setDirty(new Set());
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const cells: CellCommand[] = Array.from(dirty).map((key) => {
        const separatorIndex = key.indexOf(":");
        const dayOfWeek = Number(key.slice(0, separatorIndex));
        const periodId = key.slice(separatorIndex + 1);
        const draft = drafts[key];
        return {
          dayOfWeek,
          periodId,
          entryKind: draft.entryKind,
          subjectId: draft.entryKind === "SUBJECT" ? draft.subjectId : null,
          teacherId: draft.entryKind === "SUBJECT" ? draft.teacherId : null,
          label: draft.entryKind === "ACTIVITY" ? draft.label : null,
        };
      });
      const outcome = await saveClassTimetable(view.classId, view.termId, cells);
      setDirty(new Set());
      onSaved(outcome.outcomes);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to save the timetable");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4 pb-4">
      {error && <Alert variant="error">{error}</Alert>}
      <p className="text-xs text-slate-500 lg:hidden">Scroll sideways to see every day &rarr;</p>
      <div className="overflow-x-auto overscroll-x-contain rounded-card border border-slate-200">
        <table className="min-w-full border-collapse text-sm">
          <thead className="border-b border-slate-200 bg-slate-50">
            <tr>
              <th
                scope="col"
                className="sticky left-0 z-10 bg-slate-50 px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 after:absolute after:inset-y-0 after:-right-2 after:w-2 after:bg-gradient-to-r after:from-slate-900/10 after:to-transparent"
              >
                Period
              </th>
              {DAYS.map((day) => (
                <th
                  key={day.value}
                  scope="col"
                  className="min-w-[10rem] whitespace-nowrap px-3 py-2 text-center text-xs font-semibold uppercase tracking-wide text-slate-500"
                >
                  {day.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {view.periods.map((period) => (
              <tr key={period.periodId} className="border-b border-slate-100 align-top">
                <th
                  scope="row"
                  className="sticky left-0 z-10 bg-white px-3 py-2 text-left text-xs font-medium text-slate-600 after:absolute after:inset-y-0 after:-right-2 after:w-2 after:bg-gradient-to-r after:from-slate-900/10 after:to-transparent"
                >
                  <div>{period.label}</div>
                  <div className="font-normal text-slate-400">
                    <div>{formatClockTime(period.startTime)}</div>
                    <div>--</div>
                    <div>{formatClockTime(period.endTime)}</div>
                  </div>
                </th>
                {period.kind === "BREAK" ? (
                  <td
                    colSpan={DAYS.length}
                    className="bg-slate-50 px-3 py-2 text-center text-xs font-medium uppercase tracking-wide text-slate-400"
                  >
                    {period.label}
                  </td>
                ) : (
                  DAYS.map((day) => {
                    const key = cellKey(day.value, period.periodId);
                    const draft = drafts[key] ?? EMPTY_DRAFT;
                    const cellView = period.cellsByDay[String(day.value)];
                    const weekendLocked = day.value > 5 && !allowWeekend && !cellView;
                    return (
                      <td key={key} className="px-2 py-2">
                        {!view.editable ? (
                          <TimetableCellSummary cell={cellView} />
                        ) : weekendLocked ? (
                          <span
                            className="text-xs text-slate-400"
                            title="Weekends aren't scheduled unless a school admin allows it in School Settings."
                          >
                            —
                          </span>
                        ) : (
                          <TimetableCellEditor
                            draft={draft}
                            subjects={subjects}
                            teachers={teachers}
                            suggestedTeachers={view.suggestedTeachers}
                            onChange={(next) => updateCell(day.value, period.periodId, next)}
                          />
                        )}
                      </td>
                    );
                  })
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {view.editable && (
        <TimetableSaveBar dirtyCount={dirty.size} saving={saving} onSave={handleSave} onDiscard={discard} />
      )}

      {blocker.state === "blocked" && (
        <ConfirmDialog
          title="Leave without saving?"
          message="You have unsaved timetable changes that will be lost."
          confirmLabel="Leave"
          variant="danger"
          onConfirm={async () => {
            blocker.proceed();
          }}
          onClose={() => blocker.reset()}
        />
      )}
    </div>
  );
}

function TimetableCellSummary({ cell }: { cell?: TimetableCellView }) {
  if (!cell) {
    return <span className="text-xs text-slate-300">—</span>;
  }
  if (cell.entryKind === "ACTIVITY") {
    return <span className="text-xs font-medium text-slate-700">{cell.label}</span>;
  }
  return (
    <div className="text-xs">
      <div className="font-medium text-slate-900">{cell.subjectName ?? "—"}</div>
      <div className="text-slate-500">{cell.teacherName ?? "Unassigned"}</div>
    </div>
  );
}

interface TimetableCellEditorProps {
  draft: CellDraft;
  subjects: SubjectOption[];
  teachers: TeacherOption[];
  suggestedTeachers: Record<string, string>;
  onChange: (next: CellDraft) => void;
}

/** Kind select, then either a Subject+Teacher pair or a free-text Activity label - see EntryKind's shape rules. */
function TimetableCellEditor({ draft, subjects, teachers, suggestedTeachers, onChange }: TimetableCellEditorProps) {
  return (
    <div className="space-y-1">
      <Select
        aria-label="Entry kind"
        value={draft.entryKind}
        onChange={(event) => {
          const kind = event.target.value as EntryKind | "";
          if (kind === "") {
            onChange({ entryKind: "", subjectId: null, teacherId: null, label: null });
          } else if (kind === "SUBJECT") {
            onChange({ entryKind: "SUBJECT", subjectId: draft.subjectId, teacherId: draft.teacherId, label: null });
          } else {
            onChange({ entryKind: "ACTIVITY", subjectId: null, teacherId: null, label: draft.label ?? "" });
          }
        }}
      >
        <option value="">— Empty —</option>
        <option value="SUBJECT">Subject</option>
        <option value="ACTIVITY">Activity</option>
      </Select>

      {draft.entryKind === "SUBJECT" && (
        <>
          <Select
            aria-label="Subject"
            value={draft.subjectId ?? ""}
            onChange={(event) => {
              const subjectId = event.target.value || null;
              const suggested = subjectId ? suggestedTeachers[subjectId] : undefined;
              onChange({ ...draft, subjectId, teacherId: draft.teacherId ?? suggested ?? null });
            }}
          >
            <option value="">Select subject…</option>
            {subjects.map((subject) => (
              <option key={subject.id} value={subject.id}>
                {subject.name}
              </option>
            ))}
          </Select>
          <Select
            aria-label="Teacher"
            value={draft.teacherId ?? ""}
            onChange={(event) => onChange({ ...draft, teacherId: event.target.value || null })}
          >
            <option value="">Unassigned</option>
            {teachers.map((teacher) => (
              <option key={teacher.id} value={teacher.id}>
                {teacher.name}
              </option>
            ))}
          </Select>
        </>
      )}

      {draft.entryKind === "ACTIVITY" && (
        <input
          type="text"
          aria-label="Activity label"
          value={draft.label ?? ""}
          onChange={(event) => onChange({ ...draft, label: event.target.value })}
          placeholder="e.g. Assembly"
          className="block w-full rounded-control border border-slate-300 px-2 py-1 text-xs focus:border-brand-500 mobile:min-h-11"
        />
      )}
    </div>
  );
}

interface TimetableSaveBarProps {
  dirtyCount: number;
  saving: boolean;
  onSave: () => void;
  onDiscard: () => void;
}

function TimetableSaveBar({ dirtyCount, saving, onSave, onDiscard }: TimetableSaveBarProps) {
  if (dirtyCount === 0) return null;

  return (
    <div className="sticky bottom-tabbar-safe -mx-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6 lg:-mx-8 lg:bottom-0 lg:px-8">
      <p className="text-sm text-slate-600">
        {dirtyCount} unsaved change{dirtyCount === 1 ? "" : "s"}
      </p>
      <div className="flex gap-2">
        <Button type="button" variant="ghost" disabled={saving} onClick={onDiscard}>
          Discard
        </Button>
        <Button type="button" variant="accent" loading={saving} onClick={onSave}>
          Save timetable
        </Button>
      </div>
    </div>
  );
}

interface TimetableOutcomeListProps {
  outcomes: TimetableRowOutcome[];
  labelOf: (dayOfWeek: number, periodId: string) => string;
}

/** Per-cell save results, "N of M saved" shape - mirrors AttendanceOutcomeList; only failed cells (with their reason) are listed. */
export function TimetableOutcomeList({ outcomes, labelOf }: TimetableOutcomeListProps) {
  const successCount = outcomes.filter((outcome) => outcome.success).length;
  const failures = outcomes.filter((outcome) => !outcome.success);

  return (
    <Alert
      variant={failures.length === 0 ? "success" : "warning"}
      title={
        failures.length === 0
          ? "Timetable saved"
          : `Timetable saved with ${failures.length} problem${failures.length === 1 ? "" : "s"}`
      }
    >
      <p>
        {successCount} of {outcomes.length} saved successfully.
      </p>
      {failures.length > 0 && (
        <ul className="mt-2 space-y-1.5">
          {failures.map((outcome) => (
            <li key={`${outcome.dayOfWeek}:${outcome.periodId}`} className="flex items-start gap-2">
              <XCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <span>
                <span className="font-medium">{labelOf(outcome.dayOfWeek, outcome.periodId)}</span>
                {outcome.message && <span> &mdash; {outcome.message}</span>}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Alert>
  );
}
