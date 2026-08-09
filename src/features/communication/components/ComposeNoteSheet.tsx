import { useState } from "react";
import { type MessageCategory, type StartThreadRowOutcome, startThreads } from "@/api/communication";
import { ApiError } from "@/api/client";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { DateInput } from "@/components/ui/DateInput";
import { FormField } from "@/components/ui/FormField";
import { Modal } from "@/components/ui/Modal";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { MESSAGE_CATEGORIES } from "@/features/communication/messageCategory";
import { todayIso } from "@/utils/date";

export interface RosterOption {
  studentId: string;
  studentName: string;
  admissionNumber: string;
}

interface ComposeNoteSheetProps {
  classId: string;
  roster: RosterOption[];
  /** Pre-ticks a single student when opened from a roster row's own "Log note" action. */
  initialStudentIds?: string[];
  onClose: () => void;
  /** Called once the compose action has fully resolved (even with partial per-student failures), so the caller can reload the board. */
  onSaved: () => void;
}

/**
 * Logging a note - one control for one student, several, or the whole
 * class (CLAUDE.md's "one picker: one / several / all" decision), rather
 * than a separate broadcast toggle. Always fans out into separate
 * per-student threads on the backend regardless of how many are ticked, so
 * the privacy line below is not a caveat - it is always true.
 */
export function ComposeNoteSheet({ classId, roster, initialStudentIds, onClose, onSaved }: ComposeNoteSheetProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set(initialStudentIds ?? []));
  const [category, setCategory] = useState<MessageCategory>("GENERAL");
  const [logDate, setLogDate] = useState(todayIso());
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [outcomes, setOutcomes] = useState<StartThreadRowOutcome[] | null>(null);

  const allSelected = roster.length > 0 && selected.size === roster.length;

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

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(roster.map((student) => student.studentId)));
  }

  async function submit() {
    if (selected.size === 0 || !body.trim()) {
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const outcome = await startThreads(classId, logDate, category, body.trim(), Array.from(selected));
      setOutcomes(outcome.outcomes);
      onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to log this note");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal open onClose={onClose} title="Log a note" size="lg">
      {outcomes ? (
        <div className="space-y-4">
          <ul className="space-y-1.5 text-sm">
            {outcomes.map((outcome) => {
              const student = roster.find((row) => row.studentId === outcome.studentId);
              return (
                <li key={outcome.studentId} className="flex items-center justify-between gap-2">
                  <span>{student?.studentName ?? outcome.studentId}</span>
                  <span className={outcome.success ? "text-green-700" : "text-red-700"}>
                    {outcome.success ? "Logged" : (outcome.message ?? "Failed")}
                  </span>
                </li>
              );
            })}
          </ul>
          <div className="flex justify-end">
            <Button onClick={onClose}>Done</Button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <FormField label={`Recipients (${selected.size} selected)`}>
            <div className="max-h-56 space-y-1 overflow-y-auto rounded-control border border-slate-200 p-2">
              <label className="flex min-h-11 cursor-pointer items-center gap-2 border-b border-slate-100 px-1 text-sm font-medium">
                <Checkbox checked={allSelected} onChange={toggleAll} />
                Select all {roster.length}
              </label>
              {roster.map((student) => (
                <label
                  key={student.studentId}
                  className="flex min-h-11 cursor-pointer items-center gap-2 px-1 text-sm"
                >
                  <Checkbox
                    checked={selected.has(student.studentId)}
                    onChange={() => toggle(student.studentId)}
                  />
                  <span className="flex-1">{student.studentName}</span>
                  <span className="text-xs text-slate-400">{student.admissionNumber}</span>
                </label>
              ))}
            </div>
          </FormField>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField label="Category" htmlFor="compose-category">
              <Select
                id="compose-category"
                value={category}
                onChange={(event) => setCategory(event.target.value as MessageCategory)}
              >
                {MESSAGE_CATEGORIES.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField label="Date" htmlFor="compose-date">
              <DateInput id="compose-date" max={todayIso()} value={logDate} onChange={setLogDate} />
            </FormField>
          </div>

          <FormField label="Message">
            <Textarea
              value={body}
              onChange={(event) => setBody(event.target.value)}
              rows={4}
              maxLength={4000}
              placeholder="What would you like to share?"
            />
          </FormField>

          {selected.size > 1 && (
            <p className="text-xs text-slate-500">
              Each family sees only their own copy. Replies come back to you privately.
            </p>
          )}

          {error && <Alert variant="error">{error}</Alert>}

          <div
            data-sheet-dock
            className="flex justify-end gap-2 border-t border-slate-100 pt-4 mobile:sticky mobile:bottom-0 mobile:-mx-6 mobile:bg-white/95 mobile:px-6 mobile:pb-4 mobile:backdrop-blur"
          >
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={submit} loading={submitting} disabled={selected.size === 0 || !body.trim()}>
              Log note
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
