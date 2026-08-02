import { apiFetch, apiFetchText } from "@/api/client";
import type { ReportLayout } from "@/features/reporting/components/designer/layout";

const BASE = "/api/v1/admin/result-templates";

export type ReportAssessmentMode = "NUMERIC" | "QUALITATIVE";
export type TemplateStatus = "DRAFT" | "PUBLISHED" | "RETIRED";

/** Mirrors backend reporting.application.port.in.ResultTemplateView.Summary - the templates-list screen's row shape. */
export interface ResultTemplateSummary {
  id: string;
  name: string;
  description?: string;
  assessmentMode: ReportAssessmentMode;
  baseLevel?: string;
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
  layout: ReportLayout;
}

export interface UpdateTemplateRequest {
  name: string;
  description?: string;
  layout: ReportLayout;
}

export function listResultTemplates(): Promise<ResultTemplateSummary[]> {
  return apiFetch<ResultTemplateSummary[]>(BASE);
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
