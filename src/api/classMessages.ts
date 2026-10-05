import { apiFetch } from "@/api/client";
import type { MessageAuthorRole, MessageView, UnreadCountView } from "@/api/communication";

/**
 * Creators' class messaging (creators Phase C11): one private conversation per (virtual class,
 * learner), addressed by class + learner rather than a thread id - `threadId` is null until someone
 * writes. Mirrors backend communication.application.port.in's Class* views.
 */

/** Mirrors ClassConversationDigestView - one row of a board or inbox. */
export interface ClassConversationDigest {
  threadId: string | null;
  classId: string;
  className: string | null;
  learnerId: string;
  learnerName: string | null;
  creatorName: string | null;
  lastMessageAt: string | null;
  lastMessagePreview: string | null;
  lastAuthorRole: MessageAuthorRole | null;
  unread: boolean;
}

/** Mirrors ClassConversationView. */
export interface ClassConversation {
  threadId: string | null;
  classId: string;
  className: string | null;
  learnerId: string;
  learnerName: string | null;
  creatorName: string | null;
  canPost: boolean;
  messages: MessageView[];
}

/** Mirrors ClassMessagesBoardView - a creator's members for one class. */
export interface ClassMessagesBoard {
  classId: string;
  className: string;
  writable: boolean;
  rows: ClassConversationDigest[];
}

/** Mirrors ClassConversationListView. */
export interface ClassConversationList {
  conversations: ClassConversationDigest[];
  unread: number;
}

/** Mirrors AnnouncementView. */
export interface AnnouncementResult {
  delivered: number;
  emailed: number;
}

const json = (body: unknown) => ({ method: "POST", body: JSON.stringify(body) });

const patchJson = (body: unknown) => ({ method: "PATCH", body: JSON.stringify(body) });

// ---- CREATOR ----

export function getClassMessagesBoard(classId: string): Promise<ClassMessagesBoard> {
  return apiFetch<ClassMessagesBoard>(`/api/v1/virtual-classes/${classId}/messages`);
}

export function getCreatorConversation(classId: string, learnerId: string): Promise<ClassConversation> {
  return apiFetch<ClassConversation>(`/api/v1/virtual-classes/${classId}/messages/learners/${learnerId}`);
}

export function sendCreatorMessage(classId: string, learnerId: string, body: string): Promise<MessageView> {
  return apiFetch<MessageView>(`/api/v1/virtual-classes/${classId}/messages/learners/${learnerId}`, json({ body }));
}

export function markCreatorConversationRead(classId: string, learnerId: string): Promise<void> {
  return apiFetch<void>(`/api/v1/virtual-classes/${classId}/messages/learners/${learnerId}/read`, {
    method: "POST",
  });
}

export function announceToClass(classId: string, body: string): Promise<AnnouncementResult> {
  return apiFetch<AnnouncementResult>(`/api/v1/virtual-classes/${classId}/messages/announcements`, json({ body }));
}

export function editCreatorMessage(messageId: string, body: string): Promise<MessageView> {
  return apiFetch<MessageView>(`/api/v1/virtual-classes/messages/${messageId}`, patchJson({ body }));
}

export function getCreatorUnreadCount(): Promise<UnreadCountView> {
  return apiFetch<UnreadCountView>("/api/v1/virtual-classes/messages/unread-count");
}

export function getCreatorUnreadConversations(): Promise<ClassConversationList> {
  return apiFetch<ClassConversationList>("/api/v1/virtual-classes/messages/unread");
}

// ---- LEARNER / GUARDIAN ----

/**
 * A learner's and a guardian's endpoints differ only in their prefix: a learner's pair is always
 * themself, a guardian names the followed learner.
 */
export type MemberAudience = "LEARNER" | "GUARDIAN";

function conversationPath(audience: MemberAudience, classId: string, learnerId: string): string {
  return audience === "LEARNER"
    ? `/api/v1/learner/classes/${classId}/messages`
    : `/api/v1/me/online-classes/${learnerId}/classes/${classId}/messages`;
}

export function getMemberInbox(audience: MemberAudience): Promise<ClassConversationList> {
  return apiFetch<ClassConversationList>(
    audience === "LEARNER" ? "/api/v1/learner/messages" : "/api/v1/me/online-classes/messages",
  );
}

export function getMemberUnreadCount(audience: MemberAudience): Promise<UnreadCountView> {
  return apiFetch<UnreadCountView>(
    audience === "LEARNER"
      ? "/api/v1/learner/messages/unread-count"
      : "/api/v1/me/online-classes/messages/unread-count",
  );
}

export function getMemberConversation(
  audience: MemberAudience,
  classId: string,
  learnerId: string,
): Promise<ClassConversation> {
  return apiFetch<ClassConversation>(conversationPath(audience, classId, learnerId));
}

export function sendMemberMessage(
  audience: MemberAudience,
  classId: string,
  learnerId: string,
  body: string,
): Promise<MessageView> {
  return apiFetch<MessageView>(conversationPath(audience, classId, learnerId), json({ body }));
}

export function markMemberConversationRead(
  audience: MemberAudience,
  classId: string,
  learnerId: string,
): Promise<void> {
  return apiFetch<void>(`${conversationPath(audience, classId, learnerId)}/read`, { method: "POST" });
}

export function editMemberMessage(
  audience: MemberAudience,
  classId: string,
  learnerId: string,
  messageId: string,
  body: string,
): Promise<MessageView> {
  return apiFetch<MessageView>(
    `${conversationPath(audience, classId, learnerId)}/${messageId}`,
    patchJson({ body }),
  );
}
