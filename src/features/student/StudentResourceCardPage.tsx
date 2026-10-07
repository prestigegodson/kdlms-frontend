import { useEffect, useState } from "react";
import { Link, useParams } from "react-router";
import { ApiError } from "@/api/client";
import { listMyLearningResources, type MyLearningResourceSummaryView, type MyResourceCardKind } from "@/api/learning";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { PageHeader } from "@/components/ui/PageHeader";
import { Spinner } from "@/components/ui/Spinner";
import { DrillRow } from "@/features/guardian/components/DrillRow";
import { ResourceNewPill } from "@/features/student/components/ResourceNewPill";
import { RESOURCE_TYPE_LABEL, resourceRowMeta, resourcesOnCard } from "@/features/student/resourceCards";

const RESOURCES_PATH = "/student/resources";

/**
 * One card of the student Resources page opened up - the resources of one subject, or of a
 * subject group (its own and its subjects'), in the teacher's own order. The two routes
 * (`resources/subject/:cardId`, `resources/group/:cardId`) differ only in `kind`. Filters the
 * same list endpoint the cards page reads, so the server stays the one place the roll-up rule
 * lives.
 */
export function StudentResourceCardPage({ kind }: { kind: MyResourceCardKind }) {
  const { cardId } = useParams<{ cardId: string }>();
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
        <PageHeader title="Resources" backTo={RESOURCES_PATH} />
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

  const onCard = cardId ? resourcesOnCard(resources, kind, cardId) : [];
  const title = onCard[0]?.cardName ?? onCard[0]?.subjectName ?? "Resources";

  return (
    <div className="space-y-6">
      <Link to={RESOURCES_PATH} className="hidden text-sm font-medium text-brand-700 hover:text-brand-800 lg:inline-block">
        ← All resources
      </Link>
      <PageHeader title={title} backTo={RESOURCES_PATH} />

      {onCard.length === 0 ? (
        <EmptyState title="Nothing here" description="There are no resources for this subject right now." />
      ) : (
        <div className="space-y-2">
          {onCard.map((resource) => (
            <DrillRow
              key={resource.id}
              to={`${RESOURCES_PATH}/${resource.id}`}
              title={resource.title}
              meta={resourceRowMeta(resource)}
              trailing={
                <div className="flex items-center gap-2">
                  {!resource.opened && <ResourceNewPill label="New" />}
                  {resource.completed && <Badge variant="success">Completed</Badge>}
                  <Badge variant="neutral">
                    {RESOURCE_TYPE_LABEL[resource.resourceType] ?? resource.resourceType}
                  </Badge>
                </div>
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}
