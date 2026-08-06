import type { SchoolView } from "@/api/schools";
import { Select } from "@/components/ui/Select";

interface SchoolSelectProps {
  id: string;
  schools: SchoolView[];
  value: string;
  onChange: (schoolId: string) => void;
  /** Adds a leading `value=""` option with this label (e.g. "All schools"). */
  allOptionLabel?: string;
  required?: boolean;
  disabled?: boolean;
}

/**
 * The school dropdown for a result-template's availability binding -
 * presentational only, like `LevelSelect`: the caller fetches (via
 * `listSchools`) and owns the selected value. Suffixes an archived school's
 * name rather than hiding it, the same convention `LevelSelect` uses for an
 * archived level, so a template already bound to one stays a legible option.
 */
export function SchoolSelect({ id, schools, value, onChange, allOptionLabel, required, disabled }: SchoolSelectProps) {
  const options = [...schools].sort((a, b) => a.name.localeCompare(b.name));

  return (
    <Select
      id={id}
      required={required}
      disabled={disabled}
      value={value}
      onChange={(event) => onChange(event.target.value)}
    >
      {allOptionLabel && <option value="">{allOptionLabel}</option>}
      {options.map((school) => (
        <option key={school.id} value={school.id}>
          {school.name}
          {school.status === "ARCHIVED" ? " (archived)" : ""}
        </option>
      ))}
    </Select>
  );
}
