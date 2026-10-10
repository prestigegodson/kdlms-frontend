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
  {
    id: "SCHOOL_LOGO",
    label: "School logo",
    description: "The school's logo on its own - hidden entirely for a school with no logo uploaded",
  },
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
  {
    id: "SIGNATURE_PRINCIPAL",
    label: "Principal/head signature",
    description: "Signature image and name - Principal, unless a level/branch commenter is configured under Report Settings",
  },
  {
    id: "SIGNATURE_IMAGE_CLASS_TEACHER",
    label: "Class teacher signature (image only)",
    description: "Just the signature image, no name beneath it",
  },
  {
    id: "SIGNATURE_IMAGE_PRINCIPAL",
    label: "Principal/head signature (image only)",
    description: "Just the signature image, no name beneath it",
  },
  {
    id: "REMARK_CLASS_TEACHER",
    label: "Class teacher's remark",
    description: "The term's holistic remark - closes up when never written for a student",
  },
  {
    id: "REMARK_PRINCIPAL",
    label: "Principal/head's remark",
    description: "The term's holistic remark, headed \"<Title>'s remark\" (\"Principal's remark\" by default) - closes up when never written for a student",
  },
  {
    id: "HEAD_TITLE",
    label: "Remark commenter title",
    description: "The resolved commenter's title alone, e.g. \"Head of Nursery\" - \"Principal\" unless a level/branch commenter is configured under Report Settings",
  },
  {
    id: "HEAD_NAME",
    label: "Remark commenter name",
    description: "The resolved commenter's name alone, falling back to the school's own principal name - closes up when neither is set",
  },
  {
    id: "AFFECTIVE_TRAITS",
    label: "Affective disposition table",
    description: "Rated affective-disposition traits - closes up when the category has nothing rated",
  },
  {
    id: "PSYCHOMOTOR_TRAITS",
    label: "Psychomotor skills table",
    description: "Rated psychomotor-skills traits - closes up when the category has nothing rated",
  },
  {
    id: "TRAIT_LEGEND",
    label: "Behavioural traits key",
    description: "The rating scale for both trait categories - closes up when neither is enabled",
  },
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
  { key: "nextTerm.startDate", description: "Next term begins (start date)" },
  { key: "result.total", description: "Term total (NUMERIC only)" },
  { key: "result.average", description: "Term average (NUMERIC only)" },
  { key: "result.position", description: "Class position (NUMERIC only)" },
  { key: "result.classSize", description: "Class size" },
  { key: "result.scope", description: '"Mid-Term Assessment" or "End of Term"' },
  { key: "attendance.present", description: "Days present" },
  { key: "attendance.absent", description: "Days absent" },
  { key: "attendance.daysMarked", description: "Days a register was taken" },
  { key: "attendance.rate", description: "Attendance rate" },
  { key: "teacher.name", description: "Class teacher's name" },
  { key: "principal.name", description: "Principal's name (always the real principal - see head.name)" },
  { key: "head.title", description: "Who signs the remark today - \"Principal\" unless a level/branch commenter is configured" },
  { key: "head.name", description: "That commenter's own name" },
  { key: "remark.classTeacher", description: "Class teacher's remark" },
  { key: "remark.principal", description: "The principal/head's remark" },
];
