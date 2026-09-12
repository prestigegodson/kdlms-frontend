import { Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { deleteFee, type FeeView, listFees } from "@/api/billing";
import { ApiError } from "@/api/client";
import { can } from "@/auth/permissions";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from "@/components/ui/Table";
import { FeeFormModal } from "@/features/billing/components/FeeFormModal";
import { useAuthStore } from "@/stores/authStore";
import { useFeatureStore } from "@/stores/featureStore";

/** The fee catalogue - a definition list, no amounts. SCHOOL_ADMIN writes; BRANCH_ADMIN reads only. */
export function FeesTab() {
  const role = useAuthStore((state) => state.user?.role);
  const entitled = useFeatureStore((state) => state.billing);
  const canManage = can.manageFees(role, entitled);

  const [fees, setFees] = useState<FeeView[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [editingFee, setEditingFee] = useState<FeeView | "new" | null>(null);
  const [deletingFee, setDeletingFee] = useState<FeeView | null>(null);

  function load() {
    listFees()
      .then(setFees)
      .catch((err: unknown) => setLoadError(err instanceof ApiError ? err.message : "Failed to load fees"));
  }

  useEffect(load, []);

  // ConfirmDialog itself catches a rejection and renders it inline, staying open (the
  // LevelsPage.confirmDelete precedent) - the delete guard's 422 (a fee that's been priced)
  // surfaces there rather than crashing the tab.
  async function confirmDelete(fee: FeeView) {
    await deleteFee(fee.id);
    setDeletingFee(null);
    load();
  }

  if (loadError) {
    return <Alert variant="error">{loadError}</Alert>;
  }

  if (fees === null) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {canManage && (
        <div className="flex justify-end">
          <Button variant="accent" onClick={() => setEditingFee("new")}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            Add fee
          </Button>
        </div>
      )}

      {fees.length === 0 ? (
        <EmptyState
          title="No fees yet"
          description={
            canManage
              ? "Add your school's first fee - tuition, registration, or any other charge."
              : "Your school hasn't defined any fees yet."
          }
        />
      ) : (
        <Table>
          <TableHead>
            <TableRow>
              <TableHeaderCell>Name</TableHeaderCell>
              <TableHeaderCell>Applies</TableHeaderCell>
              <TableHeaderCell>Levels</TableHeaderCell>
              <TableHeaderCell>Compulsory</TableHeaderCell>
              <TableHeaderCell>Status</TableHeaderCell>
              {canManage && <TableHeaderCell>Actions</TableHeaderCell>}
            </TableRow>
          </TableHead>
          <TableBody>
            {fees.map((fee) => (
              <TableRow key={fee.id}>
                <TableCell label="Name">
                  <span className="flex items-center gap-2">
                    {fee.name}
                    {fee.kind === "TRANSPORT" && (
                      <Badge variant="neutral">School bus</Badge>
                    )}
                    {fee.priceVariesByTerm && <Badge variant="neutral">Per term</Badge>}
                  </span>
                </TableCell>
                <TableCell label="Applies">
                  {fee.applicability === "TERMLY"
                    ? `Terms ${fee.termNumbers?.join(", ") ?? ""}`
                    : "Admission term"}
                </TableCell>
                <TableCell label="Levels">
                  {fee.kind === "TRANSPORT"
                    ? "Every level"
                    : fee.levels.map((level) => level.levelName).join(", ")}
                </TableCell>
                <TableCell label="Compulsory">
                  <Badge variant={fee.compulsory ? "brand" : "neutral"}>
                    {fee.compulsory ? "Compulsory" : "Optional"}
                  </Badge>
                </TableCell>
                <TableCell label="Status">
                  <Badge variant={fee.active ? "success" : "neutral"}>{fee.active ? "Active" : "Inactive"}</Badge>
                </TableCell>
                {canManage && (
                  <TableCell label="Actions">
                    <div className="flex gap-3">
                      <Button variant="ghost" size="sm" onClick={() => setEditingFee(fee)}>
                        Edit
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => setDeletingFee(fee)}>
                        Delete
                      </Button>
                    </div>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {editingFee && (
        <FeeFormModal
          fee={editingFee === "new" ? undefined : editingFee}
          nextPosition={fees.length}
          onClose={() => setEditingFee(null)}
          onSaved={load}
        />
      )}

      {deletingFee && (
        <ConfirmDialog
          title="Delete fee"
          message={`Delete "${deletingFee.name}"? This can't be undone.`}
          confirmLabel="Delete"
          variant="danger"
          onConfirm={() => confirmDelete(deletingFee)}
          onClose={() => setDeletingFee(null)}
        />
      )}
    </div>
  );
}
