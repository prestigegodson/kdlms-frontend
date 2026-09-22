import { ClipboardList, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { ApiError } from "@/api/client";
import {
  getRequisition,
  type InventoryItemView,
  listItems,
  listRequisitions,
  type RequisitionSummaryView,
  type RequisitionView,
} from "@/api/inventory";
import { can } from "@/auth/permissions";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { FormField } from "@/components/ui/FormField";
import { Select } from "@/components/ui/Select";
import { Skeleton } from "@/components/ui/Skeleton";
import { StickySubHeader } from "@/components/ui/StickySubHeader";
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from "@/components/ui/Table";
import { BranchFilter } from "@/features/branches/components/BranchFilter";
import { useBranchScope } from "@/features/branches/useBranchScope";
import { RequisitionDetailModal } from "@/features/inventory/components/RequisitionDetailModal";
import { RequisitionFormModal } from "@/features/inventory/components/RequisitionFormModal";
import { RequisitionStatusBadge } from "@/features/inventory/components/RequisitionStatusBadge";
import { useAuthStore } from "@/stores/authStore";

const STATUS_OPTIONS = ["DRAFT", "SUBMITTED", "APPROVED", "REJECTED", "ISSUED", "CANCELLED"] as const;

interface RequisitionsTabProps {
  /** Seeds the status filter - the dashboard's "Awaiting review"/"Draft" deep links into this tab. */
  initialStatus?: string;
}

/** The requisition worklist for one branch - status filter, row-click opens the detail modal, "New requisition" opens the form. */
export function RequisitionsTab({ initialStatus = "" }: RequisitionsTabProps) {
  const role = useAuthStore((state) => state.user?.role);
  const canManage = can.manageRequisitions(role);
  const { ready: branchReady, branchId } = useBranchScope();

  const [status, setStatus] = useState(initialStatus);
  const [requisitions, setRequisitions] = useState<RequisitionSummaryView[] | null>(null);
  const [items, setItems] = useState<InventoryItemView[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [editingRequisition, setEditingRequisition] = useState<RequisitionView | null>(null);
  const [openRequisitionId, setOpenRequisitionId] = useState<string | null>(null);
  const [openRequisition, setOpenRequisition] = useState<RequisitionView | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);

  function load() {
    if (!branchReady) return;
    Promise.all([listRequisitions(branchId, status || undefined), listItems(undefined, true)])
      .then(([requisitionsResult, itemsResult]) => {
        setRequisitions(requisitionsResult);
        setItems(itemsResult);
      })
      .catch((err: unknown) => setLoadError(err instanceof ApiError ? err.message : "Failed to load requisitions"));
  }

  useEffect(load, [branchReady, branchId, status]);

  function openDetail(requisitionId: string) {
    setOpenRequisitionId(requisitionId);
    setDetailError(null);
    getRequisition(requisitionId)
      .then(setOpenRequisition)
      .catch((err: unknown) => setDetailError(err instanceof ApiError ? err.message : "Failed to load requisition"));
  }

  function closeDetail() {
    setOpenRequisitionId(null);
    setOpenRequisition(null);
  }

  function reloadOpenRequisition() {
    if (openRequisitionId) {
      getRequisition(openRequisitionId).then(setOpenRequisition);
    }
    load();
  }

  if (loadError) {
    return <Alert variant="error">{loadError}</Alert>;
  }

  return (
    <div className="space-y-4">
      <StickySubHeader>
        {can.selectBranch(role) && <BranchFilter id="inventory-requisitions-branch" />}
        <FormField label="Status" htmlFor="requisition-status-filter" className="min-w-0 flex-1 lg:max-w-[12rem]">
          <Select id="requisition-status-filter" value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="">All statuses</option>
            {STATUS_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </Select>
        </FormField>
      </StickySubHeader>

      {canManage && (
        <div className="flex justify-end">
          <Button variant="accent" disabled={items.length === 0} onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            New requisition
          </Button>
        </div>
      )}
      {canManage && items.length === 0 && (
        <Alert variant="info">Add an item on the Items tab before raising a requisition.</Alert>
      )}

      {requisitions === null ? (
        <div className="space-y-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : requisitions.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="No requisitions yet"
          description={canManage ? "Raise your branch's first requisition." : "No requisitions have been raised yet."}
        />
      ) : (
        <Table>
          <TableHead>
            <TableRow>
              <TableHeaderCell>Reference</TableHeaderCell>
              <TableHeaderCell>Status</TableHeaderCell>
              <TableHeaderCell numeric>Lines</TableHeaderCell>
              <TableHeaderCell>Needed by</TableHeaderCell>
              <TableHeaderCell>Student</TableHeaderCell>
              <TableHeaderCell>Requested by</TableHeaderCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {requisitions.map((requisition) => (
              <TableRow key={requisition.id} onClick={() => openDetail(requisition.id)}>
                <TableCell label="Reference">{requisition.reference}</TableCell>
                <TableCell label="Status">
                  <RequisitionStatusBadge status={requisition.status} />
                </TableCell>
                <TableCell label="Lines" numeric>
                  {requisition.lineCount}
                </TableCell>
                <TableCell label="Needed by">{requisition.neededBy ?? "—"}</TableCell>
                <TableCell label="Student">{requisition.studentName ?? "—"}</TableCell>
                <TableCell label="Requested by">{requisition.requestedByName ?? "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {creating && (
        <RequisitionFormModal
          branchId={branchId}
          items={items}
          onClose={() => setCreating(false)}
          onSaved={load}
        />
      )}

      {editingRequisition && (
        <RequisitionFormModal
          requisition={editingRequisition}
          items={items}
          onClose={() => setEditingRequisition(null)}
          onSaved={reloadOpenRequisition}
        />
      )}

      {openRequisitionId && !editingRequisition && (
        <>
          {detailError && <Alert variant="error">{detailError}</Alert>}
          {openRequisition && (
            <RequisitionDetailModal
              requisition={openRequisition}
              onClose={closeDetail}
              onChanged={reloadOpenRequisition}
              onEdit={() => setEditingRequisition(openRequisition)}
            />
          )}
        </>
      )}
    </div>
  );
}
