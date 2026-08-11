import { useEffect, useState } from "react";
import { ApiError } from "@/api/client";
import type { LevelView } from "@/api/levels";
import { copySubjects, listSubjects, type SubjectCopyOutcome, type SubjectView } from "@/api/subjects";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { FormField } from "@/components/ui/FormField";
import { Modal } from "@/components/ui/Modal";
import { Spinner } from "@/components/ui/Spinner";
import { LevelSelect } from "@/features/academics/components/LevelSelect";
import { termNumbersLabel } from "@/features/academics/subjectTerms";

interface CopySubjectsModalProps {
  targetLevelId: string;
  targetLevelName: string;
  levels: LevelView[];
  onClose: () => void;
  /** Called once at least one row actually copied, so the caller can reload subjects/groups and the level store's counts. */
  onCopied: () => void;
}

/**
 * Bulk-copies another level's active subjects onto the currently selected
 * (target) level - name, code, terms taught, and the selective flag carry
 * over. A grouped subject is filed under a same-named group of the target
 * level, auto-created if it doesn't exist yet (POST /api/v1/subjects/copy).
 * A row whose name already exists on the target is skipped and reported,
 * never overwritten - the outcome list below the fold mirrors
 * ComposeNoteSheet's per-row result pattern.
 */
export function CopySubjectsModal({
  targetLevelId,
  targetLevelName,
  levels,
  onClose,
  onCopied,
}: CopySubjectsModalProps) {
  const [sourceLevelId, setSourceLevelId] = useState("");
  const [subjects, setSubjects] = useState<SubjectView[]>([]);
  const [loadingSubjects, setLoadingSubjects] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [outcomes, setOutcomes] = useState<SubjectCopyOutcome[] | null>(null);

  const sourceOptions = levels.filter((level) => level.id !== targetLevelId);
  const allSelected = subjects.length > 0 && selected.size === subjects.length;

  useEffect(() => {
    if (!sourceLevelId) {
      return;
    }
    // An explicit page size, larger than the page's default of 50 - a
    // truncated picker would silently drop subjects from the copy.
    listSubjects(sourceLevelId, 0, 200)
      .then((page) => {
        const active = page.content.filter((subject) => subject.status === "ACTIVE");
        setSubjects(active);
        setSelected(new Set(active.map((subject) => subject.id)));
      })
      .catch((err: unknown) => setError(err instanceof ApiError ? err.message : "Failed to load subjects"))
      .finally(() => setLoadingSubjects(false));
  }, [sourceLevelId]);

  function selectSource(id: string) {
    setSourceLevelId(id);
    setSubjects([]);
    setSelected(new Set());
    setOutcomes(null);
    setError(null);
    setLoadingSubjects(id !== "");
  }

  function toggle(subjectId: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(subjectId)) {
        next.delete(subjectId);
      } else {
        next.add(subjectId);
      }
      return next;
    });
  }

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(subjects.map((subject) => subject.id)));
  }

  async function submit() {
    if (!sourceLevelId || selected.size === 0) {
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const result = await copySubjects({ sourceLevelId, targetLevelId, subjectIds: Array.from(selected) });
      setOutcomes(result.outcomes);
      if (result.outcomes.some((outcome) => outcome.success)) {
        onCopied();
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to copy subjects");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal open onClose={onClose} title={`Copy subjects to ${targetLevelName}`} size="lg">
      {outcomes ? (
        <div className="space-y-4">
          <ul className="space-y-1.5 text-sm">
            {outcomes.map((outcome) => {
              const subject = subjects.find((row) => row.id === outcome.sourceSubjectId);
              return (
                <li key={outcome.sourceSubjectId} className="flex items-center justify-between gap-2">
                  <span>{subject?.name ?? outcome.sourceSubjectId}</span>
                  <span className={outcome.success ? "text-green-700" : "text-red-700"}>
                    {outcome.success ? "Copied" : (outcome.message ?? "Failed")}
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
          {error && <Alert variant="error">{error}</Alert>}

          <FormField label="Copy from level" htmlFor="copy-subjects-source">
            <LevelSelect
              id="copy-subjects-source"
              levels={sourceOptions}
              value={sourceLevelId}
              onChange={selectSource}
              allOptionLabel="Select a level…"
            />
          </FormField>

          {loadingSubjects && (
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <Spinner /> Loading subjects…
            </div>
          )}

          {!loadingSubjects && sourceLevelId && subjects.length === 0 && (
            <p className="text-sm text-slate-500">This level has no active subjects to copy.</p>
          )}

          {!loadingSubjects && subjects.length > 0 && (
            <FormField label={`Subjects (${selected.size} selected)`}>
              <div className="max-h-72 space-y-1 overflow-y-auto overscroll-contain rounded-control border border-slate-200 p-2">
                <label className="flex min-h-11 cursor-pointer items-center gap-2 border-b border-slate-100 px-1 text-sm font-medium">
                  <Checkbox checked={allSelected} onChange={toggleAll} />
                  Select all {subjects.length}
                </label>
                {subjects.map((subject) => (
                  <label key={subject.id} className="flex min-h-11 cursor-pointer items-center gap-2 px-1 text-sm">
                    <Checkbox checked={selected.has(subject.id)} onChange={() => toggle(subject.id)} />
                    <span className="flex-1">
                      {subject.name}
                      {subject.selective && <span className="ml-2 text-xs text-slate-400">Selective</span>}
                    </span>
                    <span className="text-xs text-slate-400">{subject.code ?? "—"}</span>
                    <span className="w-20 shrink-0 text-right text-xs text-slate-400">
                      {termNumbersLabel(subject.termNumbers)}
                    </span>
                  </label>
                ))}
              </div>
            </FormField>
          )}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={submit} loading={submitting} disabled={selected.size === 0}>
              Copy
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
