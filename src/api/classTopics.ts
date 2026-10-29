import { apiFetch } from "@/api/client";

/**
 * A virtual class's topics and the tutor's per-topic grades - mirrors backend
 * virtualclass.application.port.in.ManageClassTopicsUseCase / MyClassTopicsUseCase. A grade is free
 * text with an optional comment; learners and guardians see it only once the tutor publishes that
 * topic's grades.
 */

export interface ClassTopic {
  id: string;
  classId: string;
  title: string;
  description: string | null;
  position: number;
  /** Absent (the API omits nulls) or null while the topic's grades are tutor-only. */
  gradesPublishedAt?: string | null;
}

export interface TopicInput {
  title: string;
  description: string | null;
}

export interface LearnerGradeRow {
  learnerId: string;
  firstName: string;
  lastName: string;
  grade: string | null;
  comment: string | null;
  gradedAt: string | null;
}

export interface TopicGradebook {
  topic: ClassTopic;
  learners: LearnerGradeRow[];
}

/** A blank grade and comment clears that learner's grade. */
export interface GradeEntry {
  learnerId: string;
  grade: string;
  comment: string;
}

export interface GradebookLearner {
  learnerId: string;
  firstName: string;
  lastName: string;
}

export interface GradeCell {
  topicId: string;
  learnerId: string;
  grade: string;
  comment: string | null;
  gradedAt: string;
}

/** The class broadsheet: every topic against every enrolled learner. `grades` holds only graded cells. */
export interface ClassGradebook {
  topics: ClassTopic[];
  learners: GradebookLearner[];
  grades: GradeCell[];
}

/** One broadsheet cell to save - a blank grade and comment clears it. */
export interface ClassGradeEntry {
  topicId: string;
  learnerId: string;
  grade: string;
  comment: string;
}

export interface MyClassTopic {
  id: string;
  title: string;
  description: string | null;
  published: boolean;
  grade: string | null;
  comment: string | null;
  gradedAt: string | null;
}

export interface MyClassTopics {
  classId: string;
  className: string;
  topics: MyClassTopic[];
}

export const TOPIC_GRADE_MAX = 50;
export const TOPIC_COMMENT_MAX = 1000;

const base = (classId: string) => `/api/v1/virtual-classes/${classId}/topics`;

export function listClassTopics(classId: string): Promise<ClassTopic[]> {
  return apiFetch<ClassTopic[]>(base(classId));
}

export function createClassTopic(classId: string, input: TopicInput): Promise<ClassTopic> {
  return apiFetch<ClassTopic>(base(classId), { method: "POST", body: JSON.stringify(input) });
}

export function updateClassTopic(classId: string, topicId: string, input: TopicInput): Promise<ClassTopic> {
  return apiFetch<ClassTopic>(`${base(classId)}/${topicId}`, { method: "PUT", body: JSON.stringify(input) });
}

export function deleteClassTopic(classId: string, topicId: string): Promise<void> {
  return apiFetch<void>(`${base(classId)}/${topicId}`, { method: "DELETE" });
}

export function reorderClassTopics(classId: string, topicIds: string[]): Promise<ClassTopic[]> {
  return apiFetch<ClassTopic[]>(`${base(classId)}/order`, {
    method: "PUT",
    body: JSON.stringify({ topicIds }),
  });
}

export function getTopicGradebook(classId: string, topicId: string): Promise<TopicGradebook> {
  return apiFetch<TopicGradebook>(`${base(classId)}/${topicId}/grades`);
}

export function saveTopicGrades(classId: string, topicId: string, entries: GradeEntry[]): Promise<TopicGradebook> {
  return apiFetch<TopicGradebook>(`${base(classId)}/${topicId}/grades`, {
    method: "PUT",
    body: JSON.stringify({ entries }),
  });
}

export function getClassGradebook(classId: string): Promise<ClassGradebook> {
  return apiFetch<ClassGradebook>(`${base(classId)}/grades`);
}

/** Saves every entry in one all-or-nothing request and returns the refreshed broadsheet. */
export function saveClassGrades(classId: string, entries: ClassGradeEntry[]): Promise<ClassGradebook> {
  return apiFetch<ClassGradebook>(`${base(classId)}/grades`, {
    method: "PUT",
    body: JSON.stringify({ entries }),
  });
}

export function publishTopicGrades(classId: string, topicId: string): Promise<ClassTopic> {
  return apiFetch<ClassTopic>(`${base(classId)}/${topicId}/publish-grades`, { method: "POST" });
}

export function unpublishTopicGrades(classId: string, topicId: string): Promise<ClassTopic> {
  return apiFetch<ClassTopic>(`${base(classId)}/${topicId}/unpublish-grades`, { method: "POST" });
}

export function getMyClassTopics(classId: string): Promise<MyClassTopics> {
  return apiFetch<MyClassTopics>(`/api/v1/learner/classes/${classId}/topics`);
}

export function getWardClassTopics(learnerId: string, classId: string): Promise<MyClassTopics> {
  return apiFetch<MyClassTopics>(`/api/v1/me/online-classes/${learnerId}/classes/${classId}/topics`);
}
