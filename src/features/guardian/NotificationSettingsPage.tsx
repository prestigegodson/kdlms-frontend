import { type FormEvent, useEffect, useState } from "react";
import {
  getMyNotificationPreferences,
  type NotificationPreferencesView,
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
 */
export function NotificationSettingsPage() {
  const [state, setState] = useState<LoadState>({ kind: "loading" });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

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

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (state.kind !== "loaded") return;
    setSaving(true);
    setSaveError(null);
    setSaved(false);
    try {
      const updated = await updateMyNotificationPreferences({
        communicationEmailsEnabled: state.preferences.communicationEmailsEnabled,
      });
      setState({ kind: "loaded", preferences: updated });
      setSaved(true);
    } catch (error) {
      setSaveError(error instanceof ApiError ? error.message : "Failed to save notification preferences");
    } finally {
      setSaving(false);
    }
  }

  if (state.kind === "loading") {
    return (
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <Spinner /> Loading notification preferences…
      </div>
    );
  }

  if (state.kind === "error") {
    return <Alert variant="error">{state.message}</Alert>;
  }

  const { preferences } = state;

  return (
    <div className="max-w-2xl space-y-6">
      <PageHeader title="Notifications" description="Choose which emails you'd like to receive." />

      <Card>
        <form className="space-y-4" onSubmit={handleSubmit}>
          {saveError && <Alert variant="error">{saveError}</Alert>}
          {saved && <Alert variant="success">Notification preferences updated.</Alert>}

          <label className="flex items-center gap-2 text-sm text-slate-700">
            <Checkbox
              checked={preferences.communicationEmailsEnabled}
              onChange={(event) =>
                setState({
                  kind: "loaded",
                  preferences: { ...preferences, communicationEmailsEnabled: event.target.checked },
                })
              }
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
    </div>
  );
}
