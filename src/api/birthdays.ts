import { apiFetch } from "@/api/client";

/** Mirrors backend student.application.port.in.BirthdayView. */
export interface BirthdayView {
  studentId: string;
  fullName: string;
  admissionNumber: string;
  photoFileId?: string;
  classId: string;
  className: string;
  levelName: string;
  dateOfBirth: string;
  daysUntil: number;
  turningAge: number;
}

const DEFAULT_WITHIN_DAYS = 7;

/**
 * The school dashboard's own card - role-shaped server-side, exactly like
 * `getSchoolDashboard`, but self-fetched rather than folded into it (the
 * same split `AttendanceTodayCard` follows).
 */
export function listUpcomingBirthdays(withinDays: number = DEFAULT_WITHIN_DAYS): Promise<BirthdayView[]> {
  return apiFetch<BirthdayView[]>(`/api/v1/birthdays?withinDays=${withinDays}`);
}

/** The class detail page's own section - narrowed to one class, class-teacher only. */
export function listClassBirthdays(
  classId: string,
  withinDays: number = DEFAULT_WITHIN_DAYS,
): Promise<BirthdayView[]> {
  return apiFetch<BirthdayView[]>(`/api/v1/classes/${classId}/birthdays?withinDays=${withinDays}`);
}
