import type { PublishReadinessView } from "@/api/takeHomeQuizzes";
import { Alert } from "@/components/ui/Alert";

interface PublishReadinessPanelProps {
  readiness: PublishReadinessView | null;
  quizType: "MIDTERM" | "NORMAL";
}

/**
 * Non-blocking publish-readiness surface for `GET .../validation` (Phase
 * 20B) - the same blockers a hard publish 422 would throw (Phase 20C),
 * shown here so a teacher can see what's missing while still building the
 * quiz. Always names the resolved midterm maximum and its source inline
 * ("this level's midterm maximum: 20"), per quiz-module.md's mitigation for
 * a cap a teacher can't see configured anywhere else.
 */
export function PublishReadinessPanel({ readiness, quizType }: PublishReadinessPanelProps) {
  if (!readiness) return null;

  return (
    <div className="space-y-2">
      {readiness.canPublish ? (
        <Alert variant="success" title="Ready to publish">
          {readiness.totalPoints} point{readiness.totalPoints === 1 ? "" : "s"} across this quiz.
          {quizType === "MIDTERM" && readiness.midtermMax !== null && (
            <> This level's midterm maximum is {readiness.midtermMax}.</>
          )}
        </Alert>
      ) : (
        <Alert variant="warning" title="Not ready to publish yet">
          <ul className="list-inside list-disc space-y-1">
            {readiness.blockers.map((message) => (
              <li key={message}>{message}</li>
            ))}
          </ul>
          {quizType === "MIDTERM" && readiness.midtermMax !== null && (
            <p className="mt-2">This level's midterm maximum is {readiness.midtermMax}.</p>
          )}
        </Alert>
      )}
    </div>
  );
}
