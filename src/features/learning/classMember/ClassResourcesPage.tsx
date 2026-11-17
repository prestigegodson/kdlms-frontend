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
import { loadAcrossClasses } from "@/features/learner/loadAcrossClasses";
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
  INTERACTIVE_VIDEO: "Interactive video",
};

/** Where a resource row opens - the learner's own detail page, or the guardian's for that child. */
function classResourceHref(audience: ClassResourcesAudience, classId: string, learnerId: string | undefined, resourceId: string) {
  return audience === "GUARDIAN"
    ? `/guardian/class-resources/${learnerId}/${classId}/${resourceId}`
    : `/learner/resources/${classId}/${resourceId}`;
}

/**
 * A learner's or a guardian's learning resources from their tutors' online classes (creators Phase
 * C14). Pick a class (a guardian picks a child's class) and open a resource to read, watch or listen
 * to it. A learner's rows show whether they've marked it done; a guardian only reads. The class and
 * learner live in the URL (`?classId=&learnerId=`), so an online-class card's "Resources" link lands
 * straight on the class - the `ClassQuizzesPage` shape. A learner with no class chosen sees "All
 * classes": every class's resources together; a guardian lands on their first (child, class).
 */
export function ClassResourcesPage({ audience }: { audience: ClassResourcesAudience }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const classId = searchParams.get("classId");
  const learnerId = searchParams.get("learnerId") ?? undefined;

  const [options, setOptions] = useState<FollowedClassOption[] | null>(null);
  const [loadedList, setList] = useState<ClassMemberResourceListView | null>(null);
  const [allLists, setAllLists] = useState<ClassMemberResourceListView[] | null>(null);
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
  const allClasses = audience === "LEARNER" && !classId;

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

  // A guardian lands on the first (child, class) when none is chosen yet; a learner stays on "All classes".
  useEffect(() => {
    if (audience === "GUARDIAN" && !classId && options && options.length > 0) {
      const first = options[0];
      setSearchParams(first.learnerId ? { classId: first.classId, learnerId: first.learnerId } : { classId: first.classId }, {
        replace: true,
      });
    }
  }, [audience, classId, options, setSearchParams]);

  useEffect(() => {
    if (!allClasses || !options) {
      return;
    }
    let cancelled = false;
    loadAcrossClasses(
      options.map((option) => option.classId),
      (id) => listMemberClassResources({ classId: id }),
    )
      .then((loaded) => {
        if (!cancelled) {
          setAllLists(loaded);
          setError(null);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(getErrorMessage(err, "We couldn't load your resources."));
      });
    return () => {
      cancelled = true;
    };
  }, [allClasses, options]);

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
  // The lists on screen - every class's in "All classes", else just the chosen class's.
  const shownLists = allClasses ? allLists : list ? [list] : null;
  const rows =
    shownLists?.flatMap((shown) => shown.resources.map((resource) => ({ resource, list: shown }))) ?? null;

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
          <FormField label="Class" htmlFor="class-resources-class" className="w-full sm:w-72">
            <Select
              id="class-resources-class"
              value={allClasses ? "" : (selectedOption?.key ?? "")}
              onChange={(event) => {
                if (event.target.value === "") {
                  setSearchParams({});
                  return;
                }
                const option = options.find((candidate) => candidate.key === event.target.value);
                if (option) {
                  setSearchParams(
                    option.learnerId ? { classId: option.classId, learnerId: option.learnerId } : { classId: option.classId },
                  );
                }
              }}
            >
              {!guardian && <option value="">All classes</option>}
              {options.map((option) => (
                <option key={option.key} value={option.key}>
                  {option.label}
                </option>
              ))}
            </Select>
          </FormField>

          {!allClasses && notIncluded ? (
            <EmptyState icon={BookOpen} title="Resources aren't available" description={notIncluded} />
          ) : rows === null ? (
            <Skeleton className="h-40" />
          ) : rows.length === 0 ? (
            <EmptyState
              icon={BookOpen}
              title="No resources yet"
              description={
                allClasses
                  ? "Resources show up here once your tutors share them with your classes."
                  : "Resources show up here once the tutor shares them with this class."
              }
            />
          ) : (
            <div className="space-y-2">
              {rows.map(({ resource, list: owner }) => {
                const meta = [
                  allClasses ? owner.className : null,
                  TYPE_LABEL[resource.resourceType] ?? resource.resourceType,
                  formatDuration(resource.durationSeconds),
                  resource.availableUntil ? `Available until ${formatInstant(resource.availableUntil)}` : null,
                ]
                  .filter(Boolean)
                  .join(" · ");
                return (
                  <DrillRow
                    key={`${owner.classId}:${resource.id}`}
                    to={classResourceHref(audience, owner.classId, reader?.learnerId, resource.id)}
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
