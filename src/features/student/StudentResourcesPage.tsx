import { BookOpen, ChevronRight, Layers } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router";
import { ApiError } from "@/api/client";
import { listMyLearningResources, type MyLearningResourceSummaryView } from "@/api/learning";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { PageHeader } from "@/components/ui/PageHeader";
import { Spinner } from "@/components/ui/Spinner";
import { ResourceNewPill } from "@/features/student/components/ResourceNewPill";
import { cardPath, groupByCard, type ResourceCard } from "@/features/student/resourceCards";

function plural(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

function cardSummary(card: ResourceCard): string {
  const progress = card.notCompleted === 0 ? "All completed" : `${card.notCompleted} not completed`;
  return `${plural(card.resources.length, "resource")} · ${progress}`;
}

function ResourceCardTile({ card }: { card: ResourceCard }) {
  const Icon = card.kind === "GROUP" ? Layers : BookOpen;
  return (
    <Link to={cardPath(card.kind, card.id)} className="block h-full">
      <Card className="flex h-full cursor-pointer items-start gap-3 p-4 transition-colors hover:border-brand-200 hover:bg-brand-50/40 sm:p-4">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-control bg-brand-50 text-brand-700">
          <Icon className="h-5 w-5" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="font-display text-base font-medium text-slate-900">{card.name}</p>
            {card.unopened > 0 && <ResourceNewPill label={`${card.unopened}`} />}
          </div>
          <p className="mt-0.5 text-sm text-slate-500">{cardSummary(card)}</p>
        </div>
        <ChevronRight className="mt-2.5 h-5 w-5 shrink-0 text-slate-400" aria-hidden="true" />
      </Card>
    </Link>
  );
}

/**
 * The student portal's Resources tab (Phase 35E) - every published resource of the caller's own
 * class+current term, as one card per subject (or per subject group, which its subjects roll up
 * into - decided server-side), the card with the most recently visible resource first. Each card
 * shows how many resources it holds, how many aren't completed, and a "new" pill for those never
 * opened; tapping one opens `StudentResourceCardPage`.
 */
export function StudentResourcesPage() {
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

  if (error) {
    return (
      <div className="space-y-6">
        <PageHeader title="Resources" />
        <ErrorState message={error} onRetry={load} />
      </div>
    );
  }

  if (resources === null) {
    return (
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <Spinner /> Loading…
      </div>
    );
  }

  const cards = groupByCard(resources);

  return (
    <div className="space-y-6">
      <PageHeader title="Resources" description="Notes, documents, and videos from your teachers." />

      {cards.length === 0 ? (
        <EmptyState title="No resources yet" description="Your teachers haven't published anything yet." />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {cards.map((card) => (
            <ResourceCardTile key={`${card.kind}:${card.id}`} card={card} />
          ))}
        </div>
      )}
    </div>
  );
}
