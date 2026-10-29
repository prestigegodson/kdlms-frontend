import { useEffect, useState } from "react";
import { useParams } from "react-router";
import { getErrorMessage } from "@/api/client";
import { type VirtualClass, getVirtualClass } from "@/api/virtualClasses";
import { Alert } from "@/components/ui/Alert";
import { PageHeader } from "@/components/ui/PageHeader";
import { Spinner } from "@/components/ui/Spinner";
import { ClassTopicsCard } from "../components/ClassTopicsCard";

/**
 * One class's topics, opened from the class's action menu: the tutor adds, orders and edits the
 * topics here, and each topic opens its gradebook. An archived or over-limit class is read-only.
 */
export function ClassTopicsPage() {
  const { classId = "" } = useParams();
  const [virtualClass, setVirtualClass] = useState<VirtualClass | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    getVirtualClass(classId)
      .then(setVirtualClass)
      .catch((err: unknown) => setLoadError(getErrorMessage(err, "Failed to load this class.")));
  }, [classId]);

  const backTo = `/tutor/classes/${classId}`;
  if (loadError) {
    return (
      <div className="space-y-6">
        <PageHeader title="Topics" backTo={backTo} backLabel="Back to class" />
        <Alert variant="error">{loadError}</Alert>
      </div>
    );
  }
  if (!virtualClass) {
    return (
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <Spinner /> Loading topics…
      </div>
    );
  }

  const archived = virtualClass.status === "ARCHIVED";
  const writable = !archived && !virtualClass.overLimit;
  return (
    <div className="space-y-6">
      <PageHeader title="Topics" description={virtualClass.name} backTo={backTo} backLabel="Back to class" />
      {!writable && (
        <Alert variant="info">
          {archived
            ? "This class is archived, so its topics and grades are read-only."
            : "This class is over your plan's class limit, so its topics and grades are read-only."}
        </Alert>
      )}
      <ClassTopicsCard classId={virtualClass.id} writable={writable} />
    </div>
  );
}
