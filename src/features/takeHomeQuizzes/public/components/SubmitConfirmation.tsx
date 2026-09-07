import { CheckCircle2 } from "lucide-react";
import { Card } from "@/components/ui/Card";

/**
 * Rendered identically whether this was the first submission or a repeat -
 * the design doc's own wording, verbatim: "your result is being computed
 * and will be sent across." No score is shown here at v1 (Open Decision 8).
 */
export function SubmitConfirmation() {
  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-4 py-8">
      <Card className="text-center">
        <CheckCircle2 className="mx-auto h-10 w-10 text-green-600" aria-hidden="true" />
        <h1 className="mt-3 font-display text-lg font-medium text-slate-900">Quiz submitted</h1>
        <p className="mt-2 text-sm text-slate-600">
          Your result is being computed and will be sent across. You can close this page now.
        </p>
      </Card>
    </div>
  );
}
