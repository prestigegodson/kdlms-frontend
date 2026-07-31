import { apiFetch } from "@/api/client";
import type { Page } from "@/api/types";

/** Mirrors backend academics.application.port.in.AcademicSessionView. endDate is optional. */
export interface AcademicSessionView {
  id: string;
  schoolId: string;
  name: string;
  startDate: string;
  endDate: string | null;
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
  endDate: string | null;
  /** One to three terms, numbered consecutively from 1 - the rest are added later with {@link addTerm}. */
  terms: TermInput[];
}

export interface UpdateSessionRequest {
  name: string;
  startDate: string;
  endDate: string | null;
}

export interface UpdateTermRequest {
  name: string;
  startDate: string;
  endDate: string;
}

const SESSIONS_BASE = "/api/v1/sessions";
const TERMS_BASE = "/api/v1/terms";

export function listSessions(page = 0, size = 20): Promise<Page<AcademicSessionView>> {
  return apiFetch<Page<AcademicSessionView>>(`${SESSIONS_BASE}?page=${page}&size=${size}`);
}

/** Creates the session and whichever of its terms are supplied (1-3, from term 1) in one backend transaction. */
export function createSession(request: CreateSessionRequest): Promise<AcademicSessionView> {
  return apiFetch<AcademicSessionView>(SESSIONS_BASE, { method: "POST", body: JSON.stringify(request) });
}

/** Renames and/or reschedules the session; `endDate` may be null. */
export function updateSession(sessionId: string, request: UpdateSessionRequest): Promise<AcademicSessionView> {
  return apiFetch<AcademicSessionView>(`${SESSIONS_BASE}/${sessionId}`, {
    method: "PUT",
    body: JSON.stringify(request),
  });
}

export function setCurrentSession(sessionId: string): Promise<AcademicSessionView> {
  return apiFetch<AcademicSessionView>(`${SESSIONS_BASE}/${sessionId}/current`, { method: "PATCH" });
}

export function listTerms(sessionId: string): Promise<TermView[]> {
  return apiFetch<TermView[]>(`${SESSIONS_BASE}/${sessionId}/terms`);
}

/** Adds the next term to a session that doesn't have it yet. */
export function addTerm(sessionId: string, term: TermInput): Promise<TermView> {
  return apiFetch<TermView>(`${SESSIONS_BASE}/${sessionId}/terms`, { method: "POST", body: JSON.stringify(term) });
}

/** Renames and/or reschedules an existing term; its term number is immutable. */
export function updateTerm(termId: string, request: UpdateTermRequest): Promise<TermView> {
  return apiFetch<TermView>(`${TERMS_BASE}/${termId}`, { method: "PUT", body: JSON.stringify(request) });
}

export function setCurrentTerm(termId: string): Promise<TermView> {
  return apiFetch<TermView>(`${TERMS_BASE}/${termId}/current`, { method: "PATCH" });
}
