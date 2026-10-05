import { CheckCircle2, Clock, XCircle } from "lucide-react";
import { Link, useSearchParams } from "react-router";
import { Alert } from "@/components/ui/Alert";
import { Card } from "@/components/ui/Card";
import { Spinner } from "@/components/ui/Spinner";
import { formatMoney, fromMinor } from "@/utils/currency";
import { useTransactionPoll } from "./useTransactionPoll";

/**
 * Where Paystack sends the browser back after checkout (`/billing/callback?reference=…`,
 * creators.md §6.1). It only waits for the server to confirm the payment through Paystack's webhook;
 * it never grants the plan itself.
 */
export function BillingCallbackPage() {
  const [params] = useSearchParams();
  // Paystack appends both `reference` and `trxref` (the same value).
  const reference = params.get("reference") ?? params.get("trxref");
  const state = useTransactionPoll(reference);
  const backLink = (
    <Link className="text-sm font-medium text-brand-500 hover:text-brand-600" to="/billing">
      Back to Plan &amp; billing
    </Link>
  );

  return (
    <div className="mx-auto flex min-h-screen max-w-lg items-center px-4 py-12">
      <Card className="w-full space-y-4 text-center">
        {state.kind === "polling" && (
          <>
            <div className="flex justify-center text-brand-500">
              <Spinner />
            </div>
            <h1 className="font-display text-xl font-medium text-slate-900">
              Confirming your payment…
            </h1>
            <p className="text-sm text-slate-500">
              This usually takes a few seconds. Please keep this page open.
            </p>
          </>
        )}
        {state.kind === "settled" && state.transaction.status === "SUCCESS" && (
          <>
            <CheckCircle2 className="mx-auto h-10 w-10 text-green-600" aria-hidden="true" />
            <h1 className="font-display text-xl font-medium text-slate-900">Payment received</h1>
            <p className="text-sm text-slate-600">
              {formatMoney(fromMinor(state.transaction.amountMinor), state.transaction.currency)}{" "}
              for {state.transaction.planName ?? "your plan"}. Your plan is now active, and a
              receipt is on its way to your email.
            </p>
            {backLink}
          </>
        )}
        {state.kind === "settled" && state.transaction.status !== "SUCCESS" && (
          <>
            <XCircle className="mx-auto h-10 w-10 text-red-600" aria-hidden="true" />
            <h1 className="font-display text-xl font-medium text-slate-900">
              Payment not completed
            </h1>
            <p className="text-sm text-slate-600">
              {state.transaction.gatewayMessage ?? "Your card wasn't charged."} You can try again
              from your billing page.
            </p>
            {backLink}
          </>
        )}
        {state.kind === "timeout" && (
          <>
            <Clock className="mx-auto h-10 w-10 text-amber-600" aria-hidden="true" />
            <h1 className="font-display text-xl font-medium text-slate-900">Still processing</h1>
            <p className="text-sm text-slate-600">
              We haven't heard back from Paystack yet. If you were charged, your plan will update
              within a few minutes - you don't need to pay again.
            </p>
            {backLink}
          </>
        )}
        {state.kind === "error" && (
          <>
            <Alert variant="error">{state.message}</Alert>
            {backLink}
          </>
        )}
      </Card>
    </div>
  );
}
