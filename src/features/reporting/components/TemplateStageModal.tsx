import { type FormEvent, useState } from "react";
import { ApiError } from "@/api/client";
import { changeResultTemplateStage, type ResultTemplateSummary } from "@/api/resultTemplates";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { FormField } from "@/components/ui/FormField";
import { Modal } from "@/components/ui/Modal";
import { Select } from "@/components/ui/Select";
import { BASE_LEVELS } from "@/features/reporting/components/baseLevels";

interface TemplateStageModalProps {
  template: ResultTemplateSummary;
  onClose: () => void;
  onSaved: () => void;
}

/**
 * Rebinds a template's stage (base level) - unlike the assessment mode,
 * this stays editable after creation, and unlike availability
 * (TemplateAvailabilityModal) the backend needs no dependents guard: a
 * school's explicit per-level assignment never checks a template's stage,
 * so this only changes which levels pick the template up by *default*
 * going forward.
 */
export function TemplateStageModal({ template, onClose, onSaved }: TemplateStageModalProps) {
  const [baseLevel, setBaseLevel] = useState(template.baseLevel ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await changeResultTemplateStage(template.id, baseLevel || null);
      onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to update stage");
      setSubmitting(false);
    }
  }

  return (
    <Modal open onClose={onClose} title="Template stage">
      <form className="space-y-4" onSubmit={handleSubmit}>
        {error && <Alert variant="error">{error}</Alert>}
        <FormField label="Stage" htmlFor="template-stage-base-level">
          <Select
            id="template-stage-base-level"
            value={baseLevel}
            onChange={(event) => setBaseLevel(event.target.value)}
          >
            <option value="">Any stage sharing this mode</option>
            {BASE_LEVELS.map((level) => (
              <option key={level} value={level}>
                {level}
              </option>
            ))}
          </Select>
        </FormField>
        <p className="text-xs text-slate-500">
          Changes which levels pick this template up by default. A school with an explicit assignment to this
          template keeps rendering against it regardless of stage.
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
