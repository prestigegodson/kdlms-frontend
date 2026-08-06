import { apiFetch, apiFetchText } from "@/api/client";
import type { Page } from "@/api/types";
import type { ReportLayout } from "@/features/reporting/components/designer/layout";

const BASE = "/api/v1/admin/result-templates";

export type ReportAssessmentMode = "NUMERIC" | "QUALITATIVE";
export type TemplateStatus = "DRAFT" | "PUBLISHED" | "RETIRED";

/** {@code ALL} = every template; {@code SHARED} = global (no owning school) only; {@code SCHOOL} = one school's own. */
export type TemplateScope = "ALL" | "SHARED" | "SCHOOL";

/** Mirrors backend reporting.application.port.in.ResultTemplateView.Summary - the templates-list screen's row shape. */
export interface ResultTemplateSummary {
  id: string;
  name: string;
  description?: string;
  assessmentMode: ReportAssessmentMode;
  baseLevel?: string;
  /** Absent/undefined for a global template shared by every school. */
  schoolId?: string;
  schoolName?: string;
  status: TemplateStatus;
  updatedAt: string;
}

/** Mirrors backend reporting.application.port.in.ResultTemplateView - the full editable payload the designer canvas loads/saves. */
export interface ResultTemplateView {
  id: string;
  name: string;
  description?: string;
  assessmentMode: ReportAssessmentMode;
  baseLevel?: string;
  schoolId?: string;
  schoolName?: string;
  layout: ReportLayout;
  status: TemplateStatus;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTemplateRequest {
  name: string;
  description?: string;
  assessmentMode: ReportAssessmentMode;
  baseLevel?: string;
  /** Omit (or undefined) for a template shared by every school. */
  schoolId?: string;
  layout: ReportLayout;
}

export interface UpdateTemplateRequest {
  name: string;
  description?: string;
  layout: ReportLayout;
}

export function listResultTemplates(
  page = 0,
  size = 20,
  scope: TemplateScope = "ALL",
  schoolId?: string,
): Promise<Page<ResultTemplateSummary>> {
  const params = new URLSearchParams({ page: String(page), size: String(size), scope });
  if (schoolId) {
    params.set("schoolId", schoolId);
  }
  return apiFetch<Page<ResultTemplateSummary>>(`${BASE}?${params.toString()}`);
}

export function getResultTemplate(templateId: string): Promise<ResultTemplateView> {
  return apiFetch<ResultTemplateView>(`${BASE}/${templateId}`);
}

export function createResultTemplate(request: CreateTemplateRequest): Promise<ResultTemplateView> {
  return apiFetch<ResultTemplateView>(BASE, { method: "POST", body: JSON.stringify(request) });
}

export function updateResultTemplate(templateId: string, request: UpdateTemplateRequest): Promise<ResultTemplateView> {
  return apiFetch<ResultTemplateView>(`${BASE}/${templateId}`, { method: "PUT", body: JSON.stringify(request) });
}

/**
 * Rebinds which school (if any) may use this template - `null` shares it
 * with every school again. A dedicated endpoint rather than a field on
 * `updateResultTemplate`: that PUT is a full-replace of editable content, so
 * an omitted `schoolId` there would be indistinguishable from an intentional
 * unbind. The backend blocks the change once any school has the template
 * assigned to a level (unless `schoolId` is unchanged, always a no-op).
 */
export function bindResultTemplateSchool(templateId: string, schoolId: string | null): Promise<ResultTemplateView> {
  return apiFetch<ResultTemplateView>(`${BASE}/${templateId}/school`, {
    method: "PUT",
    body: JSON.stringify({ schoolId }),
  });
}

export function publishResultTemplate(templateId: string): Promise<ResultTemplateView> {
  return apiFetch<ResultTemplateView>(`${BASE}/${templateId}/publish`, { method: "POST" });
}

export function retireResultTemplate(templateId: string): Promise<ResultTemplateView> {
  return apiFetch<ResultTemplateView>(`${BASE}/${templateId}/retire`, { method: "POST" });
}

export function deleteResultTemplate(templateId: string): Promise<void> {
  return apiFetch<void>(`${BASE}/${templateId}`, { method: "DELETE" });
}

/** Renders {@code templateId} against synthetic sample data - returns final HTML, not a PDF. */
export function previewResultTemplate(templateId: string): Promise<string> {
  return apiFetchText(`${BASE}/${templateId}/preview`);
}
