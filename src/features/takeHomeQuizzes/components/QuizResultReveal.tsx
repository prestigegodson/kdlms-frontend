import { type ReactNode, useEffect, useState } from "react";
import type { QuizReviewView } from "@/api/publicTakeHomeQuiz";
import { getErrorMessage } from "@/api/client";
import { Alert } from "@/components/ui/Alert";
import { Spinner } from "@/components/ui/Spinner";
import { QuizReview } from "@/features/takeHomeQuizzes/components/QuizReview";

interface QuizResultRevealProps {
  /** Fetches the caller's own score/review - `getTakeHomeQuizReview` (token path) or `getMyQuizReview` (portal path). Memoize with `useCallback` so this only fires once per mount. */
  load: () => Promise<QuizReviewView>;
  renderImage: (fileId: string, alt: string) => ReactNode;
}

/**
 * The score-and-per-question-review a student sees right after submitting an opt-in quiz (Phase
 * 20K, `revealResultsOnSubmit`) - shared by the token page and the portal, which otherwise render
 * this inside different page chrome. Renders via the same `QuizReview` a teacher's
 * `StudentAnswersModal` uses, so the two can never disagree on what "correct" looks like.
 */
export function QuizResultReveal({ load, renderImage }: QuizResultRevealProps) {
  const [review, setReview] = useState<QuizReviewView | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    load()
      .then((data) => {
        if (!cancelled) setReview(data);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(getErrorMessage(err, "Could not load your result"));
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `load` is memoized by the caller; fetch once per mount.
  }, []);

  if (error) {
    return <Alert variant="error">{error}</Alert>;
  }

  if (!review) {
    return (
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <Spinner /> Loading your result…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <p className="text-sm text-slate-500">Your score</p>
        <p className="font-display text-3xl font-semibold text-slate-900">
          {review.score} <span className="text-lg font-normal text-slate-500">/ {review.totalPoints}</span>
        </p>
      </div>
      <QuizReview questions={review.questions} renderImage={renderImage} perspective="self" />
    </div>
  );
}
