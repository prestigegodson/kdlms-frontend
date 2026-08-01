import { FormField } from "@/components/ui/FormField";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { todayIso } from "@/utils/date";

export interface ClassOption {
  id: string;
  name: string;
}

interface ClassDatePickerProps {
  classes: ClassOption[];
  classId: string;
  onClassChange: (classId: string) => void;
  date: string;
  onDateChange: (date: string) => void;
}

/**
 * Class + date selection for the daily register - the attendance
 * counterpart to `features/assessments/components/ClassTermPicker.tsx`. A
 * date can never be marked in the future (CLAUDE.md), so the native date
 * input caps at today; a date outside the current term is still possible to
 * pick (e.g. an admin reviewing a past term) and is handled by the loaded
 * register/error state rather than a second bound here.
 */
export function ClassDatePicker({
  classes,
  classId,
  onClassChange,
  date,
  onDateChange,
}: ClassDatePickerProps) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <FormField label="Class" htmlFor="attendance-class">
        <Select
          id="attendance-class"
          value={classId}
          onChange={(event) => onClassChange(event.target.value)}
        >
          <option value="">Select a class…</option>
          {classes.map((option) => (
            <option key={option.id} value={option.id}>
              {option.name}
            </option>
          ))}
        </Select>
      </FormField>
      <FormField label="Date" htmlFor="attendance-date">
        <Input
          id="attendance-date"
          type="date"
          max={todayIso()}
          value={date}
          onChange={(event) => onDateChange(event.target.value)}
        />
      </FormField>
    </div>
  );
}
