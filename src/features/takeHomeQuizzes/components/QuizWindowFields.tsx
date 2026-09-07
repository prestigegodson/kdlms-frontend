import { Checkbox } from "@/components/ui/Checkbox";
import { DateInput } from "@/components/ui/DateInput";
import { FormField } from "@/components/ui/FormField";
import { Input } from "@/components/ui/Input";
import { TAKE_HOME_QUIZ_FIELD_HELP } from "@/features/takeHomeQuizzes/takeHomeQuizFieldHelp";
import { splitInstant, toInstant } from "@/utils/date";

interface QuizWindowFieldsProps {
  opensAt: string;
  onOpensAtChange: (instant: string) => void;
  closesAt: string;
  onClosesAtChange: (instant: string) => void;
  timed: boolean;
  onTimedChange: (timed: boolean) => void;
  durationMinutes: string;
  onDurationMinutesChange: (value: string) => void;
  disabled?: boolean;
  /** `opensAt`/`durationMinutes` are frozen once a submission exists - see `TakeHomeQuiz.updateMetadata`'s per-field checks on the backend. */
  opensAtDisabled?: boolean;
}

/**
 * The quiz window - opens/closes instants plus the timed/duration toggle.
 * There is no datetime input in this app's component kit, so each instant
 * is a `DateInput` (date-only) paired with a native `<input type="time">`
 * (the `features/timetable/components/PeriodRows.tsx` idiom), combined via
 * `utils/date.ts`'s `toInstant`/`splitInstant` - both in the browser's own
 * local zone, per quiz-module.md's "Timezone handling". The server only
 * ever sees the resulting ISO instant and never needs to know any zone.
 */
export function QuizWindowFields({
  opensAt,
  onOpensAtChange,
  closesAt,
  onClosesAtChange,
  timed,
  onTimedChange,
  durationMinutes,
  onDurationMinutesChange,
  disabled = false,
  opensAtDisabled = false,
}: QuizWindowFieldsProps) {
  const opens = splitInstant(opensAt);
  const closes = splitInstant(closesAt);

  function updateOpens(dateIso: string, clockTime: string) {
    const instant = toInstant(dateIso, clockTime);
    if (instant) onOpensAtChange(instant);
  }

  function updateCloses(dateIso: string, clockTime: string) {
    const instant = toInstant(dateIso, clockTime);
    if (instant) onClosesAtChange(instant);
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Opens" htmlFor="quiz-opens-date" description={TAKE_HOME_QUIZ_FIELD_HELP.opensAt}>
          <div className="flex gap-2">
            <DateInput
              id="quiz-opens-date"
              value={opens.dateIso}
              onChange={(value) => updateOpens(value, opens.clockTime || "00:00")}
              disabled={disabled || opensAtDisabled}
            />
            <Input
              type="time"
              aria-label="Opens time"
              value={opens.clockTime}
              onChange={(event) => updateOpens(opens.dateIso, event.target.value)}
              disabled={disabled || opensAtDisabled}
            />
          </div>
        </FormField>

        <FormField label="Closes" htmlFor="quiz-closes-date" description={TAKE_HOME_QUIZ_FIELD_HELP.closesAt}>
          <div className="flex gap-2">
            <DateInput
              id="quiz-closes-date"
              value={closes.dateIso}
              onChange={(value) => updateCloses(value, closes.clockTime || "00:00")}
              disabled={disabled}
            />
            <Input
              type="time"
              aria-label="Closes time"
              value={closes.clockTime}
              onChange={(event) => updateCloses(closes.dateIso, event.target.value)}
              disabled={disabled}
            />
          </div>
        </FormField>
      </div>

      <label className="flex items-center gap-2 text-sm text-slate-700">
        <Checkbox
          checked={timed}
          onChange={(event) => onTimedChange(event.target.checked)}
          disabled={disabled || opensAtDisabled}
        />
        Timed
      </label>
      {timed && (
        <FormField
          label="Duration (minutes)"
          htmlFor="quiz-duration"
          description={TAKE_HOME_QUIZ_FIELD_HELP.durationMinutes}
          className="max-w-xs"
        >
          <Input
            id="quiz-duration"
            type="number"
            min={1}
            value={durationMinutes}
            onChange={(event) => onDurationMinutesChange(event.target.value)}
            disabled={disabled || opensAtDisabled}
          />
        </FormField>
      )}
    </div>
  );
}
