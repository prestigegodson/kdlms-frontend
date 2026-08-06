import { type FormEvent, useState } from "react";
import type { SchoolView } from "@/api/schools";
import { ApiError } from "@/api/client";
import { bindResultTemplateSchool, type ResultTemplateSummary } from "@/api/resultTemplates";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { FormField } from "@/components/ui/FormField";
import { Modal } from "@/components/ui/Modal";
import { SchoolSelect } from "@/features/schools/components/SchoolSelect";

interface TemplateAvailabilityModalProps {
  template: ResultTemplateSummary;
  schools: SchoolView[];
  onClose: () => void;
  onSaved: () => void;
}

/**
 * Rebinds a template's owning school, or shares it with every school again.
 * The backend refuses the change once any school has assigned the template
 * to a level - the 422 that guard produces surfaces here, in the same
 * `Alert` shape every other action error in this app uses.
 */
export function TemplateAvailabilityModal({ template, schools, onClose, onSaved }: TemplateAvailabilityModalProps) {
  const [schoolId, setSchoolId] = useState(template.schoolId ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await bindResultTemplateSchool(template.id, schoolId || null);
      onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to update availability");
      setSubmitting(false);
    }
  }

  return (
    <Modal open onClose={onClose} title="Template availability">
      <form className="space-y-4" onSubmit={handleSubmit}>
        {error && <Alert variant="error">{error}</Alert>}
        <p className="text-sm text-slate-600">
          A school-specific template is offered only to that school. Global templates are offered to every school.
        </p>
        <FormField label="Available to" htmlFor="template-availability-school">
          <SchoolSelect
            id="template-availability-school"
            schools={schools}
            value={schoolId}
            onChange={setSchoolId}
            allOptionLabel="All schools (global template)"
          />
        </FormField>
        <p className="text-xs text-slate-500">
          Locked once a school has assigned this template to a level.
        </p>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting ? "Saving…" : "Save"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
