import { ClipboardList, Package, PackageMinus, PackageX, TrendingDown } from "lucide-react";
import { Link } from "react-router";
import type { SchoolDashboardInventorySection } from "@/api/dashboard";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatTile } from "@/components/ui/StatTile";
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from "@/components/ui/Table";
import { RequisitionStatusBadge } from "@/features/inventory/components/RequisitionStatusBadge";
import { StockBandBadge } from "@/features/inventory/components/StockBandBadge";

const STOCK_TAB = "/school/inventory?tab=stock";
const REQUISITIONS_TAB = "/school/inventory";
const DRAFT_REQUISITIONS_TAB = "/school/inventory?tab=requisitions&status=DRAFT";
const SUBMITTED_REQUISITIONS_TAB = "/school/inventory?tab=requisitions&status=SUBMITTED";

interface InventoryDashboardSectionProps {
  inventory: SchoolDashboardInventorySection;
}

/**
 * The INVENTORY_MANAGER landing page - stock banded by how close each item sits to its own
 * reorder level, and the caller's own requisitions split into what needs their action versus
 * what's waiting on an approver. `stockPreview`/`requisitionPreview` are capped previews (see
 * backend `InventoryRecords.PREVIEW_LIMIT`) - every row links into the full Inventory page.
 */
export function InventoryDashboardSection({ inventory }: InventoryDashboardSectionProps) {
  const needsAttention = inventory.requisitionPreview.filter(
    (row) => row.status === "DRAFT" || row.status === "REJECTED",
  );
  const waitingOnApprover = inventory.requisitionPreview.filter(
    (row) => row.status === "SUBMITTED" || row.status === "APPROVED",
  );

  return (
    <>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          icon={PackageX}
          label="Out of stock"
          value={inventory.outOfStockItems}
          to={STOCK_TAB}
        />
        <StatTile icon={PackageMinus} label="Low stock" value={inventory.lowStockItems} to={STOCK_TAB} />
        <StatTile
          icon={TrendingDown}
          label="Approaching reorder"
          value={inventory.approachingReorderItems}
          to={STOCK_TAB}
        />
        <StatTile
          icon={ClipboardList}
          label="Awaiting review"
          value={inventory.awaitingReviewRequisitions}
          to={SUBMITTED_REQUISITIONS_TAB}
        />
      </div>

      <Card className="p-0">
        <h2 className="p-6 pb-0 text-sm font-semibold text-slate-900">Stock needing attention</h2>
        {inventory.stockPreview.length === 0 ? (
          <div className="p-6">
            <EmptyState icon={Package} title="Nothing flagged" description="Every item is above its reorder level." />
          </div>
        ) : (
          <div className="mt-3">
            <Table>
              <TableHead>
                <TableRow>
                  <TableHeaderCell>Item</TableHeaderCell>
                  <TableHeaderCell>Type</TableHeaderCell>
                  <TableHeaderCell numeric>On hand</TableHeaderCell>
                  <TableHeaderCell>Status</TableHeaderCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {inventory.stockPreview.map((item) => (
                  <TableRow key={item.itemId} to={STOCK_TAB}>
                    <TableCell label="Item">{item.itemName}</TableCell>
                    <TableCell label="Type">{item.itemTypeName}</TableCell>
                    <TableCell label="On hand" numeric>
                      {item.onHand} {item.unit}
                    </TableCell>
                    <TableCell label="Status">
                      <StockBandBadge band={item.band} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>

      <Card className="p-0">
        <h2 className="p-6 pb-0 text-sm font-semibold text-slate-900">Your requisitions</h2>
        <div className="mt-3 grid grid-cols-1 divide-y divide-slate-100 lg:grid-cols-2 lg:divide-x lg:divide-y-0">
          <RequisitionList
            title="Needs your attention"
            emptyText="Nothing to submit or re-raise."
            rows={needsAttention}
            linkFor={(row) =>
              row.status === "DRAFT" ? DRAFT_REQUISITIONS_TAB : REQUISITIONS_TAB
            }
          />
          <RequisitionList
            title="Waiting on an approver"
            emptyText="Nothing pending review right now."
            rows={waitingOnApprover}
            linkFor={() => SUBMITTED_REQUISITIONS_TAB}
          />
        </div>
      </Card>
    </>
  );
}

interface RequisitionListProps {
  title: string;
  emptyText: string;
  rows: SchoolDashboardInventorySection["requisitionPreview"];
  linkFor: (row: SchoolDashboardInventorySection["requisitionPreview"][number]) => string;
}

function RequisitionList({ title, emptyText, rows, linkFor }: RequisitionListProps) {
  return (
    <div className="p-6">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</h3>
      {rows.length === 0 ? (
        <p className="mt-3 text-sm text-slate-500">{emptyText}</p>
      ) : (
        <ul className="mt-3 divide-y divide-slate-100">
          {rows.map((row) => (
            <li key={row.requisitionId}>
              <Link
                to={linkFor(row)}
                className="flex min-h-11 items-center justify-between gap-2 rounded-control py-2 text-sm text-slate-700 hover:bg-slate-50"
              >
                <span className="min-w-0 truncate">
                  <span className="font-medium text-slate-900">{row.reference}</span>
                  {row.neededBy && <span className="text-slate-400"> · needed {row.neededBy}</span>}
                </span>
                <RequisitionStatusBadge status={row.status} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
