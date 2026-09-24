import { useEffect, useState } from "react";
import { ApiError } from "@/api/client";
import { listMyLearningResources, type MyLearningResourceSummaryView } from "@/api/learning";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { PageHeader } from "@/components/ui/PageHeader";
import { Spinner } from "@/components/ui/Spinner";
import { DrillRow } from "@/features/guardian/components/DrillRow";
import { formatInstantDate } from "@/utils/date";
import { formatDuration } from "@/utils/duration";

const TYPE_LABEL: Record<string, string> = {
  PDF: "PDF",
  RICH_TEXT: "Note",
  YOUTUBE: "YouTube",
  AUDIO: "Audio",
  VIDEO: "Video",
};

/**
 * `resource.description`, with the media duration and (Phase 35L) an "Available until ..." hint
 * appended - e.g. "5:00 lecture · 4:32 · Available until 10 Oct 2026". The resource is simply
 * absent from this list once its window has actually closed - this is a heads-up while it's still
 * visible, never a claim this page enforces itself.
 */
function rowMeta(resource: MyLearningResourceSummaryView): string | undefined {
  const parts = [
    resource.description ?? undefined,
    formatDuration(resource.durationSeconds) || undefined,
    resource.availableUntil ? `Available until ${formatInstantDate(resource.availableUntil)}` : undefined,
  ].filter((part): part is string => Boolean(part));
  return parts.length > 0 ? parts.join(" · ") : undefined;
}

interface SubjectGroup {
  subjectName: string;
  resources: MyLearningResourceSummaryView[];
}

function groupBySubject(resources: MyLearningResourceSummaryView[]): SubjectGroup[] {
  const bySubject = new Map<string, SubjectGroup>();
  for (const resource of resources) {
    const existing = bySubject.get(resource.subjectName);
    if (existing) {
      existing.resources.push(resource);
      continue;
    }
    bySubject.set(resource.subjectName, { subjectName: resource.subjectName, resources: [resource] });
  }
  return [...bySubject.values()].sort((a, b) => a.subjectName.localeCompare(b.subjectName));
}

/**
 * The student portal's Resources tab (Phase 35E) - every published resource of the caller's own
 * class+current term, grouped by subject. A flat page like `StudentResultsPage`: one student, no
 * ward selector.
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

  const groups = groupBySubject(resources);

  return (
    <div className="space-y-6">
      <PageHeader title="Resources" description="Notes, documents, and videos from your teachers." />

      {groups.length === 0 && (
        <EmptyState title="No resources yet" description="Your teachers haven't published anything yet." />
      )}

      <div className="space-y-6">
        {groups.map((group) => (
          <div key={group.subjectName} className="space-y-2">
            <p className="text-sm font-medium text-slate-500">{group.subjectName}</p>
            <div className="space-y-2">
              {group.resources.map((resource) => (
                <DrillRow
                  key={resource.id}
                  to={`/student/resources/${resource.id}`}
                  title={resource.title}
                  meta={rowMeta(resource)}
                  trailing={
                    <div className="flex items-center gap-2">
                      {resource.completed && <Badge variant="success">Completed</Badge>}
                      <Badge variant="neutral">{TYPE_LABEL[resource.resourceType] ?? resource.resourceType}</Badge>
                    </div>
                  }
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
