import { apiFetch } from "@/api/client";
import type { ReportAssessmentMode, ResultTemplateSummary } from "@/api/resultTemplates";

const BASE = "/api/v1/report-settings";

/** Mirrors backend reporting.application.port.in.ManageSchoolReportSettingsUseCase.SchoolReportSettingsView. */
export interface SchoolReportSettingsView {
  schoolId: string;
  logoFileId?: string;
  primaryColor?: string;
  secondaryColor?: string;
  fontFamily?: string;
  principalName?: string;
  principalSignatureFileId?: string;
}

export interface SaveSettingsRequest {
  logoFileId?: string | null;
  primaryColor?: string | null;
  secondaryColor?: string | null;
  fontFamily?: string | null;
  principalName?: string | null;
  principalSignatureFileId?: string | null;
}

/**
 * Mirrors backend reporting.application.port.in.ManageSchoolReportSettingsUseCase.LevelTemplateAssignmentView -
 * `assignedTemplateId` is undefined when the level has no explicit
 * assignment yet (it still renders, via the system-template fallback - see
 * CLAUDE.md's Domain Rules on template resolution order).
 */
export interface LevelTemplateAssignmentView {
  levelId: string;
  levelName: string;
  assessmentMode: ReportAssessmentMode;
  assignedTemplateId?: string;
  assignedTemplateName?: string;
  availableTemplates: ResultTemplateSummary[];
}

export function getReportSettings(): Promise<SchoolReportSettingsView> {
  return apiFetch<SchoolReportSettingsView>(BASE);
}

export function saveReportSettings(request: SaveSettingsRequest): Promise<SchoolReportSettingsView> {
  return apiFetch<SchoolReportSettingsView>(BASE, { method: "PUT", body: JSON.stringify(request) });
}

export function listLevelTemplates(): Promise<LevelTemplateAssignmentView[]> {
  return apiFetch<LevelTemplateAssignmentView[]>(`${BASE}/levels`);
}

export function assignLevelTemplate(levelId: string, templateId: string): Promise<LevelTemplateAssignmentView> {
  return apiFetch<LevelTemplateAssignmentView>(`${BASE}/levels/${levelId}/template`, {
    method: "PUT",
    body: JSON.stringify({ templateId }),
  });
}
