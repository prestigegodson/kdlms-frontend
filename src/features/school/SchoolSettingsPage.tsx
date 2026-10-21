import { type FormEvent, useEffect, useState } from "react";
import {
  type ExistingAttendanceConversion,
  getSchoolSettings,
  type SchoolSettingsView,
  updateSchoolSettings,
} from "@/api/schoolSettings";
import { ApiError } from "@/api/client";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Checkbox } from "@/components/ui/Checkbox";
import { Modal } from "@/components/ui/Modal";
import { PageHeader } from "@/components/ui/PageHeader";
import { Spinner } from "@/components/ui/Spinner";
import { useSchoolSettingsStore } from "@/stores/schoolSettingsStore";

type LoadState =
  | { kind: "loading" }
  | { kind: "loaded"; settings: SchoolSettingsView }
  | { kind: "error"; message: string };

/**
 * School-wide operational policy toggles - whether attendance and timetable
 * periods can be marked/scheduled on weekends (each default off:
 * Monday-Friday only, per CLAUDE.md's attendance and timetable rules).
 * SCHOOL_ADMIN only, matching School Profile.
 * <p>
 * Saving with two-session attendance newly turned on first asks what this
 * term's already-marked attendance becomes (morning and afternoon, or
 * morning only) - the server refuses the save without that choice. Turning
 * it off asks nothing: afternoon registers already taken are kept.
 */
export function SchoolSettingsPage() {
  const [state, setState] = useState<LoadState>({ kind: "loading" });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  /** The two-session flag as last saved - the conversion prompt only shows when a save turns it on. */
  const [savedTwoSessions, setSavedTwoSessions] = useState(false);
  const [confirmingConversion, setConfirmingConversion] = useState(false);

  useEffect(() => {
    getSchoolSettings()
      .then((settings) => {
        setState({ kind: "loaded", settings });
        setSavedTwoSessions(settings.twoSessionAttendance);
      })
      .catch((error: unknown) =>
        setState({
          kind: "error",
          message: error instanceof ApiError ? error.message : "Failed to load settings",
        }),
      );
  }, []);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (state.kind !== "loaded") return;
    if (state.settings.twoSessionAttendance && !savedTwoSessions) {
      setConfirmingConversion(true);
      return;
    }
    void save();
  }

  async function save(existingAttendanceConversion?: ExistingAttendanceConversion) {
    if (state.kind !== "loaded") return;
    setConfirmingConversion(false);
    setSaving(true);
    setSaveError(null);
    setSaved(false);
    try {
      const updated = await updateSchoolSettings({
        allowWeekendAttendance: state.settings.allowWeekendAttendance,
        allowWeekendTimetable: state.settings.allowWeekendTimetable,
        guardianLessonNotesEnabled: state.settings.guardianLessonNotesEnabled,
        allowStudentPasswordChange: state.settings.allowStudentPasswordChange,
        twoSessionAttendance: state.settings.twoSessionAttendance,
        existingAttendanceConversion,
      });
      setState({ kind: "loaded", settings: updated });
      setSavedTwoSessions(updated.twoSessionAttendance);
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
      <div className="max-w-2xl space-y-6">
        <PageHeader title="School settings" description="School-wide operational policy for your school." />
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Spinner /> Loading settings…
        </div>
      </div>
    );
  }

  if (state.kind === "error") {
    return (
      <div className="max-w-2xl space-y-6">
        <PageHeader title="School settings" description="School-wide operational policy for your school." />
        <Alert variant="error">{state.message}</Alert>
      </div>
    );
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

          <label className="flex items-center gap-2 text-sm text-slate-700">
            <Checkbox
              checked={settings.allowWeekendTimetable}
              onChange={(event) =>
                setState({
                  kind: "loaded",
                  settings: { ...settings, allowWeekendTimetable: event.target.checked },
                })
              }
            />
            Allow timetable periods on weekends
          </label>
          <p className="text-sm text-slate-500">
            By default, timetable periods can only be scheduled Monday through Friday. Turn this on if
            your school runs Saturday or Sunday classes. A timetable entry already saved on a weekend
            stays correctable even if this is turned back off.
          </p>

          <label className="flex items-center gap-2 text-sm text-slate-700">
            <Checkbox
              checked={settings.guardianLessonNotesEnabled}
              onChange={(event) =>
                setState({
                  kind: "loaded",
                  settings: { ...settings, guardianLessonNotesEnabled: event.target.checked },
                })
              }
            />
            Let guardians view approved lesson notes
          </label>
          <p className="text-sm text-slate-500">
            Off by default. When turned on, guardians can read their wards' approved lesson notes in the
            guardian portal. This also requires the Lesson notes feature on your school's plan.
          </p>

          <label className="flex items-center gap-2 text-sm text-slate-700">
            <Checkbox
              checked={settings.allowStudentPasswordChange}
              onChange={(event) =>
                setState({
                  kind: "loaded",
                  settings: { ...settings, allowStudentPasswordChange: event.target.checked },
                })
              }
            />
            Allow pupils to change password
          </label>
          <p className="text-sm text-slate-500">
            On by default. When turned off, pupils can't change their own password from the pupil
            portal - a teacher or admin sets it for them. A pupil given a temporary password must still
            replace it the first time they sign in.
          </p>

          <label className="flex items-center gap-2 text-sm text-slate-700">
            <Checkbox
              checked={settings.twoSessionAttendance}
              onChange={(event) =>
                setState({
                  kind: "loaded",
                  settings: { ...settings, twoSessionAttendance: event.target.checked },
                })
              }
            />
            Take attendance twice a day (morning and afternoon)
          </label>
          <p className="text-sm text-slate-500">
            Off by default. When turned on, class teachers mark a morning and an afternoon register each
            day, and each register counts once in a pupil&rsquo;s attendance totals. You&rsquo;ll be asked
            what this term&rsquo;s existing attendance should count as.
          </p>
          {savedTwoSessions && !settings.twoSessionAttendance && (
            <Alert variant="info">
              Afternoon registers already taken are kept and still count in attendance totals. Teachers just
              won&rsquo;t be able to take new ones.
            </Alert>
          )}

          <Button type="submit" disabled={saving}>
            {saving ? "Saving…" : "Save changes"}
          </Button>
        </form>
      </Card>

      {confirmingConversion && (
        <Modal open onClose={() => setConfirmingConversion(false)} title="Existing attendance this term">
          <div className="space-y-4">
            <p className="text-sm text-slate-700">
              Registers already marked this term were taken once a day. Should each of them count for
              both the morning and the afternoon, or for the morning only? Earlier terms aren&rsquo;t
              changed.
            </p>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setConfirmingConversion(false)}
                className="w-full sm:w-auto"
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => void save("MORNING_ONLY")}
                className="w-full sm:w-auto"
              >
                Morning only
              </Button>
              <Button
                type="button"
                onClick={() => void save("MORNING_AND_AFTERNOON")}
                className="w-full sm:w-auto"
              >
                Morning and afternoon
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
