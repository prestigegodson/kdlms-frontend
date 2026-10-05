import { type FormEvent, useEffect, useState } from "react";
import { ApiError } from "@/api/client";
import {
  type CreatorProfile,
  type CreatorProfileInput,
  getMyCreatorProfile,
  updateMyCreatorProfile,
} from "@/api/creators";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { Spinner } from "@/components/ui/Spinner";
import { CreatorProfileFields } from "@/features/creators/components/CreatorProfileFields";

type LoadState =
  { kind: "loading" } | { kind: "loaded"; profile: CreatorProfileInput } | { kind: "error"; message: string };

function toInput(profile: CreatorProfile): CreatorProfileInput {
  const { firstName, lastName, businessName, contactAddress, mobile, timezone, currency } = profile;
  return { firstName, lastName, businessName, contactAddress, mobile, timezone, currency };
}

const TITLE = "Profile";
const DESCRIPTION = "Your business details, timezone and preferred currency.";

/** The creator's own business profile - the SchoolProfilePage shape. */
export function CreatorProfilePage() {
  const [state, setState] = useState<LoadState>({ kind: "loading" });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    getMyCreatorProfile()
      .then((profile) => setState({ kind: "loaded", profile: toInput(profile) }))
      .catch((error: unknown) =>
        setState({ kind: "error", message: error instanceof ApiError ? error.message : "Failed to load profile" }),
      );
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (state.kind !== "loaded") return;
    setSaving(true);
    setSaveError(null);
    setSaved(false);
    try {
      const updated = await updateMyCreatorProfile(state.profile);
      setState({ kind: "loaded", profile: toInput(updated) });
      setSaved(true);
    } catch (error) {
      setSaveError(error instanceof ApiError ? error.message : "Failed to save profile");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-2xl space-y-6">
      <PageHeader title={TITLE} description={DESCRIPTION} />
      {state.kind === "loading" && (
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Spinner /> Loading profile…
        </div>
      )}
      {state.kind === "error" && <Alert variant="error">{state.message}</Alert>}
      {state.kind === "loaded" && (
        <Card>
          <form className="space-y-4" onSubmit={handleSubmit}>
            {saveError && <Alert variant="error">{saveError}</Alert>}
            {saved && <Alert variant="success">Profile updated.</Alert>}
            <CreatorProfileFields
              value={state.profile}
              onChange={(profile) => setState({ kind: "loaded", profile })}
              idPrefix="profile"
            />
            <Button type="submit" loading={saving}>
              {saving ? "Saving…" : "Save changes"}
            </Button>
          </form>
        </Card>
      )}
    </div>
  );
}
