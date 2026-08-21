import { useEffect, useState } from "react";
import { type AcademicSessionView, listSessions, listTerms, type TermView } from "@/api/sessions";
import { ApiError } from "@/api/client";
import { copyLessonNotes, type SubjectCopyOutcome } from "@/api/lessonNotes";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { FormField } from "@/components/ui/FormField";
import { Modal } from "@/components/ui/Modal";
import { Select } from "@/components/ui/Select";
import { CheckCircle2, XCircle } from "lucide-react";

export interface CopyLessonNotesModalSubjectOption {
  id: string;
  name: string;
  levelName?: string;
}

interface CopyLessonNotesModalProps {
  open: boolean;
  onClose: () => void;
  /** The term currently being viewed - always the copy's target. */
  targetTermId: string;
  subjectOptions: CopyLessonNotesModalSubjectOption[];
  /** Pre-checked so the common "copy just this subject" case needs no extra clicks. */
  defaultSubjectId?: string;
  onCopied: () => void;
}

/**
 * Lets a teacher or admin multi-select subjects and a source term, then copies each selected
 * subject's lesson notes from that term into the currently-viewed (target) term in one action -
 * `ManageLessonNotesUseCase.copyFromTerm`'s bulk contract. A one-for-one port of
 * `features/timetable/components/CopyTermModal.tsx` (classes → subjects), with two deliberate
 * differences: the submit button is `primary`, not `accent` (this feature's one accent is
 * "Generate with AI" on the editor screen - the style guide's one-amber-per-view rule), and a
 * subject already holding a week the target term has is *skipped*, not refused wholesale, so
 * the outcome copy reads "copied/skipped" rather than a hard refusal message.
 */
export function CopyLessonNotesModal({
  open,
  onClose,
  targetTermId,
  subjectOptions,
  defaultSubjectId,
  onCopied,
}: CopyLessonNotesModalProps) {
  const [sessions, setSessions] = useState<AcademicSessionView[]>([]);
  const [sessionId, setSessionId] = useState("");
  const [terms, setTerms] = useState<TermView[]>([]);
  const [sourceTermId, setSourceTermId] = useState("");
  const [selectedSubjectIds, setSelectedSubjectIds] = useState<Set<string>>(
    () => new Set(defaultSubjectId ? [defaultSubjectId] : []),
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [outcomes, setOutcomes] = useState<SubjectCopyOutcome[] | null>(null);

  useEffect(() => {
    if (!open) return;
    listSessions(0, 50).then((page) => setSessions(page.content));
  }, [open]);

  useEffect(() => {
    if (!sessionId) return;
    listTerms(sessionId).then(setTerms);
  }, [sessionId]);

  function toggleSubject(subjectId: string) {
    setSelectedSubjectIds((current) => {
      const next = new Set(current);
      if (next.has(subjectId)) next.delete(subjectId);
      else next.add(subjectId);
      return next;
    });
  }

  async function handleCopy() {
    setSubmitting(true);
    setError(null);
    try {
      const result = await copyLessonNotes(sourceTermId, targetTermId, Array.from(selectedSubjectIds));
      setOutcomes(result.outcomes);
      if (result.outcomes.some((outcome) => outcome.success)) {
        onCopied();
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to copy lesson notes");
    } finally {
      setSubmitting(false);
    }
  }

  function handleClose() {
    setOutcomes(null);
    setError(null);
    onClose();
  }

  const canCopy = Boolean(sourceTermId) && sourceTermId !== targetTermId && selectedSubjectIds.size > 0;

  return (
    <Modal open={open} onClose={handleClose} title="Copy from another term">
      <div className="space-y-4">
        {error && <Alert variant="error">{error}</Alert>}

        {outcomes ? (
          <div className="space-y-2">
            {outcomes.map((outcome) => (
              <div
                key={outcome.subjectId}
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
                  <span className="font-medium">{outcome.subjectName ?? "Subject"}</span>
                  {outcome.success ? (
                    <span className="text-slate-600">
                      {" "}
                      &mdash; {outcome.copied} week{outcome.copied === 1 ? "" : "s"} copied
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
            <FormField label="Source session" htmlFor="copy-lesson-notes-session">
              <Select
                id="copy-lesson-notes-session"
                value={sessionId}
                onChange={(event) => setSessionId(event.target.value)}
              >
                <option value="">Select a session…</option>
                {sessions.map((session) => (
                  <option key={session.id} value={session.id}>
                    {session.name}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField label="Source term" htmlFor="copy-lesson-notes-term">
              <Select
                id="copy-lesson-notes-term"
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

            <FormField label="Subjects to copy" htmlFor="copy-lesson-notes-subjects">
              <div
                id="copy-lesson-notes-subjects"
                className="max-h-48 space-y-1 overflow-y-auto overscroll-contain rounded-control border border-slate-200 p-2"
              >
                {subjectOptions.map((option) => (
                  <label
                    key={option.id}
                    className="flex items-center gap-2 rounded px-1 py-1 text-sm hover:bg-slate-50"
                  >
                    <Checkbox checked={selectedSubjectIds.has(option.id)} onChange={() => toggleSubject(option.id)} />
                    {option.name}
                    {option.levelName && <span className="text-slate-400"> · {option.levelName}</span>}
                  </label>
                ))}
              </div>
            </FormField>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="ghost" onClick={handleClose}>
                Cancel
              </Button>
              <Button type="button" variant="primary" loading={submitting} disabled={!canCopy} onClick={handleCopy}>
                Copy note{selectedSubjectIds.size > 1 ? "s" : ""}
              </Button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
