import { type FormEvent, useEffect, useState } from "react";
import { ApiError } from "@/api/client";
import { getMySchoolProfile, type SchoolView, updateMySchoolProfile } from "@/api/schools";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { FormField } from "@/components/ui/FormField";
import { Input } from "@/components/ui/Input";
import { PageHeader } from "@/components/ui/PageHeader";
import { Spinner } from "@/components/ui/Spinner";

type LoadState =
  { kind: "loading" } | { kind: "loaded"; school: SchoolView } | { kind: "error"; message: string };

/** School-admin self-service profile: name and contact details. */
export function SchoolProfilePage() {
  const [state, setState] = useState<LoadState>({ kind: "loading" });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    getMySchoolProfile()
      .then((school) => setState({ kind: "loaded", school }))
      .catch((error: unknown) =>
        setState({
          kind: "error",
          message: error instanceof ApiError ? error.message : "Failed to load profile",
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
      const updated = await updateMySchoolProfile(state.school);
      setState({ kind: "loaded", school: updated });
      setSaved(true);
    } catch (error) {
      setSaveError(error instanceof ApiError ? error.message : "Failed to save profile");
    } finally {
      setSaving(false);
    }
  }

  function updateField<K extends keyof SchoolView>(key: K, value: SchoolView[K]) {
    setState((prev) =>
      prev.kind === "loaded" ? { kind: "loaded", school: { ...prev.school, [key]: value } } : prev,
    );
  }

  if (state.kind === "loading") {
    return (
      <div className="max-w-2xl space-y-6">
        <PageHeader title="School profile" description="Contact details for your school." />
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Spinner /> Loading profile…
        </div>
      </div>
    );
  }

  if (state.kind === "error") {
    return (
      <div className="max-w-2xl space-y-6">
        <PageHeader title="School profile" description="Contact details for your school." />
        <Alert variant="error">{state.message}</Alert>
      </div>
    );
  }

  const { school } = state;

  return (
    <div className="max-w-2xl space-y-6">
      <PageHeader title="School profile" description="Contact details for your school." />

      <Card>
        <form className="space-y-4" onSubmit={handleSubmit}>
          {saveError && <Alert variant="error">{saveError}</Alert>}
          {saved && <Alert variant="success">Profile updated.</Alert>}

          <FormField label="School code" htmlFor="profile-code">
            <Input id="profile-code" value={school.code} disabled />
          </FormField>
          <FormField label="Name" htmlFor="profile-name">
            <Input
              id="profile-name"
              required
              value={school.name}
              onChange={(event) => updateField("name", event.target.value)}
            />
          </FormField>
          <FormField label="Email" htmlFor="profile-email">
            <Input
              id="profile-email"
              type="email"
              value={school.email ?? ""}
              onChange={(event) => updateField("email", event.target.value)}
            />
          </FormField>
          <FormField label="Phone" htmlFor="profile-phone">
            <Input
              id="profile-phone"
              value={school.phone ?? ""}
              onChange={(event) => updateField("phone", event.target.value)}
            />
          </FormField>
          <FormField label="Address" htmlFor="profile-address">
            <Input
              id="profile-address"
              value={school.address ?? ""}
              onChange={(event) => updateField("address", event.target.value)}
            />
          </FormField>
          <Button type="submit" disabled={saving}>
            {saving ? "Saving…" : "Save changes"}
          </Button>
        </form>
      </Card>
    </div>
  );
}
