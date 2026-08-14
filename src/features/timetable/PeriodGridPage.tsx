import { type FormEvent, useEffect, useState } from "react";
import { ApiError } from "@/api/client";
import { getPeriodGrid, type PeriodCommand, savePeriodGrid } from "@/api/timetable";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { FormField } from "@/components/ui/FormField";
import { PageHeader } from "@/components/ui/PageHeader";
import { Spinner } from "@/components/ui/Spinner";
import { StickySubHeader, useFilterChip } from "@/components/ui/StickySubHeader";
import { LevelSelect } from "@/features/academics/components/LevelSelect";
import { type PeriodRow, PeriodRows } from "@/features/timetable/components/PeriodRows";
import { useLevelStore } from "@/stores/levelStore";

/**
 * Client-side mirror of PeriodGridPolicy.normalize's overlap check and
 * LevelPeriod's own validators - re-validated by the backend regardless.
 * Half-open, so back-to-back periods never count as overlapping.
 */
function validatePeriods(periods: PeriodRow[]): string | null {
  if (periods.length === 0) return "Add at least one period.";
  for (const period of periods) {
    if (!period.label.trim()) return "Every period needs a label.";
    if (!period.startTime || !period.endTime) return "Every period needs a start and end time.";
    if (period.startTime >= period.endTime) return `"${period.label}" - the start time must be before the end time.`;
  }
  const sorted = [...periods].sort((a, b) => a.startTime.localeCompare(b.startTime));
  for (let i = 0; i < sorted.length - 1; i++) {
    const current = sorted[i];
    const next = sorted[i + 1];
    if (current.endTime > next.startTime) {
      return `"${current.label}" and "${next.label}" overlap - periods must not overlap.`;
    }
  }
  return null;
}

/**
 * A school admin's per-level bell-time grid - SCHOOL_ADMIN writes,
 * school-wide like levels and grading systems themselves. One page, no
 * separate list+editor split (unlike grading systems): the level picker
 * docks in a plain (non-collapsible) StickySubHeader since it's a single
 * control, per that component's own guidance.
 */
export function PeriodGridPage() {
  const levels = useLevelStore((state) => state.levels);
  const levelsStatus = useLevelStore((state) => state.status);
  const fetchLevels = useLevelStore((state) => state.fetchIfNeeded);

  const [selectedLevelId, setSelectedLevelId] = useState<string | null>(null);
  const levelId = selectedLevelId ?? levels[0]?.id ?? "";

  const [levelName, setLevelName] = useState("");
  const [periods, setPeriods] = useState<PeriodRow[]>([]);
  const [gridLoaded, setGridLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetchLevels();
  }, [fetchLevels]);

  useFilterChip("level", levels.find((level) => level.id === levelId)?.displayName);

  // Level selection resets downstream grid state during render (mirrors
  // TeacherEntryPanel's lastClassId idiom) rather than inside an effect; the
  // fetch effect below only fetches.
  const [lastLevelId, setLastLevelId] = useState(levelId);
  if (levelId !== lastLevelId) {
    setLastLevelId(levelId);
    setGridLoaded(false);
    setLoadError(null);
    setError(null);
    setSaved(false);
  }

  useEffect(() => {
    if (!levelId) return;
    getPeriodGrid(levelId)
      .then((grid) => {
        setLevelName(grid.levelName);
        setPeriods(
          grid.periods.map((period) => ({
            id: period.id,
            label: period.label,
            startTime: period.startTime,
            endTime: period.endTime,
            kind: period.kind,
            inUse: period.inUse,
          })),
        );
        setGridLoaded(true);
      })
      .catch((err: unknown) =>
        setLoadError(err instanceof ApiError ? err.message : "Failed to load period grid"),
      );
  }, [levelId]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!levelId) return;
    setError(null);
    setSaved(false);

    const validationError = validatePeriods(periods);
    if (validationError) {
      setError(validationError);
      return;
    }

    const commands: PeriodCommand[] = periods.map((period) => ({
      id: period.id,
      label: period.label,
      startTime: period.startTime,
      endTime: period.endTime,
      kind: period.kind,
    }));

    setSubmitting(true);
    try {
      const grid = await savePeriodGrid(levelId, { periods: commands });
      setPeriods(
        grid.periods.map((period) => ({
          id: period.id,
          label: period.label,
          startTime: period.startTime,
          endTime: period.endTime,
          kind: period.kind,
          inUse: period.inUse,
        })),
      );
      setSaved(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to save period grid");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Period grid" description="Define each level's bell-time grid." />

      {levelsStatus !== "loaded" && (
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Spinner /> Loading levels…
        </div>
      )}

      {levelsStatus === "loaded" && levels.length === 0 && (
        <EmptyState title="No levels yet" description="Add a level before building its period grid." />
      )}

      {levelsStatus === "loaded" && levels.length > 0 && (
        <>
          <StickySubHeader>
            <FormField
              label="Level"
              htmlFor="period-grid-level-filter"
              className="min-w-0 flex-1 lg:max-w-xs"
              labelClassName="sr-only lg:not-sr-only"
            >
              <LevelSelect id="period-grid-level-filter" levels={levels} value={levelId} onChange={setSelectedLevelId} />
            </FormField>
          </StickySubHeader>

          {!gridLoaded && !loadError && (
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <Spinner /> Loading {levelName || "grid"}…
            </div>
          )}
          {loadError && <Alert variant="error">{loadError}</Alert>}

          {gridLoaded && (
            <form className="space-y-6" onSubmit={handleSubmit}>
              {error && <Alert variant="error">{error}</Alert>}
              {saved && <Alert variant="success">Period grid saved.</Alert>}

              <Card>
                <PeriodRows periods={periods} onChange={setPeriods} />
              </Card>

              <div className="flex justify-end gap-2">
                <Button type="submit" variant="accent" loading={submitting}>
                  Save period grid
                </Button>
              </div>
            </form>
          )}
        </>
      )}
    </div>
  );
}
