import { BookOpen, ClipboardList, FileQuestion, PenLine } from "lucide-react";
import type { SchoolDashboardTeacherSection } from "@/api/dashboard";
import { StatTile } from "@/components/ui/StatTile";

/**
 * The teacher dashboard's headline numbers. Subject tiles appear only for a teacher with subject
 * assignments; the lesson-note and quiz tiles only when the server sent those sections (the
 * school's plan includes the feature and a term is current).
 */
export function TeacherTodoTiles({ teacher }: { teacher: SchoolDashboardTeacherSection }) {
  const { subjectClasses, lessonNotes, quizzes } = teacher;
  const examRows = subjectClasses.filter((row) => row.exam);
  const examRecorded = examRows.reduce((sum, row) => sum + (row.exam?.recorded ?? 0), 0);
  const examTotal = examRows.reduce((sum, row) => sum + (row.exam?.total ?? 0), 0);
  const students = subjectClasses.reduce((sum, row) => sum + row.studentCount, 0);

  if (subjectClasses.length === 0 && !lessonNotes && !quizzes) {
    return null;
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {subjectClasses.length > 0 && (
        <StatTile
          icon={BookOpen}
          label="Subject classes"
          value={subjectClasses.length}
          hint={`${students} ${students === 1 ? "student" : "students"}`}
          to="/school/academics/subjects"
        />
      )}
      {examRows.length > 0 && (
        <StatTile
          icon={PenLine}
          label="Exam scores entered"
          value={examTotal === 0 ? "—" : `${Math.round((examRecorded / examTotal) * 100)}%`}
          hint={`${examRecorded} of ${examTotal}`}
          to="/school/assessments"
        />
      )}
      {lessonNotes && (
        <StatTile
          icon={ClipboardList}
          label="Lesson notes to fix"
          value={lessonNotes.rejected}
          hint={`${lessonNotes.draft} draft · ${lessonNotes.submitted} awaiting review`}
          to="/school/lesson-notes"
        />
      )}
      {quizzes && (
        <StatTile
          icon={FileQuestion}
          label="Quizzes to publish"
          value={quizzes.closedAwaitingResults}
          hint={`${quizzes.open} open · ${quizzes.openSubmissions} submitted · ${quizzes.draft} draft`}
          to="/school/take-home-quizzes"
        />
      )}
    </div>
  );
}
