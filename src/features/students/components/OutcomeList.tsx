import type { MovementResult } from "@/api/students";
import { CheckCircle2, XCircle } from "lucide-react";
import { Card } from "@/components/ui/Card";

interface OutcomeListProps {
  result: MovementResult;
  /** Resolves a row id to its display name - the caller already has the roster in scope. */
  nameOf: (id: string) => string;
}

/**
 * Renders a batch action's per-row outcome - shared by PromotionPage's
 * promote/place flows and ClassDetailPage's selective-subject registration
 * screen, both of which submit to the same "never fail the whole batch on
 * one bad row" contract (see api/students.ts's {@link MovementResult}).
 */
export function OutcomeList({ result, nameOf }: OutcomeListProps) {
  const successCount = result.outcomes.filter((outcome) => outcome.success).length;

  return (
    <Card>
      <h2 className="text-sm font-semibold text-slate-900">Result</h2>
      <p className="mt-1 text-sm text-slate-500">
        {successCount} of {result.outcomes.length} succeeded.
      </p>
      <ul className="mt-3 space-y-2">
        {result.outcomes.map((outcome) => (
          <li key={outcome.studentId} className="flex items-start gap-2 text-sm">
            {outcome.success ? (
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-600" aria-hidden="true" />
            ) : (
              <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" aria-hidden="true" />
            )}
            <span>
              <span className="font-medium text-slate-900">{nameOf(outcome.studentId)}</span>
              {!outcome.success && outcome.message && (
                <span className="text-slate-500"> &mdash; {outcome.message}</span>
              )}
            </span>
          </li>
        ))}
      </ul>
    </Card>
  );
}
