import type { RowOutcome } from "@/api/assessments";
import { Card } from "@/components/ui/Card";

interface SaveOutcomeListProps {
  outcomes: RowOutcome[];
  nameOf: (enrollmentId: string) => string;
}

/** Per-row save results - the same "N of M succeeded" pattern PromotionPage's OutcomeList uses for bulk promotion. */
export function SaveOutcomeList({ outcomes, }: SaveOutcomeListProps) {
  const successCount = outcomes.filter((outcome) => outcome.success).length;

  return (
    <Card>
      <h2 className="text-sm font-semibold text-slate-900">Save result</h2>
      <p className="mt-1 text-sm text-slate-500">
        {successCount} of {outcomes.length} saved successfully.
      </p>
    </Card>
  );
}
