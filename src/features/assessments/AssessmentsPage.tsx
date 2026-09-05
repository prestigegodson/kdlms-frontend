import { useState } from "react";
import { useSearchParams } from "react-router";
import { PageHeader } from "@/components/ui/PageHeader";
import { Tabs } from "@/components/ui/Tabs";
import { useAuthStore } from "@/stores/authStore";
import { AdminResultsPanel } from "@/features/assessments/components/AdminResultsPanel";
import { RemarksPanel } from "@/features/assessments/components/RemarksPanel";
import { TeacherEntryPanel } from "@/features/assessments/components/TeacherEntryPanel";

type TeacherTab = "scores" | "remarks";

/**
 * Assessments, split by role like SubjectsPage/StudentsPage: a TEACHER
 * records scores/ratings and termly remarks for their own classes, via a
 * Scores/Remarks tab pair (mirrors TeacherTimetablePanel's "My timetable"/
 * "Class timetable" tabs); SCHOOL_ADMIN/BRANCH_ADMIN see the read-only
 * broadsheet, the publish control, and the principal-remark composer - see
 * CLAUDE.md's Roles matrix (recording is TEACHER-only, admins have no
 * correction path for scores, but do write the separate principal remark).
 * An optional `?classId=` (from ClassDetailPage's "Results & broadsheet"
 * quick link) seeds the initial class selection.
 */
export function AssessmentsPage() {
  const role = useAuthStore((state) => state.user?.role);
  const [searchParams] = useSearchParams();
  const initialClassId = searchParams.get("classId") ?? undefined;
  const [tab, setTab] = useState<TeacherTab>("scores");

  if (role === "TEACHER") {
    return (
      <div className="space-y-6">
        <PageHeader title="Assessments" description="Record scores and termly remarks for your classes." />

        <Tabs
          ariaLabel="Assessment views"
          value={tab}
          onChange={setTab}
          items={[
            { value: "scores", label: "Scores" },
            { value: "remarks", label: "Remarks" },
          ]}
        />

        {tab === "scores" ? (
          <TeacherEntryPanel initialClassId={initialClassId} />
        ) : (
          <RemarksPanel initialClassId={initialClassId} />
        )}
      </div>
    );
  }
  return <AdminResultsPanel initialClassId={initialClassId} />;
}
