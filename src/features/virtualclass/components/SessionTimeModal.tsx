import { type FormEvent, useState } from "react";
import { getErrorMessage } from "@/api/client";
import type { SessionTimeInput } from "@/api/virtualClasses";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { DateInput } from "@/components/ui/DateInput";
import { FormField } from "@/components/ui/FormField";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { MAX_DURATION, MIN_DURATION } from "../scheduleUtils";

interface SessionTimeModalProps {
  title: string;
  submitLabel: string;
  initial: SessionTimeInput;
  minDate: string;
  timezone: string;
  onSubmit: (input: SessionTimeInput) => Promise<void>;
  onClose: () => void;
}

/** Picks a date, local start time and length for one session - rescheduling one, or adding a one-off. */
export function SessionTimeModal({
  title,
  submitLabel,
  initial,
  minDate,
  timezone,
  onSubmit,
  onClose,
}: SessionTimeModalProps) {
  const [date, setDate] = useState(initial.date);
  const [startTime, setStartTime] = useState(initial.startTime);
  const [durationMinutes, setDurationMinutes] = useState(initial.durationMinutes);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await onSubmit({ date, startTime, durationMinutes });
    } catch (submitError) {
      setError(getErrorMessage(submitError, "Failed to save the session."));
      setSaving(false);
    }
  }

  return (
    <Modal open onClose={onClose} title={title} size="md">
      <form className="space-y-4" onSubmit={handleSubmit}>
        {error && <Alert variant="error">{error}</Alert>}
        <FormField label="Date" htmlFor="session-date">
          <DateInput id="session-date" required value={date} min={minDate} onChange={setDate} />
        </FormField>
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Start time" htmlFor="session-start" description={timezone}>
            <Input
              id="session-start"
              type="time"
              required
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
            />
          </FormField>
          <FormField label="Minutes" htmlFor="session-duration">
            <Input
              id="session-duration"
              type="number"
              required
              min={MIN_DURATION}
              max={MAX_DURATION}
              step={5}
              value={Number.isNaN(durationMinutes) ? "" : durationMinutes}
              onChange={(e) => setDurationMinutes(e.target.valueAsNumber)}
            />
          </FormField>
        </div>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" loading={saving}>
            {submitLabel}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
