import { useState } from "react";
import { type AdvanceBillPlanView, type SaveAdvanceBillPlanRow, saveAdvanceBillPlans } from "@/api/billing";
import { ApiError } from "@/api/client";
import { Alert } from "@/components/ui/Alert";
import { Modal } from "@/components/ui/Modal";
import { Select } from "@/components/ui/Select";
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from "@/components/ui/Table";
import { UnsavedChangesBar } from "@/features/assessments/components/UnsavedChangesBar";

interface AdvanceBillPlanModalProps {
  view: AdvanceBillPlanView;
  branchId?: string;
  onClose: () => void;
  /** Called once every dirty row saved successfully; the parent refetches the summary and shows its own ResultDialog. */
  onSaved: (message: string) => void;
}

/** Sentinel `Edits`/`LevelGroup.value` for a level whose classes don't all currently share one billing level. */
const MIXED = "__mixed__";

type Edits = Record<string, string>;

/** One row of the editor: a school's current level, folded up from every `advance_bill_plans`-eligible class at it. */
interface LevelGroup {
  currentLevelId: string;
  currentLevelName: string;
  /** Every class of this level, in the view's own (level-rank) order - what a save fans one selection out across. */
  classIds: string[];
  activeStudents: number;
  alreadyEnrolled: number;
  /** "" = Exclude, a levelId, or MIXED when the level's classes don't already agree. */
  value: string;
}

/**
 * Folds `view.classes` up into one row per `currentLevelId` - a plan is priced off the student's
 * level, never their class, so two classes of the same level are always billed identically. A
 * `Map` preserves first-seen order, which is already level-rank order (`classesInScope`'s own
 * `DEFAULT_ORDER`), so no re-sort is needed. A level whose classes don't already share one
 * `billingLevelId` (a leftover from an older per-class save, or a cross-session copy) folds to
 * `MIXED` rather than silently picking one.
 */
function groupByCurrentLevel(view: AdvanceBillPlanView): LevelGroup[] {
  const groups = new Map<string, LevelGroup>();
  for (const row of view.classes) {
    const existing = groups.get(row.currentLevelId);
    const rowValue = row.billingLevelId ?? "";
    if (!existing) {
      groups.set(row.currentLevelId, {
        currentLevelId: row.currentLevelId,
        currentLevelName: row.currentLevelName,
        classIds: [row.classId],
        activeStudents: row.activeStudents,
        alreadyEnrolled: row.alreadyEnrolled,
        value: rowValue,
      });
      continue;
    }
    existing.classIds.push(row.classId);
    existing.activeStudents += row.activeStudents;
    existing.alreadyEnrolled += row.alreadyEnrolled;
    if (existing.value !== rowValue) {
      existing.value = MIXED;
    }
  }
  return Array.from(groups.values());
}

function seedEdits(groups: LevelGroup[]): Edits {
  const edits: Edits = {};
  for (const group of groups) {
    edits[group.currentLevelId] = group.value;
  }
  return edits;
}

/**
 * One session's whole advance-bill plan for a branch - each *current level* a row, its billing
 * level a single select ("Exclude" clears it, the `TransportRidersTable` inline-edit shape),
 * wrapped in a `Modal` rather than rendered directly in the tab body since `AdvanceBillPlanCard`
 * only shows a summary. Storage (`advance_bill_plans`) stays keyed on `(session_id, class_id)` -
 * saving a level fans its value out across every class folded into that row
 * (`groupByCurrentLevel`). `activeStudents`/`alreadyEnrolled` are read-only context columns,
 * summed from the level's classes; they come from those classes' own enrollment, not the plan.
 */
export function AdvanceBillPlanModal({ view, branchId, onClose, onSaved }: AdvanceBillPlanModalProps) {
  const [groups] = useState(() => groupByCurrentLevel(view));
  const [initial, setInitial] = useState(() => seedEdits(groups));
  const [edits, setEdits] = useState<Edits>(initial);
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function updateLevel(currentLevelId: string, levelId: string) {
    setEdits((current) => ({ ...current, [currentLevelId]: levelId }));
    setRowErrors((current) => {
      if (!(currentLevelId in current)) return current;
      const next = { ...current };
      delete next[currentLevelId];
      return next;
    });
  }

  const dirtyLevelIds = groups
    .map((group) => group.currentLevelId)
    .filter((currentLevelId) => (edits[currentLevelId] ?? "") !== (initial[currentLevelId] ?? ""));

  async function handleSave() {
    setError(null);
    const rows: SaveAdvanceBillPlanRow[] = [];
    const levelIdByClassId: Record<string, string> = {};
    for (const currentLevelId of dirtyLevelIds) {
      const group = groups.find((candidate) => candidate.currentLevelId === currentLevelId);
      if (!group) continue;
      const levelId = edits[currentLevelId] || null;
      for (const classId of group.classIds) {
        rows.push({ classId, levelId });
        levelIdByClassId[classId] = currentLevelId;
      }
    }
    if (rows.length === 0) return;

    setSaving(true);
    try {
      const outcome = await saveAdvanceBillPlans(view.sessionId, rows, branchId);
      const failed = outcome.outcomes.filter((row) => !row.success);
      if (failed.length === 0) {
        setInitial(edits);
        onSaved(`${dirtyLevelIds.length} level${dirtyLevelIds.length === 1 ? "" : "s"} saved.`);
        return;
      }
      const failedByLevelId: Record<string, string> = {};
      for (const row of failed) {
        const levelId = levelIdByClassId[row.classId];
        if (levelId && !(levelId in failedByLevelId)) {
          failedByLevelId[levelId] = row.message ?? "Failed to save.";
        }
      }
      setRowErrors(failedByLevelId);
      const failedCount = Object.keys(failedByLevelId).length;
      setError(
        `${dirtyLevelIds.length - failedCount} of ${dirtyLevelIds.length} level${dirtyLevelIds.length === 1 ? "" : "s"} saved; ${failedCount} failed - see the highlighted level${failedCount === 1 ? "" : "s"}.`,
      );
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to save the advance-bill plan");
    } finally {
      setSaving(false);
    }
  }

  function handleDiscard() {
    setEdits(initial);
    setRowErrors({});
    setError(null);
  }

  function handleClose() {
    if (dirtyLevelIds.length > 0 && !window.confirm("Discard unsaved changes to the advance-bill plan?")) {
      return;
    }
    onClose();
  }

  return (
    <Modal
      open
      onClose={handleClose}
      title={`Advance-bill plan — ${view.branchName} · ${view.sessionName}`}
      size="xl"
    >
      <div className="space-y-4">
        <p className="text-sm text-slate-600">
          Map each level to the level its students will be billed at for {view.sessionName}, before they're
          promoted. A level left as "Exclude" is not advance-billed at all.
        </p>
        {error && <Alert variant="error">{error}</Alert>}

        <Table>
          <TableHead>
            <TableRow>
              <TableHeaderCell>Current level</TableHeaderCell>
              <TableHeaderCell numeric>Active students</TableHeaderCell>
              <TableHeaderCell numeric>Already enrolled</TableHeaderCell>
              <TableHeaderCell>Bills at</TableHeaderCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {groups.map((group) => {
              const rowError = rowErrors[group.currentLevelId];
              const value = edits[group.currentLevelId] ?? "";
              return (
                <TableRow key={group.currentLevelId}>
                  <TableCell label="Current level">{group.currentLevelName}</TableCell>
                  <TableCell label="Active students" numeric>
                    {group.activeStudents}
                  </TableCell>
                  <TableCell label="Already enrolled" numeric>
                    {group.alreadyEnrolled}
                  </TableCell>
                  <TableCell label="Bills at">
                    <Select
                      aria-label={`${group.currentLevelName} bills at`}
                      aria-invalid={rowError ? "true" : undefined}
                      value={value}
                      onChange={(event) => updateLevel(group.currentLevelId, event.target.value)}
                    >
                      {value === MIXED && (
                        <option value={MIXED} disabled>
                          Mixed
                        </option>
                      )}
                      <option value="">Exclude</option>
                      {view.levels.map((level) => (
                        <option key={level.levelId} value={level.levelId}>
                          {level.displayName}
                        </option>
                      ))}
                    </Select>
                    {rowError && <p className="mt-1 text-xs text-red-600">{rowError}</p>}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>

        <UnsavedChangesBar
          count={dirtyLevelIds.length}
          saving={saving}
          onSave={handleSave}
          onDiscard={handleDiscard}
          saveVariant="primary"
        />
      </div>
    </Modal>
  );
}
