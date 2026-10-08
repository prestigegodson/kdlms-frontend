import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import {
  getAuthorableSubjectGroups,
  getAuthorableSubjects,
  listTakeHomeQuizzes,
  type AuthorableSubjectGroupView,
  type TakeHomeQuizSummaryView,
} from "@/api/takeHomeQuizzes";
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
import { SubjectTargetOptions } from "@/features/academics/components/SubjectTargetOptions";
import { parseTargetKey } from "@/features/academics/subjectTarget";
import { ClassTermPicker } from "@/features/assessments/components/ClassTermPicker";
import { quizStatusLabel, quizStatusVariant } from "@/features/takeHomeQuizzes/takeHomeQuizStatus";
import { BranchFilter } from "@/features/branches/components/BranchFilter";
import { useBranchScope } from "@/features/branches/useBranchScope";
import { useIsLevelHead } from "@/features/levelHeads/useLevelHead";
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
 * action) seeds the initial class + subject selection. The Subject picker
 * also offers the class's subject groups to whole-class staff, the Learning
 * resources page's shape: a group quiz covers every subject in it, and a
 * subject's own list takes in its group's quizzes too, labelled "Group".
 */
export function TakeHomeQuizzesPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const role = useAuthStore((state) => state.user?.role);
  const entitled = useFeatureStore((state) => state.takeHomeQuiz);
  const canAuthor = can.authorTakeHomeQuizzes(role, entitled);
  // A Head of Level uses the admin class list - the server unions their levels' classes with the ones they teach.
  const levelHead = useIsLevelHead();
  const isTeacher = role === "TEACHER" && !levelHead;
  const { ready: branchReady, branchId } = useBranchScope();

  const [adminClasses, setAdminClasses] = useState<SchoolClassView[] | null>(null);
  const [teacherClasses, setTeacherClasses] = useState<TeacherClassView[] | null>(null);
  const [classId, setClassId] = useState(searchParams.get("classId") ?? "");
  const [termId, setTermId] = useState("");
  // A target key (`academics/subjectTarget.ts`): a subject's bare id, or `group:<id>` for a subject group.
  const [targetKey, setTargetKey] = useState(searchParams.get("subjectId") ?? "");
  const target = parseTargetKey(targetKey);
  const [subjects, setSubjects] = useState<{ subjectId: string; subjectName: string }[] | null>(null);
  const [subjectGroups, setSubjectGroups] = useState<AuthorableSubjectGroupView[]>([]);

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
    setTargetKey("");
    setSubjects(null);
    setSubjectGroups([]);
  }

  const selectionKey = `${classId}|${termId}|${targetKey}`;
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
    getAuthorableSubjectGroups(classId)
      .then(setSubjectGroups)
      .catch(() => setSubjectGroups([]));
  }, [classId]);

  useEffect(() => {
    if (!classId || !termId) return;
    listTakeHomeQuizzes(classId, termId, targetKey ? parseTargetKey(targetKey) : undefined, undefined, pageIndex, 20)
      .then(setPage)
      .catch((error: unknown) =>
        setLoadError(error instanceof ApiError ? error.message : "Failed to load CBT/Quizzes"),
      );
  }, [classId, termId, targetKey, pageIndex]);

  const classes = isTeacher ? teacherClasses : adminClasses;
  const classesLoaded = classes !== null;
  const classOptions = isTeacher
    ? (teacherClasses ?? []).map((c) => ({ id: c.classId, name: c.className }))
    : (adminClasses ?? []).map((c) => ({ id: c.id, name: c.name }));
  const showsBranchFilter = can.selectBranch(role);

  function newQuizHref(): string {
    const params = new URLSearchParams({ classId, termId });
    if (target.subjectGroupId) params.set("subjectGroupId", target.subjectGroupId);
    else params.set("subjectId", target.subjectId ?? "");
    return `/school/take-home-quizzes/new?${params.toString()}`;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="CBT/Quizzes"
        description="Author and manage CBT/Quizzes for your classes."
        actions={
          canAuthor &&
          classId &&
          termId &&
          targetKey && (
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
                    value={targetKey}
                    onChange={(event) => setTargetKey(event.target.value)}
                  >
                    <SubjectTargetOptions subjects={subjects ?? []} subjectGroups={subjectGroups} />
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
          title="No CBT/Quizzes yet"
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
                  <TableCell label="Subject">
                    <div className="flex flex-wrap items-center gap-1">
                      {quiz.subjectName}
                      {quiz.subjectGroupId && <Badge variant="info">Group</Badge>}
                    </div>
                  </TableCell>
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
