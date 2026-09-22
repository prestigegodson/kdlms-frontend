import { useEffect, useState } from "react";
import {
  assignLevelTemplate,
  clearLevelTemplate,
  getReportSettings,
  type LevelTemplateAssignmentView,
  listLevelTemplates,
  previewLevelSample,
  saveReportSettings,
} from "@/api/reportSettings";
import { ApiError } from "@/api/client";
import { can } from "@/auth/permissions";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Checkbox } from "@/components/ui/Checkbox";
import { Modal } from "@/components/ui/Modal";
import { PageHeader } from "@/components/ui/PageHeader";
import { Spinner } from "@/components/ui/Spinner";
import { type BrandingValues, BrandingFields } from "@/features/reporting/components/BrandingFields";
import { LevelTemplateTable } from "@/features/reporting/components/LevelTemplateTable";
import { ReportPreviewFrame } from "@/features/reporting/components/ReportPreviewFrame";
import { useAuthStore } from "@/stores/authStore";

const BLANK: BrandingValues = {
  logoFileId: undefined,
  principalName: "",
  principalSignatureFileId: undefined,
};

/**
 * A school's result-report personalization: branding (logo, principal
 * name/signature) and which PUBLISHED template each active level uses.
 * SCHOOL_ADMIN edits; BRANCH_ADMIN sees the same screen read-only - see
 * `auth/permissions.ts`'s `manageReportSettings`/`viewReportSettings`.
 */
export function ReportSettingsPage() {
  const role = useAuthStore((state) => state.user?.role);
  const editable = can.manageReportSettings(role);

  const [branding, setBranding] = useState<BrandingValues>(BLANK);
  const [showClassAverage, setShowClassAverage] = useState(false);
  const [brandingLoaded, setBrandingLoaded] = useState(false);
  const [levels, setLevels] = useState<LevelTemplateAssignmentView[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [previewLevel, setPreviewLevel] = useState<LevelTemplateAssignmentView | null>(null);
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);

  function loadLevels() {
    listLevelTemplates()
      .then(setLevels)
      .catch((error: unknown) => setLoadError(error instanceof ApiError ? error.message : "Failed to load levels"));
  }

  useEffect(() => {
    getReportSettings()
      .then((settings) => {
        setBranding({
          logoFileId: settings.logoFileId,
          principalName: settings.principalName ?? "",
          principalSignatureFileId: settings.principalSignatureFileId,
        });
        setShowClassAverage(settings.showClassAverage);
      })
      .catch((error: unknown) => setLoadError(error instanceof ApiError ? error.message : "Failed to load settings"))
      .finally(() => setBrandingLoaded(true));
    loadLevels();
  }, []);

  async function handleSave() {
    setSaving(true);
    setSaveError(null);
    setSaved(false);
    try {
      await saveReportSettings({
        logoFileId: branding.logoFileId ?? null,
        principalName: branding.principalName || null,
        principalSignatureFileId: branding.principalSignatureFileId ?? null,
        showClassAverage,
      });
      setSaved(true);
    } catch (error) {
      setSaveError(error instanceof ApiError ? error.message : "Failed to save settings");
    } finally {
      setSaving(false);
    }
  }

  async function handleAssign(levelId: string, templateId: string) {
    await assignLevelTemplate(levelId, templateId);
    loadLevels();
  }

  async function handleClear(levelId: string) {
    await clearLevelTemplate(levelId);
    loadLevels();
  }

  async function handlePreview(level: LevelTemplateAssignmentView) {
    setPreviewLevel(level);
    setPreviewHtml(null);
    setPreviewError(null);
    try {
      setPreviewHtml(await previewLevelSample(level.levelId));
    } catch (error) {
      setPreviewError(error instanceof ApiError ? error.message : "Failed to render this preview");
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Report Settings"
        description="Personalize your school's result reports with your own logo and signatures."
      />

      {loadError && <Alert variant="error">{loadError}</Alert>}

      <Card>
        <h2 className="mb-4 font-display text-lg font-medium text-slate-900">Branding</h2>
        {!brandingLoaded ? (
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Spinner /> Loading…
          </div>
        ) : (
          <>
            <BrandingFields values={branding} onChange={editable ? setBranding : () => undefined} />

            <div className="mt-6 border-t border-slate-200 pt-6">
              <h3 className="mb-2 font-display text-sm font-medium text-slate-900">Result options</h3>
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <Checkbox
                  checked={showClassAverage}
                  disabled={!editable}
                  onChange={(event) => setShowClassAverage(event.target.checked)}
                />
                Show class average per subject
              </label>
              <p className="mt-1 text-sm text-slate-500">
                Off by default. When on, every NUMERIC result report, the broadsheet, and the on-screen
                result views print each subject's class-wide average alongside a student's own score.
              </p>
            </div>

            {editable && (
              <div className="mt-6 flex items-center gap-3">
                <Button onClick={handleSave} loading={saving}>
                  Save settings
                </Button>
                {saved && !saveError && <span className="text-sm text-green-700">Saved.</span>}
              </div>
            )}
            {saveError && <Alert variant="error" className="mt-4">{saveError}</Alert>}
          </>
        )}
      </Card>

      <Card className="p-0">
        <div className="p-6 pb-0">
          <h2 className="font-display text-lg font-medium text-slate-900">Result templates by level</h2>
          <p className="mt-1 text-sm text-slate-500">
            A level with no template selected uses the platform's default template for its assessment mode.
          </p>
        </div>
        <div className="p-6">
          {levels === null ? (
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <Spinner /> Loading levels…
            </div>
          ) : (
            <LevelTemplateTable
              levels={levels}
              onAssign={handleAssign}
              onClear={handleClear}
              onPreview={handlePreview}
              editable={editable}
            />
          )}
        </div>
      </Card>

      {previewLevel && (
        <Modal
          open
          onClose={() => setPreviewLevel(null)}
          title={`Sample report — ${previewLevel.levelName}`}
          size="xl"
        >
          <p className="mb-3 text-xs text-slate-500">
            A sample student and scores, rendered with your school's own branding by the same server-side pipeline a
            real report uses.
          </p>
          {previewError && <Alert variant="error">{previewError}</Alert>}
          {!previewError && !previewHtml && (
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <Spinner /> Rendering…
            </div>
          )}
          {previewHtml && <ReportPreviewFrame html={previewHtml} />}
        </Modal>
      )}
    </div>
  );
}
