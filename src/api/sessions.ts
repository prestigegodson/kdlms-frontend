import { apiFetch } from "@/api/client";
import type { Page } from "@/api/types";

/** Mirrors backend academics.application.port.in.AcademicSessionView. */
export interface AcademicSessionView {
  id: string;
  schoolId: string;
  name: string;
  startDate: string;
  endDate: string;
  current: boolean;
}

/** Mirrors backend academics.application.port.in.TermView. */
export interface TermView {
  id: string;
  schoolId: string;
  sessionId: string;
  termNumber: number;
  name: string;
  startDate: string;
  endDate: string;
  current: boolean;
}

export interface TermInput {
  termNumber: number;
  name: string;
  startDate: string;
  endDate: string;
}

export interface CreateSessionRequest {
  name: string;
  startDate: string;
  endDate: string;
  terms: TermInput[];
}

const SESSIONS_BASE = "/api/v1/sessions";
const TERMS_BASE = "/api/v1/terms";

export function listSessions(page = 0, size = 20): Promise<Page<AcademicSessionView>> {
  return apiFetch<Page<AcademicSessionView>>(`${SESSIONS_BASE}?page=${page}&size=${size}`);
}

/** Creates the session and its three terms together, in one backend transaction. */
export function createSession(request: CreateSessionRequest): Promise<AcademicSessionView> {
  return apiFetch<AcademicSessionView>(SESSIONS_BASE, { method: "POST", body: JSON.stringify(request) });
}

export function setCurrentSession(sessionId: string): Promise<AcademicSessionView> {
  return apiFetch<AcademicSessionView>(`${SESSIONS_BASE}/${sessionId}/current`, { method: "PATCH" });
}

export function listTerms(sessionId: string): Promise<TermView[]> {
  return apiFetch<TermView[]>(`${SESSIONS_BASE}/${sessionId}/terms`);
}

export function setCurrentTerm(termId: string): Promise<TermView> {
  return apiFetch<TermView>(`${TERMS_BASE}/${termId}/current`, { method: "PATCH" });
}
