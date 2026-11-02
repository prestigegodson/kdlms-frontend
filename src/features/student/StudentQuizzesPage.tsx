import { ClipboardList } from "lucide-react";
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router";
import { ApiError } from "@/api/client";
import { listMyTakeHomeQuizzes, type MyQuizFilter, type MyTakeHomeQuizSummaryView } from "@/api/myTakeHomeQuizzes";
import type { Page } from "@/api/types";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { PageHeader } from "@/components/ui/PageHeader";
import { Pagination } from "@/components/ui/Pagination";
import { Spinner } from "@/components/ui/Spinner";
import { Tabs } from "@/components/ui/Tabs";
import { StudentQuizCard } from "@/features/student/components/StudentQuizCard";

const PAGE_SIZE = 20;

type TabKey = "todo" | "upcoming" | "completed" | "missed";

const TABS: Array<{ value: TabKey; label: string; filter: MyQuizFilter; empty: { title: string; description: string } }> = [
  {
    value: "todo",
    label: "To do",
    filter: "TODO",
    empty: { title: "Nothing to do right now", description: "Open quizzes you haven't submitted yet will show here." },
  },
  {
    value: "upcoming",
    label: "Upcoming",
    filter: "UPCOMING",
    empty: { title: "No upcoming quizzes", description: "Quizzes your teachers have scheduled will show here before they open." },
  },
  {
    value: "completed",
    label: "Completed",
    filter: "COMPLETED",
    empty: { title: "No completed quizzes yet", description: "Quizzes you submit will show here with your score once it's released." },
  },
  {
    value: "missed",
    label: "Missed",
    filter: "MISSED",
    empty: { title: "No missed quizzes", description: "Quizzes that closed before you submitted will show here." },
  },
];

function tabFrom(value: string | null): TabKey {
  return TABS.some((tab) => tab.value === value) ? (value as TabKey) : "todo";
}

/**
 * The student portal's Quizzes page (Phase 35I.3) - the caller's own class's published take-home quizzes for
 * the current term, split into the dashboard's "My quizzes" buckets: To do, Upcoming, Completed, Missed. Each
 * tab is its own server-filtered, paginated call (`?filter=`), so page totals are the tab's own; the active tab
 * lives in `?tab=` so coming back from a quiz lands on the same tab. A submitted attempt whose score isn't
 * reviewable yet renders as an inert card - see `StudentQuizCard`.
 */
export function StudentQuizzesPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = tabFrom(searchParams.get("tab"));
  const active = TABS.find((item) => item.value === tab) ?? TABS[0];

  const [pageIndex, setPageIndex] = useState(0);
  const [reloadKey, setReloadKey] = useState(0);
  // Keyed by the request that produced it, so a tab/page switch shows the spinner (the stored result no
  // longer matches) without resetting state inside the effect, and a late response for a tab the
  // student already left is ignored.
  const requestKey = `${active.filter}:${pageIndex}:${reloadKey}`;
  const [result, setResult] = useState<{
    key: string;
    page?: Page<MyTakeHomeQuizSummaryView>;
    error?: string;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    listMyTakeHomeQuizzes(pageIndex, PAGE_SIZE, active.filter)
      .then((page) => {
        if (!cancelled) {
          setResult({ key: requestKey, page });
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setResult({ key: requestKey, error: err instanceof ApiError ? err.message : "Failed to load your quizzes" });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [active.filter, pageIndex, requestKey]);

  const current = result?.key === requestKey ? result : null;
  const page = current?.page ?? null;
  const error = current?.error ?? null;

  function changeTab(next: TabKey) {
    if (next === tab) {
      return;
    }
    setPageIndex(0);
    setSearchParams(
      (params) => {
        const updated = new URLSearchParams(params);
        updated.set("tab", next);
        return updated;
      },
      { replace: true },
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Quizzes" description="CBT/Quizzes from your teachers for this term." />

      <div className="max-w-4xl space-y-4">
        <Tabs ariaLabel="Quiz status" value={tab} onChange={changeTab} items={TABS} />

        <div role="tabpanel" aria-label={active.label}>
          {error ? (
            <ErrorState message={error} onRetry={() => setReloadKey((key) => key + 1)} />
          ) : page === null ? (
            <div className="flex items-center gap-2 py-6 text-sm text-slate-500">
              <Spinner /> Loading…
            </div>
          ) : page.totalElements === 0 ? (
            <EmptyState icon={ClipboardList} title={active.empty.title} description={active.empty.description} />
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {page.content.map((quiz) => (
                  <StudentQuizCard key={quiz.id} quiz={quiz} />
                ))}
              </div>
              <Pagination page={page} onPageChange={setPageIndex} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
