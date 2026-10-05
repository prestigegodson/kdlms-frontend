import { Presentation } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { getErrorMessage } from "@/api/client";
import { type LearnerOnlineClasses, listWardOnlineClasses, setWardClassReminders } from "@/api/onlineClasses";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { PageHeader } from "@/components/ui/PageHeader";
import { Skeleton } from "@/components/ui/Skeleton";
import { getWardClassAttendance } from "@/api/liveSessions";
import { OnlineClassCard } from "@/features/virtualclass/components/OnlineClassCard";

/**
 * The guardian portal's Online classes page (creators.md Phase C5): the classes each learner the
 * guardian follows is enrolled in with education creators - separate from their school wards. A
 * creator's classes appear only while that creator's plan includes guardian access.
 */
export function OnlineClassesPage() {
  const [learners, setLearners] = useState<LearnerOnlineClasses[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    listWardOnlineClasses()
      .then((loaded) => {
        setLearners(loaded);
        setError(null);
      })
      .catch((err: unknown) => setError(getErrorMessage(err, "We couldn't load online classes.")));
  }, []);

  useEffect(load, [load]);

  return (
    <div className="space-y-6">
      <PageHeader title="Online classes" description="Classes your children take with online tutors." />
      {error ? (
        <ErrorState message={error} onRetry={load} />
      ) : learners === null ? (
        <Skeleton className="h-40" />
      ) : learners.length === 0 ? (
        <EmptyState
          icon={Presentation}
          title="No online classes"
          description="When a tutor enrolls your child in an online class, it shows up here."
        />
      ) : (
        learners.map((learner) => (
          <section key={learner.learnerId} className="space-y-3" aria-label={`${learner.firstName}'s classes`}>
            <h2 className="font-display text-lg font-medium text-slate-900">
              {learner.firstName} {learner.lastName}
            </h2>
            {learner.classes.length === 0 ? (
              <p className="text-sm text-slate-500">Not enrolled in a class yet.</p>
            ) : (
              <div className="grid gap-4 lg:grid-cols-2">
                {learner.classes.map((onlineClass) => (
                  <OnlineClassCard
                    key={onlineClass.id}
                    onlineClass={onlineClass}
                    joinLabel="Watch"
                    loadAttendance={() => getWardClassAttendance(learner.learnerId, onlineClass.id)}
                    saveReminders={(enabled) => setWardClassReminders(onlineClass.id, enabled)}
                  />
                ))}
              </div>
            )}
          </section>
        ))
      )}
    </div>
  );
}
