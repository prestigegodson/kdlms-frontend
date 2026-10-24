import { useEffect, useState } from "react";
import { ChevronRight, CircleCheck, Library } from "lucide-react";
import { Link } from "react-router";
import { ApiError } from "@/api/client";
import type { MyLearningResourceSummaryView } from "@/api/learning";
import { listWardLearningResources } from "@/api/wards";
import { Accordion } from "@/components/ui/Accordion";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { PageHeader } from "@/components/ui/PageHeader";
import { Spinner } from "@/components/ui/Spinner";
import { StickySubHeader } from "@/components/ui/StickySubHeader";
import { WardSelector } from "@/features/guardian/components/WardSelector";
import { ResourceTypeIcon } from "@/features/student/ResourceTypeIcon";
import { groupByCard, resourceRowMeta } from "@/features/student/resourceCards";
import { useWardStore } from "@/stores/wardStore";

/**
 * A ward's learning resources - exactly what the ward sees on the student portal's Resources page
 * (their class, the current term, their applicable subjects), read-only, with the ward's own
 * done/opened flags so a parent can see what's been looked at. Shown whether or not the ward has a
 * login. `WardLessonNotesPage`'s flat shape - `WardSelector` docked in a `StickySubHeader`, one
 * `Accordion` per card - minus the term picker, since resources are current-term only. The cards
 * come from the student page's own `groupByCard`, so a subject group rolls up identically.
 */
export function WardResourcesPage() {
  const {
    wards,
    selectedWardId,
    status,
    errorMessage: wardsError,
    fetchIfNeeded,
    retry,
  } = useWardStore();

  useEffect(() => {
    fetchIfNeeded();
  }, [fetchIfNeeded]);

  const [resources, setResources] = useState<MyLearningResourceSummaryView[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  // A ward change resets the stale list during render (the WardLessonNotesPage pattern); the effect only fetches.
  const selectionKey = selectedWardId ?? "";
  const [lastSelectionKey, setLastSelectionKey] = useState(selectionKey);
  if (selectionKey !== lastSelectionKey) {
    setLastSelectionKey(selectionKey);
    setResources(null);
    setError(null);
  }

  const [reloadCount, setReloadCount] = useState(0);
  useEffect(() => {
    if (!selectedWardId) return;
    listWardLearningResources(selectedWardId)
      .then(setResources)
      .catch((err: unknown) =>
        setError(err instanceof ApiError ? err.message : "Failed to load this ward's resources"),
      );
  }, [selectedWardId, reloadCount]);

  function reload() {
    setResources(null);
    setError(null);
    setReloadCount((count) => count + 1);
  }

  const hasWards = status === "loaded" && wards.length > 0;
  const cards = resources ? groupByCard(resources) : [];

  return (
    <div className="space-y-6">
      <PageHeader title="Resources" description="Notes, documents, and videos your ward's teachers have shared." />

      {(status === "idle" || status === "loading") && (
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Spinner /> Loading…
        </div>
      )}
      {status === "error" && <ErrorState message={wardsError ?? "Failed to load your wards"} onRetry={retry} />}
      {status === "loaded" && wards.length === 0 && (
        <EmptyState title="No wards linked yet" description="Contact your school if you believe this is a mistake." />
      )}

      {hasWards && (
        <StickySubHeader>
          <WardSelector />
        </StickySubHeader>
      )}

      {hasWards && error && <ErrorState message={error} onRetry={reload} />}

      {hasWards && !error && resources === null && (
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Spinner /> Loading resources…
        </div>
      )}

      {hasWards && resources && cards.length === 0 && (
        <EmptyState
          icon={Library}
          title="No resources yet"
          description="Your ward's teachers haven't published anything for this term yet."
        />
      )}

      {hasWards && selectedWardId && cards.length > 0 && (
        <div className="space-y-3">
          {cards.map((card, index) => (
            <Accordion
              key={`${card.kind}:${card.id}`}
              title={card.name}
              subtitle={`${card.resources.length} resource${card.resources.length === 1 ? "" : "s"}`}
              defaultOpen={index === 0}
            >
              <ul className="divide-y divide-slate-100">
                {card.resources.map((resource) => {
                  const meta = resourceRowMeta(resource);
                  return (
                    <li key={resource.id}>
                      <Link
                        to={`/guardian/resources/${selectedWardId}/${resource.id}`}
                        className="flex w-full items-center justify-between gap-3 py-3 text-left mobile:min-h-11"
                      >
                        <span className="flex min-w-0 items-center gap-3">
                          <ResourceTypeIcon type={resource.resourceType} />
                          <span className="min-w-0">
                            <span className="flex items-center gap-1.5 text-sm text-slate-900">
                              {resource.completed && (
                                <>
                                  <CircleCheck className="h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true" />
                                  <span className="sr-only">Done</span>
                                </>
                              )}
                              <span className="min-w-0">{resource.title}</span>
                            </span>
                            {meta && <span className="block text-xs text-slate-500">{meta}</span>}
                          </span>
                        </span>
                        <span className="flex shrink-0 items-center gap-2">
                          {!resource.completed && !resource.opened && <Badge variant="warning">Not opened</Badge>}
                          <ChevronRight className="h-4 w-4 text-slate-400" aria-hidden="true" />
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </Accordion>
          ))}
        </div>
      )}
    </div>
  );
}
