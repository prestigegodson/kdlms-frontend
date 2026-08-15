import { useState } from "react";
import type { LevelView } from "@/api/levels";
import { ApiError } from "@/api/client";
import { copyPeriodGrid, type LevelPeriodGridView } from "@/api/timetable";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { FormField } from "@/components/ui/FormField";
import { Modal } from "@/components/ui/Modal";
import { Select } from "@/components/ui/Select";

interface CopyLevelPeriodsModalProps {
  open: boolean;
  onClose: () => void;
  /** The level currently being viewed - always the copy's target. */
  targetLevelId: string;
  targetLevelName: string;
  levels: LevelView[];
  onCopied: (grid: LevelPeriodGridView) => void;
}

/**
 * Lets a SCHOOL_ADMIN clone another level's whole period grid onto the level
 * currently being viewed - ManagePeriodGridUseCase.copyFrom's all-or-nothing
 * contract (unlike CopyTermModal's per-class outcome list, there is exactly
 * one grid, so success/failure is a single response, not a batch).
 */
export function CopyLevelPeriodsModal({
  open,
  onClose,
  targetLevelId,
  targetLevelName,
  levels,
  onCopied,
}: CopyLevelPeriodsModalProps) {
  const [sourceLevelId, setSourceLevelId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleClose() {
    setError(null);
    onClose();
  }

  async function handleCopy() {
    if (!sourceLevelId) return;
    setSubmitting(true);
    setError(null);
    try {
      const grid = await copyPeriodGrid(targetLevelId, sourceLevelId);
      onCopied(grid);
      setSourceLevelId("");
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to copy the period grid");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal open={open} onClose={handleClose} title="Copy from another level">
      <div className="space-y-4">
        {error && <Alert variant="error">{error}</Alert>}

        <p className="text-sm text-slate-600">Periods will be copied into {targetLevelName || "this level"}.</p>

        <FormField label="Source level" htmlFor="copy-periods-source-level">
          <Select
            id="copy-periods-source-level"
            value={sourceLevelId}
            onChange={(event) => setSourceLevelId(event.target.value)}
          >
            <option value="">Select a level…</option>
            {levels.map((level) => (
              <option key={level.id} value={level.id} disabled={level.id === targetLevelId}>
                {level.displayName}
              </option>
            ))}
          </Select>
        </FormField>

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={handleClose}>
            Cancel
          </Button>
          <Button type="button" variant="accent" loading={submitting} disabled={!sourceLevelId} onClick={handleCopy}>
            Copy periods
          </Button>
        </div>
      </div>
    </Modal>
  );
}
