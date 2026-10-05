import { type FormEvent, useState } from "react";
import { getErrorMessage } from "@/api/client";
import type { VirtualClass, VirtualClassInput } from "@/api/virtualClasses";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { DateInput } from "@/components/ui/DateInput";
import { FormField } from "@/components/ui/FormField";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Textarea } from "@/components/ui/Textarea";

interface ClassFormModalProps {
  /** The class being edited, or `null` to create one. */
  existing: VirtualClass | null;
  defaultStartDate: string;
  onSubmit: (input: VirtualClassInput) => Promise<void>;
  onClose: () => void;
}

/** Create or edit a virtual class's details - its schedule is edited on the class page. */
export function ClassFormModal({
  existing,
  defaultStartDate,
  onSubmit,
  onClose,
}: ClassFormModalProps) {
  const [name, setName] = useState(existing?.name ?? "");
  const [subjectLabel, setSubjectLabel] = useState(existing?.subjectLabel ?? "");
  const [description, setDescription] = useState(existing?.description ?? "");
  const [startDate, setStartDate] = useState(existing?.startDate ?? defaultStartDate);
  const [endDate, setEndDate] = useState(existing?.endDate ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await onSubmit({
        name: name.trim(),
        subjectLabel: subjectLabel.trim() || null,
        description: description.trim() || null,
        startDate,
        endDate: endDate || null,
      });
    } catch (submitError) {
      setError(getErrorMessage(submitError, "Failed to save the class."));
      setSaving(false);
    }
  }

  return (
    <Modal open onClose={onClose} title={existing ? "Edit class" : "New class"}>
      <form className="space-y-4" onSubmit={handleSubmit}>
        {error && <Alert variant="error">{error}</Alert>}
        <FormField label="Name" htmlFor="class-name">
          <Input
            id="class-name"
            required
            maxLength={120}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </FormField>
        <FormField
          label="Subject"
          htmlFor="class-subject"
          description="Optional - e.g. Mathematics, Piano, IELTS."
        >
          <Input
            id="class-subject"
            maxLength={120}
            value={subjectLabel}
            onChange={(e) => setSubjectLabel(e.target.value)}
          />
        </FormField>
        <FormField label="Description" htmlFor="class-description">
          <Textarea
            id="class-description"
            rows={3}
            maxLength={2000}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </FormField>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Starts on" htmlFor="class-start">
            <DateInput id="class-start" required value={startDate} onChange={setStartDate} />
          </FormField>
          <FormField
            label="Ends on"
            htmlFor="class-end"
            description="Optional - leave blank to run indefinitely."
          >
            <DateInput id="class-end" value={endDate} min={startDate} onChange={setEndDate} />
          </FormField>
        </div>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" loading={saving}>
            {existing ? "Save changes" : "Create class"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
