import type { ReportBlockName } from "@/features/reporting/components/designer/layout";

/**
 * The palette's block registry - one entry per backend `reporting.domain.ReportBlock`
 * constant. A BLOCK element's interior is always filled server-side at
 * render time (see `LayoutHtmlEmitter`/`TemplateRenderer`) - what a system
 * admin arranges on the canvas is its position and container styling only,
 * never its content. Keep this list's block names in exact sync with the
 * backend enum.
 */
export interface ReportBlockDefinition {
  id: ReportBlockName;
  label: string;
  description: string;
  /** Only SCORE_TABLE/RATING_TABLE/GRADE_KEY/RATING_LEGEND are mode-specific - `BlockPalette` filters on this. */
  mode?: "NUMERIC" | "QUALITATIVE";
}

export const REPORT_BLOCKS: ReportBlockDefinition[] = [
  { id: "SCHOOL_HEADER", label: "School header", description: "Logo, name, address, contact details" },
  { id: "STUDENT_BIO", label: "Student bio", description: "Name, admission no., class, session and term" },
  {
    id: "STUDENT_PHOTO",
    label: "Student photo",
    description: "The student's profile picture, on its own - hidden entirely for a student with no photo on file",
  },
  { id: "SCORE_TABLE", label: "Score table", mode: "NUMERIC", description: "Subjects, scores, grades, totals, position" },
  { id: "RATING_TABLE", label: "Rating table", mode: "QUALITATIVE", description: "Subjects, ratings, observations" },
  { id: "ATTENDANCE_SUMMARY", label: "Attendance summary", description: "Present/absent/days marked/rate" },
  { id: "GRADE_KEY", label: "Grade key", mode: "NUMERIC", description: "Grade boundaries and remarks" },
  { id: "RATING_LEGEND", label: "Rating legend", mode: "QUALITATIVE", description: "Rating scale and descriptions" },
  { id: "SIGNATURE_CLASS_TEACHER", label: "Class teacher signature", description: "Signature image and name" },
  { id: "SIGNATURE_PRINCIPAL", label: "Principal signature", description: "Signature image and name" },
];

/**
 * The `{{token}}` substitution registry a TEXT element's content may
 * reference - mirrors backend `reporting.domain.ReportToken`. Rendered by
 * `TokenPanel` for click-to-insert into the selected TEXT element.
 */
export const REPORT_TOKENS: Array<{ key: string; description: string }> = [
  { key: "school.name", description: "School name" },
  { key: "school.address", description: "School address" },
  { key: "school.phone", description: "School phone" },
  { key: "school.email", description: "School email" },
  { key: "student.fullName", description: "Student's full name" },
  { key: "student.admissionNumber", description: "Student's admission number" },
  { key: "student.gender", description: "Student's gender" },
  { key: "class.name", description: "Class name" },
  { key: "level.name", description: "Level name" },
  { key: "session.name", description: "Session name, e.g. 2026/2027" },
  { key: "term.name", description: "Term name" },
  { key: "term.endDate", description: "Term end date" },
  { key: "nextTerm.startDate", description: "Next term's start date" },
  { key: "result.total", description: "Term total (NUMERIC only)" },
  { key: "result.average", description: "Term average (NUMERIC only)" },
  { key: "result.position", description: "Class position (NUMERIC only)" },
  { key: "result.classSize", description: "Class size" },
  { key: "attendance.present", description: "Days present" },
  { key: "attendance.absent", description: "Days absent" },
  { key: "attendance.daysMarked", description: "Days a register was taken" },
  { key: "attendance.rate", description: "Attendance rate" },
  { key: "teacher.name", description: "Class teacher's name" },
  { key: "principal.name", description: "Principal's name" },
];
