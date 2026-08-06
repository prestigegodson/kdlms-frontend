import { type FormEvent, useEffect, useState } from "react";
import { getSchoolSettings, type SchoolSettingsView, updateSchoolSettings } from "@/api/schoolSettings";
import { ApiError } from "@/api/client";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Checkbox } from "@/components/ui/Checkbox";
import { PageHeader } from "@/components/ui/PageHeader";
import { Spinner } from "@/components/ui/Spinner";
import { useSchoolSettingsStore } from "@/stores/schoolSettingsStore";

type LoadState =
  | { kind: "loading" }
  | { kind: "loaded"; settings: SchoolSettingsView }
  | { kind: "error"; message: string };

/**
 * School-wide operational policy toggles - today just whether attendance can
 * be marked on weekends (default off: Monday-Friday only, per CLAUDE.md's
 * attendance rules). SCHOOL_ADMIN only, matching School Profile.
 */
export function SchoolSettingsPage() {
  const [state, setState] = useState<LoadState>({ kind: "loading" });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    getSchoolSettings()
      .then((settings) => setState({ kind: "loaded", settings }))
      .catch((error: unknown) =>
        setState({
          kind: "error",
          message: error instanceof ApiError ? error.message : "Failed to load settings",
        }),
      );
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (state.kind !== "loaded") return;
    setSaving(true);
    setSaveError(null);
    setSaved(false);
    try {
      const updated = await updateSchoolSettings({ allowWeekendAttendance: state.settings.allowWeekendAttendance });
      setState({ kind: "loaded", settings: updated });
      // The attendance date picker reads this same store - push the save straight in
      // rather than waiting for schoolSettingsStore's own idempotent fetchIfNeeded to
      // notice (it won't, since it only fetches once per session).
      useSchoolSettingsStore.setState({ settings: updated, status: "loaded" });
      setSaved(true);
    } catch (error) {
      setSaveError(error instanceof ApiError ? error.message : "Failed to save settings");
    } finally {
      setSaving(false);
    }
  }

  if (state.kind === "loading") {
    return (
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <Spinner /> Loading settings…
      </div>
    );
  }

  if (state.kind === "error") {
    return <Alert variant="error">{state.message}</Alert>;
  }

  const { settings } = state;

  return (
    <div className="max-w-2xl space-y-6">
      <PageHeader title="School settings" description="School-wide operational policy for your school." />

      <Card>
        <form className="space-y-4" onSubmit={handleSubmit}>
          {saveError && <Alert variant="error">{saveError}</Alert>}
          {saved && <Alert variant="success">Settings updated.</Alert>}

          <label className="flex items-center gap-2 text-sm text-slate-700">
            <Checkbox
              checked={settings.allowWeekendAttendance}
              onChange={(event) =>
                setState({
                  kind: "loaded",
                  settings: { ...settings, allowWeekendAttendance: event.target.checked },
                })
              }
            />
            Allow attendance on weekends
          </label>
          <p className="text-sm text-slate-500">
            By default, attendance can only be marked Monday through Friday. Turn this on if your school
            runs Saturday or Sunday classes. A register already marked on a weekend stays correctable even
            if this is turned back off.
          </p>

          <Button type="submit" disabled={saving}>
            {saving ? "Saving…" : "Save changes"}
          </Button>
        </form>
      </Card>
    </div>
  );
}
