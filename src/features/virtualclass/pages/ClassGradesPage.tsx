import { useEffect, useState } from "react";
import { useParams } from "react-router";
import { type ClassGradebook, getClassGradebook } from "@/api/classTopics";
import { getErrorMessage } from "@/api/client";
import { type VirtualClass, getVirtualClass } from "@/api/virtualClasses";
import { Alert } from "@/components/ui/Alert";
import { PageHeader } from "@/components/ui/PageHeader";
import { Spinner } from "@/components/ui/Spinner";
import { ClassGradesGrid } from "../components/ClassGradesGrid";

/**
 * One class's broadsheet, opened from its topics or its action menu: the tutor grades every
 * enrolled learner on every topic in one grid and saves it all at once. An archived or over-limit
 * class is read-only.
 */
export function ClassGradesPage() {
  const { classId = "" } = useParams();
  const [virtualClass, setVirtualClass] = useState<VirtualClass | null>(null);
  const [gradebook, setGradebook] = useState<ClassGradebook | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([getVirtualClass(classId), getClassGradebook(classId)])
      .then(([loadedClass, loadedGradebook]) => {
        setVirtualClass(loadedClass);
        setGradebook(loadedGradebook);
      })
      .catch((err: unknown) => setLoadError(getErrorMessage(err, "Failed to load this class's grades.")));
  }, [classId]);

  const backTo = `/tutor/classes/${classId}/topics`;
  if (loadError) {
    return (
      <div className="space-y-6">
        <PageHeader title="Grades" backTo={backTo} backLabel="Back to topics" />
        <Alert variant="error">{loadError}</Alert>
      </div>
    );
  }
  if (!virtualClass || !gradebook) {
    return (
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <Spinner /> Loading grades…
      </div>
    );
  }

  const archived = virtualClass.status === "ARCHIVED";
  const writable = !archived && !virtualClass.overLimit;
  return (
    <div className="space-y-6">
      <PageHeader title="Grades" description={virtualClass.name} backTo={backTo} backLabel="Back to topics" />
      {writable ? (
        <p className="text-sm text-slate-500">
          A grade can be anything - a letter, a score or a word. Learners and their guardians see a topic's grades
          once you publish it.
        </p>
      ) : (
        <Alert variant="info">
          {archived
            ? "This class is archived, so its grades are read-only."
            : "This class is over your plan's class limit, so its grades are read-only."}
        </Alert>
      )}
      <ClassGradesGrid classId={virtualClass.id} gradebook={gradebook} writable={writable} onChange={setGradebook} />
    </div>
  );
}
