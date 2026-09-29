import { useEffect, useState } from "react";
import type { UserSummary } from "@/api/auth";
import { ApiError } from "@/api/client";
import { listLevelHeadships, replaceLevelHeadships } from "@/api/levelHeadships";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { Modal } from "@/components/ui/Modal";
import { Spinner } from "@/components/ui/Spinner";
import { useLevelStore } from "@/stores/levelStore";

interface LevelHeadshipsModalProps {
  teacher: UserSummary;
  onClose: () => void;
  onSaved: () => void;
}

/**
 * Makes a teacher Head of Level for one or more levels of their own branch -
 * SCHOOL_ADMIN only. A head keeps everything they had as a teacher and gains
 * BRANCH_ADMIN-equivalent access to the academic section for those levels only.
 * Only active levels are offered; saving an empty selection revokes every
 * headship, effective on the teacher's very next request.
 */
export function LevelHeadshipsModal({ teacher, onClose, onSaved }: LevelHeadshipsModalProps) {
  const levels = useLevelStore((state) => state.levels);
  const fetchLevels = useLevelStore((state) => state.fetchIfNeeded);
  const [selected, setSelected] = useState<Set<string> | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchLevels();
    let cancelled = false;
    listLevelHeadships(teacher.id)
      .then((headships) => {
        if (!cancelled) setSelected(new Set(headships.map((headship) => headship.levelId)));
      })
      .catch((err: unknown) => {
        if (!cancelled)
          setError(err instanceof ApiError ? err.message : "Failed to load this teacher's levels");
      });
    return () => {
      cancelled = true;
    };
  }, [teacher.id, fetchLevels]);

  function toggle(levelId: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(levelId)) {
        next.delete(levelId);
      } else {
        next.add(levelId);
      }
      return next;
    });
  }

  async function handleSave() {
    if (!selected) return;
    setSaving(true);
    setError(null);
    try {
      await replaceLevelHeadships(teacher.id, [...selected]);
      onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to save this teacher's levels");
    } finally {
      setSaving(false);
    }
  }

  const activeLevels = levels.filter((level) => level.status === "ACTIVE");

  return (
    <Modal
      open
      onClose={onClose}
      title={`${teacher.firstName} ${teacher.lastName} - Head of level`}
    >
      <div className="space-y-4">
        <p className="text-sm text-slate-600">
          A head of level manages the classes, students, results, and timetables of the levels you
          pick, in their own branch. They keep their teaching access and don't get billing,
          inventory, or school settings.
        </p>
        {error && <Alert variant="error">{error}</Alert>}
        {selected === null && !error && <Spinner />}
        {selected !== null && (
          <fieldset className="space-y-2">
            <legend className="sr-only">Levels this teacher heads</legend>
            {activeLevels.map((level) => (
              <label key={level.id} className="flex items-center gap-3 text-sm text-slate-800">
                <Checkbox checked={selected.has(level.id)} onChange={() => toggle(level.id)} />
                {level.displayName}
              </label>
            ))}
          </fieldset>
        )}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" onClick={handleSave} loading={saving} disabled={selected === null}>
            Save
          </Button>
        </div>
      </div>
    </Modal>
  );
}
