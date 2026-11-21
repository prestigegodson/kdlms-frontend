import { type FormEvent, useEffect, useState } from "react";
import { ApiError } from "@/api/client";
import {
  CREATOR_BIO_MAX_LENGTH,
  type CreatorBrandingInput,
  type CreatorProfile,
  type CreatorProfileInput,
  getMyCreatorProfile,
  updateMyCreatorBio,
  updateMyCreatorBranding,
  updateMyCreatorProfile,
} from "@/api/creators";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { FormField } from "@/components/ui/FormField";
import { ImageUploadField } from "@/components/ui/ImageUploadField";
import { PageHeader } from "@/components/ui/PageHeader";
import { Spinner } from "@/components/ui/Spinner";
import { Textarea } from "@/components/ui/Textarea";
import { CreatorProfileFields } from "@/features/creators/components/CreatorProfileFields";
import { useSchoolBrandingStore } from "@/stores/schoolBrandingStore";

type LoadState =
  | { kind: "loading" }
  | { kind: "loaded"; profile: CreatorProfileInput; branding: CreatorBrandingInput; bio: string }
  | { kind: "error"; message: string };

function toInput(profile: CreatorProfile): CreatorProfileInput {
  const { firstName, lastName, businessName, contactAddress, mobile, timezone, currency } = profile;
  return { firstName, lastName, businessName, contactAddress, mobile, timezone, currency };
}

function toBranding(profile: CreatorProfile): CreatorBrandingInput {
  return { logoFileId: profile.logoFileId ?? null, bannerFileId: profile.bannerFileId ?? null };
}

const TITLE = "Profile";
const DESCRIPTION = "Your business details, branding, bio, timezone and preferred currency.";

/** The creator's own business profile - the SchoolProfilePage shape. */
export function CreatorProfilePage() {
  const [state, setState] = useState<LoadState>({ kind: "loading" });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [brandingSaving, setBrandingSaving] = useState(false);
  const [brandingError, setBrandingError] = useState<string | null>(null);
  const [brandingSaved, setBrandingSaved] = useState(false);
  const [bioSaving, setBioSaving] = useState(false);
  const [bioError, setBioError] = useState<string | null>(null);
  const [bioSaved, setBioSaved] = useState(false);

  useEffect(() => {
    getMyCreatorProfile()
      .then((profile) => setState({
          kind: "loaded",
          profile: toInput(profile),
          branding: toBranding(profile),
          bio: profile.bio ?? "",
        }))
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
      setState((current) =>
        current.kind === "loaded" ? { ...current, profile: toInput(updated), branding: toBranding(updated) } : current,
      );
      setSaved(true);
    } catch (error) {
      setSaveError(error instanceof ApiError ? error.message : "Failed to save profile");
    } finally {
      setSaving(false);
    }
  }

  /** Saved straight away, like the upload itself; the sidebar logo is refreshed after a logo change. */
  async function saveBranding(next: CreatorBrandingInput) {
    if (state.kind !== "loaded") return;
    const logoChanged = next.logoFileId !== state.branding.logoFileId;
    setBrandingSaving(true);
    setBrandingError(null);
    setBrandingSaved(false);
    try {
      const updated = await updateMyCreatorBranding(next);
      setState((current) => (current.kind === "loaded" ? { ...current, branding: toBranding(updated) } : current));
      setBrandingSaved(true);
      if (logoChanged) {
        const brandingStore = useSchoolBrandingStore.getState();
        brandingStore.reset();
        void useSchoolBrandingStore.getState().fetchIfNeeded();
      }
    } catch (error) {
      setBrandingError(error instanceof ApiError ? error.message : "Failed to save branding");
    } finally {
      setBrandingSaving(false);
    }
  }

  async function handleBioSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (state.kind !== "loaded") return;
    setBioSaving(true);
    setBioError(null);
    setBioSaved(false);
    try {
      const updated = await updateMyCreatorBio(state.bio.trim() === "" ? null : state.bio);
      setState((current) => (current.kind === "loaded" ? { ...current, bio: updated.bio ?? "" } : current));
      setBioSaved(true);
    } catch (error) {
      setBioError(error instanceof ApiError ? error.message : "Failed to save bio");
    } finally {
      setBioSaving(false);
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
          <div className="space-y-4" aria-busy={brandingSaving}>
            <div>
              <h2 className="font-display text-base font-medium text-slate-900">Branding</h2>
              <p className="text-sm text-slate-500">
                Your logo shows in your portal and, with your banner, on your learners' class cards.
              </p>
            </div>
            {brandingError && <Alert variant="error">{brandingError}</Alert>}
            {brandingSaved && <Alert variant="success">Branding updated.</Alert>}
            <ImageUploadField
              label="Logo"
              fileId={state.branding.logoFileId ?? undefined}
              hint="a square image works best"
              onChange={(fileId) => saveBranding({ ...state.branding, logoFileId: fileId ?? null })}
            />
            <ImageUploadField
              label="Banner"
              variant="banner"
              fileId={state.branding.bannerFileId ?? undefined}
              hint="wide image, about 1200 × 400"
              onChange={(fileId) => saveBranding({ ...state.branding, bannerFileId: fileId ?? null })}
            />
          </div>
        </Card>
      )}
      {state.kind === "loaded" && (
        <Card>
          <form className="space-y-4" onSubmit={handleBioSubmit}>
            <div>
              <h2 className="font-display text-base font-medium text-slate-900">About you</h2>
              <p className="text-sm text-slate-500">
                Shown to your learners and their guardians on your class cards.
              </p>
            </div>
            {bioError && <Alert variant="error">{bioError}</Alert>}
            {bioSaved && <Alert variant="success">Bio updated.</Alert>}
            <FormField
              label="Bio"
              htmlFor="profile-bio"
              description={`${state.bio.length}/${CREATOR_BIO_MAX_LENGTH} characters`}
            >
              <Textarea
                id="profile-bio"
                rows={5}
                maxLength={CREATOR_BIO_MAX_LENGTH}
                aria-describedby="profile-bio-description"
                placeholder="Your teaching experience, subjects and approach."
                value={state.bio}
                onChange={(event) => setState({ ...state, bio: event.target.value })}
              />
            </FormField>
            <Button type="submit" loading={bioSaving}>
              {bioSaving ? "Saving…" : "Save bio"}
            </Button>
          </form>
        </Card>
      )}
      {state.kind === "loaded" && (
        <Card>
          <form className="space-y-4" onSubmit={handleSubmit}>
            {saveError && <Alert variant="error">{saveError}</Alert>}
            {saved && <Alert variant="success">Profile updated.</Alert>}
            <CreatorProfileFields
              value={state.profile}
              onChange={(profile) => setState({ ...state, profile })}
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
