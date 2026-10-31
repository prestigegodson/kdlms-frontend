import { type FormEvent, useEffect, useState } from "react";
import { getErrorMessage } from "@/api/client";
import { getInsightSettings, isFeatureNotIncluded, saveInsightSettings, type InsightSettings } from "@/api/insights";
import { can } from "@/auth/permissions";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { FormField } from "@/components/ui/FormField";
import { Input } from "@/components/ui/Input";
import { PageHeader } from "@/components/ui/PageHeader";
import { Skeleton } from "@/components/ui/Skeleton";
import { Switch } from "@/components/ui/Switch";
import { InsightsUpgradeNotice } from "@/features/insights/components/InsightsUpgradeNotice";
import { useAuthStore } from "@/stores/authStore";
import { useFeatureStore } from "@/stores/featureStore";

type NumericKey = Exclude<keyof InsightSettings, "guardianAlertsEnabled">;

interface FieldSpec {
  key: NumericKey;
  label: string;
  description: string;
  /** Mirrors backend `InsightThresholds`' ranges; the server stays the authority (422 on a miss). */
  min: number;
  max?: number;
  step?: number;
}

const GROUPS: Array<{ title: string; fields: FieldSpec[] }> = [
  {
    title: "Results",
    fields: [
      { key: "averageDropPoints", label: "Average drop (points)", description: "Flag a term average this far below last term's.", min: 0.1, max: 100, step: 0.1 },
      { key: "positionDropPercent", label: "Position drop (% of class)", description: "Flag a fall in class position of at least this share of the class.", min: 1, max: 100 },
      { key: "passMark", label: "Pass mark", description: "A subject score below this counts as failing.", min: 0.1, max: 100, step: 0.1 },
      { key: "failingSubjectsMin", label: "Failing subjects", description: "Flag a student failing at least this many subjects.", min: 1 },
    ],
  },
  {
    title: "Attendance",
    fields: [
      { key: "attendanceRateMin", label: "Minimum attendance (%)", description: "Flag term attendance below this.", min: 0.1, max: 100, step: 0.1 },
      { key: "absenceStreakDays", label: "Absence streak (school days)", description: "Flag this many consecutive school days absent.", min: 1 },
    ],
  },
  {
    title: "Quizzes & learning",
    fields: [
      { key: "missedQuizzesMin", label: "Missed quizzes", description: "Flag at least this many assigned take-home quizzes not attempted.", min: 1 },
      { key: "unopenedResourcesMin", label: "Unopened resources", description: "Flag at least this many assigned learning resources left unopened…", min: 1 },
      { key: "unopenedResourceDays", label: "…after (days)", description: "…this many days after they became available. Students with a login only.", min: 1 },
    ],
  },
];

/**
 * Insight thresholds (insights Phase I4) - SCHOOL_ADMIN only. Saving queues every class in the
 * school for recompute, so new thresholds show up within a poll interval rather than overnight.
 * The guardian-alerts switch (Phase I6) emails a ward's guardians at most once per term, once
 * that term's results are published and the ward is at risk.
 */
export function InsightSettingsPage() {
  const role = useAuthStore((state) => state.user?.role);
  const entitled = useFeatureStore((state) => state.studentInsights);
  const featuresStatus = useFeatureStore((state) => state.status);
  const [loaded, setLoaded] = useState<{ settings?: InsightSettings; error?: string; notIncluded?: boolean } | null>(
    null,
  );

  useEffect(() => {
    let cancelled = false;
    getInsightSettings()
      .then((settings) => !cancelled && setLoaded({ settings }))
      .catch(
        (error: unknown) =>
          !cancelled &&
          setLoaded({
            error: getErrorMessage(error, "Failed to load insight settings"),
            notIncluded: isFeatureNotIncluded(error),
          }),
      );
    return () => {
      cancelled = true;
    };
  }, []);

  const header = (
    <PageHeader
      title="Insight settings"
      description="When a student gets flagged. One signal puts them on watch; two or more marks them at risk."
      backTo="/school/insights"
      backLabel="Student insights"
    />
  );

  if ((featuresStatus === "loaded" && !can.manageInsightSettings(role, entitled)) || loaded?.notIncluded) {
    return (
      <div className="space-y-6">
        {header}
        <InsightsUpgradeNotice />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {header}
      {loaded?.error && <Alert variant="error">{loaded.error}</Alert>}
      {!loaded && <Skeleton className="h-96 w-full max-w-2xl" />}
      {loaded?.settings && <InsightSettingsForm initial={loaded.settings} />}
    </div>
  );
}

function InsightSettingsForm({ initial }: { initial: InsightSettings }) {
  const [values, setValues] = useState<Record<NumericKey, string>>(() => {
    const entries = GROUPS.flatMap((group) => group.fields).map((field) => [field.key, String(initial[field.key])]);
    return Object.fromEntries(entries) as Record<NumericKey, string>;
  });
  const [guardianAlertsEnabled, setGuardianAlertsEnabled] = useState(initial.guardianAlertsEnabled);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ kind: "success" | "error"; text: string } | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      const numbers = Object.fromEntries(
        Object.entries(values).map(([key, value]) => [key, Number(value)]),
      ) as Record<NumericKey, number>;
      await saveInsightSettings({ ...numbers, guardianAlertsEnabled });
      setMessage({ kind: "success", text: "Saved. Every class will be recomputed shortly." });
    } catch (error) {
      setMessage({ kind: "error", text: getErrorMessage(error, "Failed to save insight settings") });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="max-w-2xl p-6">
      <form onSubmit={handleSubmit} className="space-y-6">
        {message && <Alert variant={message.kind}>{message.text}</Alert>}
        {GROUPS.map((group) => (
          <fieldset key={group.title}>
            <legend className="mb-3 text-sm font-semibold text-slate-900">{group.title}</legend>
            <div className="grid gap-4 sm:grid-cols-2">
              {group.fields.map((field) => {
                const id = `insight-${field.key}`;
                return (
                  <FormField key={field.key} label={field.label} htmlFor={id} description={field.description}>
                    <Input
                      id={id}
                      type="number"
                      inputMode="decimal"
                      required
                      min={field.min}
                      max={field.max}
                      step={field.step ?? 1}
                      aria-describedby={`${id}-description`}
                      value={values[field.key]}
                      onChange={(event) => setValues((current) => ({ ...current, [field.key]: event.target.value }))}
                    />
                  </FormField>
                );
              })}
            </div>
          </fieldset>
        ))}
        <fieldset>
          <legend className="mb-3 text-sm font-semibold text-slate-900">Guardian alerts</legend>
          <Switch
            checked={guardianAlertsEnabled}
            onChange={setGuardianAlertsEnabled}
            label="Email guardians when a ward is at risk"
            hint="Sent at most once per term, after that term's results are published. Guardians who turned off school emails aren't sent one."
            disabled={saving}
          />
        </fieldset>
        <div className="flex justify-end">
          <Button type="submit" loading={saving}>
            Save settings
          </Button>
        </div>
      </form>
    </Card>
  );
}
