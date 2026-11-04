import { Wallet } from "lucide-react";
import { useEffect, useState } from "react";
import { getErrorMessage } from "@/api/client";
import { creditTermLabel, type StudentCreditView } from "@/api/feePayments";
import { applyStudentCredit, getStudentCredit, reverseCreditApplication } from "@/api/staffFeePayments";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ApplyCreditDialog } from "@/features/billing/components/payments/ApplyCreditDialog";
import { ReasonDialog } from "@/features/billing/components/payments/ReasonDialog";
import { formatMoney } from "@/utils/currency";
import { formatInstantDate } from "@/utils/date";

interface CreditWalletPanelProps {
  studentId: string;
  studentName: string;
  /** The term the surrounding preview is showing - pre-selected when credit can go toward it. */
  termId: string;
  /** Bumped by the parent after any payment write, so the wallet re-reads. */
  refreshKey: number;
  /** Called after an apply/reverse, so the term figures and roster refresh. */
  onChanged: (message: string) => void;
}

/**
 * A student's overpayment credit wallet for staff (D10'): what's available and from which terms,
 * Apply credit to a term that still owes, and the history with Reverse. Renders nothing for a
 * student who has never had credit.
 */
export function CreditWalletPanel({
  studentId,
  studentName,
  termId,
  refreshKey,
  onChanged,
}: CreditWalletPanelProps) {
  const [wallet, setWallet] = useState<StudentCreditView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [applying, setApplying] = useState(false);
  const [reversing, setReversing] = useState<StudentCreditView["applications"][number] | null>(null);

  useEffect(() => {
    let cancelled = false;
    getStudentCredit(studentId)
      .then((next) => {
        if (!cancelled) {
          setWallet(next);
          setError(null);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(getErrorMessage(err, "Couldn't load the credit wallet"));
      });
    return () => {
      cancelled = true;
    };
  }, [studentId, refreshKey]);

  if (error) return <Alert variant="error">{error}</Alert>;
  if (!wallet || (wallet.available <= 0 && wallet.applications.length === 0)) return null;

  return (
    <div className="space-y-3 rounded-control border border-slate-200 bg-slate-50 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Wallet className="h-4 w-4 text-slate-500" aria-hidden="true" />
          <span className="text-sm font-semibold text-slate-900">Credit wallet</span>
        </div>
        <span className="text-sm font-semibold text-slate-900">
          {formatMoney(wallet.available, wallet.currency)}
        </span>
      </div>

      {wallet.sources.length > 0 && (
        <ul className="space-y-1 text-xs text-slate-600">
          {wallet.sources.map((source) => (
            <li key={source.termId} className="flex justify-between gap-2">
              <span>Overpaid in {creditTermLabel(source.termName, source.sessionName)}</span>
              <span>{formatMoney(source.available, wallet.currency)}</span>
            </li>
          ))}
        </ul>
      )}

      {wallet.targets.length > 0 ? (
        <Button variant="secondary" size="sm" onClick={() => setApplying(true)}>
          Apply credit
        </Button>
      ) : (
        wallet.available > 0 && (
          <p className="text-xs text-slate-500">No other term has a published bill left to pay.</p>
        )
      )}

      {wallet.applications.length > 0 && (
        <ul className="space-y-2 border-t border-slate-200 pt-2" aria-label="Credit history">
          {wallet.applications.map((application) => (
            <li key={application.id} className="space-y-1 text-sm">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="text-slate-900">
                  {formatMoney(application.amount, wallet.currency)} to{" "}
                  {creditTermLabel(application.targetTermName, application.targetSessionName)}
                </span>
                {application.status === "REVERSED" ? (
                  <Badge variant="neutral">Reversed</Badge>
                ) : (
                  <Badge variant="success">Applied</Badge>
                )}
              </div>
              <p className="text-xs text-slate-500">
                From {creditTermLabel(application.sourceTermName, application.sourceSessionName)} ·{" "}
                {formatInstantDate(application.appliedAt)}
                {application.note ? ` · ${application.note}` : ""}
              </p>
              {application.status === "REVERSED" && application.reverseReason && (
                <p className="text-xs text-slate-500">Reversed: {application.reverseReason}</p>
              )}
              {application.status === "APPLIED" && (
                <Button variant="secondary" size="sm" onClick={() => setReversing(application)}>
                  Reverse
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}

      {applying && (
        <ApplyCreditDialog
          wallet={wallet}
          studentName={studentName}
          defaultTermId={termId}
          onConfirm={async (body) => {
            const next = await applyStudentCredit(studentId, body);
            setWallet(next);
            setApplying(false);
            onChanged("Credit applied.");
          }}
          onClose={() => setApplying(false)}
        />
      )}
      {reversing && (
        <ReasonDialog
          title="Reverse credit"
          message={`Reverse ${formatMoney(reversing.amount, wallet.currency)} applied to ${creditTermLabel(
            reversing.targetTermName,
            reversing.targetSessionName,
          )}? That term owes it again, and the credit goes back to the wallet.`}
          confirmLabel="Reverse credit"
          onConfirm={async (reason) => {
            const next = await reverseCreditApplication(reversing.id, reversing.version, reason);
            setWallet(next);
            setReversing(null);
            onChanged("Credit reversed.");
          }}
          onClose={() => setReversing(null)}
        />
      )}
    </div>
  );
}
