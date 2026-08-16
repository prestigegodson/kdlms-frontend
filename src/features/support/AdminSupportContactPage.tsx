import { type FormEvent, useEffect, useState } from "react";
import { ApiError } from "@/api/client";
import { getAdminSupportContact, type SupportContactView, updateSupportContact } from "@/api/supportContact";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { FormField } from "@/components/ui/FormField";
import { Input } from "@/components/ui/Input";
import { PageHeader } from "@/components/ui/PageHeader";
import { Spinner } from "@/components/ui/Spinner";

type LoadState =
  | { kind: "loading" }
  | { kind: "loaded"; contact: SupportContactView }
  | { kind: "error"; message: string };

/** System-admin editor for the platform's own support contact - shown read-only to school/branch admins. */
export function AdminSupportContactPage() {
  const [state, setState] = useState<LoadState>({ kind: "loading" });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    getAdminSupportContact()
      .then((contact) => setState({ kind: "loaded", contact }))
      .catch((error: unknown) =>
        setState({
          kind: "error",
          message: error instanceof ApiError ? error.message : "Failed to load support contact",
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
      const updated = await updateSupportContact(state.contact);
      setState({ kind: "loaded", contact: updated });
      setSaved(true);
    } catch (error) {
      setSaveError(error instanceof ApiError ? error.message : "Failed to save support contact");
    } finally {
      setSaving(false);
    }
  }

  function updateField<K extends keyof SupportContactView>(key: K, value: string) {
    setState((prev) =>
      prev.kind === "loaded"
        ? { kind: "loaded", contact: { ...prev.contact, [key]: value === "" ? null : value } }
        : prev,
    );
  }

  if (state.kind === "loading") {
    return (
      <div className="max-w-2xl space-y-6">
        <PageHeader
          title="Support contact"
          description="Contact details school and branch admins use to reach platform support."
        />
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Spinner /> Loading support contact…
        </div>
      </div>
    );
  }

  if (state.kind === "error") {
    return (
      <div className="max-w-2xl space-y-6">
        <PageHeader
          title="Support contact"
          description="Contact details school and branch admins use to reach platform support."
        />
        <Alert variant="error">{state.message}</Alert>
      </div>
    );
  }

  const { contact } = state;

  return (
    <div className="max-w-2xl space-y-6">
      <PageHeader
        title="Support contact"
        description="Contact details school and branch admins use to reach platform support."
      />

      <Card>
        <form className="space-y-4" onSubmit={handleSubmit}>
          {saveError && <Alert variant="error">{saveError}</Alert>}
          {saved && <Alert variant="success">Support contact updated.</Alert>}

          <FormField label="Support email" htmlFor="support-email">
            <Input
              id="support-email"
              type="email"
              value={contact.supportEmail ?? ""}
              onChange={(event) => updateField("supportEmail", event.target.value)}
            />
          </FormField>
          <FormField label="Support phone" htmlFor="support-phone">
            <Input
              id="support-phone"
              value={contact.supportPhone ?? ""}
              onChange={(event) => updateField("supportPhone", event.target.value)}
            />
          </FormField>
          <FormField label="WhatsApp number" htmlFor="support-whatsapp">
            <Input
              id="support-whatsapp"
              value={contact.whatsappNumber ?? ""}
              onChange={(event) => updateField("whatsappNumber", event.target.value)}
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
