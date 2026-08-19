import { useEffect, useState } from "react";
import { useParams } from "react-router";
import { ApiError } from "@/api/client";
import {
  getResultTemplate,
  previewResultTemplate,
  publishResultTemplate,
  retireResultTemplate,
  type ResultTemplateView,
  updateResultTemplate,
} from "@/api/resultTemplates";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { FormField } from "@/components/ui/FormField";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { PageHeader } from "@/components/ui/PageHeader";
import { Spinner } from "@/components/ui/Spinner";
import { BlockPalette } from "@/features/reporting/components/designer/BlockPalette";
import { DesignerCanvas } from "@/features/reporting/components/designer/DesignerCanvas";
import { InspectorPanel } from "@/features/reporting/components/designer/InspectorPanel";
import { TokenPanel } from "@/features/reporting/components/designer/TokenPanel";
import { useDragAutoScroll } from "@/features/reporting/components/designer/useDragAutoScroll";
import { useLayoutEditor } from "@/features/reporting/components/designer/useLayoutEditor";
import { validateLayout } from "@/features/reporting/components/designer/layoutValidation";
import { ReportPreviewFrame } from "@/features/reporting/components/ReportPreviewFrame";
import { TemplateStatusBadge } from "@/features/reporting/components/TemplateStatusBadge";

type LoadState = { kind: "loading" } | { kind: "loaded"; template: ResultTemplateView } | { kind: "error"; message: string };

/**
 * Full-page layout designer for one master template - a purpose-built
 * drag-and-drop canvas over the `ReportLayout` document model, replacing
 * the earlier GrapesJS-based designer entirely (see
 * `V19__replace_template_markup_with_layout_json.sql`'s header for the
 * backend side of that change).
 * <p>
 * The canvas here is a deliberate approximation, never the source of truth:
 * `LayoutHtmlEmitter` (backend) is the only thing that turns a `ReportLayout`
 * into real CSS-2.1 markup, so what renders here can drift slightly from
 * what actually prints - "Preview" (which saves first, then fetches a real
 * server render against sample data) is the one place that's guaranteed
 * accurate. This split is exactly what closes the old designer's worst
 * failure mode: a GrapesJS-authored `display:flex` that looked correct in
 * its own preview and silently collapsed in the PDF. Nothing here can emit
 * anything but table/block markup, because nothing here emits markup at all.
 * <p>
 * Lazy-loaded from `routes/index.tsx` (a default export, unlike this app's
 * usual named-export pages) via `routes/TemplateDesignerRoute.tsx` - still
 * worth code-splitting even without GrapesJS's weight, since it's an
 * admin-only page with its own component tree. Below `lg` this shows an
 * explanatory panel instead of a canvas that can't usefully render at that
 * width, the same spirit as `BroadsheetTable`'s responsive-table escape
 * hatch.
 */
export default function TemplateDesignerPage() {
  const { templateId } = useParams<{ templateId: string }>();
  const [state, setState] = useState<LoadState>({ kind: "loading" });

  useEffect(() => {
    if (!templateId) return;
    getResultTemplate(templateId)
      .then((template) => setState({ kind: "loaded", template }))
      .catch((err: unknown) =>
        setState({ kind: "error", message: err instanceof ApiError ? err.message : "Failed to load this template" }),
      );
  }, [templateId]);

  if (state.kind === "loading") {
    return (
      <>
        <PageHeader title="Template designer" backTo="/admin/templates" />
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Spinner /> Loading template…
        </div>
      </>
    );
  }
  if (state.kind === "error") {
    return (
      <>
        <PageHeader title="Template designer" backTo="/admin/templates" />
        <Alert variant="error">{state.message}</Alert>
      </>
    );
  }

  // Keyed by template id so switching templates (a route-param change that
  // doesn't itself remount this page) resets the layout editor's undo/redo
  // history and working state rather than carrying over the previous
  // template's in-progress edits.
  return <TemplateDesignerBody key={state.template.id} initialTemplate={state.template} />;
}

function TemplateDesignerBody({ initialTemplate }: { initialTemplate: ResultTemplateView }) {
  const [template, setTemplate] = useState(initialTemplate);
  const [name, setName] = useState(initialTemplate.name);
  const [description, setDescription] = useState(initialTemplate.description ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [previewing, setPreviewing] = useState(false);

  const editor = useLayoutEditor(initialTemplate.layout);
  const validationErrors = validateLayout(editor.layout, template.assessmentMode);
  useDragAutoScroll();

  async function handleSave(): Promise<ResultTemplateView | null> {
    setSaving(true);
    setError(null);
    setSaved(false);
    if (validationErrors.length > 0) {
      setError(validationErrors[0]);
      setSaving(false);
      return null;
    }
    try {
      const updated = await updateResultTemplate(template.id, { name, description: description || undefined, layout: editor.layout });
      setTemplate(updated);
      editor.reset(updated.layout);
      setSaved(true);
      return updated;
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to save this template");
      return null;
    } finally {
      setSaving(false);
    }
  }

  async function handlePreview() {
    const savedTemplate = await handleSave();
    if (!savedTemplate) return;
    setPreviewing(true);
    try {
      const html = await previewResultTemplate(savedTemplate.id);
      setPreviewHtml(html);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to render the preview");
    } finally {
      setPreviewing(false);
    }
  }

  async function handlePublish() {
    // Publishing saves first (a fix over the old designer, which published
    // whatever was last persisted even if the canvas had unsaved edits).
    const savedTemplate = await handleSave();
    if (!savedTemplate) return;
    setError(null);
    try {
      const published = await publishResultTemplate(savedTemplate.id);
      setTemplate(published);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to publish this template");
    }
  }

  async function handleRetire() {
    setError(null);
    try {
      const retired = await retireResultTemplate(template.id);
      setTemplate(retired);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to retire this template");
    }
  }

  return (
    <div className="flex h-full flex-col gap-4">
      <PageHeader title={template.name} backTo="/admin/templates" />

      <div className="lg:hidden">
        <Alert variant="info" title="Design on a wider screen">
          The template designer needs a wider viewport to work well. Open this page on a landscape tablet or desktop
          to edit the canvas.
        </Alert>
      </div>

      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-4">
        <div className="flex flex-1 flex-wrap items-end gap-3">
          <FormField label="Name" htmlFor="designer-name" className="min-w-[220px]">
            <Input id="designer-name" value={name} onChange={(event) => setName(event.target.value)} />
          </FormField>
          <FormField label="Description" htmlFor="designer-description" className="min-w-[260px] flex-1">
            <Input
              id="designer-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </FormField>
          <div className="flex items-center gap-2 pb-2">
            <TemplateStatusBadge status={template.status} />
            {template.schoolId && <Badge variant="info">School-specific</Badge>}
            <span className="text-xs text-slate-500">
              {template.assessmentMode === "NUMERIC" ? "Numeric" : "Qualitative"} · {template.baseLevel ?? "Any stage"}
            </span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="secondary" size="sm" onClick={editor.undo} disabled={!editor.canUndo}>
            Undo
          </Button>
          <Button variant="secondary" size="sm" onClick={editor.redo} disabled={!editor.canRedo}>
            Redo
          </Button>
          <Button variant="secondary" onClick={handlePreview} loading={previewing}>
            Preview
          </Button>
          {template.status === "PUBLISHED" ? (
            <Button variant="secondary" onClick={handleRetire}>
              Retire
            </Button>
          ) : (
            <Button variant="secondary" onClick={handlePublish}>
              Publish
            </Button>
          )}
          <Button variant="accent" onClick={handleSave} loading={saving}>
            Save
          </Button>
        </div>
      </div>

      {error && <Alert variant="error">{error}</Alert>}
      {saved && !error && <Alert variant="success">Template saved.</Alert>}
      {!error && validationErrors.length > 0 && (
        <Alert variant="warning">{validationErrors[0]} Fix this before saving.</Alert>
      )}

      <div className="hidden flex-1 items-start gap-4 lg:grid lg:grid-cols-[220px_1fr_280px]">
        <Card className="sticky top-16 z-10 max-h-[calc(100dvh-5rem)] overflow-y-auto overscroll-contain p-3">
          <BlockPalette mode={template.assessmentMode} editor={editor} />
        </Card>
        <DesignerCanvas editor={editor} />
        <div className="sticky top-16 z-10 max-h-[calc(100dvh-5rem)] space-y-4 overflow-y-auto overscroll-contain">
          <Card className="p-3">
            <InspectorPanel editor={editor} />
          </Card>
          <Card className="p-3">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Tokens</h3>
            <TokenPanel editor={editor} />
          </Card>
        </div>
      </div>

      {previewHtml && (
        <Modal open onClose={() => setPreviewHtml(null)} title="Preview" size="xl">
          <p className="mb-3 text-xs text-slate-500">
            Rendered by the same server-side pipeline a real report uses - the canvas above is only an approximation.
          </p>
          <ReportPreviewFrame html={previewHtml} />
        </Modal>
      )}
    </div>
  );
}
