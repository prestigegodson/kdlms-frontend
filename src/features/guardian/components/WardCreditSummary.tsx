import { Wallet } from "lucide-react";
import { useEffect, useState } from "react";
import { creditTermLabel, getWardCredit, type StudentCreditView } from "@/api/feePayments";
import type { MyWardView } from "@/api/wards";
import { Card } from "@/components/ui/Card";
import { formatMoney } from "@/utils/currency";
import { formatInstantDate } from "@/utils/date";

interface WardCreditSummaryProps {
  wards: MyWardView[];
  /** Bumped by the page after a payment write, so the credit re-reads. */
  refreshKey: number;
}

/**
 * Each ward's overpayment credit with the school (D10'), read-only: what's held, from which
 * terms, and where the school has applied it. Shown only for a ward with credit or a history;
 * a ward whose wallet fails to load is simply left out (the payments table reports load errors).
 */
export function WardCreditSummary({ wards, refreshKey }: WardCreditSummaryProps) {
  const [wallets, setWallets] = useState<{ ward: MyWardView; wallet: StudentCreditView }[]>([]);

  useEffect(() => {
    let cancelled = false;
    Promise.allSettled(wards.map((ward) => getWardCredit(ward.studentId))).then((results) => {
      if (cancelled) return;
      const loaded: { ward: MyWardView; wallet: StudentCreditView }[] = [];
      results.forEach((result, index) => {
        if (result.status !== "fulfilled" || !result.value) return;
        const wallet = result.value;
        if (wallet.available > 0 || wallet.applications.length > 0) loaded.push({ ward: wards[index], wallet });
      });
      setWallets(loaded);
    });
    return () => {
      cancelled = true;
    };
  }, [wards, refreshKey]);

  if (wallets.length === 0) return null;

  return (
    <section aria-label="Credit on account" className="space-y-3">
      {wallets.map(({ ward, wallet }) => (
        <Card key={ward.studentId} className="space-y-3">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="flex items-center gap-2">
              <Wallet className="h-5 w-5 text-brand-600" aria-hidden="true" />
              <div>
                <h2 className="text-base font-semibold text-slate-900">Credit on account</h2>
                <p className="text-sm text-slate-500">{ward.fullName}</p>
              </div>
            </div>
            <p className="text-lg font-semibold text-slate-900">{formatMoney(wallet.available, wallet.currency)}</p>
          </div>
          {wallet.available > 0 && (
            <p className="text-sm text-slate-600">
              You paid more than was billed. The school can apply this credit to a later term's fees.
            </p>
          )}
          {wallet.sources.length > 0 && (
            <ul className="space-y-1 text-sm text-slate-600">
              {wallet.sources.map((source) => (
                <li key={source.termId} className="flex justify-between gap-2">
                  <span>Overpaid in {creditTermLabel(source.termName, source.sessionName)}</span>
                  <span>{formatMoney(source.available, wallet.currency)}</span>
                </li>
              ))}
            </ul>
          )}
          {wallet.applications.some((application) => application.status === "APPLIED") && (
            <ul className="space-y-1 border-t border-slate-100 pt-3 text-sm text-slate-600" aria-label="Credit applied">
              {wallet.applications
                .filter((application) => application.status === "APPLIED")
                .map((application) => (
                  <li key={application.id} className="flex flex-wrap justify-between gap-2">
                    <span>
                      Applied to {creditTermLabel(application.targetTermName, application.targetSessionName)} ·{" "}
                      {formatInstantDate(application.appliedAt)}
                    </span>
                    <span>{formatMoney(application.amount, wallet.currency)}</span>
                  </li>
                ))}
            </ul>
          )}
        </Card>
      ))}
    </section>
  );
}
