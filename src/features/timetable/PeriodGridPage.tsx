import { type FormEvent, useEffect, useState } from "react";
import { can } from "@/auth/permissions";
import { ApiError } from "@/api/client";
import { type LevelPeriodGridView, getPeriodGrid, type PeriodCommand, savePeriodGrid } from "@/api/timetable";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { FormField } from "@/components/ui/FormField";
import { PageHeader } from "@/components/ui/PageHeader";
import { ResultDialog } from "@/components/ui/ResultDialog";
import { Spinner } from "@/components/ui/Spinner";
import { StickySubHeader, useFilterChip } from "@/components/ui/StickySubHeader";
import { LevelSelect } from "@/features/academics/components/LevelSelect";
import { CopyLevelPeriodsModal } from "@/features/timetable/components/CopyLevelPeriodsModal";
import { type PeriodRow, PeriodRows } from "@/features/timetable/components/PeriodRows";
import { useAuthStore } from "@/stores/authStore";
import { useFeatureStore } from "@/stores/featureStore";
import { useLevelStore } from "@/stores/levelStore";
import { formatClockTime, normalizeClockTime, parseClockMinutes } from "@/utils/date";

/**
 * Client-side mirror of PeriodGridPolicy.normalize's overlap check and
 * LevelPeriod's own validators - re-validated by the backend regardless.
 * Half-open, so back-to-back periods (one ending exactly when the next
 * starts) never count as overlapping. Compares parsed minutes-since-midnight
 * via `parseClockMinutes`, not the raw strings - a bare string compare only
 * agrees with clock time when every value is exactly "HH:mm".
 */
function validatePeriods(periods: PeriodRow[]): string | null {
  if (periods.length === 0) return "Add at least one period.";
  const parsed: { label: string; startTime: string; endTime: string; start: number; end: number }[] = [];
  for (const period of periods) {
    if (!period.label.trim()) return "Every period needs a label.";
    if (!period.startTime || !period.endTime) return "Every period needs a start and end time.";
    const start = parseClockMinutes(period.startTime);
    const end = parseClockMinutes(period.endTime);
    if (start === null || end === null) return "Every period needs a start and end time.";
    if (start >= end) return `"${period.label}" - the start time must be before the end time.`;
    parsed.push({ label: period.label, startTime: period.startTime, endTime: period.endTime, start, end });
  }
  const sorted = [...parsed].sort((a, b) => a.start - b.start);
  for (let i = 0; i < sorted.length - 1; i++) {
    const current = sorted[i];
    const next = sorted[i + 1];
    if (current.end > next.start) {
      return `"${current.label}" (${formatClockTime(current.startTime)}–${formatClockTime(current.endTime)}) and "${next.label}" (${formatClockTime(next.startTime)}–${formatClockTime(next.endTime)}) overlap - periods must not overlap.`;
    }
  }
  return null;
}

/**
 * `PeriodView[] -> PeriodRow[]`, canonicalizing each time to "HH:mm" via
 * `normalizeClockTime` - so a seconds-bearing value ("12:30:00", the shape
 * Jackson emits for a LocalTime with non-zero seconds) never lands in an
 * `<input type="time">` or reaches `validatePeriods`' comparison. Shared by
 * the initial fetch and `applyGrid` (both a save response and a copy
 * response), which previously duplicated this mapping.
 */
function toRows(periods: LevelPeriodGridView["periods"]): PeriodRow[] {
  return periods.map((period) => ({
    id: period.id,
    label: period.label,
    startTime: normalizeClockTime(period.startTime) ?? period.startTime,
    endTime: normalizeClockTime(period.endTime) ?? period.endTime,
    kind: period.kind,
    inUse: period.inUse,
  }));
}

/**
 * A school admin's per-level bell-time grid - SCHOOL_ADMIN writes,
 * school-wide like levels and grading systems themselves. One page, no
 * separate list+editor split (unlike grading systems): the level picker
 * docks in a plain (non-collapsible) StickySubHeader since it's a single
 * control, per that component's own guidance.
 */
export function PeriodGridPage() {
  const role = useAuthStore((state) => state.user?.role);
  const entitled = useFeatureStore((state) => state.timetable);
  const canManage = can.managePeriodGrid(role, entitled);

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
  const [result, setResult] = useState<{ variant: "success" | "error"; message: string } | null>(null);
  const [copyOpen, setCopyOpen] = useState(false);
  // The *saved* count, not the local draft - an unsaved blank row shouldn't
  // disable "Copy from another level" (the server's own refusal is the real
  // guard regardless).
  const [serverPeriodCount, setServerPeriodCount] = useState(0);

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
    setResult(null);
    setCopyOpen(false);
  }

  useEffect(() => {
    if (!levelId) return;
    getPeriodGrid(levelId)
      .then((grid) => {
        setLevelName(grid.levelName);
        setPeriods(toRows(grid.periods));
        setServerPeriodCount(grid.periods.length);
        setGridLoaded(true);
      })
      .catch((err: unknown) =>
        setLoadError(err instanceof ApiError ? err.message : "Failed to load period grid"),
      );
  }, [levelId]);

  function applyGrid(grid: LevelPeriodGridView) {
    setLevelName(grid.levelName);
    setPeriods(toRows(grid.periods));
    setServerPeriodCount(grid.periods.length);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!levelId) return;
    setResult(null);

    const validationError = validatePeriods(periods);
    if (validationError) {
      setResult({ variant: "error", message: validationError });
      return;
    }

    const commands: PeriodCommand[] = periods.map((period) => ({
      id: period.id,
      label: period.label,
      startTime: normalizeClockTime(period.startTime) ?? period.startTime,
      endTime: normalizeClockTime(period.endTime) ?? period.endTime,
      kind: period.kind,
    }));

    setSubmitting(true);
    try {
      const grid = await savePeriodGrid(levelId, { periods: commands });
      applyGrid(grid);
      setResult({ variant: "success", message: "Period grid saved." });
    } catch (err) {
      setResult({
        variant: "error",
        message: err instanceof ApiError ? err.message : "Failed to save period grid",
      });
    } finally {
      setSubmitting(false);
    }
  }

  function handleCopied(grid: LevelPeriodGridView) {
    applyGrid(grid);
    setResult(null);
  }

  const copyDisabled = serverPeriodCount > 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Period grid"
        description="Define each level's bell-time grid."
        actions={
          canManage && levels.length > 1 ? (
            <span
              title={
                copyDisabled
                  ? "This level already has a period grid - remove its periods first."
                  : undefined
              }
            >
              <Button type="button" variant="secondary" disabled={copyDisabled} onClick={() => setCopyOpen(true)}>
                Copy from another level
              </Button>
            </span>
          ) : undefined
        }
      />

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
              <Card>
                <PeriodRows periods={periods} onChange={setPeriods} readOnly={!canManage} />
              </Card>

              {canManage && (
                <div className="flex justify-end gap-2">
                  <Button type="submit" variant="accent" loading={submitting}>
                    Save period grid
                  </Button>
                </div>
              )}
            </form>
          )}

          {canManage && (
            <CopyLevelPeriodsModal
              open={copyOpen}
              onClose={() => setCopyOpen(false)}
              targetLevelId={levelId}
              targetLevelName={levelName}
              levels={levels}
              onCopied={handleCopied}
            />
          )}

          {result && (
            <ResultDialog variant={result.variant} message={result.message} onClose={() => setResult(null)} />
          )}
        </>
      )}
    </div>
  );
}
