import { BookOpen } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router";
import { ApiError, getErrorMessage } from "@/api/client";
import {
  type ClassMemberResourceListView,
  type ClassResourceReader,
  listMemberClassResources,
} from "@/api/classLearningResources";
import { listMyOnlineClasses, listWardOnlineClasses } from "@/api/onlineClasses";
import { can } from "@/auth/permissions";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { FormField } from "@/components/ui/FormField";
import { PageHeader } from "@/components/ui/PageHeader";
import { Select } from "@/components/ui/Select";
import { Skeleton } from "@/components/ui/Skeleton";
import { DrillRow } from "@/features/guardian/components/DrillRow";
import { formatInstant } from "@/utils/date";
import { formatDuration } from "@/utils/duration";

export type ClassResourcesAudience = "LEARNER" | "GUARDIAN";

/** One class the viewer can see - for a guardian, one per (followed learner, class). */
interface FollowedClassOption {
  key: string;
  classId: string;
  learnerId?: string;
  label: string;
}

const optionKey = (classId: string, learnerId?: string | null) => `${classId}:${learnerId ?? ""}`;

const TYPE_LABEL: Record<string, string> = {
  PDF: "PDF",
  RICH_TEXT: "Notes",
  YOUTUBE: "YouTube",
  AUDIO: "Audio",
  VIDEO: "Video",
};

/** Where a resource row opens - the learner's own detail page, or the guardian's for that child. */
function classResourceHref(audience: ClassResourcesAudience, reader: ClassResourceReader, resourceId: string) {
  return audience === "GUARDIAN"
    ? `/guardian/class-resources/${reader.learnerId}/${reader.classId}/${resourceId}`
    : `/learner/resources/${reader.classId}/${resourceId}`;
}

/**
 * A learner's or a guardian's learning resources from their tutors' online classes (creators Phase
 * C14). Pick a class (a guardian picks a child's class) and open a resource to read, watch or listen
 * to it. A learner's rows show whether they've marked it done; a guardian only reads. The class and
 * learner live in the URL (`?classId=&learnerId=`), so an online-class card's "Resources" link lands
 * straight on the class - the `ClassQuizzesPage` shape.
 */
export function ClassResourcesPage({ audience }: { audience: ClassResourcesAudience }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const classId = searchParams.get("classId");
  const learnerId = searchParams.get("learnerId") ?? undefined;

  const [options, setOptions] = useState<FollowedClassOption[] | null>(null);
  const [loadedList, setList] = useState<ClassMemberResourceListView | null>(null);
  // Keyed by the option it was answered for, so switching class never shows a stale refusal.
  const [refusal, setRefusal] = useState<{ key: string; message: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const reader: ClassResourceReader | null = useMemo(
    () => (classId ? { classId, learnerId: audience === "GUARDIAN" ? learnerId : undefined } : null),
    [audience, classId, learnerId],
  );
  const list = loadedList?.classId === classId ? loadedList : null;
  const currentKey = optionKey(classId ?? "", learnerId);
  const notIncluded = refusal?.key === currentKey ? refusal.message : null;

  useEffect(() => {
    const load: Promise<FollowedClassOption[]> =
      audience === "GUARDIAN"
        ? listWardOnlineClasses().then((learners) =>
            learners.flatMap((learner) =>
              learner.classes.map((virtualClass) => ({
                key: optionKey(virtualClass.id, learner.learnerId),
                classId: virtualClass.id,
                learnerId: learner.learnerId,
                label: `${learner.firstName} - ${virtualClass.name}`,
              })),
            ),
          )
        : listMyOnlineClasses().then((classes) =>
            classes.map((virtualClass) => ({
              key: optionKey(virtualClass.id),
              classId: virtualClass.id,
              label: virtualClass.creatorName ? `${virtualClass.name} · ${virtualClass.creatorName}` : virtualClass.name,
            })),
          );
    load.then(setOptions).catch((err: unknown) => setError(getErrorMessage(err, "We couldn't load your classes.")));
  }, [audience]);

  // Land on the first class when none is chosen yet.
  useEffect(() => {
    if (!classId && options && options.length > 0) {
      const first = options[0];
      setSearchParams(first.learnerId ? { classId: first.classId, learnerId: first.learnerId } : { classId: first.classId }, {
        replace: true,
      });
    }
  }, [classId, options, setSearchParams]);

  useEffect(() => {
    if (!reader) {
      return;
    }
    let cancelled = false;
    const key = optionKey(reader.classId, reader.learnerId);
    listMemberClassResources(reader)
      .then((loaded) => {
        if (!cancelled) {
          setList(loaded);
          setError(null);
        }
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 403) {
          setRefusal({ key, message: err.message });
        } else {
          setError(getErrorMessage(err, "We couldn't load this class's resources."));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [reader]);

  const selectedOption = options?.find((option) => option.key === currentKey);
  const guardian = audience === "GUARDIAN";
  const tracksProgress = can.trackClassResources(audience);

  return (
    <div className="space-y-6">
      <PageHeader
        title={guardian ? "Class resources" : "Resources"}
        description={
          guardian
            ? "Notes, documents and videos your children's tutors have shared with their online classes."
            : "Notes, documents and videos your tutors have shared with each class."
        }
      />

      {error ? (
        <ErrorState message={error} />
      ) : options === null ? (
        <Skeleton className="h-40" />
      ) : options.length === 0 ? (
        <EmptyState icon={BookOpen} title="No online classes" description="Resources from your tutors' classes show up here." />
      ) : (
        <>
          <FormField label="Class" htmlFor="class-resources-class">
            <Select
              id="class-resources-class"
              value={selectedOption?.key ?? ""}
              onChange={(event) => {
                const option = options.find((candidate) => candidate.key === event.target.value);
                if (option) {
                  setSearchParams(
                    option.learnerId ? { classId: option.classId, learnerId: option.learnerId } : { classId: option.classId },
                  );
                }
              }}
            >
              {options.map((option) => (
                <option key={option.key} value={option.key}>
                  {option.label}
                </option>
              ))}
            </Select>
          </FormField>

          {notIncluded ? (
            <EmptyState icon={BookOpen} title="Resources aren't available" description={notIncluded} />
          ) : list === null || reader === null ? (
            <Skeleton className="h-40" />
          ) : list.resources.length === 0 ? (
            <EmptyState
              icon={BookOpen}
              title="No resources yet"
              description="Resources show up here once the tutor shares them with this class."
            />
          ) : (
            <div className="space-y-2">
              {list.resources.map((resource) => {
                const meta = [
                  TYPE_LABEL[resource.resourceType] ?? resource.resourceType,
                  formatDuration(resource.durationSeconds),
                  resource.availableUntil ? `Available until ${formatInstant(resource.availableUntil)}` : null,
                ]
                  .filter(Boolean)
                  .join(" · ");
                return (
                  <DrillRow
                    key={resource.id}
                    to={classResourceHref(audience, reader, resource.id)}
                    title={resource.title}
                    meta={meta}
                    trailing={
                      tracksProgress && resource.completed ? <Badge variant="success">Done</Badge> : undefined
                    }
                  />
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
