import { Presentation } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { getErrorMessage } from "@/api/client";
import { listMyOnlineClasses, type OnlineClass, setMyClassReminders } from "@/api/onlineClasses";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { PageHeader } from "@/components/ui/PageHeader";
import { Skeleton } from "@/components/ui/Skeleton";
import { getMyClassAttendance } from "@/api/liveSessions";
import { OnlineClassCard } from "@/features/virtualclass/components/OnlineClassCard";
import { UpcomingSessionsPanel } from "@/features/virtualclass/components/UpcomingSessionsPanel";
import { loadLearnerUpcoming } from "@/features/virtualclass/upcomingSessions";

/**
 * The learner portal's home (creators.md Phase C5): the learner's next sessions (Phase C7), then
 * every class they're enrolled in, across creators, each with its reminder-email toggle.
 */
export function MyClassesPage() {
  const [classes, setClasses] = useState<OnlineClass[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    listMyOnlineClasses()
      .then((loaded) => {
        setClasses(loaded);
        setError(null);
      })
      .catch((err: unknown) => setError(getErrorMessage(err, "We couldn't load your classes.")));
  }, []);

  useEffect(load, [load]);

  return (
    <div className="space-y-6">
      <PageHeader title="My classes" description="Your online classes and their upcoming sessions." />
      <UpcomingSessionsPanel load={loadLearnerUpcoming} joinLabel={() => "Join"} />
      {error ? (
        <ErrorState message={error} onRetry={load} />
      ) : classes === null ? (
        <Skeleton className="h-40" />
      ) : classes.length === 0 ? (
        <EmptyState
          icon={Presentation}
          title="No classes yet"
          description="When a tutor enrolls you in a class, it shows up here."
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {classes.map((onlineClass) => (
            <OnlineClassCard
              key={onlineClass.id}
              onlineClass={onlineClass}
              loadAttendance={() => getMyClassAttendance(onlineClass.id)}
              saveReminders={(enabled) => setMyClassReminders(onlineClass.id, enabled)}
              lessonNotesHref={`/learner/lesson-notes?classId=${onlineClass.id}`}
              quizzesHref={`/learner/quizzes?classId=${onlineClass.id}`}
              resourcesHref={`/learner/resources?classId=${onlineClass.id}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
