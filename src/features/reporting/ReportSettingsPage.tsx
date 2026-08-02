import { useEffect, useState } from "react";
import {
  assignLevelTemplate,
  getReportSettings,
  type LevelTemplateAssignmentView,
  listLevelTemplates,
  saveReportSettings,
} from "@/api/reportSettings";
import { ApiError } from "@/api/client";
import { can } from "@/auth/permissions";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { Spinner } from "@/components/ui/Spinner";
import { type BrandingValues, BrandingFields } from "@/features/reporting/components/BrandingFields";
import { LevelTemplateTable } from "@/features/reporting/components/LevelTemplateTable";
import { useAuthStore } from "@/stores/authStore";

const BLANK: BrandingValues = {
  logoFileId: undefined,
  primaryColor: "",
  secondaryColor: "",
  fontFamily: "",
  principalName: "",
  principalSignatureFileId: undefined,
};

/**
 * A school's result-report personalization: branding (logo, colors, font,
 * principal name/signature) and which PUBLISHED template each active level
 * uses. SCHOOL_ADMIN edits; BRANCH_ADMIN sees the same screen read-only -
 * see `auth/permissions.ts`'s `manageReportSettings`/`viewReportSettings`.
 */
export function ReportSettingsPage() {
  const role = useAuthStore((state) => state.user?.role);
  const editable = can.manageReportSettings(role);

  const [branding, setBranding] = useState<BrandingValues>(BLANK);
  const [levels, setLevels] = useState<LevelTemplateAssignmentView[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function loadLevels() {
    listLevelTemplates()
      .then(setLevels)
      .catch((error: unknown) => setLoadError(error instanceof ApiError ? error.message : "Failed to load levels"));
  }

  useEffect(() => {
    getReportSettings()
      .then((settings) =>
        setBranding({
          logoFileId: settings.logoFileId,
          primaryColor: settings.primaryColor ?? "",
          secondaryColor: settings.secondaryColor ?? "",
          fontFamily: settings.fontFamily ?? "",
          principalName: settings.principalName ?? "",
          principalSignatureFileId: settings.principalSignatureFileId,
        }),
      )
      .catch((error: unknown) => setLoadError(error instanceof ApiError ? error.message : "Failed to load settings"));
    loadLevels();
  }, []);

  async function handleSave() {
    setSaving(true);
    setSaveError(null);
    setSaved(false);
    try {
      await saveReportSettings({
        logoFileId: branding.logoFileId ?? null,
        primaryColor: branding.primaryColor || null,
        secondaryColor: branding.secondaryColor || null,
        fontFamily: branding.fontFamily || null,
        principalName: branding.principalName || null,
        principalSignatureFileId: branding.principalSignatureFileId ?? null,
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

  return (
    <div className="space-y-6">
      <PageHeader
        title="Report Settings"
        description="Personalize your school's result reports with your own logo, colors, and signatures."
      />

      {loadError && <Alert variant="error">{loadError}</Alert>}

      <Card>
        <h2 className="mb-4 font-display text-lg font-medium text-slate-900">Branding</h2>
        <BrandingFields values={branding} onChange={editable ? setBranding : () => undefined} />
        {editable && (
          <div className="mt-6 flex items-center gap-3">
            <Button onClick={handleSave} loading={saving}>
              Save settings
            </Button>
            {saved && !saveError && <span className="text-sm text-green-700">Saved.</span>}
          </div>
        )}
        {saveError && <Alert variant="error" className="mt-4">{saveError}</Alert>}
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
            <LevelTemplateTable levels={levels} onAssign={handleAssign} editable={editable} />
          )}
        </div>
      </Card>
    </div>
  );
}
