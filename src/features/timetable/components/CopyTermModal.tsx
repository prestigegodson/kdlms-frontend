import { useEffect, useState } from "react";
import { type AcademicSessionView, listSessions, listTerms, type TermView } from "@/api/sessions";
import { ApiError } from "@/api/client";
import { type ClassCopyOutcome, copyClassTimetables } from "@/api/timetable";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { FormField } from "@/components/ui/FormField";
import { Modal } from "@/components/ui/Modal";
import { Select } from "@/components/ui/Select";
import { CheckCircle2, XCircle } from "lucide-react";

export interface CopyTermModalClassOption {
  id: string;
  name: string;
}

interface CopyTermModalProps {
  open: boolean;
  onClose: () => void;
  /** The term currently being viewed - always the copy's target. */
  targetTermId: string;
  classOptions: CopyTermModalClassOption[];
  /** Pre-checked so the common "copy just this class" case needs no extra clicks. */
  defaultClassId?: string;
  onCopied: () => void;
}

/**
 * Lets an admin multi-select classes and a source term, then copies each
 * selected class's timetable from that term into the currently-viewed
 * (target) term in one action - `ManageClassTimetableUseCase.copyFromTerm`'s
 * bulk contract. Surfaces one `ClassCopyOutcome` per class, the same way
 * `AttendanceOutcomeList` renders `RowOutcome`s.
 */
export function CopyTermModal({ open, onClose, targetTermId, classOptions, defaultClassId, onCopied }: CopyTermModalProps) {
  const [sessions, setSessions] = useState<AcademicSessionView[]>([]);
  const [sessionId, setSessionId] = useState("");
  const [terms, setTerms] = useState<TermView[]>([]);
  const [sourceTermId, setSourceTermId] = useState("");
  const [selectedClassIds, setSelectedClassIds] = useState<Set<string>>(
    () => new Set(defaultClassId ? [defaultClassId] : []),
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [outcomes, setOutcomes] = useState<ClassCopyOutcome[] | null>(null);

  useEffect(() => {
    if (!open) return;
    listSessions(0, 50).then((page) => setSessions(page.content));
  }, [open]);

  useEffect(() => {
    if (!sessionId) return;
    listTerms(sessionId).then(setTerms);
  }, [sessionId]);

  function toggleClass(classId: string) {
    setSelectedClassIds((current) => {
      const next = new Set(current);
      if (next.has(classId)) next.delete(classId);
      else next.add(classId);
      return next;
    });
  }

  async function handleCopy() {
    setSubmitting(true);
    setError(null);
    try {
      const result = await copyClassTimetables(sourceTermId, targetTermId, Array.from(selectedClassIds));
      setOutcomes(result.outcomes);
      if (result.outcomes.some((outcome) => outcome.success)) {
        onCopied();
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to copy the timetable");
    } finally {
      setSubmitting(false);
    }
  }

  function handleClose() {
    setOutcomes(null);
    setError(null);
    onClose();
  }

  const canCopy = Boolean(sourceTermId) && sourceTermId !== targetTermId && selectedClassIds.size > 0;

  return (
    <Modal open={open} onClose={handleClose} title="Copy from another term">
      <div className="space-y-4">
        {error && <Alert variant="error">{error}</Alert>}

        {outcomes ? (
          <div className="space-y-2">
            {outcomes.map((outcome) => (
              <div
                key={outcome.classId}
                className={`flex items-start gap-2 rounded-control border px-3 py-2 text-sm ${
                  outcome.success ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50"
                }`}
              >
                {outcome.success ? (
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-600" aria-hidden="true" />
                ) : (
                  <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" aria-hidden="true" />
                )}
                <span>
                  <span className="font-medium">{outcome.className}</span>
                  {outcome.success ? (
                    <span className="text-slate-600">
                      {" "}
                      &mdash; {outcome.copied} period{outcome.copied === 1 ? "" : "s"} copied
                      {outcome.skipped > 0 ? `, ${outcome.skipped} skipped` : ""}
                    </span>
                  ) : (
                    outcome.message && <span className="text-slate-600"> &mdash; {outcome.message}</span>
                  )}
                </span>
              </div>
            ))}
            <div className="flex justify-end pt-2">
              <Button type="button" variant="secondary" onClick={handleClose}>
                Close
              </Button>
            </div>
          </div>
        ) : (
          <>
            <FormField label="Source session" htmlFor="copy-term-session">
              <Select id="copy-term-session" value={sessionId} onChange={(event) => setSessionId(event.target.value)}>
                <option value="">Select a session…</option>
                {sessions.map((session) => (
                  <option key={session.id} value={session.id}>
                    {session.name}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField label="Source term" htmlFor="copy-term-term">
              <Select
                id="copy-term-term"
                value={sourceTermId}
                onChange={(event) => setSourceTermId(event.target.value)}
                disabled={!sessionId}
              >
                <option value="">Select a term…</option>
                {terms.map((term) => (
                  <option key={term.id} value={term.id} disabled={term.id === targetTermId}>
                    {term.name}
                  </option>
                ))}
              </Select>
            </FormField>

            <FormField label="Classes to copy" htmlFor="copy-term-classes">
              <div id="copy-term-classes" className="max-h-48 space-y-1 overflow-y-auto overscroll-contain rounded-control border border-slate-200 p-2">
                {classOptions.map((option) => (
                  <label key={option.id} className="flex items-center gap-2 rounded px-1 py-1 text-sm hover:bg-slate-50">
                    <Checkbox
                      checked={selectedClassIds.has(option.id)}
                      onChange={() => toggleClass(option.id)}
                    />
                    {option.name}
                  </label>
                ))}
              </div>
            </FormField>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="ghost" onClick={handleClose}>
                Cancel
              </Button>
              <Button type="button" variant="accent" loading={submitting} disabled={!canCopy} onClick={handleCopy}>
                Copy timetable{selectedClassIds.size > 1 ? "s" : ""}
              </Button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
