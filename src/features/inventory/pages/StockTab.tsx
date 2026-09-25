import { Package, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { ApiError } from "@/api/client";
import { getStockLevels, type InventoryItemView, listItems, type StockLevelView } from "@/api/inventory";
import { can } from "@/auth/permissions";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { StickySubHeader } from "@/components/ui/StickySubHeader";
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from "@/components/ui/Table";
import { BranchFilter } from "@/features/branches/components/BranchFilter";
import { useBranchScope } from "@/features/branches/useBranchScope";
import { StockBandBadge } from "@/features/inventory/components/StockBandBadge";
import { StockIssueModal } from "@/features/inventory/components/StockIssueModal";
import { StockLedgerModal } from "@/features/inventory/components/StockLedgerModal";
import { StockMovementModal } from "@/features/inventory/components/StockMovementModal";
import { useAuthStore } from "@/stores/authStore";

type MovementModalState = { kind: "receive" | "adjust"; defaultItemId?: string } | null;

/** A branch's derived on-hand stock, with a low-stock badge and a per-item movement ledger. */
export function StockTab() {
  const role = useAuthStore((state) => state.user?.role);
  const canManage = can.manageInventoryStock(role);
  const canIssue = can.issueStock(role);
  const { ready: branchReady, branchId } = useBranchScope();

  const [levels, setLevels] = useState<StockLevelView[] | null>(null);
  const [items, setItems] = useState<InventoryItemView[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [movementModal, setMovementModal] = useState<MovementModalState>(null);
  const [ledgerLevel, setLedgerLevel] = useState<StockLevelView | null>(null);
  const [issuingLevel, setIssuingLevel] = useState<StockLevelView | null>(null);

  function load() {
    if (!branchReady) return;
    Promise.all([getStockLevels(branchId), listItems(undefined, true)])
      .then(([levelsResult, itemsResult]) => {
        setLevels(levelsResult);
        setItems(itemsResult);
      })
      .catch((err: unknown) => setLoadError(err instanceof ApiError ? err.message : "Failed to load stock"));
  }

  useEffect(load, [branchReady, branchId]);

  if (loadError) {
    return <Alert variant="error">{loadError}</Alert>;
  }

  return (
    <div className="space-y-4">
      {can.selectBranch(role) && (
        <StickySubHeader>
          <BranchFilter id="inventory-stock-branch" />
        </StickySubHeader>
      )}

      {canManage && (
        <div className="flex justify-end gap-2">
          <Button variant="secondary" disabled={items.length === 0} onClick={() => setMovementModal({ kind: "adjust" })}>
            Adjust stock
          </Button>
          <Button variant="accent" disabled={items.length === 0} onClick={() => setMovementModal({ kind: "receive" })}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            Receive stock
          </Button>
        </div>
      )}

      {levels === null ? (
        <div className="space-y-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : levels.length === 0 ? (
        <EmptyState
          icon={Package}
          title="No stock yet"
          description={
            canManage
              ? "Receive stock for an item, or add items on the Items tab first."
              : "Nothing has been received for this branch yet."
          }
        />
      ) : (
        <Table>
          <TableHead>
            <TableRow>
              <TableHeaderCell>Item</TableHeaderCell>
              <TableHeaderCell>Type</TableHeaderCell>
              <TableHeaderCell numeric>On hand</TableHeaderCell>
              <TableHeaderCell numeric>Reorder level</TableHeaderCell>
              <TableHeaderCell>Status</TableHeaderCell>
              {canIssue && <TableHeaderCell>Actions</TableHeaderCell>}
            </TableRow>
          </TableHead>
          <TableBody>
            {levels.map((level) => (
              <TableRow key={level.itemId} onClick={() => setLedgerLevel(level)}>
                <TableCell label="Item">{level.itemName}</TableCell>
                <TableCell label="Type">{level.itemTypeName}</TableCell>
                <TableCell label="On hand" numeric>
                  {level.onHand} {level.unit}
                </TableCell>
                <TableCell label="Reorder level" numeric>
                  {level.reorderLevel}
                </TableCell>
                <TableCell label="Status">
                  <StockBandBadge band={level.band} />
                </TableCell>
                {canIssue && (
                  <TableCell label="Actions">
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={level.onHand <= 0}
                      onClick={(event) => {
                        event.stopPropagation();
                        setIssuingLevel(level);
                      }}
                    >
                      Issue
                    </Button>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {movementModal && (
        <StockMovementModal
          kind={movementModal.kind}
          branchId={branchId}
          items={items}
          defaultItemId={movementModal.defaultItemId}
          onClose={() => setMovementModal(null)}
          onSaved={load}
        />
      )}

      {ledgerLevel && (
        <StockLedgerModal level={ledgerLevel} branchId={branchId} onClose={() => setLedgerLevel(null)} />
      )}

      {issuingLevel && (
        <StockIssueModal level={issuingLevel} branchId={branchId} onClose={() => setIssuingLevel(null)} onSaved={load} />
      )}
    </div>
  );
}
