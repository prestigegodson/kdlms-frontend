import { LinkIcon } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router";
import {
  getTakeHomeQuizReview,
  publicQuestionImageUrl,
  resolveTakeHomeQuiz,
  saveTakeHomeQuizAnswers,
  startTakeHomeQuiz,
  submitTakeHomeQuiz,
  type QuizAttemptView,
  type QuizInterstitialView,
} from "@/api/publicTakeHomeQuiz";
import { ApiError, GENERIC_ERROR_MESSAGE, getErrorMessage } from "@/api/client";
import { Alert } from "@/components/ui/Alert";
import { EmptyState } from "@/components/ui/EmptyState";
import { Spinner } from "@/components/ui/Spinner";
import { QuizResultReveal } from "@/features/takeHomeQuizzes/components/QuizResultReveal";
import { QuizInterstitial } from "@/features/takeHomeQuizzes/public/components/QuizInterstitial";
import { SubmitConfirmation } from "@/features/takeHomeQuizzes/public/components/SubmitConfirmation";
import { QuizRunner } from "@/features/takeHomeQuizzes/runner/QuizRunner";
import { QUIZ_IMAGE_SIZE_CLASS } from "@/features/takeHomeQuizzes/runner/quizImageSizes";
import type { QuizTransport } from "@/features/takeHomeQuizzes/runner/quizTransport";

type Status =
  | { kind: "loading" }
  | { kind: "invalid" }
  | { kind: "interstitial"; data: QuizInterstitialView }
  | { kind: "inProgress"; attempt: QuizAttemptView }
  | { kind: "submitted"; revealResults: boolean }
  | { kind: "error"; message: string };

/**
 * The unauthenticated take-home quiz page (Phase 20D) - see `quiz-module.md`'s
 * "Phase 20D — Taking and submitting". Follows `ResetPasswordPage`'s
 * precedent for a token-in-querystring public page: the token comes solely
 * from `?token=`, and a missing one renders an invalid-link state rather
 * than a form. Every API call passes `authenticated: false`
 * (`api/publicTakeHomeQuiz.ts`), so a signed-in teacher opening this link
 * gets the identical anonymous page everyone else does.
 * <p>
 * Phase 35I: the in-progress state machine (timer, autosave, buffer, submit) now lives in the
 * shared `QuizRunner`, reused by the authenticated portal's `StudentQuizPage` - this page keeps
 * only what's specific to the token entry point: resolving/starting by token, the interstitial,
 * and the invalid/error/submitted chrome.
 */
export function TakeHomeQuizPublicPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const [status, setStatus] = useState<Status>(() => (token ? { kind: "loading" } : { kind: "invalid" }));
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    // No token to resolve - `status` was already initialized to "invalid" above, matching
    // ResetPasswordPage's precedent of checking this once, in render, rather than via an effect.
    if (!token) {
      return;
    }
    let cancelled = false;
    resolveTakeHomeQuiz(token)
      .then((data) => {
        if (cancelled) return;
        if (data.attemptState === "SUBMITTED") {
          setStatus({ kind: "submitted", revealResults: data.revealResults });
        } else {
          setStatus({ kind: "interstitial", data });
        }
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setStatus(errorStatus(error));
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  function handleStart() {
    setStarting(true);
    startTakeHomeQuiz(token)
      .then((attempt) => setStatus({ kind: "inProgress", attempt }))
      .catch((error: unknown) => setStatus(errorStatus(error)))
      .finally(() => setStarting(false));
  }

  const transport: QuizTransport = useMemo(
    () => ({
      bufferKey: token,
      saveAnswers: (answers) => saveTakeHomeQuizAnswers(token, answers),
      submit: () => submitTakeHomeQuiz(token),
      renderQuestionImage: (fileId, alt, size) => (
        <img
          src={publicQuestionImageUrl(token, fileId)}
          alt={alt}
          loading="lazy"
          className={QUIZ_IMAGE_SIZE_CLASS[size]}
        />
      ),
    }),
    [token],
  );

  const loadReview = useCallback(() => getTakeHomeQuizReview(token), [token]);
  const renderReviewImage = useCallback(
    (fileId: string, alt: string) => <img src={publicQuestionImageUrl(token, fileId)} alt={alt} loading="lazy" />,
    [token],
  );

  if (status.kind === "loading") {
    return (
      <div className="flex min-h-dvh items-center justify-center gap-2 text-sm text-slate-500">
        <Spinner /> Loading…
      </div>
    );
  }

  if (status.kind === "invalid") {
    return (
      <div className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-4 py-8">
        <EmptyState
          icon={LinkIcon}
          title="Link not found"
          description="This quiz link is invalid or incomplete. Check the link your school sent and try again."
        />
      </div>
    );
  }

  if (status.kind === "error") {
    return (
      <div className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-4 py-8">
        <Alert variant="error">{status.message}</Alert>
      </div>
    );
  }

  if (status.kind === "submitted") {
    if (status.revealResults) {
      return (
        <div className="mx-auto min-h-dvh max-w-2xl px-4 py-8">
          <QuizResultReveal load={loadReview} renderImage={renderReviewImage} />
        </div>
      );
    }
    return <SubmitConfirmation />;
  }

  if (status.kind === "interstitial") {
    return <QuizInterstitial data={status.data} starting={starting} onStart={handleStart} />;
  }

  return (
    <div className="mx-auto min-h-dvh max-w-2xl px-4 py-6 pb-28">
      <QuizRunner
        initialAttempt={status.attempt}
        transport={transport}
        onSubmitted={(confirmation) => setStatus({ kind: "submitted", revealResults: confirmation.revealResults })}
        onError={(error) => setStatus(errorStatus(error))}
      />
    </div>
  );
}

function errorStatus(error: unknown): Status {
  if (error instanceof ApiError) {
    if (error.problem?.type === "https://kdlms.com/problems/too-many-requests") {
      return { kind: "error", message: "Too many requests - please wait a moment and try again." };
    }
    if (error.status === 404) {
      return { kind: "invalid" };
    }
  }
  return { kind: "error", message: getErrorMessage(error, GENERIC_ERROR_MESSAGE) };
}
