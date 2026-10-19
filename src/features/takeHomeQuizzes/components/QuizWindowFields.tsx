import { Checkbox } from "@/components/ui/Checkbox";
import { DateInput } from "@/components/ui/DateInput";
import { FormField } from "@/components/ui/FormField";
import { Input } from "@/components/ui/Input";
import { TAKE_HOME_QUIZ_FIELD_HELP } from "@/features/takeHomeQuizzes/takeHomeQuizFieldHelp";
import { splitInstant, toInstant } from "@/utils/date";
import { useParticipantNoun } from "@/components/ParticipantNoun";

interface QuizWindowFieldsProps {
  opensAt: string;
  onOpensAtChange: (instant: string) => void;
  closesAt: string;
  onClosesAtChange: (instant: string) => void;
  timed: boolean;
  onTimedChange: (timed: boolean) => void;
  durationMinutes: string;
  onDurationMinutesChange: (value: string) => void;
  /** Only shown, and only sent as `true`, for a timed quiz. */
  pauseTimerOnLeave: boolean;
  onPauseTimerOnLeaveChange: (pause: boolean) => void;
  disabled?: boolean;
  /**
   * `opensAt` is frozen once a submission exists - see `TakeHomeQuiz.updateMetadata`'s per-field
   * checks on the backend. The timer isn't: a change reaches only attempts started afterwards.
   */
  opensAtDisabled?: boolean;
}

/**
 * The quiz window - opens/closes instants plus the timed/duration toggle and, for a timed quiz,
 * whether its timer pauses while the participant is away.
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
  pauseTimerOnLeave,
  onPauseTimerOnLeaveChange,
  disabled = false,
  opensAtDisabled = false,
}: QuizWindowFieldsProps) {
  const { adapt } = useParticipantNoun();
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
        <FormField label="Opens" htmlFor="quiz-opens-date" description={adapt(TAKE_HOME_QUIZ_FIELD_HELP.opensAt)}>
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

        <FormField label="Closes" htmlFor="quiz-closes-date" description={adapt(TAKE_HOME_QUIZ_FIELD_HELP.closesAt)}>
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
          disabled={disabled}
        />
        Timed
      </label>
      {timed && (
        <>
          <FormField
            label="Duration (minutes)"
            htmlFor="quiz-duration"
            description={adapt(TAKE_HOME_QUIZ_FIELD_HELP.durationMinutes)}
            className="max-w-xs"
          >
            <Input
              id="quiz-duration"
              type="number"
              min={1}
              value={durationMinutes}
              onChange={(event) => onDurationMinutesChange(event.target.value)}
              disabled={disabled}
            />
          </FormField>
          <div>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <Checkbox
                checked={pauseTimerOnLeave}
                onChange={(event) => onPauseTimerOnLeaveChange(event.target.checked)}
                disabled={disabled}
              />
              {adapt("Pause the timer when a pupil leaves the quiz")}
            </label>
            <p className="mt-1 text-xs text-slate-500">{adapt(TAKE_HOME_QUIZ_FIELD_HELP.pauseTimerOnLeave)}</p>
          </div>
        </>
      )}
    </div>
  );
}
