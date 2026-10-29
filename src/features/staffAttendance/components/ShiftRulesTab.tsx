import { type FormEvent, useEffect, useState } from "react";
import { getErrorMessage } from "@/api/client";
import {
  DAYS_OF_WEEK,
  type DayOfWeek,
  getShiftPolicy,
  saveShiftPolicy,
  type ShiftPolicyView,
} from "@/api/staffAttendance";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Checkbox } from "@/components/ui/Checkbox";
import { FormField } from "@/components/ui/FormField";
import { Input } from "@/components/ui/Input";
import { Skeleton } from "@/components/ui/Skeleton";
import { useAuthStore } from "@/stores/authStore";
import { shortTime } from "../format";

const DAY_LABEL: Record<DayOfWeek, string> = {
  MONDAY: "Mon",
  TUESDAY: "Tue",
  WEDNESDAY: "Wed",
  THURSDAY: "Thu",
  FRIDAY: "Fri",
  SATURDAY: "Sat",
  SUNDAY: "Sun",
};

/** One branch's working hours - what "late" and "left early" are measured against. */
export function ShiftRulesTab({ branchId }: { branchId?: string }) {
  const ownBranch = useAuthStore((state) => state.user?.branchId);
  const target = branchId ?? ownBranch;
  const [loaded, setLoaded] = useState<{ branchId: string; policy?: ShiftPolicyView; error?: string } | null>(null);
  const current = loaded && loaded.branchId === target ? loaded : null;
  const policy = current?.policy ?? null;
  const error = current?.error ?? null;

  useEffect(() => {
    if (!target) {
      return;
    }
    let cancelled = false;
    getShiftPolicy(target)
      .then((found) => !cancelled && setLoaded({ branchId: target, policy: found }))
      .catch(
        (err: unknown) =>
          !cancelled && setLoaded({ branchId: target, error: getErrorMessage(err, "Failed to load working hours") }),
      );
    return () => {
      cancelled = true;
    };
  }, [target]);

  if (!target) {
    return <Alert variant="info">Choose a branch above to set its working hours.</Alert>;
  }
  if (error) {
    return <Alert variant="error">{error}</Alert>;
  }
  if (!policy) {
    return <Skeleton className="h-64 w-full" />;
  }
  return <ShiftRulesForm key={target} branchId={target} initial={policy} />;
}

function ShiftRulesForm({ branchId, initial }: { branchId: string; initial: ShiftPolicyView }) {
  const [timezone, setTimezone] = useState(initial.timezone);
  const [resumption, setResumption] = useState(shortTime(initial.resumptionTime));
  const [closing, setClosing] = useState(shortTime(initial.closingTime));
  const [lateGrace, setLateGrace] = useState(String(initial.lateGraceMinutes));
  const [earlyGrace, setEarlyGrace] = useState(String(initial.earlyLeaveGraceMinutes));
  const [days, setDays] = useState<DayOfWeek[]>(initial.workingDays);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ kind: "success" | "error"; text: string } | null>(null);

  function toggleDay(day: DayOfWeek) {
    setDays((current) => (current.includes(day) ? current.filter((d) => d !== day) : [...current, day]));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      await saveShiftPolicy(branchId, {
        timezone,
        resumptionTime: resumption,
        closingTime: closing,
        lateGraceMinutes: Number(lateGrace),
        earlyLeaveGraceMinutes: Number(earlyGrace),
        workingDays: DAYS_OF_WEEK.filter((day) => days.includes(day)),
      });
      setMessage({ kind: "success", text: "Working hours saved. The register uses them straight away." });
    } catch (err) {
      setMessage({ kind: "error", text: getErrorMessage(err, "Failed to save working hours") });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="max-w-2xl p-6">
      <form onSubmit={handleSubmit} className="space-y-5">
        {!initial.custom && (
          <Alert variant="info">This branch uses the default hours. Save to set its own.</Alert>
        )}
        {message && <Alert variant={message.kind}>{message.text}</Alert>}
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Resumption time" htmlFor="shift-resumption">
            <Input id="shift-resumption" type="time" required value={resumption} onChange={(e) => setResumption(e.target.value)} />
          </FormField>
          <FormField label="Closing time" htmlFor="shift-closing">
            <Input id="shift-closing" type="time" required value={closing} onChange={(e) => setClosing(e.target.value)} />
          </FormField>
          <FormField label="Late after (minutes of grace)" htmlFor="shift-late-grace">
            <Input id="shift-late-grace" type="number" min={0} max={240} required value={lateGrace} onChange={(e) => setLateGrace(e.target.value)} />
          </FormField>
          <FormField label="Early leave grace (minutes)" htmlFor="shift-early-grace">
            <Input id="shift-early-grace" type="number" min={0} max={240} required value={earlyGrace} onChange={(e) => setEarlyGrace(e.target.value)} />
          </FormField>
        </div>
        <fieldset>
          <legend className="mb-2 text-sm font-medium text-slate-700">Working days</legend>
          <div className="flex flex-wrap gap-4">
            {DAYS_OF_WEEK.map((day) => (
              <label key={day} className="flex items-center gap-2 text-sm text-slate-700">
                <Checkbox checked={days.includes(day)} onChange={() => toggleDay(day)} />
                {DAY_LABEL[day]}
              </label>
            ))}
          </div>
        </fieldset>
        <FormField label="Timezone" htmlFor="shift-timezone" description="An IANA name, e.g. Africa/Lagos or Africa/Accra.">
          <Input id="shift-timezone" required value={timezone} onChange={(e) => setTimezone(e.target.value)} />
        </FormField>
        <p className="text-sm text-slate-500">
          A night guard or other shift worker can have their own hours - set them on their staff page.
        </p>
        <div className="flex justify-end">
          <Button type="submit" loading={saving} disabled={days.length === 0}>
            Save working hours
          </Button>
        </div>
      </form>
    </Card>
  );
}
