/** Mirrors backend com.kdlms.identity's role model (see CLAUDE.md). */
export type Role = "SYSTEM_ADMIN" | "SCHOOL_ADMIN" | "BRANCH_ADMIN" | "TEACHER" | "GUARDIAN";

/**
 * RFC 9457 problem details, as returned by the backend's
 * GlobalExceptionHandler for every error response.
 */
export interface ProblemDetail {
  type?: string;
  title?: string;
  status?: number;
  detail?: string;
  instance?: string;
  errors?: string[];
  [key: string]: unknown;
}

/** Shape of a Spring Data `Page<T>` as serialized to JSON. */
export interface Page<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  number: number;
  size: number;
}
