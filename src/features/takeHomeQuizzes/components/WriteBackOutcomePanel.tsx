import { type TakeHomeQuizRowOutcome } from "@/api/takeHomeQuizzes";
import { CheckCircle2, XCircle } from "lucide-react";

interface WriteBackOutcomePanelProps {
  rows: TakeHomeQuizRowOutcome[];
}

/**
 * A per-student green/red outcome list, shared by {@link "./PublishQuizModal"} (Phase 20C's
 * link-minting outcome) and {@link "./PublishResultsModal"} (Phase 20F's gradebook write-back
 * outcome) - both resolve to the identical `TakeHomeQuizRowOutcome` shape (the backend's
 * `WriteBackOutcomeView.RowOutcome` Javadoc says "Same shape as `PublishOutcomeView.RowOutcome`,
 * for frontend consistency"), so this was extracted out of `PublishQuizModal` rather than grown a
 * second time.
 */
export function WriteBackOutcomePanel({ rows }: WriteBackOutcomePanelProps) {
  if (rows.length === 0) return null;

  return (
    <div className="max-h-48 space-y-1 overflow-y-auto overscroll-contain">
      {rows.map((row) => (
        <div
          key={row.studentId}
          className={`flex items-start gap-2 rounded-control border px-3 py-2 text-sm ${
            row.success ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50"
          }`}
        >
          {row.success ? (
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-600" aria-hidden="true" />
          ) : (
            <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" aria-hidden="true" />
          )}
          <span>
            <span className="font-medium">{row.studentName}</span>
            {row.message && <span className="text-slate-600"> &mdash; {row.message}</span>}
          </span>
        </div>
      ))}
    </div>
  );
}
