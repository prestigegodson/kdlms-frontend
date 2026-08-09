import { useEffect, useState } from "react";
import {
  getMyNotificationPreferences,
  type NotificationPreferencesView,
  type SchoolPreference,
  updateMyNotificationPreferences,
} from "@/api/notificationPreferences";
import { ApiError } from "@/api/client";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Checkbox } from "@/components/ui/Checkbox";
import { PageHeader } from "@/components/ui/PageHeader";
import { Spinner } from "@/components/ui/Spinner";

type LoadState =
  | { kind: "loading" }
  | { kind: "loaded"; preferences: NotificationPreferencesView }
  | { kind: "error"; message: string };

/**
 * Guardian self-service opt-out from communication-thread-started email
 * (CLAUDE.md's communication Domain Rules). Email-only - turning this off
 * never hides a thread; it's still visible in Messages and still drives the
 * unread badge. Results-published, guardian-invitation, and password-reset
 * emails are unaffected and always send. A SCHOOL_ADMIN/BRANCH_ADMIN can set
 * this same preference on a guardian's behalf from the guardian edit form.
 * <p>
 * One toggle per school the guardian holds a profile at (CLAUDE.md's
 * cross-school guardian rule) - identical to today's single checkbox when
 * there's only one.
 */
export function NotificationSettingsPage() {
  const [state, setState] = useState<LoadState>({ kind: "loading" });

  useEffect(() => {
    getMyNotificationPreferences()
      .then((preferences) => setState({ kind: "loaded", preferences }))
      .catch((error: unknown) =>
        setState({
          kind: "error",
          message: error instanceof ApiError ? error.message : "Failed to load notification preferences",
        }),
      );
  }, []);

  function handleUpdated(updated: NotificationPreferencesView) {
    setState({ kind: "loaded", preferences: updated });
  }

  return (
    <div className="max-w-2xl space-y-6">
      <PageHeader
        title="Notifications"
        description="Choose which emails you'd like to receive."
        backTo="/guardian"
      />

      {state.kind === "loading" && (
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Spinner /> Loading notification preferences…
        </div>
      )}

      {state.kind === "error" && <Alert variant="error">{state.message}</Alert>}

      {state.kind === "loaded" && (
        <div className="space-y-4">
          {state.preferences.schools.map((school) => (
            <SchoolPreferenceCard key={school.schoolId} school={school} onUpdated={handleUpdated} />
          ))}
        </div>
      )}
    </div>
  );
}

interface SchoolPreferenceCardProps {
  school: SchoolPreference;
  onUpdated: (preferences: NotificationPreferencesView) => void;
}

/** One school's preference row/card - each school saves independently, since it's a separate `guardians` row server-side. */
function SchoolPreferenceCard({ school, onUpdated }: SchoolPreferenceCardProps) {
  const [enabled, setEnabled] = useState(school.communicationEmailsEnabled);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function handleSubmit() {
    setSaving(true);
    setSaveError(null);
    setSaved(false);
    try {
      const updated = await updateMyNotificationPreferences({ schoolId: school.schoolId, communicationEmailsEnabled: enabled });
      onUpdated(updated);
      setSaved(true);
    } catch (error) {
      setSaveError(error instanceof ApiError ? error.message : "Failed to save notification preferences");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          handleSubmit();
        }}
      >
        <h2 className="font-display text-sm font-semibold text-slate-900">{school.schoolName}</h2>
        {saveError && <Alert variant="error">{saveError}</Alert>}
        {saved && <Alert variant="success">Notification preferences updated.</Alert>}

        <label className="flex min-h-14 cursor-pointer items-center gap-3 text-sm text-slate-700">
          <Checkbox
            checked={enabled}
            onChange={(event) => {
              setEnabled(event.target.checked);
              setSaved(false);
            }}
          />
          Send email notifications for new messages
        </label>
        <p className="text-sm text-slate-500">
          Turning this off only stops the email - you'll still see every message from your child's teacher in
          Messages, with the usual unread badge.
        </p>

        <Button type="submit" disabled={saving}>
          {saving ? "Saving…" : "Save changes"}
        </Button>
      </form>
    </Card>
  );
}
