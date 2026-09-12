import type { FeePriceGridView, FeePriceRow } from "@/api/billing";
import { Badge } from "@/components/ui/Badge";
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from "@/components/ui/Table";
import { formatMoney } from "@/utils/currency";

interface FeePriceListTableProps {
  grid: FeePriceGridView;
  currency: string | null;
  onEdit: (fee: FeePriceRow) => void;
}

/** How many (level, term) slots this fee needs priced - levels x term slots (1 for a uniform fee). */
function slotCount(fee: FeePriceRow): number {
  const termSlots = fee.priceVariesByTerm && fee.termNumbers ? fee.termNumbers.length : 1;
  return fee.applicableLevelIds.length * termSlots;
}

/** How many of those slots are actually priced right now. */
function pricedCount(fee: FeePriceRow): number {
  return fee.prices.length;
}

/** A single figure when every priced cell shares one amount, a range when they differ, an em dash when nothing's priced. */
function amountSummary(fee: FeePriceRow, currency: string | null): string {
  const amounts = fee.prices.map((cell) => cell.amount);
  if (amounts.length === 0) return "—";
  const min = Math.min(...amounts);
  const max = Math.max(...amounts);
  if (min === max) return formatMoney(min, currency);
  return `${formatMoney(min, currency)} – ${formatMoney(max, currency)}`;
}

/**
 * "Every term" / "Term 2" / "Terms 1, 3" / "Admission term" - real term numbers rather than the
 * old blanket "Every session". Exported so `FeePricesModal` reads the same label for one fee.
 */
export function applicabilityLabel(fee: FeePriceRow): string {
  if (fee.applicability !== "TERMLY") return "Admission term";
  if (!fee.termNumbers || fee.termNumbers.length === 3) return "Every term";
  if (fee.termNumbers.length === 1) return `Term ${fee.termNumbers[0]}`;
  return `Terms ${fee.termNumbers.join(", ")}`;
}

/**
 * A fixed-column list of fees, one row per fee, replacing the old fee×level grid of inputs
 * (whose column count grew with the school's level count and forced horizontal scroll). Never
 * scrolls horizontally and card-stacks per fee below `md` via `TableCell`'s `label` prop, the
 * same convention the removed grid used. Tapping a row opens `FeePricesModal` to actually price
 * it - this table has no inputs of its own.
 *
 * `priceVariesByTerm` (Phase 23) widens the "priced" denominator from levels alone to levels x
 * terms, and the "Per term" badge flags a fee whose amount can differ by term.
 */
export function FeePriceListTable({ grid, currency, onEdit }: FeePriceListTableProps) {
  return (
    <Table>
      <TableHead>
        <TableRow>
          <TableHeaderCell>Fee</TableHeaderCell>
          <TableHeaderCell>Applies</TableHeaderCell>
          <TableHeaderCell>Type</TableHeaderCell>
          <TableHeaderCell>Prices set</TableHeaderCell>
          <TableHeaderCell numeric>Amount</TableHeaderCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {grid.fees.map((fee) => {
          const applicable = slotCount(fee);
          const priced = pricedCount(fee);
          const gap = fee.compulsory && priced < applicable;
          return (
            <TableRow key={fee.feeId} onClick={() => onEdit(fee)}>
              <TableCell label="Fee">{fee.feeName}</TableCell>
              <TableCell label="Applies">{applicabilityLabel(fee)}</TableCell>
              <TableCell label="Type">
                <span className="inline-flex items-center gap-2">
                  <Badge variant={fee.compulsory ? "brand" : "neutral"}>
                    {fee.compulsory ? "Compulsory" : "Optional"}
                  </Badge>
                  {fee.priceVariesByTerm && <Badge variant="neutral">Per term</Badge>}
                </span>
              </TableCell>
              <TableCell label="Prices set">
                <span className="inline-flex items-center gap-2">
                  {priced} of {applicable}
                  {gap && <Badge variant="warning">Not fully priced</Badge>}
                </span>
              </TableCell>
              <TableCell label="Amount" numeric>
                {amountSummary(fee, currency)}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
