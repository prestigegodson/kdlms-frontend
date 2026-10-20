import { useState } from "react";
import { getErrorMessage } from "@/api/client";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { DateInput } from "@/components/ui/DateInput";
import { FormField } from "@/components/ui/FormField";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { splitInstant, toInstant, todayIso } from "@/utils/date";

interface ScheduleModalProps {
  recipientCount: number | null;
  onSchedule: (instant: string) => Promise<void>;
  onClose: () => void;
}

function inOneHour(): string {
  const date = new Date(Date.now() + 60 * 60 * 1000);
  date.setMinutes(0, 0, 0);
  return date.toISOString();
}

/**
 * Picks when a newsletter goes out - a `DateInput` plus a native time input in the browser's own
 * zone (the `QuizWindowFields` idiom, since the kit has no datetime picker), sent as an ISO
 * instant. The send starts within the backend worker's poll interval (30s) of that time.
 */
export function ScheduleModal({ recipientCount, onSchedule, onClose }: ScheduleModalProps) {
  const initial = splitInstant(inOneHour());
  const [dateIso, setDateIso] = useState(initial.dateIso);
  const [clockTime, setClockTime] = useState(initial.clockTime);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  async function submit() {
    const instant = toInstant(dateIso, clockTime);
    if (!instant) {
      setError("Choose a date and time.");
      return;
    }
    if (new Date(instant).getTime() <= Date.now()) {
      setError("Choose a time in the future.");
      return;
    }
    setError(null);
    setSaving(true);
    try {
      await onSchedule(instant);
    } catch (caught) {
      setError(getErrorMessage(caught, "Couldn't schedule the newsletter."));
      setSaving(false);
    }
  }

  return (
    <Modal open onClose={onClose} title="Schedule newsletter">
      <div className="space-y-4">
        {error && <Alert variant="error">{error}</Alert>}
        <FormField
          label="Send on"
          htmlFor="newsletter-schedule-date"
          description={`Times are in your time zone (${zone}).`}
        >
          <div className="flex gap-2">
            <DateInput
              id="newsletter-schedule-date"
              value={dateIso}
              min={todayIso()}
              onChange={setDateIso}
            />
            <Input
              type="time"
              aria-label="Send time"
              value={clockTime}
              onChange={(event) => setClockTime(event.target.value)}
            />
          </div>
        </FormField>
        {recipientCount !== null && (
          <p className="text-sm text-slate-600">
            About {recipientCount.toLocaleString()} {recipientCount === 1 ? "person" : "people"}{" "}
            will get it. The audience is worked out again when it sends.
          </p>
        )}
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button
            variant="secondary"
            onClick={onClose}
            disabled={saving}
            className="w-full sm:w-auto"
          >
            Cancel
          </Button>
          <Button onClick={() => void submit()} loading={saving} className="w-full sm:w-auto">
            Schedule
          </Button>
        </div>
      </div>
    </Modal>
  );
}
