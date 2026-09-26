import type { BillLineView, BillView, TransportFareLineView } from "@/api/billing";
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from "@/components/ui/Table";
import { formatMoney } from "@/utils/currency";

interface BillCardProps {
  bill: BillView;
}

function FeeCell({ line }: { line: BillLineView }) {
  return <TableCell label="Fee">{line.feeName}</TableCell>;
}

/**
 * One rendered bill - header (student/class/term/session/bill reference), a charged-lines table
 * with a total row (Phase 25: every compulsory fee, every selected optional fee, and every custom
 * extra - final amounts only, no "discount"/"adjusted" marking anywhere, per the module's "the
 * parent sees final amounts only" rule; Phase 26: a rider's own resolved school-bus fare is one
 * more line in this same table, charged into the total exactly like an extra), an optional-lines
 * table headed "Optional — not included in the total" (the school's optional fees this student is
 * NOT selected for; only when non-empty), a published "School bus fares" table (Phase 22 revision,
 * reworded in Phase 26 now that a rider's own fare is charged above rather than merely
 * informational - every active, priced route in the branch, identical whether or not this student
 * rides; only when non-empty), a bank-accounts list, and free-text instructions. A standalone
 * component, not
 * itself a dialog, so it can be reused verbatim by the guardian ward view (Phase 21G) - the same
 * "one component, two callers" precedent `ThreadCard`/`AttendanceSummaryPanel` set. The staff
 * preview call site (`BillsTab`) wraps this in a `Modal size="xl"`.
 */
export function BillCard({ bill }: BillCardProps) {
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h2 className="font-display text-lg font-medium text-slate-900">{bill.studentName}</h2>
        <p className="text-sm text-slate-500">
          {/* A prospective bill (no student/class yet) omits admissionNumber/className - joins only what's there. */}
          {[bill.admissionNumber, bill.className ? `${bill.className} (${bill.levelName})` : bill.levelName]
            .filter(Boolean)
            .join(" · ")}
        </p>
        <p className="text-sm text-slate-500">
          {bill.termName}
          {bill.sessionName ? ` · ${bill.sessionName}` : ""}
        </p>
        {bill.billReference && <p className="text-xs text-slate-400">Bill reference: {bill.billReference}</p>}
      </div>

      <div>
        <Table>
          <TableHead>
            <TableRow>
              <TableHeaderCell>Fee</TableHeaderCell>
              <TableHeaderCell numeric>Amount</TableHeaderCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {bill.chargedLines.map((line, index) => (
              <TableRow key={line.feeId ?? `extra-${index}`}>
                <FeeCell line={line} />
                <TableCell label="Amount" numeric>
                  {formatMoney(line.amount, bill.currency)}
                </TableCell>
              </TableRow>
            ))}
            <TableRow>
              <TableCell label="Fee" className="font-semibold text-slate-900">
                Total
              </TableCell>
              <TableCell label="Amount" numeric className="font-semibold text-slate-900">
                {formatMoney(bill.total, bill.currency)}
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>

      {bill.optionalLines.length > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-medium text-slate-700">Optional — not included in the total</h3>
          <Table>
            <TableHead>
              <TableRow>
                <TableHeaderCell>Fee</TableHeaderCell>
                <TableHeaderCell numeric>Amount</TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {bill.optionalLines.map((line) => (
                <TableRow key={line.feeId}>
                  <FeeCell line={line} />
                  <TableCell label="Amount" numeric>
                    {formatMoney(line.amount, bill.currency)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {bill.transportFares.length > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-medium text-slate-700">School bus fares</h3>
          <p className="mb-2 text-xs text-slate-400">
            Published route prices for the whole school. This student&apos;s own school-bus fare, if assigned, is
            already included in the charges above.
          </p>
          <Table>
            <TableHead>
              <TableRow>
                <TableHeaderCell>Route Name</TableHeaderCell>
                <TableHeaderCell numeric>One way</TableHeaderCell>
                <TableHeaderCell numeric>Two ways</TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {bill.transportFares.map((fare: TransportFareLineView) => (
                <TableRow key={fare.routeName}>
                  <TableCell label="Route Name">{fare.routeName}</TableCell>
                  <TableCell label="One way" numeric>
                    {formatMoney(fare.oneWayAmount, bill.currency)}
                  </TableCell>
                  <TableCell label="Two ways" numeric>
                    {formatMoney(fare.toAndFroAmount, bill.currency)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {bill.bankAccounts.length > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-medium text-slate-700">Bank accounts</h3>
          <ul className="space-y-2 text-sm text-slate-700">
            {bill.bankAccounts.map((account) => (
              <li key={account.position} className="rounded-card border border-slate-200 p-3">
                <p className="font-medium">{account.bankName}</p>
                <p>{account.accountName}</p>
                <p className="tabular-nums text-slate-500">{account.accountNumber}</p>
              </li>
            ))}
          </ul>
        </div>
      )}

      {bill.instructions && (
        <div>
          <h3 className="mb-2 text-sm font-medium text-slate-700">Instructions</h3>
          <p className="whitespace-pre-wrap text-sm text-slate-600">{bill.instructions}</p>
        </div>
      )}
    </div>
  );
}
