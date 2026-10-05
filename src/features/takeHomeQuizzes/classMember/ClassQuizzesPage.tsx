import { ClipboardCheck } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router";
import { ApiError, getErrorMessage } from "@/api/client";
import {
  type ClassMemberQuizListView,
  type ClassQuizReader,
  getMemberClassQuizReview,
  listMemberClassQuizzes,
} from "@/api/classTakeHomeQuizzes";
import type { MyTakeHomeQuizSummaryView } from "@/api/myTakeHomeQuizzes";
import { listMyOnlineClasses, listWardOnlineClasses } from "@/api/onlineClasses";
import { can } from "@/auth/permissions";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { FormField } from "@/components/ui/FormField";
import { Modal } from "@/components/ui/Modal";
import { PageHeader } from "@/components/ui/PageHeader";
import { Select } from "@/components/ui/Select";
import { Skeleton } from "@/components/ui/Skeleton";
import { DrillRow } from "@/features/guardian/components/DrillRow";
import { ClassQuizImage } from "@/features/takeHomeQuizzes/classMember/ClassQuizImage";
import { QuizResultReveal } from "@/features/takeHomeQuizzes/components/QuizResultReveal";
import { formatInstant } from "@/utils/date";

export type ClassQuizzesAudience = "LEARNER" | "GUARDIAN";

/** One class the viewer can see - for a guardian, one per (followed learner, class). */
interface FollowedClassOption {
  key: string;
  classId: string;
  learnerId?: string;
  label: string;
}

const optionKey = (classId: string, learnerId?: string | null) => `${classId}:${learnerId ?? ""}`;

/** The row's badge - the score once released, else where the quiz and the attempt stand. */
function statusBadge(quiz: MyTakeHomeQuizSummaryView): { variant: "success" | "warning" | "neutral"; label: string } {
  if (quiz.score && quiz.score !== null) {
    return { variant: "success", label: `${quiz.score}/${quiz.totalPoints}` };
  }
  if (quiz.resultsPublished) {
    return { variant: "neutral", label: "Not submitted" };
  }
  if (quiz.attemptState === "SUBMITTED") {
    return { variant: "neutral", label: "Submitted · awaiting results" };
  }
  if (quiz.availability === "CLOSED") {
    return { variant: "warning", label: "Closed" };
  }
  if (quiz.availability === "SCHEDULED") {
    return { variant: "neutral", label: "Not open yet" };
  }
  return { variant: "success", label: quiz.attemptState === "IN_PROGRESS" ? "In progress" : "Open" };
}

/**
 * A learner's or a guardian's quizzes from their tutors' online classes (creators Phase C13). Pick a
 * class (a guardian picks a child's class): a learner opens a quiz to take it in the portal, the
 * `StudentQuizzesPage` rows; a guardian sees only quizzes whose results are out, and opens one to see
 * the child's score and answers. The class and learner live in the URL (`?classId=&learnerId=`), so
 * an online-class card's "Quizzes" link lands straight on the class.
 */
export function ClassQuizzesPage({ audience }: { audience: ClassQuizzesAudience }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const classId = searchParams.get("classId");
  const learnerId = searchParams.get("learnerId") ?? undefined;

  const [options, setOptions] = useState<FollowedClassOption[] | null>(null);
  const [loadedList, setList] = useState<ClassMemberQuizListView | null>(null);
  // Keyed by the option it was answered for, so switching class never shows a stale refusal.
  const [refusal, setRefusal] = useState<{ key: string; message: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reviewing, setReviewing] = useState<MyTakeHomeQuizSummaryView | null>(null);
  const reader: ClassQuizReader | null = useMemo(
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
    listMemberClassQuizzes(reader)
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
          setError(getErrorMessage(err, "We couldn't load this class's quizzes."));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [reader]);

  const loadReview = useCallback(
    () => getMemberClassQuizReview(reader!, reviewing!.id),
    [reader, reviewing],
  );
  const renderReviewImage = useCallback(
    (fileId: string, alt: string) =>
      reader && reviewing ? (
        <ClassQuizImage reader={reader} quizId={reviewing.id} fileId={fileId} alt={alt} size="option" />
      ) : null,
    [reader, reviewing],
  );

  const selectedOption = options?.find((option) => option.key === currentKey);
  const guardian = audience === "GUARDIAN";
  // A guardian reads released results; only the learner opens a quiz to take it.
  const taker = can.takeClassQuizzes(audience);

  return (
    <div className="space-y-6">
      <PageHeader
        title={guardian ? "Class quizzes" : "Quizzes"}
        description={
          guardian
            ? "Results from your children's online class quizzes, once their tutor releases them."
            : "Quizzes your tutors have set for each class."
        }
      />

      {error ? (
        <ErrorState message={error} />
      ) : options === null ? (
        <Skeleton className="h-40" />
      ) : options.length === 0 ? (
        <EmptyState icon={ClipboardCheck} title="No online classes" description="Quizzes from your tutors' classes show up here." />
      ) : (
        <>
          <FormField label="Class" htmlFor="class-quizzes-class">
            <Select
              id="class-quizzes-class"
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
            <EmptyState icon={ClipboardCheck} title="Quizzes aren't available" description={notIncluded} />
          ) : list === null ? (
            <Skeleton className="h-40" />
          ) : list.quizzes.length === 0 ? (
            <EmptyState
              icon={ClipboardCheck}
              title={guardian ? "No results yet" : "No quizzes yet"}
              description={
                guardian
                  ? "Results show up here once the tutor releases them."
                  : "Your tutor hasn't set a quiz for this class yet."
              }
            />
          ) : (
            <div className="space-y-2">
              {list.quizzes.map((quiz) => {
                const badge = statusBadge(quiz);
                const meta = `${list.className} · Closes ${formatInstant(quiz.closesAt)}`;
                const trailing = <Badge variant={badge.variant}>{badge.label}</Badge>;
                if (!taker) {
                  const reviewable = quiz.attemptState === "SUBMITTED";
                  return reviewable ? (
                    <button
                      key={quiz.id}
                      type="button"
                      onClick={() => setReviewing(quiz)}
                      className="flex w-full items-center justify-between gap-3 rounded-card border border-slate-200 bg-white px-4 py-3 text-left hover:bg-slate-50"
                    >
                      <span>
                        <span className="block text-sm font-medium text-slate-900">{quiz.title}</span>
                        <span className="block text-xs text-slate-500">{meta}</span>
                      </span>
                      {trailing}
                    </button>
                  ) : (
                    <DrillRow key={quiz.id} title={quiz.title} trailing={trailing} disabled disabledReason={meta} />
                  );
                }
                const awaitingResults = quiz.attemptState === "SUBMITTED" && quiz.score === null;
                return (
                  <DrillRow
                    key={quiz.id}
                    to={`/learner/quizzes/${list.classId}/${quiz.id}`}
                    title={quiz.title}
                    meta={meta}
                    trailing={trailing}
                    disabled={awaitingResults}
                    disabledReason="Submitted · Your result appears once your tutor releases it"
                  />
                );
              })}
            </div>
          )}
        </>
      )}

      {reviewing && reader && (
        <Modal open onClose={() => setReviewing(null)} title={reviewing.title} size="xl">
          <QuizResultReveal load={loadReview} renderImage={renderReviewImage} />
        </Modal>
      )}
    </div>
  );
}
