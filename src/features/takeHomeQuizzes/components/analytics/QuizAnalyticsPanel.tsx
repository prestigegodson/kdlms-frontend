import { useEffect, useState } from "react";
import { ApiError } from "@/api/client";
import type { QuizAnalytics, QuizScoreSummary, QuizTiming } from "@/api/takeHomeQuizzes";
import { Alert } from "@/components/ui/Alert";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Spinner } from "@/components/ui/Spinner";
import { StatTile } from "@/components/ui/StatTile";
import { QuestionAnalysisTable } from "@/features/takeHomeQuizzes/components/analytics/QuestionAnalysisTable";
import { formatDuration } from "@/features/takeHomeQuizzes/components/analytics/formatDuration";

interface QuizAnalyticsPanelProps {
  /** School and creator pages pass their own endpoint. */
  load: () => Promise<QuizAnalytics>;
  /** "students" or "learners" - the roster's own noun. */
  participantNoun: string;
  /** Bumped by the page after an adjustment or reset, so the figures re-fetch like the results do. */
  reloadKey?: number;
}

/**
 * A quiz's analytics tab (participation, scores, timing, and per-question difficulty), shared by the
 * school and creator results pages. Every figure is computed server-side over submitted attempts.
 */
export function QuizAnalyticsPanel({ load, participantNoun, reloadKey }: QuizAnalyticsPanelProps) {
  const [analytics, setAnalytics] = useState<QuizAnalytics | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    load()
      .then((view) => !cancelled && setAnalytics(view))
      .catch((err: unknown) => {
        if (!cancelled)
          setError(err instanceof ApiError ? err.message : "Failed to load analytics");
      });
    return () => {
      cancelled = true;
    };
  }, [load, reloadKey]);

  if (error) return <Alert variant="error">{error}</Alert>;
  if (!analytics) {
    return (
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <Spinner /> Loading analytics…
      </div>
    );
  }

  const { participation, scores, timing } = analytics;
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          label="Submitted"
          value={`${participation.submitted} / ${participation.rosterSize}`}
          hint={`${participation.inProgress} in progress · ${participation.notStarted} not started`}
        />
        <StatTile
          label="Average score"
          value={scores.mean != null ? `${scores.mean} / ${analytics.totalPoints}` : "—"}
          hint={scores.meanPercent != null ? `${scores.meanPercent}%` : undefined}
        />
        <StatTile
          label="Median score"
          value={scores.median != null ? `${scores.median} / ${analytics.totalPoints}` : "—"}
          hint={scores.lowest != null ? `Range ${scores.lowest}–${scores.highest}` : undefined}
        />
        {timing ? (
          <StatTile
            label="Average time"
            value={formatDuration(timing.averageSeconds)}
            hint={`of ${timing.durationMinutes} min allowed`}
          />
        ) : (
          <StatTile
            label="Spread"
            value={scores.standardDeviation ?? "—"}
            hint="Standard deviation (points)"
          />
        )}
      </div>

      {participation.submitted === 0 ? (
        <EmptyState title={`No ${participantNoun} have submitted yet`} />
      ) : (
        <>
          <div className="grid gap-6 lg:grid-cols-2">
            <ScoreHistogram scores={scores} />
            {timing && <TimingPanel timing={timing} />}
          </div>
          <QuestionAnalysisTable questions={analytics.questions} />
        </>
      )}
    </div>
  );
}

function ScoreHistogram({ scores }: { scores: QuizScoreSummary }) {
  const max = Math.max(1, ...scores.bands.map((band) => band.count));
  return (
    <Card>
      <h3 className="font-display text-base font-medium text-slate-900">Score distribution</h3>
      <p className="mt-1 text-xs text-slate-500">Submissions per 10% band of the total points.</p>
      <div className="mt-4 flex h-36 items-end gap-1" role="img" aria-label="Score distribution">
        {scores.bands.map((band) => (
          <div
            key={band.fromPercent}
            className="flex min-w-0 flex-1 flex-col items-center justify-end gap-1"
          >
            {band.count > 0 && (
              <span className="text-xs tabular-nums text-slate-600">{band.count}</span>
            )}
            <div
              className="w-full rounded-t bg-brand-500"
              style={{ height: `${(band.count / max) * 100}%`, minHeight: band.count > 0 ? 2 : 0 }}
              title={`${band.fromPercent}–${band.toPercent}%: ${band.count}`}
            />
          </div>
        ))}
      </div>
      <div className="mt-1 flex gap-1 border-t border-slate-200 pt-1">
        {scores.bands.map((band) => (
          <span
            key={band.fromPercent}
            className="flex-1 text-center text-[10px] tabular-nums text-slate-500"
          >
            {band.fromPercent}
          </span>
        ))}
      </div>
    </Card>
  );
}

function TimingPanel({ timing }: { timing: QuizTiming }) {
  const rows: Array<[string, string]> = [
    ["Average", formatDuration(timing.averageSeconds)],
    ["Median", formatDuration(timing.medianSeconds)],
    ["Fastest", formatDuration(timing.fastestSeconds)],
    ["Slowest", formatDuration(timing.slowestSeconds)],
    [
      "Average share of time used",
      timing.averageTimeUsedPercent != null ? `${timing.averageTimeUsedPercent}%` : "—",
    ],
    [
      "Ran out of time",
      `${timing.timedOutCount}${timing.timedOutPercent != null ? ` (${timing.timedOutPercent}%)` : ""}`,
    ],
  ];
  return (
    <Card>
      <h3 className="font-display text-base font-medium text-slate-900">Completion time</h3>
      <p className="mt-1 text-xs text-slate-500">
        {timing.durationMinutes} minutes allowed. Times cover the {timing.measuredCount} who
        submitted themselves; auto-submitted attempts count as running out of time.
      </p>
      <dl className="mt-4 divide-y divide-slate-100 text-sm">
        {rows.map(([label, value]) => (
          <div key={label} className="flex justify-between gap-4 py-2">
            <dt className="text-slate-500">{label}</dt>
            <dd className="font-medium tabular-nums text-slate-900">{value}</dd>
          </div>
        ))}
      </dl>
    </Card>
  );
}
