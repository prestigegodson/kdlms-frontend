import { apiFetch } from "@/api/client";
import type { Page } from "@/api/types";

/** Mirrors backend communication.domain.MessageCategory. */
export type MessageCategory = "GENERAL" | "BEHAVIOUR" | "ACADEMIC" | "HEALTH" | "COMMENDATION" | "CONCERN";

export type MessageAuthorRole = "TEACHER" | "GUARDIAN";

/** Mirrors backend communication.application.port.in.MessageView. */
export interface MessageView {
  messageId: string;
  threadId: string;
  authorId: string;
  authorName?: string;
  authorRole: MessageAuthorRole;
  body: string;
  createdAt: string;
  editedAt?: string;
  canEdit: boolean;
  editableUntil: string;
}

/** Mirrors backend communication.application.port.in.ThreadView - a thread's flat root + replies. */
export interface ThreadView {
  threadId: string;
  studentId: string;
  studentName: string;
  admissionNumber: string;
  classId: string;
  className: string;
  category: MessageCategory;
  logDate: string;
  canReply: boolean;
  messages: MessageView[];
}

/**
 * Mirrors backend communication.application.port.in.ThreadDigestView - a
 * summary row shared by the teacher's roster board, the admin overview, and
 * a guardian's own ward thread list. `threadId` is only ever null on a
 * board row for a student nobody has messaged yet today.
 */
export interface ThreadDigestView {
  threadId?: string;
  studentId: string;
  studentName: string;
  admissionNumber: string;
  classId: string;
  className: string;
  category?: MessageCategory;
  logDate?: string;
  startedByName?: string;
  lastMessageAt?: string;
  replyCount: number;
  guardianHasReplied: boolean;
  unread: boolean;
}

/** Mirrors backend communication.application.port.in.ClassThreadBoardView. */
export interface ClassThreadBoardView {
  classId: string;
  className: string;
  date: string;
  canCompose: boolean;
  rows: ThreadDigestView[];
}

export interface UnreadCountView {
  unreadThreads: number;
}

/** Mirrors backend communication.application.port.in.ManageThreadsUseCase.RowOutcome. */
export interface StartThreadRowOutcome {
  studentId: string;
  threadId?: string;
  success: boolean;
  message?: string;
}

/** Mirrors backend communication.application.port.in.ManageThreadsUseCase.StartOutcome. */
export interface StartOutcome {
  broadcastId?: string;
  outcomes: StartThreadRowOutcome[];
}

const BASE = "/api/v1/communication";

export function getBoard(classId: string, date: string): Promise<ClassThreadBoardView> {
  return apiFetch<ClassThreadBoardView>(`${BASE}/board?classId=${classId}&date=${date}`);
}

export function getThread(threadId: string): Promise<ThreadView> {
  return apiFetch<ThreadView>(`${BASE}/threads/${threadId}`);
}

/** Starts one thread per id in `studentIds` - one student is a note, several is a broadcast, both go through this one call. */
export function startThreads(
  classId: string,
  logDate: string,
  category: MessageCategory,
  body: string,
  studentIds: string[],
): Promise<StartOutcome> {
  return apiFetch<StartOutcome>(`${BASE}/threads`, {
    method: "POST",
    body: JSON.stringify({ classId, logDate, category, body, studentIds }),
  });
}

export function replyToThread(threadId: string, body: string): Promise<MessageView> {
  return apiFetch<MessageView>(`${BASE}/threads/${threadId}/replies`, {
    method: "POST",
    body: JSON.stringify({ body }),
  });
}

export function markThreadRead(threadId: string): Promise<void> {
  return apiFetch<void>(`${BASE}/threads/${threadId}/read`, { method: "POST" });
}

export function editMessage(messageId: string, body: string): Promise<MessageView> {
  return apiFetch<MessageView>(`${BASE}/messages/${messageId}`, {
    method: "PATCH",
    body: JSON.stringify({ body }),
  });
}

/** TEACHER only - admins have no read rows, so their count would always be zero. */
export function getUnreadCount(): Promise<UnreadCountView> {
  return apiFetch<UnreadCountView>(`${BASE}/unread-count`);
}

/** Read-only cross-class digest for SCHOOL_ADMIN (school-wide) / BRANCH_ADMIN (own branch). */
export function getOverview(from: string, to: string, page = 0, size = 20): Promise<Page<ThreadDigestView>> {
  return apiFetch<Page<ThreadDigestView>>(`${BASE}/overview?from=${from}&to=${to}&page=${page}&size=${size}`);
}

const WARD_BASE = "/api/v1/me/wards";

export function getWardThreads(studentId: string, page = 0, size = 20): Promise<Page<ThreadDigestView>> {
  return apiFetch<Page<ThreadDigestView>>(
    `${WARD_BASE}/${studentId}/communication/threads?page=${page}&size=${size}`,
  );
}

export function getWardThread(studentId: string, threadId: string): Promise<ThreadView> {
  return apiFetch<ThreadView>(`${WARD_BASE}/${studentId}/communication/threads/${threadId}`);
}

export function replyToWardThread(studentId: string, threadId: string, body: string): Promise<MessageView> {
  return apiFetch<MessageView>(`${WARD_BASE}/${studentId}/communication/threads/${threadId}/replies`, {
    method: "POST",
    body: JSON.stringify({ body }),
  });
}

export function markWardThreadRead(studentId: string, threadId: string): Promise<void> {
  return apiFetch<void>(`${WARD_BASE}/${studentId}/communication/threads/${threadId}/read`, { method: "POST" });
}

export function editWardMessage(studentId: string, messageId: string, body: string): Promise<MessageView> {
  return apiFetch<MessageView>(`${WARD_BASE}/${studentId}/communication/messages/${messageId}`, {
    method: "PATCH",
    body: JSON.stringify({ body }),
  });
}

/** Unread count across every linked ward. */
export function getWardUnreadCount(): Promise<UnreadCountView> {
  return apiFetch<UnreadCountView>("/api/v1/me/communication/unread-count");
}
