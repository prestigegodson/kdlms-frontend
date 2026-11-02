import { CalendarDays } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router";
import { listMyLearningResources, type MyLearningResourceSummaryView } from "@/api/learning";
import { listMyTakeHomeQuizzes, type MyTakeHomeQuizSummaryView } from "@/api/myTakeHomeQuizzes";
import { downloadMyPhoto } from "@/api/student";
import { can } from "@/auth/permissions";
import { Avatar } from "@/components/ui/Avatar";
import { ErrorState } from "@/components/ui/ErrorState";
import { PageHeader } from "@/components/ui/PageHeader";
import { Spinner } from "@/components/ui/Spinner";
import { StatTileSkeleton } from "@/components/ui/StatTileSkeleton";
import { DueSoonBanner, PrivacyNote, StudyTip } from "@/features/student/dashboard/DashboardBanners";
import { LearnerSnapshot } from "@/features/student/dashboard/LearnerSnapshot";
import { ProgressCard } from "@/features/student/dashboard/ProgressCard";
import { QuizzesTable } from "@/features/student/dashboard/QuizzesTable";
import { dueSoonQuizzes } from "@/features/student/dashboard/studentDashboardStats";
import { useObjectUrl } from "@/hooks/useObjectUrl";
import { useFeatureStore } from "@/stores/featureStore";
import { useStudentStore } from "@/stores/studentStore";
import { initialsOfFullName } from "@/utils/initials";

/** One page is plenty for a single class's current-term quizzes; the Quizzes tab paginates the rest. */
const QUIZ_PAGE_SIZE = 100;

/** `useObjectUrl`'s fetcher must be a stable module-level function - `downloadMyPhoto` itself takes no id, so this just ignores the key `useObjectUrl` passes it. */
function fetchMyPhoto(): Promise<Blob> {
  return downloadMyPhoto();
}

/** `undefined` = still loading, `null` = unavailable (feature off or the fetch failed) - its widgets hide. */
type Loadable<T> = T[] | null | undefined;

/**
 * The student portal's Home tab - a personal dashboard built only from the student's own
 * take-home quizzes (due dates, status, released scores) and learning resources (completion).
 * Never term results: students don't see those. Each list loads independently, so one failing
 * or feature-gated source only hides its own widgets; the profile header always renders.
 */
export function StudentDashboardPage() {
  const me = useStudentStore((state) => state.me);
  const status = useStudentStore((state) => state.status);
  const errorMessage = useStudentStore((state) => state.errorMessage);
  const fetchIfNeeded = useStudentStore((state) => state.fetchIfNeeded);
  const retry = useStudentStore((state) => state.retry);
  // Gated on hasPhoto so a student with no photo never fires a fetch that can only 404.
  const photoUrl = useObjectUrl(me?.hasPhoto ? me.studentId : undefined, fetchMyPhoto);

  const quizzesEnabled = useFeatureStore((state) => can.viewStudentQuizzes("STUDENT", state.takeHomeQuiz));
  const resourcesEnabled = useFeatureStore((state) => can.viewStudentResources("STUDENT", state.onDemandLearning));
  const [quizzes, setQuizzes] = useState<Loadable<MyTakeHomeQuizSummaryView>>(undefined);
  const [resources, setResources] = useState<Loadable<MyLearningResourceSummaryView>>(undefined);

  useEffect(() => {
    fetchIfNeeded();
  }, [fetchIfNeeded]);

  useEffect(() => {
    if (!quizzesEnabled) {
      return;
    }
    let cancelled = false;
    listMyTakeHomeQuizzes(0, QUIZ_PAGE_SIZE)
      .then((page) => !cancelled && setQuizzes(page.content))
      .catch(() => !cancelled && setQuizzes(null));
    return () => {
      cancelled = true;
    };
  }, [quizzesEnabled]);

  useEffect(() => {
    if (!resourcesEnabled) {
      return;
    }
    let cancelled = false;
    listMyLearningResources()
      .then((list) => !cancelled && setResources(list))
      .catch(() => !cancelled && setResources(null));
    return () => {
      cancelled = true;
    };
  }, [resourcesEnabled]);

  if (status === "error") {
    return (
      <div className="space-y-6">
        <PageHeader title="Home" />
        <ErrorState message={errorMessage ?? "Failed to load your profile"} onRetry={retry} />
      </div>
    );
  }

  if (!me) {
    return (
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <Spinner /> Loading…
      </div>
    );
  }

  // A disabled source reads as unavailable regardless of what an earlier fetch left in state.
  const loading = (quizzesEnabled && quizzes === undefined) || (resourcesEnabled && resources === undefined);
  const loadedQuizzes = quizzesEnabled ? (quizzes ?? null) : null;
  const loadedResources = resourcesEnabled ? (resources ?? null) : null;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between">
        <div className="mb-2 mr-4 flex min-w-0 items-center">
          <Avatar initials={initialsOfFullName(me.fullName)} url={photoUrl} size="lg" />
          <div className="ml-4 min-w-0">
            <h1 className="font-display text-xl font-medium text-slate-900">{me.fullName}</h1>
            <p className="text-sm text-slate-500">{me.admissionNumber}</p>
            {me.className && (
              <p className="text-sm text-slate-500">
                {me.className}
                {me.levelName ? ` · ${me.levelName}` : ""}
              </p>
            )}
          </div>
        </div>
        {me.sessionName && (
          <Link
            to="/student/timetable"
            className="mb-2 inline-flex items-center rounded-full border border-brand-100 bg-brand-50 px-3 py-1.5 text-sm font-medium text-brand-700 hover:bg-brand-100"
          >
            <CalendarDays className="mr-2 h-4 w-4" aria-hidden="true" />
            {me.sessionName}
            {me.currentTermName ? ` · ${me.currentTermName}` : ""}
          </Link>
        )}
      </header>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {loadedQuizzes ? <DueSoonBanner count={dueSoonQuizzes(loadedQuizzes).length} /> : null}
        <PrivacyNote />
      </div>

      {loadedQuizzes && loadedQuizzes.length > 0 && <StudyTip />}

      {loading ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-busy="true">
          <StatTileSkeleton />
          <StatTileSkeleton />
          <StatTileSkeleton />
          <StatTileSkeleton />
        </div>
      ) : (
        <>
          <LearnerSnapshot quizzes={loadedQuizzes} resources={loadedResources} />
          <ProgressCard quizzes={loadedQuizzes} resources={loadedResources} />
          {loadedQuizzes && loadedQuizzes.length > 0 && <QuizzesTable quizzes={loadedQuizzes} />}
        </>
      )}
    </div>
  );
}
