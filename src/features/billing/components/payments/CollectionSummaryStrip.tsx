import type { CollectionSummaryView } from "@/api/staffFeePayments";
import { Accordion } from "@/components/ui/Accordion";
import { Alert } from "@/components/ui/Alert";
import { Skeleton } from "@/components/ui/Skeleton";
import { StatTile } from "@/components/ui/StatTile";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
} from "@/components/ui/Table";
import { formatMoney } from "@/utils/currency";

interface CollectionSummaryStripProps {
  summary: CollectionSummaryView | null;
  error: string | null;
}

/**
 * Billed / confirmed / outstanding / pending for one branch + term (Phase 45F's roster-based
 * summary), with a per-level breakdown. Outstanding sums only positive balances; credit is shown
 * separately, so one student's overpayment never hides another's debt.
 */
export function CollectionSummaryStrip({ summary, error }: CollectionSummaryStripProps) {
  if (error) {
    return <Alert variant="error">{error}</Alert>;
  }
  if (!summary) {
    return (
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[0, 1, 2, 3].map((n) => (
          <Skeleton key={n} className="h-20 w-full" />
        ))}
      </div>
    );
  }

  const money = (amount: number) => formatMoney(amount, summary.currency);
  const { totals } = summary;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile
          label="Billed"
          value={money(totals.billed)}
          hint={`${totals.billableStudents} billable students`}
        />
        <StatTile label="Confirmed" value={money(totals.confirmed)} />
        <StatTile
          label="Outstanding"
          value={money(totals.outstanding)}
          hint={totals.credit > 0 ? `${money(totals.credit)} in credit` : undefined}
        />
        <StatTile label="Pending review" value={money(totals.pending)} />
      </div>
      {summary.byLevel.length > 0 && (
        <Accordion title="Breakdown by level" collapsible="always">
          <Table>
            <TableHead>
              <TableRow>
                <TableHeaderCell>Level</TableHeaderCell>
                <TableHeaderCell numeric>Billed</TableHeaderCell>
                <TableHeaderCell numeric>Confirmed</TableHeaderCell>
                <TableHeaderCell numeric>Outstanding</TableHeaderCell>
                <TableHeaderCell numeric>Pending</TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {summary.byLevel.map((level) => (
                <TableRow key={level.levelId}>
                  <TableCell label="Level">{level.levelName}</TableCell>
                  <TableCell label="Billed" numeric>
                    {money(level.totals.billed)}
                  </TableCell>
                  <TableCell label="Confirmed" numeric>
                    {money(level.totals.confirmed)}
                  </TableCell>
                  <TableCell label="Outstanding" numeric>
                    {money(level.totals.outstanding)}
                  </TableCell>
                  <TableCell label="Pending" numeric>
                    {money(level.totals.pending)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Accordion>
      )}
    </div>
  );
}
