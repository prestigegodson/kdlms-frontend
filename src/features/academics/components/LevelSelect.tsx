import type { LevelView } from "@/api/levels";
import { Select } from "@/components/ui/Select";

interface LevelSelectProps {
  id: string;
  levels: LevelView[];
  value: string;
  onChange: (levelId: string) => void;
  /**
   * Excludes archived levels - pass this for create forms (a subject/class
   * can't be filed under an archived level). List filters should omit it:
   * an archived level's existing subjects/classes/groups must stay
   * reachable, so it's shown labeled "(archived)" instead of hidden.
   */
  activeOnly?: boolean;
  /** Adds a leading `value=""` option with this label (e.g. "All levels") - for list filters, not required create-form fields. */
  allOptionLabel?: string;
  required?: boolean;
}

/**
 * The level dropdown shared by every level-scoped screen (Subjects,
 * Classes) - presentational only, like Pagination/SearchInput: the caller
 * fetches (via stores/levelStore.ts) and owns the selected value.
 */
export function LevelSelect({ id, levels, value, onChange, activeOnly, allOptionLabel, required }: LevelSelectProps) {
  const options = activeOnly ? levels.filter((level) => level.status === "ACTIVE") : levels;

  return (
    <Select id={id} required={required} value={value} onChange={(event) => onChange(event.target.value)}>
      {allOptionLabel && <option value="">{allOptionLabel}</option>}
      {options.map((level) => (
        <option key={level.id} value={level.id}>
          {level.displayName}
          {level.status === "INACTIVE" ? " (archived)" : ""}
        </option>
      ))}
    </Select>
  );
}
