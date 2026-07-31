import type { RowOutcome } from "@/api/assessments";
import { CheckCircle2, XCircle } from "lucide-react";
import { Card } from "@/components/ui/Card";

interface SaveOutcomeListProps {
  outcomes: RowOutcome[];
  nameOf: (enrollmentId: string) => string;
}

/** Per-row save results - the same "N of M succeeded" pattern PromotionPage's OutcomeList uses for bulk promotion. */
export function SaveOutcomeList({ outcomes, nameOf }: SaveOutcomeListProps) {
  const successCount = outcomes.filter((outcome) => outcome.success).length;

  return (
    <Card>
      <h2 className="text-sm font-semibold text-slate-900">Save result</h2>
      <p className="mt-1 text-sm text-slate-500">
        {successCount} of {outcomes.length} saved successfully.
      </p>
      <ul className="mt-3 space-y-2">
        {outcomes.map((outcome) => (
          <li key={outcome.enrollmentId} className="flex items-start gap-2 text-sm">
            {outcome.success ? (
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-600" aria-hidden="true" />
            ) : (
              <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" aria-hidden="true" />
            )}
            <span>
              <span className="font-medium text-slate-900">{nameOf(outcome.enrollmentId)}</span>
              {!outcome.success && outcome.message && <span className="text-slate-500"> &mdash; {outcome.message}</span>}
            </span>
          </li>
        ))}
      </ul>
    </Card>
  );
}
