import type { MyClassTopics } from "@/api/classTopics";
import { Badge } from "@/components/ui/Badge";
import { ErrorState } from "@/components/ui/ErrorState";
import { Modal } from "@/components/ui/Modal";
import { Skeleton } from "@/components/ui/Skeleton";
import { useLoaded } from "./useLoaded";

/**
 * A class's topics as a learner or guardian sees them - every topic the class covers, with the
 * learner's grade and the tutor's comment once the tutor has published that topic's grades. `load`
 * picks the endpoint for the viewer.
 */
export function ClassTopicsModal({
  title,
  load,
  onClose,
}: {
  title: string;
  load: () => Promise<MyClassTopics>;
  onClose: () => void;
}) {
  const { data, error, retry } = useLoaded<MyClassTopics>(load, "We couldn't load this class's topics.");
  return (
    <Modal open onClose={onClose} title={title} size="xl" fullScreenOnMobile>
      {error && <ErrorState message={error} onRetry={retry} />}
      {!error && !data && <Skeleton className="h-40" />}
      {data &&
        (data.topics.length === 0 ? (
          <p className="text-sm text-slate-500">Your tutor hasn't added any topics to this class yet.</p>
        ) : (
          <ol className="divide-y divide-slate-100">
            {data.topics.map((topic, index) => (
              <li key={topic.id} className="flex gap-3 py-3">
                <span className="w-6 shrink-0 text-sm text-slate-400">{index + 1}.</span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-medium text-slate-900">{topic.title}</p>
                    {topic.grade ? (
                      <Badge variant="brand">{topic.grade}</Badge>
                    ) : (
                      <span className="text-xs text-slate-500">Not graded yet</span>
                    )}
                  </div>
                  {topic.description && (
                    <p className="mt-0.5 text-sm whitespace-pre-line text-slate-500">{topic.description}</p>
                  )}
                  {topic.comment && (
                    <p className="mt-2 rounded-control bg-slate-50 px-3 py-2 text-sm whitespace-pre-line text-slate-700">
                      {topic.comment}
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ol>
        ))}
    </Modal>
  );
}
