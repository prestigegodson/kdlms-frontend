import { FileText } from "lucide-react";
import { type FormEvent, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { ApiError } from "@/api/client";
import {
  createResultTemplate,
  deleteResultTemplate,
  listResultTemplates,
  publishResultTemplate,
  type ReportAssessmentMode,
  retireResultTemplate,
  type ResultTemplateSummary,
} from "@/api/resultTemplates";
import { listSchools, type SchoolView } from "@/api/schools";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { FormField } from "@/components/ui/FormField";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { PageHeader } from "@/components/ui/PageHeader";
import { Select } from "@/components/ui/Select";
import { Spinner } from "@/components/ui/Spinner";
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from "@/components/ui/Table";
import { starterLayoutsForMode } from "@/features/reporting/components/designer/starterLayouts";
import { TemplateAvailabilityModal } from "@/features/reporting/components/TemplateAvailabilityModal";
import { TemplateStatusBadge } from "@/features/reporting/components/TemplateStatusBadge";
import { SchoolSelect } from "@/features/schools/components/SchoolSelect";

const BASE_LEVELS = ["PRE_SCHOOL", "PRE_NURSERY", "NURSERY", "PRIMARY", "SECONDARY"];

type ListState =
  | { kind: "loading" }
  | { kind: "loaded"; templates: ResultTemplateSummary[]; schools: SchoolView[] }
  | { kind: "error"; message: string };

/**
 * System-admin master result templates: list, create (opens the layout
 * designer for the new template), publish/retire, delete. A new template
 * starts from a chosen starter layout (Blank, or a mode-appropriate
 * prebuilt arrangement) the designer's canvas then rearranges freely - see
 * `TemplateDesignerPage` and `starterLayouts.ts`.
 */
export function ResultTemplatesPage() {
  const navigate = useNavigate();
  const [state, setState] = useState<ListState>({ kind: "loading" });
  const [createOpen, setCreateOpen] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [retiring, setRetiring] = useState<ResultTemplateSummary | null>(null);
  const [deleting, setDeleting] = useState<ResultTemplateSummary | null>(null);
  const [changingAvailability, setChangingAvailability] = useState<ResultTemplateSummary | null>(null);
  const [schoolFilter, setSchoolFilter] = useState("");

  function fetchTemplates() {
    Promise.all([listResultTemplates(0, 200), listSchools(0, 500)])
      .then(([page, schoolPage]) => setState({ kind: "loaded", templates: page.content, schools: schoolPage.content }))
      .catch((error: unknown) =>
        setState({ kind: "error", message: error instanceof ApiError ? error.message : "Failed to load templates" }),
      );
  }

  // Mount-only fetch: the initial state above is already "loading", so no synchronous
  // setState is needed here - only load() (used by user-triggered reloads below) resets it.
  useEffect(fetchTemplates, []);

  function load() {
    setState({ kind: "loading" });
    fetchTemplates();
  }

  async function handlePublish(template: ResultTemplateSummary) {
    setActionError(null);
    try {
      await publishResultTemplate(template.id);
      load();
    } catch (error) {
      setActionError(error instanceof ApiError ? error.message : "That action failed");
    }
  }

  const schoolNameById = useMemo(() => {
    const map = new Map<string, string>();
    if (state.kind === "loaded") {
      for (const school of state.schools) {
        map.set(school.id, school.name);
      }
    }
    return map;
  }, [state]);

  const hasAnyBoundTemplate = state.kind === "loaded" && state.templates.some((template) => template.schoolId);

  const visibleTemplates =
    state.kind === "loaded"
      ? state.templates.filter((template) => {
          if (!schoolFilter) {
            return true;
          }
          if (schoolFilter === "SHARED") {
            return !template.schoolId;
          }
          return template.schoolId === schoolFilter;
        })
      : [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Result Templates"
        description="Design result-sheet templates schools personalize and use for their result reports."
        actions={<Button onClick={() => setCreateOpen(true)}>New template</Button>}
      />

      {actionError && <Alert variant="error">{actionError}</Alert>}

      {state.kind === "loading" && (
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Spinner /> Loading templates…
        </div>
      )}
      {state.kind === "error" && <Alert variant="error">{state.message}</Alert>}
      {state.kind === "loaded" && state.templates.length === 0 && (
        <EmptyState
          icon={FileText}
          title="No result templates yet"
          description="Create a template to give schools a result sheet to personalize."
        />
      )}
      {state.kind === "loaded" && state.templates.length > 0 && hasAnyBoundTemplate && (
        <div className="flex flex-wrap items-end gap-3">
          <FormField label="Availability" htmlFor="template-school-filter" className="w-full sm:w-64">
            <Select
              id="template-school-filter"
              value={schoolFilter}
              onChange={(event) => setSchoolFilter(event.target.value)}
            >
              <option value="">All templates</option>
              <option value="SHARED">Shared (all schools)</option>
              {state.schools.map((school) => (
                <option key={school.id} value={school.id}>
                  {school.name}
                </option>
              ))}
            </Select>
          </FormField>
        </div>
      )}
      {state.kind === "loaded" && state.templates.length > 0 && (
        <Card className="p-0">
          <Table>
            <TableHead>
              <TableRow>
                <TableHeaderCell>Name</TableHeaderCell>
                <TableHeaderCell>Mode</TableHeaderCell>
                <TableHeaderCell>Stage</TableHeaderCell>
                <TableHeaderCell>Availability</TableHeaderCell>
                <TableHeaderCell>Status</TableHeaderCell>
                <TableHeaderCell>Actions</TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {visibleTemplates.map((template) => (
                <TableRow key={template.id}>
                  <TableCell label="Name" className="font-medium text-slate-900">
                    {template.name}
                  </TableCell>
                  <TableCell label="Mode">{template.assessmentMode === "NUMERIC" ? "Numeric" : "Qualitative"}</TableCell>
                  <TableCell label="Stage">{template.baseLevel ?? "Any"}</TableCell>
                  <TableCell label="Availability">
                    {template.schoolId ? (
                      <Badge variant="info">{schoolNameById.get(template.schoolId) ?? "Unknown school"}</Badge>
                    ) : (
                      <span className="text-slate-500">All schools</span>
                    )}
                  </TableCell>
                  <TableCell label="Status">
                    <TemplateStatusBadge status={template.status} />
                  </TableCell>
                  <TableCell label="Actions">
                    <div className="flex flex-wrap justify-end gap-3 sm:justify-start">
                      <button
                        type="button"
                        className="text-brand-500 hover:text-brand-600"
                        onClick={() => navigate(`/admin/templates/${template.id}`)}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="text-brand-500 hover:text-brand-600"
                        onClick={() => setChangingAvailability(template)}
                      >
                        Change school
                      </button>
                      {template.status !== "PUBLISHED" && (
                        <button
                          type="button"
                          className="text-green-700 hover:text-green-800"
                          onClick={() => handlePublish(template)}
                        >
                          Publish
                        </button>
                      )}
                      {template.status === "PUBLISHED" && (
                        <button
                          type="button"
                          className="text-slate-500 hover:text-slate-700"
                          onClick={() => setRetiring(template)}
                        >
                          Retire
                        </button>
                      )}
                      <button
                        type="button"
                        className="text-red-600 hover:text-red-700"
                        onClick={() => setDeleting(template)}
                      >
                        Delete
                      </button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {createOpen && (
        <CreateTemplateModal
          schools={state.kind === "loaded" ? state.schools : []}
          onClose={() => setCreateOpen(false)}
          onCreated={(templateId) => navigate(`/admin/templates/${templateId}`)}
        />
      )}

      {retiring && (
        <ConfirmDialog
          title="Retire this template?"
          message={`"${retiring.name}" will no longer be offered to schools for a new assignment. Schools already using it keep rendering against it.`}
          confirmLabel="Retire"
          onClose={() => setRetiring(null)}
          onConfirm={async () => {
            await retireResultTemplate(retiring.id);
            setRetiring(null);
            load();
          }}
        />
      )}
      {deleting && (
        <ConfirmDialog
          title="Delete this template?"
          message={`"${deleting.name}" will be permanently deleted. This only works while no school has it assigned to a level.`}
          confirmLabel="Delete"
          variant="danger"
          onClose={() => setDeleting(null)}
          onConfirm={async () => {
            await deleteResultTemplate(deleting.id);
            setDeleting(null);
            load();
          }}
        />
      )}
      {changingAvailability && (
        <TemplateAvailabilityModal
          template={changingAvailability}
          schools={state.kind === "loaded" ? state.schools : []}
          onClose={() => setChangingAvailability(null)}
          onSaved={() => {
            setChangingAvailability(null);
            load();
          }}
        />
      )}
    </div>
  );
}

interface CreateTemplateModalProps {
  schools: SchoolView[];
  onClose: () => void;
  onCreated: (templateId: string) => void;
}

function CreateTemplateModal({ schools, onClose, onCreated }: CreateTemplateModalProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [assessmentMode, setAssessmentMode] = useState<ReportAssessmentMode>("NUMERIC");
  const [baseLevel, setBaseLevel] = useState("");
  const [schoolId, setSchoolId] = useState("");
  const [starterId, setStarterId] = useState(starterLayoutsForMode("NUMERIC")[0].id);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const availableStarters = starterLayoutsForMode(assessmentMode);

  function handleModeChange(mode: ReportAssessmentMode) {
    setAssessmentMode(mode);
    setStarterId(starterLayoutsForMode(mode)[0].id);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const starter = availableStarters.find((option) => option.id === starterId) ?? availableStarters[0];
      const template = await createResultTemplate({
        name,
        description: description || undefined,
        assessmentMode,
        baseLevel: baseLevel || undefined,
        schoolId: schoolId || undefined,
        layout: starter.build(),
      });
      onCreated(template.id);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to create template");
      setSubmitting(false);
    }
  }

  return (
    <Modal open onClose={onClose} title="New template">
      <form className="space-y-4" onSubmit={handleSubmit}>
        {error && <Alert variant="error">{error}</Alert>}
        <FormField label="Name" htmlFor="template-name">
          <Input id="template-name" required value={name} onChange={(event) => setName(event.target.value)} />
        </FormField>
        <FormField label="Description" htmlFor="template-description">
          <Input
            id="template-description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
        </FormField>
        <FormField label="Assessment mode" htmlFor="template-mode">
          <Select
            id="template-mode"
            value={assessmentMode}
            onChange={(event) => handleModeChange(event.target.value as ReportAssessmentMode)}
          >
            <option value="NUMERIC">Numeric (scored)</option>
            <option value="QUALITATIVE">Qualitative (rated)</option>
          </Select>
        </FormField>
        <FormField label="Stage" htmlFor="template-base-level">
          <Select id="template-base-level" value={baseLevel} onChange={(event) => setBaseLevel(event.target.value)}>
            <option value="">Any stage sharing this mode</option>
            {BASE_LEVELS.map((level) => (
              <option key={level} value={level}>
                {level}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField label="Start from" htmlFor="template-starter">
          <Select id="template-starter" value={starterId} onChange={(event) => setStarterId(event.target.value)}>
            {availableStarters.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField label="Available to" htmlFor="template-school">
          <SchoolSelect
            id="template-school"
            schools={schools}
            value={schoolId}
            onChange={setSchoolId}
            allOptionLabel="All schools"
          />
        </FormField>
        <p className="text-xs text-slate-500">
          The mode and stage can't be changed after creation - a different shape needs a new template. The school it's
          available to can be changed later, but only while no school has it assigned to a level. The starter layout
          is just a starting point on the canvas - rearrange or clear it freely.
        </p>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting ? "Creating…" : "Create and design"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
