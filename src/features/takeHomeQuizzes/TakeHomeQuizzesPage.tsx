import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { getAuthorableSubjects, listTakeHomeQuizzes, type TakeHomeQuizSummaryView } from "@/api/takeHomeQuizzes";
import { ApiError } from "@/api/client";
import { listClasses, type SchoolClassView } from "@/api/classes";
import { listMyClasses, type TeacherClassView } from "@/api/me";
import type { Page } from "@/api/types";
import { can } from "@/auth/permissions";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { FormField } from "@/components/ui/FormField";
import { PageHeader } from "@/components/ui/PageHeader";
import { Pagination } from "@/components/ui/Pagination";
import { Select } from "@/components/ui/Select";
import { Spinner } from "@/components/ui/Spinner";
import { StickySubHeader } from "@/components/ui/StickySubHeader";
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from "@/components/ui/Table";
import { ClassTermPicker } from "@/features/assessments/components/ClassTermPicker";
import { quizStatusLabel, quizStatusVariant } from "@/features/takeHomeQuizzes/takeHomeQuizStatus";
import { BranchFilter } from "@/features/branches/components/BranchFilter";
import { useBranchScope } from "@/features/branches/useBranchScope";
import { useAuthStore } from "@/stores/authStore";
import { useFeatureStore } from "@/stores/featureStore";
import { formatInstant } from "@/utils/date";
import { ClipboardList } from "lucide-react";

/**
 * The take-home quiz list, Phase 20B. One page for every staff role, not a
 * role fork the way `LessonNotesPage` is - both audiences select the same
 * class+term(+subject), and `BranchFilter` already renders nothing for a
 * BRANCH_ADMIN/TEACHER, so there's no per-role render branch worth
 * splitting out. Composition mirrors
 * `features/assessments/components/AdminResultsPanel.tsx`. An optional
 * `?classId=&subjectId=` (from SubjectsPage's "Take-home quizzes" row
 * action) seeds the initial class + subject selection.
 */
export function TakeHomeQuizzesPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const role = useAuthStore((state) => state.user?.role);
  const entitled = useFeatureStore((state) => state.takeHomeQuiz);
  const canAuthor = can.authorTakeHomeQuizzes(role, entitled);
  const isTeacher = role === "TEACHER";
  const { ready: branchReady, branchId } = useBranchScope();

  const [adminClasses, setAdminClasses] = useState<SchoolClassView[] | null>(null);
  const [teacherClasses, setTeacherClasses] = useState<TeacherClassView[] | null>(null);
  const [classId, setClassId] = useState(searchParams.get("classId") ?? "");
  const [termId, setTermId] = useState("");
  const [subjectId, setSubjectId] = useState(searchParams.get("subjectId") ?? "");
  const [subjects, setSubjects] = useState<{ subjectId: string; subjectName: string }[] | null>(null);

  const [pageIndex, setPageIndex] = useState(0);
  const [page, setPage] = useState<Page<TakeHomeQuizSummaryView> | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (isTeacher) {
      listMyClasses()
        .then(setTeacherClasses)
        .catch(() => setTeacherClasses([]));
      return;
    }
    if (!branchReady) return;
    listClasses(branchId, undefined, 0, 200)
      .then((result) => setAdminClasses(result.content))
      .catch(() => setAdminClasses([]));
  }, [isTeacher, branchReady, branchId]);

  // A class change resets the downstream subject/quiz selection during render (the
  // ScoreEntryGrid/TeacherEntryPanel pattern) rather than in an effect.
  const [lastClassId, setLastClassId] = useState(classId);
  if (classId !== lastClassId) {
    setLastClassId(classId);
    setSubjectId("");
    setSubjects(null);
  }

  const selectionKey = `${classId}|${termId}|${subjectId}`;
  const [lastSelectionKey, setLastSelectionKey] = useState(selectionKey);
  if (selectionKey !== lastSelectionKey) {
    setLastSelectionKey(selectionKey);
    setPage(null);
    setLoadError(null);
    setPageIndex(0);
  }

  useEffect(() => {
    if (!classId) return;
    getAuthorableSubjects(classId)
      .then(setSubjects)
      .catch(() => setSubjects([]));
  }, [classId]);

  useEffect(() => {
    if (!classId || !termId) return;
    listTakeHomeQuizzes(classId, termId, subjectId || undefined, undefined, pageIndex, 20)
      .then(setPage)
      .catch((error: unknown) =>
        setLoadError(error instanceof ApiError ? error.message : "Failed to load take-home quizzes"),
      );
  }, [classId, termId, subjectId, pageIndex]);

  const classes = isTeacher ? teacherClasses : adminClasses;
  const classesLoaded = classes !== null;
  const classOptions = isTeacher
    ? (teacherClasses ?? []).map((c) => ({ id: c.classId, name: c.className }))
    : (adminClasses ?? []).map((c) => ({ id: c.id, name: c.name }));
  const showsBranchFilter = can.selectBranch(role);

  function newQuizHref(): string {
    const params = new URLSearchParams({ classId, subjectId, termId });
    return `/school/take-home-quizzes/new?${params.toString()}`;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Take-home quizzes"
        description="Author and manage take-home quizzes for your classes."
        actions={
          canAuthor &&
          classId &&
          termId &&
          subjectId && (
            <Button variant="accent" onClick={() => navigate(newQuizHref())}>
              New quiz
            </Button>
          )
        }
      />

      {!classesLoaded && (
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Spinner /> Loading your classes…
        </div>
      )}

      {classesLoaded && classes.length === 0 && !showsBranchFilter && (
        <EmptyState
          icon={ClipboardList}
          title="No classes assigned yet"
          description="You'll see this page once you're assigned as a class or subject teacher."
        />
      )}

      {classesLoaded && (classes.length > 0 || showsBranchFilter) && (
        <StickySubHeader collapsible>
          <BranchFilter id="take-home-quizzes-branch" />
          {classes.length > 0 && (
            <ClassTermPicker classes={classOptions} classId={classId} onClassChange={setClassId} termId={termId} onTermChange={setTermId}>
              {classId && (
                <FormField label="Subject" htmlFor="take-home-quiz-subject">
                  <Select
                    id="take-home-quiz-subject"
                    value={subjectId}
                    onChange={(event) => setSubjectId(event.target.value)}
                  >
                    <option value="">Select a subject…</option>
                    {(subjects ?? []).map((subject) => (
                      <option key={subject.subjectId} value={subject.subjectId}>
                        {subject.subjectName}
                      </option>
                    ))}
                  </Select>
                </FormField>
              )}
            </ClassTermPicker>
          )}
        </StickySubHeader>
      )}

      {loadError && <Alert variant="error">{loadError}</Alert>}

      {classId && termId && page === null && !loadError && (
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Spinner /> Loading quizzes…
        </div>
      )}

      {page !== null && page.content.length === 0 && (
        <EmptyState
          icon={ClipboardList}
          title="No take-home quizzes yet"
          description={canAuthor ? "Create one to get started." : "Nothing has been authored for this selection yet."}
        />
      )}

      {page !== null && page.content.length > 0 && (
        <>
          <Table>
            <TableHead>
              <tr>
                <TableHeaderCell>Title</TableHeaderCell>
                <TableHeaderCell>Subject</TableHeaderCell>
                <TableHeaderCell>Status</TableHeaderCell>
                <TableHeaderCell numeric>Questions</TableHeaderCell>
                <TableHeaderCell numeric>Points</TableHeaderCell>
                <TableHeaderCell>Opens</TableHeaderCell>
                <TableHeaderCell>Closes</TableHeaderCell>
              </tr>
            </TableHead>
            <TableBody>
              {page.content.map((quiz) => (
                <TableRow key={quiz.id} to={`/school/take-home-quizzes/${quiz.id}`}>
                  <TableCell label="Title">{quiz.title}</TableCell>
                  <TableCell label="Subject">{quiz.subjectName}</TableCell>
                  <TableCell label="Status">
                    <Badge variant={quizStatusVariant(quiz.status, quiz.availability)}>
                      {quizStatusLabel(quiz.status, quiz.availability)}
                    </Badge>
                  </TableCell>
                  <TableCell label="Questions" numeric>
                    {quiz.questionCount}
                  </TableCell>
                  <TableCell label="Points" numeric>
                    {quiz.totalPoints}
                  </TableCell>
                  <TableCell label="Opens">{formatInstant(quiz.opensAt)}</TableCell>
                  <TableCell label="Closes">{formatInstant(quiz.closesAt)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <Pagination page={page} onPageChange={setPageIndex} />
        </>
      )}
    </div>
  );
}
