import { useState } from "react";
import { useSearchParams } from "react-router";
import { PageHeader } from "@/components/ui/PageHeader";
import { Tabs } from "@/components/ui/Tabs";
import { can } from "@/auth/permissions";
import { useAuthStore } from "@/stores/authStore";
import { useTeacherScopeStore } from "@/stores/teacherScopeStore";
import { AdminResultsPanel } from "@/features/assessments/components/AdminResultsPanel";
import { RemarksPanel } from "@/features/assessments/components/RemarksPanel";
import { TeacherBroadsheetPanel } from "@/features/assessments/components/TeacherBroadsheetPanel";
import { TeacherEntryPanel } from "@/features/assessments/components/TeacherEntryPanel";
import { LevelHeadViewSwitch } from "@/features/levelHeads/LevelHeadViewSwitch";
import { useIsLevelHead } from "@/features/levelHeads/useLevelHead";

type TeacherTab = "scores" | "remarks" | "broadsheet";
type LevelsTab = "results" | "scores";

/**
 * Assessments, split by role like SubjectsPage/StudentsPage: a TEACHER
 * records scores/ratings and termly remarks for their own classes, via a
 * Scores/Remarks tab pair (mirrors TeacherTimetablePanel's "My timetable"/
 * "Class timetable" tabs), plus - for a class/assistant teacher only
 * (`can.viewBroadsheet`) - a read-only Broadsheet tab with CSV download and
 * print; SCHOOL_ADMIN/BRANCH_ADMIN see the read-only
 * broadsheet, the publish control, and the principal-remark composer - see
 * CLAUDE.md's Roles matrix (recording is TEACHER-only, admins have no
 * correction path for scores, but do write the separate principal remark).
 * An optional `?classId=` (from ClassDetailPage's "Results & broadsheet"
 * quick link) seeds the initial class selection; an optional `?subjectId=`
 * (from SubjectsPage's "Record assessment" row action) additionally seeds
 * the subject, TEACHER-only - the admin panel is class-level; an optional
 * `?tab=broadsheet` opens the teacher's Broadsheet tab. A Head of Level
 * is both, so they get the two as a "My levels"/"My classes" tab pair; their
 * "My levels" side adds a Scores tab, since a head records scores (and the
 * class teacher's remark, on the Results tab) for any class at their levels.
 */
export function AssessmentsPage() {
  const role = useAuthStore((state) => state.user?.role);
  const [searchParams] = useSearchParams();
  const initialClassId = searchParams.get("classId") ?? undefined;
  const initialSubjectId = searchParams.get("subjectId") ?? undefined;
  const capabilities = useTeacherScopeStore((state) => state.capabilities);
  const showsBroadsheet = role === "TEACHER" && can.viewBroadsheet(role, capabilities);
  const [tab, setTab] = useState<TeacherTab>(searchParams.get("tab") === "broadsheet" ? "broadsheet" : "scores");
  const levelHead = useIsLevelHead();
  const [levelsTab, setLevelsTab] = useState<LevelsTab>("results");
  // Capabilities load after mount - until they say class teacher, a ?tab=broadsheet falls back to Scores.
  const activeTab = tab === "broadsheet" && !showsBroadsheet ? "scores" : tab;

  const teachingView = (
    <div className="space-y-6">
      <PageHeader
        title="Assessments"
        description={
          showsBroadsheet
            ? "Record scores and termly remarks, and view your class broadsheet."
            : "Record scores and termly remarks for your classes."
        }
      />

      <Tabs
        ariaLabel="Assessment views"
        value={activeTab}
        onChange={setTab}
        items={[
          { value: "scores", label: "Scores" },
          { value: "remarks", label: "Remarks" },
          ...(showsBroadsheet ? [{ value: "broadsheet" as const, label: "Broadsheet" }] : []),
        ]}
      />

      {activeTab === "scores" && <TeacherEntryPanel initialClassId={initialClassId} initialSubjectId={initialSubjectId} />}
      {activeTab === "remarks" && <RemarksPanel initialClassId={initialClassId} />}
      {activeTab === "broadsheet" && <TeacherBroadsheetPanel initialClassId={initialClassId} />}
    </div>
  );
  if (levelHead) {
    return (
      <LevelHeadViewSwitch
        ariaLabel="Assessment scopes"
        teachingView={teachingView}
        levelsView={
          <div className="space-y-6">
            <Tabs
              ariaLabel="Level assessment views"
              value={levelsTab}
              onChange={setLevelsTab}
              items={[
                { value: "results", label: "Results" },
                { value: "scores", label: "Scores" },
              ]}
            />
            {levelsTab === "results" ? (
              <AdminResultsPanel initialClassId={initialClassId} />
            ) : (
              <TeacherEntryPanel levelClasses initialClassId={initialClassId} />
            )}
          </div>
        }
      />
    );
  }
  if (role === "TEACHER") {
    return teachingView;
  }
  return <AdminResultsPanel initialClassId={initialClassId} />;
}
