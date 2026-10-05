import { type FormEvent, useState } from "react";
import { getErrorMessage } from "@/api/client";
import type { AddLearnerInput, AddLearnerResult } from "@/api/learners";
import type { VirtualClass } from "@/api/virtualClasses";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { DateInput } from "@/components/ui/DateInput";
import { FormField } from "@/components/ui/FormField";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { LearnerCredentialsNotice } from "./LearnerCredentialsNotice";

interface AddLearnerModalProps {
  /** The creator's plan includes guardian access - a minor's email is then their guardian's. */
  guardianAccess: boolean;
  /** Active classes the learner may be enrolled in straight away. */
  classes: VirtualClass[];
  onSubmit: (input: AddLearnerInput) => Promise<AddLearnerResult>;
  onClose: () => void;
}

/**
 * Adds a learner to the creator's roster (creators.md §7.2): an adult gets an email invite; a minor's
 * guardian gets one when the plan has guardian access; otherwise the minor gets a generated login id
 * and password, shown here once.
 */
export function AddLearnerModal({ guardianAccess, classes, onSubmit, onClose }: AddLearnerModalProps) {
  const [minor, setMinor] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [email, setEmail] = useState("");
  const [classIds, setClassIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AddLearnerResult | null>(null);

  const needsEmail = !minor || guardianAccess;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const added = await onSubmit({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        dateOfBirth: dateOfBirth || null,
        minor,
        email: needsEmail ? email.trim() : null,
        classIds,
      });
      if (added.credentials) {
        setResult(added);
      } else {
        onClose();
      }
    } catch (submitError) {
      setError(getErrorMessage(submitError, "Failed to add the learner."));
    } finally {
      setSaving(false);
    }
  }

  function toggleClass(id: string) {
    setClassIds((current) => (current.includes(id) ? current.filter((c) => c !== id) : [...current, id]));
  }

  if (result?.credentials) {
    return (
      <Modal open onClose={onClose} title="Learner added">
        <div className="space-y-4">
          <LearnerCredentialsNotice
            learnerName={`${result.learner.firstName} ${result.learner.lastName}`}
            credentials={result.credentials}
          />
          <div className="flex justify-end">
            <Button onClick={onClose}>Done</Button>
          </div>
        </div>
      </Modal>
    );
  }

  return (
    <Modal open onClose={onClose} title="Add learner">
      <form className="space-y-4" onSubmit={handleSubmit}>
        {error && <Alert variant="error">{error}</Alert>}
        <fieldset>
          <legend className="mb-2 text-sm font-medium text-slate-700">Who is this learner?</legend>
          <div className="flex flex-wrap gap-4">
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="radio" name="learner-age" checked={!minor} onChange={() => setMinor(false)} />
              An adult
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="radio" name="learner-age" checked={minor} onChange={() => setMinor(true)} />
              A child (under 18)
            </label>
          </div>
        </fieldset>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="First name" htmlFor="learner-first-name">
            <Input
              id="learner-first-name"
              required
              maxLength={100}
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
            />
          </FormField>
          <FormField label="Last name" htmlFor="learner-last-name">
            <Input
              id="learner-last-name"
              required
              maxLength={100}
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
            />
          </FormField>
        </div>
        {minor && (
          <FormField label="Date of birth" htmlFor="learner-dob" description="Optional.">
            <DateInput id="learner-dob" value={dateOfBirth} onChange={setDateOfBirth} />
          </FormField>
        )}
        {needsEmail ? (
          <FormField
            label={minor ? "Guardian's email" : "Email"}
            htmlFor="learner-email"
            description={
              minor
                ? "We'll invite their parent or guardian to follow their classes."
                : "We'll email them an invitation to set a password or continue with Google."
            }
          >
            <Input
              id="learner-email"
              type="email"
              autoCapitalize="none"
              required
              maxLength={255}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </FormField>
        ) : (
          <Alert variant="info">
            Your plan doesn't include guardian access, so we'll create a login id and temporary password
            for this child. You'll see them once, after adding.
          </Alert>
        )}
        {classes.length > 0 && (
          <fieldset>
            <legend className="mb-2 text-sm font-medium text-slate-700">Enroll in classes (optional)</legend>
            <div className="space-y-2">
              {classes.map((virtualClass) => (
                <label key={virtualClass.id} className="flex items-center gap-2 text-sm text-slate-700">
                  <Checkbox
                    checked={classIds.includes(virtualClass.id)}
                    onChange={() => toggleClass(virtualClass.id)}
                  />
                  {virtualClass.name}
                </label>
              ))}
            </div>
          </fieldset>
        )}
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" loading={saving}>
            Add learner
          </Button>
        </div>
      </form>
    </Modal>
  );
}
