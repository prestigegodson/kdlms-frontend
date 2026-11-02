import { BookOpen } from "lucide-react";
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router";
import { ApiError } from "@/api/client";
import { listMyLearningResources, type MyLearningResourceSummaryView } from "@/api/learning";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { PageHeader } from "@/components/ui/PageHeader";
import { Spinner } from "@/components/ui/Spinner";
import { Tabs } from "@/components/ui/Tabs";
import { StudentResourceCard } from "@/features/student/components/StudentResourceCard";
import { sortNewestFirst } from "@/features/student/resourceCards";

type TabKey = "open" | "completed";

const TABS: Array<{
  value: TabKey;
  label: string;
  completed: boolean;
  empty: { title: string; description: string };
}> = [
  {
    value: "open",
    label: "Open",
    completed: false,
    empty: { title: "You're all caught up", description: "Resources you haven't completed yet will show here." },
  },
  {
    value: "completed",
    label: "Completed",
    completed: true,
    empty: { title: "No completed resources yet", description: "Resources you finish will show here." },
  },
];

function tabFrom(value: string | null): TabKey {
  return TABS.some((tab) => tab.value === value) ? (value as TabKey) : "open";
}

/**
 * The student portal's Resources page - every published resource of the caller's own class+current term,
 * as one card each (laid out like the Quizzes page), split into Open and Completed tabs. The subject or
 * subject group a resource belongs to is named on its card rather than grouping the page. Newest first;
 * the active tab lives in `?tab=` so coming back from a resource lands on the same tab. The list endpoint
 * returns the whole term at once, so tabs filter client-side.
 */
export function StudentResourcesPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = tabFrom(searchParams.get("tab"));
  const active = TABS.find((item) => item.value === tab) ?? TABS[0];

  const [resources, setResources] = useState<MyLearningResourceSummaryView[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  function load() {
    listMyLearningResources()
      .then((result) => {
        setResources(result);
        setError(null);
      })
      .catch((err: unknown) => setError(err instanceof ApiError ? err.message : "Failed to load your resources"));
  }

  useEffect(load, []);

  function changeTab(next: TabKey) {
    if (next === tab) {
      return;
    }
    setSearchParams(
      (params) => {
        const updated = new URLSearchParams(params);
        updated.set("tab", next);
        return updated;
      },
      { replace: true },
    );
  }

  const shown = resources
    ? sortNewestFirst(resources.filter((resource) => resource.completed === active.completed))
    : [];

  return (
    <div className="space-y-6">
      <PageHeader title="Resources" description="Notes, documents, and videos from your teachers." />

      <div className="max-w-4xl space-y-4">
        <Tabs ariaLabel="Resource status" value={tab} onChange={changeTab} items={TABS} />

        <div role="tabpanel" aria-label={active.label}>
          {error ? (
            <ErrorState message={error} onRetry={load} />
          ) : resources === null ? (
            <div className="flex items-center gap-2 py-6 text-sm text-slate-500">
              <Spinner /> Loading…
            </div>
          ) : shown.length === 0 ? (
            <EmptyState icon={BookOpen} title={active.empty.title} description={active.empty.description} />
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {shown.map((resource) => (
                <StudentResourceCard key={resource.id} resource={resource} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
