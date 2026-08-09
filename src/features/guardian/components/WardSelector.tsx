import { useEffect } from "react";
import { FormField } from "@/components/ui/FormField";
import { Select } from "@/components/ui/Select";
import { useWardStore } from "@/stores/wardStore";

/**
 * The ward switcher shown at the top of every guardian page - reads from
 * `wardStore` rather than fetching its own copy, so every page shares one
 * fetch and one selection. Renders nothing while the wards haven't loaded
 * yet or the guardian has none - the caller (e.g. `WardsPage`) is
 * responsible for its own loading/empty states.
 */
export function WardSelector() {
  const { wards, selectedWardId, status, fetchIfNeeded, select } = useWardStore();

  useEffect(() => {
    fetchIfNeeded();
  }, [fetchIfNeeded]);

  if (status !== "loaded" || wards.length === 0) {
    return null;
  }

  // Only label with the school name once it's actually disambiguating - the
  // common case (every ward at one school) stays exactly as it was.
  const multiSchool = new Set(wards.map((ward) => ward.schoolId)).size > 1;

  return (
    <FormField label="Ward" htmlFor="ward-selector" className="min-w-0 flex-1 lg:max-w-xs lg:flex-initial">
      <Select
        id="ward-selector"
        value={selectedWardId ?? ""}
        onChange={(event) => select(event.target.value)}
      >
        {wards.map((ward) => (
          <option key={ward.studentId} value={ward.studentId}>
            {multiSchool ? `${ward.fullName} — ${ward.schoolName}` : ward.fullName}
          </option>
        ))}
      </Select>
    </FormField>
  );
}
