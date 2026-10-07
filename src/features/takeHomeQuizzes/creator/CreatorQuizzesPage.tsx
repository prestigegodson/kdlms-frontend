import { ClipboardCheck, Plus } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { getErrorMessage } from "@/api/client";
import { type ClassQuizListView, listClassQuizzes } from "@/api/classTakeHomeQuizzes";
import { listVirtualClasses, type VirtualClass } from "@/api/virtualClasses";
import { can } from "@/auth/permissions";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { FormField } from "@/components/ui/FormField";
import { PageHeader } from "@/components/ui/PageHeader";
import { Select } from "@/components/ui/Select";
import { Skeleton } from "@/components/ui/Skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from "@/components/ui/Table";
import { quizStatusLabel, quizStatusVariant } from "@/features/takeHomeQuizzes/takeHomeQuizStatus";
import { useCreatorPlanStore } from "@/stores/creatorPlanStore";
import { formatInstant } from "@/utils/date";

/**
 * A creator's quizzes (creators Phase C13): pick a class, see its quizzes newest first, and open one
 * to edit, publish or review its results. The class lives in the URL (`?classId=`), so a class
 * page's "Quizzes" link lands straight on it. Without take-home quizzes in the plan, an upgrade
 * notice replaces the page - the C12 Lesson notes pattern.
 */
export function CreatorQuizzesPage() {
  const fetchPlan = useCreatorPlanStore((state) => state.fetchIfNeeded);
  const plan = useCreatorPlanStore((state) => state.plan);
  const planStatus = useCreatorPlanStore((state) => state.status);
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const classId = searchParams.get("classId");

  const [classes, setClasses] = useState<VirtualClass[] | null>(null);
  const [loadedQuizzes, setQuizzes] = useState<ClassQuizListView | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Shown only while it still matches the URL - a class switch shows a skeleton until its own list arrives.
  const quizzes = loadedQuizzes?.classId === classId ? loadedQuizzes : null;

  useEffect(() => {
    fetchPlan();
  }, [fetchPlan]);

  // Unknown while the plan loads; if it can't be loaded, carry on and let the server's own answer show.
  const entitled =
    planStatus === "loaded"
      ? can.viewClassQuizzes("CREATOR", plan?.takeHomeQuiz ?? false)
      : planStatus === "error"
        ? true
        : null;

  useEffect(() => {
    if (entitled !== true) {
      return;
    }
    listVirtualClasses()
      .then((list) =>
        setClasses(
          [...list.classes].sort((a, b) =>
            a.status === b.status ? a.name.localeCompare(b.name) : a.status === "ACTIVE" ? -1 : 1,
          ),
        ),
      )
      .catch((err: unknown) => setError(getErrorMessage(err, "We couldn't load your classes.")));
  }, [entitled]);

  // Land on the first class when none is chosen yet.
  useEffect(() => {
    if (!classId && classes && classes.length > 0) {
      setSearchParams({ classId: classes[0].id }, { replace: true });
    }
  }, [classId, classes, setSearchParams]);

  const loadQuizzes = useCallback(() => {
    if (!classId) {
      return;
    }
    listClassQuizzes(classId)
      .then((loaded) => {
        setQuizzes(loaded);
        setError(null);
      })
      .catch((err: unknown) => setError(getErrorMessage(err, "We couldn't load this class's quizzes.")));
  }, [classId]);

  useEffect(() => {
    if (entitled === true) {
      loadQuizzes();
    }
  }, [entitled, loadQuizzes]);

  if (entitled === false) {
    return (
      <div className="space-y-6">
        <PageHeader title="Quizzes" />
        <EmptyState
          icon={ClipboardCheck}
          title="Quizzes aren't in your plan"
          description="Upgrade to a plan with CBT/Quizzes to set auto-marked quizzes for your classes."
          action={
            <Link
              to="/creator/billing"
              className="inline-flex min-h-11 items-center rounded-control bg-brand-500 px-4 text-sm font-medium text-white hover:bg-brand-600"
            >
              See plans
            </Link>
          }
        />
      </div>
    );
  }

  const canAdd = !!quizzes?.writable && can.authorClassQuizzes("CREATOR", true);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Quizzes"
        description="Set auto-marked quizzes for a class. Learners take them in their own portal once published."
        actions={
          canAdd && classId ? (
            <Button onClick={() => navigate(`/creator/quizzes/${classId}/new`)}>
              <Plus className="h-4 w-4" aria-hidden="true" />
              New quiz
            </Button>
          ) : undefined
        }
      />

      {error ? (
        <ErrorState message={error} onRetry={loadQuizzes} />
      ) : classes === null ? (
        <Skeleton className="h-40" />
      ) : classes.length === 0 ? (
        <EmptyState
          icon={ClipboardCheck}
          title="No classes yet"
          description="Create a class to start setting quizzes for it."
        />
      ) : (
        <>
          <FormField label="Class" htmlFor="quizzes-class">
            <Select
              id="quizzes-class"
              value={classId ?? ""}
              onChange={(event) => setSearchParams({ classId: event.target.value })}
            >
              {classes.map((virtualClass) => (
                <option key={virtualClass.id} value={virtualClass.id}>
                  {virtualClass.name}
                  {virtualClass.status === "ARCHIVED" ? " (archived)" : ""}
                </option>
              ))}
            </Select>
          </FormField>

          {quizzes && !quizzes.writable && (
            <Alert variant="info">
              This class is archived or beyond your plan's class limit, so its quizzes are read-only.
            </Alert>
          )}

          {quizzes === null ? (
            <Skeleton className="h-40" />
          ) : quizzes.quizzes.length === 0 ? (
            <EmptyState
              icon={ClipboardCheck}
              title="No quizzes yet"
              description={quizzes.writable ? "Set your first quiz for this class." : "This class has no quizzes."}
            />
          ) : (
            <Table>
              <TableHead>
                <TableRow>
                  <TableHeaderCell>Title</TableHeaderCell>
                  <TableHeaderCell>Status</TableHeaderCell>
                  <TableHeaderCell className="max-sm:hidden">Questions</TableHeaderCell>
                  <TableHeaderCell>Closes</TableHeaderCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {quizzes.quizzes.map((quiz) => (
                  <TableRow key={quiz.id} to={`/creator/quizzes/${quizzes.classId}/${quiz.id}`}>
                    <TableCell label="Title">
                      <span className="font-medium text-slate-900">{quiz.title}</span>
                    </TableCell>
                    <TableCell label="Status">
                      <Badge variant={quizStatusVariant(quiz.status, quiz.availability)}>
                        {quizStatusLabel(quiz.status, quiz.availability)}
                      </Badge>
                    </TableCell>
                    <TableCell label="Questions" className="max-sm:hidden">
                      {quiz.questionCount} · {quiz.totalPoints} pts
                    </TableCell>
                    <TableCell label="Closes">{formatInstant(quiz.closesAt)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </>
      )}
    </div>
  );
}
