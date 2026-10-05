import { useEffect, useState } from "react";
import { getErrorMessage } from "@/api/client";
import { getPaymentTransaction, type PaymentTransactionView } from "@/api/subscriptionBilling";

export const POLL_INTERVAL_MS = 3000;
/** How long the callback page waits for Paystack's webhook before saying it's still processing. */
export const POLL_TIMEOUT_MS = 2 * 60 * 1000;

export type TransactionPollState =
  | { kind: "polling"; transaction: PaymentTransactionView | null }
  | { kind: "settled"; transaction: PaymentTransactionView }
  | { kind: "timeout"; transaction: PaymentTransactionView | null }
  | { kind: "error"; message: string };

/**
 * Polls one payment until it leaves PENDING (creators.md §6.1) - the `useBillExport` chained
 * `setTimeout` shape, never `setInterval`. Reading the payment never grants anything: the plan is
 * only ever granted by the verified webhook on the server, which this just waits for. Gives up
 * after {@link POLL_TIMEOUT_MS} without treating that as a failure.
 */
export function useTransactionPoll(reference: string | null): TransactionPollState {
  const [state, setState] = useState<TransactionPollState>(
    reference
      ? { kind: "polling", transaction: null }
      : { kind: "error", message: "No payment reference." },
  );

  useEffect(() => {
    if (!reference) return;
    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    const startedAt = Date.now();

    async function poll() {
      try {
        const transaction = await getPaymentTransaction(reference as string);
        if (cancelled) return;
        if (transaction.status !== "PENDING") {
          setState({ kind: "settled", transaction });
          return;
        }
        if (Date.now() - startedAt >= POLL_TIMEOUT_MS) {
          setState({ kind: "timeout", transaction });
          return;
        }
        setState({ kind: "polling", transaction });
        timeoutId = setTimeout(poll, POLL_INTERVAL_MS);
      } catch (error) {
        if (!cancelled)
          setState({
            kind: "error",
            message: getErrorMessage(error, "Couldn't check your payment."),
          });
      }
    }

    poll();
    return () => {
      cancelled = true;
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [reference]);

  return state;
}
