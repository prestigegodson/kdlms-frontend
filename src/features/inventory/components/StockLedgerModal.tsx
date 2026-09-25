import { useEffect, useState } from "react";
import type { Page } from "@/api/types";
import { ApiError } from "@/api/client";
import { getStockMovements, type StockLevelView, type StockMovementView } from "@/api/inventory";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { Modal } from "@/components/ui/Modal";
import { Pagination } from "@/components/ui/Pagination";
import { Skeleton } from "@/components/ui/Skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from "@/components/ui/Table";

interface StockLedgerModalProps {
  level: StockLevelView;
  branchId?: string;
  onClose: () => void;
}

const MOVEMENT_BADGE: Record<StockMovementView["kind"], "success" | "danger" | "neutral"> = {
  RECEIPT: "success",
  ISSUE: "danger",
  ADJUSTMENT: "neutral",
};

/**
 * A student recipient, then a legacy requisition reference, then general usage (with its own
 * optional "used for" text), then falls back to the reason/reference every other movement kind
 * carries. An ISSUE with no student and no issuedTo/requisitionReference is general usage with no
 * description.
 */
function movementDetail(movement: StockMovementView): string {
  if (movement.studentName) return movement.studentName;
  if (movement.requisitionReference) return movement.requisitionReference;
  if (movement.kind === "ISSUE") return movement.issuedTo ? `General usage — ${movement.issuedTo}` : "General usage";
  return movement.issuedTo ?? movement.reason ?? movement.reference ?? "—";
}

/** One item's movement history for a branch - read-only, newest first. */
export function StockLedgerModal({ level, branchId, onClose }: StockLedgerModalProps) {
  const [pageNumber, setPageNumber] = useState(0);
  const [page, setPage] = useState<Page<StockMovementView> | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    getStockMovements(branchId, level.itemId, pageNumber, 20)
      .then(setPage)
      .catch((err: unknown) => setLoadError(err instanceof ApiError ? err.message : "Failed to load stock history"));
  }, [branchId, level.itemId, pageNumber]);

  const movements = page?.content ?? null;

  return (
    <Modal open onClose={onClose} title={`${level.itemName} - stock history`} size="lg">
      <div className="space-y-4">
        {loadError && <Alert variant="error">{loadError}</Alert>}

        {movements === null ? (
          <div className="space-y-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : movements.length === 0 ? (
          <EmptyState title="No movements yet" description="Nothing has been received, issued, or adjusted for this item yet." />
        ) : (
          <>
            <Table>
              <TableHead>
                <TableRow>
                  <TableHeaderCell>Date</TableHeaderCell>
                  <TableHeaderCell>Kind</TableHeaderCell>
                  <TableHeaderCell numeric>Quantity</TableHeaderCell>
                  <TableHeaderCell>Detail</TableHeaderCell>
                  <TableHeaderCell>By</TableHeaderCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {movements.map((movement) => (
                  <TableRow key={movement.id}>
                    <TableCell label="Date">{movement.occurredOn}</TableCell>
                    <TableCell label="Kind">
                      <Badge variant={MOVEMENT_BADGE[movement.kind]}>{movement.kind}</Badge>
                    </TableCell>
                    <TableCell label="Quantity" numeric>
                      {movement.quantity > 0 ? `+${movement.quantity}` : movement.quantity}
                    </TableCell>
                    <TableCell label="Detail">{movementDetail(movement)}</TableCell>
                    <TableCell label="By">{movement.createdByName ?? "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {page && <Pagination page={page} onPageChange={setPageNumber} />}
          </>
        )}
      </div>
    </Modal>
  );
}
