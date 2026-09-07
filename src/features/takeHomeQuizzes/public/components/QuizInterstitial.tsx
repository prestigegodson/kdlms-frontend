import type { QuizInterstitialView } from "@/api/publicTakeHomeQuiz";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { formatInstant } from "@/utils/date";

interface QuizInterstitialProps {
  data: QuizInterstitialView;
  starting: boolean;
  onStart: () => void;
}

/**
 * The screen a token link resolves to, before Start is ever pressed - the
 * design doc's own reason this exists: "the interstitial exists precisely
 * so a casual open doesn't burn the clock." Reloading this screen any
 * number of times never stamps `started_at` - only the button below does.
 */
export function QuizInterstitial({ data, starting, onStart }: QuizInterstitialProps) {
  const resuming = data.attemptState === "IN_PROGRESS";
  const scheduled = data.availability === "SCHEDULED";
  const closed = data.availability === "CLOSED";
  const canStart = !scheduled && !closed;

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-4 py-8">
      <div className="mb-6 flex flex-col items-center gap-2 text-center">
        {data.schoolLogoDataUri ? (
          <img
            src={data.schoolLogoDataUri}
            alt={data.schoolName}
            className="max-h-14 w-auto max-w-full object-contain"
          />
        ) : (
          <span className="font-display text-lg font-medium text-brand-800">{data.schoolName}</span>
        )}
      </div>
      <Card>
        <h1 className="font-display text-lg font-medium text-slate-900">{data.quizTitle}</h1>
        <p className="mt-1 text-sm text-slate-500">
          {data.subjectName} · {data.className}
        </p>
        {data.teacherName && <p className="mt-0.5 text-sm text-slate-500">Set by {data.teacherName}</p>}

        <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
          <div>
            <dt className="text-slate-500">Student</dt>
            <dd className="font-medium text-slate-900">{data.studentFirstName}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Questions</dt>
            <dd className="font-medium text-slate-900">{data.questionCount}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Total points</dt>
            <dd className="font-medium text-slate-900">{data.totalPoints}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Time limit</dt>
            <dd className="font-medium text-slate-900">
              {data.timed ? `${data.durationMinutes} minutes` : "Untimed"}
            </dd>
          </div>
        </dl>

        <p className="mt-4 text-sm text-slate-500">Closes {formatInstant(data.closesAt)}</p>

        {scheduled && (
          <Alert variant="info" className="mt-4">
            This quiz is not open yet.
          </Alert>
        )}
        {closed && (
          <Alert variant="warning" className="mt-4">
            This quiz has closed.
          </Alert>
        )}

        <Button className="mt-6 w-full" size="lg" onClick={onStart} loading={starting} disabled={!canStart}>
          {resuming ? "Resume quiz" : "Start quiz"}
        </Button>
      </Card>
    </div>
  );
}
