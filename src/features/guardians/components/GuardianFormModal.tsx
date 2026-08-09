import { type FormEvent, useState } from "react";
import {
  createGuardian,
  type GuardianCreateResult,
  type GuardianView,
  updateGuardian,
} from "@/api/guardians";
import { ApiError } from "@/api/client";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { CredentialsReveal } from "@/components/ui/CredentialsReveal";
import { FormField } from "@/components/ui/FormField";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";

interface GuardianFormModalProps {
  /** Present -> edit an existing guardian's profile. Absent -> provision a new guardian account. */
  guardian?: GuardianView;
  onClose: () => void;
  onSaved: () => void;
}

/** Add-guardian and edit-guardian share one form; only submission and the post-save step differ. */
export function GuardianFormModal({ guardian, onClose, onSaved }: GuardianFormModalProps) {
  const isEdit = guardian != null;
  const [firstName, setFirstName] = useState(guardian?.firstName ?? "");
  const [lastName, setLastName] = useState(guardian?.lastName ?? "");
  const [email, setEmail] = useState(guardian?.email ?? "");
  const [phone, setPhone] = useState(guardian?.phone ?? "");
  const [occupation, setOccupation] = useState(guardian?.occupation ?? "");
  const [address, setAddress] = useState(guardian?.address ?? "");
  const [communicationEmailsEnabled, setCommunicationEmailsEnabled] = useState(
    guardian?.communicationEmailsEnabled ?? true,
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<GuardianCreateResult | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      if (isEdit) {
        await updateGuardian(guardian.id, {
          email,
          firstName,
          lastName,
          phone: phone || undefined,
          occupation: occupation || undefined,
          address: address || undefined,
          communicationEmailsEnabled,
        });
        onSaved();
        onClose();
      } else {
        const result = await createGuardian({
          email,
          firstName,
          lastName,
          phone: phone || undefined,
          occupation: occupation || undefined,
          address: address || undefined,
        });
        onSaved();
        setCreated(result);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : `Failed to ${isEdit ? "update" : "create"} guardian`);
    } finally {
      setSubmitting(false);
    }
  }

  if (created) {
    const attached = created.outcome === "ATTACHED";
    return (
      <Modal open onClose={onClose} title={attached ? "Guardian added" : "Guardian created"}>
        <div className="space-y-4">
          {attached ? (
            <Alert variant="success">
              {created.guardian.fullName} already has a KDLMS account ({created.guardian.email}) at another school.
              We've added them here and emailed them — they sign in with their existing password.
            </Alert>
          ) : (
            <Alert variant="success">
              {created.guardian.fullName} can now sign in with {created.guardian.email}. An invitation email has been
              sent to them. Link them to a student from that student's profile, or come back here later.
            </Alert>
          )}
          {!attached && created.temporaryPassword && (
            <CredentialsReveal email={created.guardian.email} temporaryPassword={created.temporaryPassword} />
          )}
          <div className="flex justify-end">
            <Button type="button" onClick={onClose}>
              Done
            </Button>
          </div>
        </div>
      </Modal>
    );
  }

  return (
    <Modal open onClose={onClose} title={isEdit ? "Edit guardian" : "Add guardian"}>
      <form className="space-y-4" onSubmit={handleSubmit}>
        {error && <Alert variant="error">{error}</Alert>}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField label="First name" htmlFor="guardian-first-name">
            <Input id="guardian-first-name" required value={firstName} onChange={(event) => setFirstName(event.target.value)} />
          </FormField>
          <FormField label="Last name" htmlFor="guardian-last-name">
            <Input id="guardian-last-name" required value={lastName} onChange={(event) => setLastName(event.target.value)} />
          </FormField>
        </div>
        <FormField label="Email" htmlFor="guardian-email">
          <Input id="guardian-email" type="email" required value={email} onChange={(event) => setEmail(event.target.value)} />
        </FormField>
        {isEdit && (
          <p className="text-xs text-slate-500">
            This is also the guardian's sign-in email — if you change it, they'll need to sign in with the new
            address.
          </p>
        )}
        {!isEdit && (
          <p className="text-xs text-slate-500">
            If this email already has a KDLMS account, we'll link that account instead of creating a new one.
          </p>
        )}
        <FormField label="Phone" htmlFor="guardian-phone">
          <Input id="guardian-phone" value={phone} onChange={(event) => setPhone(event.target.value)} />
        </FormField>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField label="Occupation" htmlFor="guardian-occupation">
            <Input id="guardian-occupation" value={occupation} onChange={(event) => setOccupation(event.target.value)} />
          </FormField>
          <FormField label="Address" htmlFor="guardian-address">
            <Input id="guardian-address" value={address} onChange={(event) => setAddress(event.target.value)} />
          </FormField>
        </div>
        {!isEdit && (
          <p className="text-xs text-slate-500">
            Link this guardian to a student afterward from the student's profile page.
          </p>
        )}
        {isEdit && (
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <Checkbox
              checked={communicationEmailsEnabled}
              onChange={(event) => setCommunicationEmailsEnabled(event.target.checked)}
            />
            Send email notifications for new messages
          </label>
        )}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting ? (isEdit ? "Saving…" : "Creating…") : isEdit ? "Save changes" : "Create guardian"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
