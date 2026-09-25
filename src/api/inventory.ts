import { apiFetch } from "@/api/client";
import type { Page } from "@/api/types";

// ============ types ============
// Mirrors backend inventory.application.port.in.* - deliberately no entitlement/feature flag
// anywhere here, unlike billing.ts: the inventory module is ungated, every school gets it
// regardless of package.

/** Mirrors backend inventory.application.port.in.InventoryItemTypeView. */
export interface InventoryItemTypeView {
  id: string;
  name: string;
  description: string | null;
  active: boolean;
  position: number;
  createdAt: string;
  updatedAt: string;
}

/** Mirrors backend inventory.application.port.in.InventoryItemView - itemTypeName resolved so the UI never has to join. */
export interface InventoryItemView {
  id: string;
  itemTypeId: string;
  itemTypeName: string;
  name: string;
  code: string | null;
  description: string | null;
  unit: string;
  unitPrice: number | null;
  reorderLevel: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

/** One item's stock band, most-urgent first - see backend inventory.domain.StockBand. `UNTRACKED` (reorderLevel 0) never reaches the UI as a badge. */
export type StockBand = "OUT_OF_STOCK" | "LOW" | "APPROACHING" | "OK" | "UNTRACKED";

/** Mirrors backend inventory.application.port.in.StockLevelView - never a stored quantity, always derived. */
export interface StockLevelView {
  itemId: string;
  itemName: string;
  itemTypeName: string;
  unit: string;
  onHand: number;
  reorderLevel: number;
  lowStock: boolean;
  band: StockBand;
}

/**
 * Mirrors backend inventory.application.port.in.StockMovementView - one append-only ledger row.
 * studentId/studentName and issuedTo are set only on a direct ISSUE (Phase 40) - never both at
 * once, and both null on a RECEIPT/ADJUSTMENT, a legacy requisition-tied ISSUE (requisitionId set
 * instead), or a general-usage direct ISSUE with no "used for" description.
 */
export interface StockMovementView {
  id: string;
  itemId: string;
  itemName: string;
  kind: "RECEIPT" | "ISSUE" | "ADJUSTMENT";
  quantity: number;
  reason: string | null;
  reference: string | null;
  requisitionId: string | null;
  requisitionReference: string | null;
  studentId: string | null;
  studentName: string | null;
  issuedTo: string | null;
  occurredOn: string;
  createdBy: string;
  createdByName: string | null;
  createdAt: string;
}

/** FULFILLED replaced ISSUED in Phase 40, when a requisition became a purchase request only and stopped moving stock. */
export type RequisitionStatus = "DRAFT" | "SUBMITTED" | "APPROVED" | "REJECTED" | "FULFILLED" | "CANCELLED";

/**
 * A requisition list row - no lines, unlike RequisitionView. Mirrors backend
 * RequisitionSummaryView. totalRequestedAmount sums only the ad-hoc lines' quantity *
 * estimatedUnitCost - an inventory item line carries no cost - and is null when the requisition
 * has none.
 */
export interface RequisitionSummaryView {
  id: string;
  reference: string;
  status: RequisitionStatus;
  branchId: string;
  branchName: string | null;
  neededBy: string | null;
  lineCount: number;
  totalRequestedAmount: number | null;
  requestedByName: string | null;
  createdAt: string;
}

/**
 * itemId is null for an ad-hoc (non-inventory) line - description/estimatedUnitCost carry the
 * purchase's own details instead, and itemName mirrors description so the UI never has to branch
 * on line kind just to show a name. estimatedUnitCost/requestedAmount/approvedAmount are null for
 * an ordinary item line, which carries no cost. Since Phase 40 no line drafted through the UI
 * carries an itemId any more - a non-null one can only be historic, read-only line from a
 * requisition raised before Phase 40.
 */
export interface RequisitionLineView {
  id: string;
  itemId: string | null;
  itemName: string;
  unit: string | null;
  description: string | null;
  estimatedUnitCost: number | null;
  quantityRequested: number;
  quantityApproved: number | null;
  requestedAmount: number | null;
  approvedAmount: number | null;
  note: string | null;
}

/**
 * Mirrors backend inventory.application.port.in.RequisitionView - the full detail read, lines
 * included. totalRequestedAmount/totalApprovedAmount sum only the ad-hoc lines - null when the
 * requisition has none (or, for the approved total, hasn't been reviewed yet).
 */
export interface RequisitionView {
  id: string;
  reference: string;
  status: RequisitionStatus;
  branchId: string;
  branchName: string | null;
  purpose: string | null;
  neededBy: string | null;
  lines: RequisitionLineView[];
  totalRequestedAmount: number | null;
  totalApprovedAmount: number | null;
  requestedBy: string;
  requestedByName: string | null;
  submittedAt: string | null;
  reviewedBy: string | null;
  reviewedByName: string | null;
  reviewedAt: string | null;
  reviewNote: string | null;
  fulfilledBy: string | null;
  fulfilledByName: string | null;
  fulfilledAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SaveItemTypeRequest {
  name: string;
  description: string | null;
  active: boolean;
  position: number;
}

export interface SaveItemRequest {
  itemTypeId: string | null;
  name: string;
  code: string | null;
  description: string | null;
  unit: string;
  unitPrice: number | null;
  reorderLevel: number;
  active: boolean;
}

export interface ReceiveStockRequest {
  branchId?: string;
  itemId: string;
  quantity: number;
  reference: string | null;
  occurredOn: string | null;
}

export interface AdjustStockRequest {
  branchId?: string;
  itemId: string;
  quantity: number;
  reason: string;
  occurredOn: string | null;
}

/**
 * A direct stock issue (Phase 40/41) - either studentId names a student recipient, or the issue is
 * general usage, optionally described by issuedTo (free text); never both at once. note is
 * optional. Takes effect immediately, refused (422) if on-hand can't cover it.
 */
export interface IssueStockRequest {
  branchId?: string;
  itemId: string;
  quantity: number;
  studentId: string | null;
  issuedTo: string | null;
  note: string | null;
  occurredOn: string | null;
}

/** A described, non-inventory purchase - since Phase 40 a requisition line names no inventory item. */
export interface RequisitionLineRequest {
  description: string | null;
  estimatedUnitCost: number | null;
  quantityRequested: number;
  note: string | null;
}

export interface SaveRequisitionRequest {
  branchId?: string;
  purpose: string | null;
  neededBy: string | null;
  lines: RequisitionLineRequest[];
}

export interface ApproveRequisitionRequest {
  quantityApprovedByLineId: Record<string, number>;
  reviewNote: string | null;
}

// ============ paths ============

const ITEM_TYPES_BASE = "/api/v1/inventory/item-types";
const ITEMS_BASE = "/api/v1/inventory/items";
const STOCK_BASE = "/api/v1/inventory/stock";
const REQUISITIONS_BASE = "/api/v1/inventory/requisitions";

// ============ item types ============

export function listItemTypes(): Promise<InventoryItemTypeView[]> {
  return apiFetch<InventoryItemTypeView[]>(ITEM_TYPES_BASE);
}

export function createItemType(request: SaveItemTypeRequest): Promise<InventoryItemTypeView> {
  return apiFetch<InventoryItemTypeView>(ITEM_TYPES_BASE, { method: "POST", body: JSON.stringify(request) });
}

export function updateItemType(itemTypeId: string, request: SaveItemTypeRequest): Promise<InventoryItemTypeView> {
  return apiFetch<InventoryItemTypeView>(`${ITEM_TYPES_BASE}/${itemTypeId}`, {
    method: "PUT",
    body: JSON.stringify(request),
  });
}

export function deleteItemType(itemTypeId: string): Promise<void> {
  return apiFetch<void>(`${ITEM_TYPES_BASE}/${itemTypeId}`, { method: "DELETE" });
}

// ============ items ============

export function listItems(itemTypeId?: string, activeOnly = false): Promise<InventoryItemView[]> {
  const params = new URLSearchParams();
  if (itemTypeId) params.set("itemTypeId", itemTypeId);
  if (activeOnly) params.set("activeOnly", "true");
  const query = params.toString();
  return apiFetch<InventoryItemView[]>(query ? `${ITEMS_BASE}?${query}` : ITEMS_BASE);
}

export function createItem(request: SaveItemRequest): Promise<InventoryItemView> {
  return apiFetch<InventoryItemView>(ITEMS_BASE, { method: "POST", body: JSON.stringify(request) });
}

export function updateItem(itemId: string, request: SaveItemRequest): Promise<InventoryItemView> {
  return apiFetch<InventoryItemView>(`${ITEMS_BASE}/${itemId}`, { method: "PUT", body: JSON.stringify(request) });
}

export function deleteItem(itemId: string): Promise<void> {
  return apiFetch<void>(`${ITEMS_BASE}/${itemId}`, { method: "DELETE" });
}

// ============ stock ============

/** branchId is optional - a BRANCH_ADMIN's own branch is derived server-side; a SCHOOL_ADMIN must supply one. */
export function getStockLevels(branchId?: string): Promise<StockLevelView[]> {
  const params = new URLSearchParams();
  if (branchId) params.set("branchId", branchId);
  const query = params.toString();
  return apiFetch<StockLevelView[]>(query ? `${STOCK_BASE}?${query}` : STOCK_BASE);
}

export function getStockMovements(
  branchId?: string,
  itemId?: string,
  page = 0,
  size = 20,
): Promise<Page<StockMovementView>> {
  const params = new URLSearchParams({ page: String(page), size: String(size) });
  if (branchId) params.set("branchId", branchId);
  if (itemId) params.set("itemId", itemId);
  return apiFetch<Page<StockMovementView>>(`${STOCK_BASE}/movements?${params}`);
}

export function receiveStock(request: ReceiveStockRequest): Promise<StockMovementView> {
  return apiFetch<StockMovementView>(`${STOCK_BASE}/movements/receive`, {
    method: "POST",
    body: JSON.stringify(request),
  });
}

export function adjustStock(request: AdjustStockRequest): Promise<StockMovementView> {
  return apiFetch<StockMovementView>(`${STOCK_BASE}/movements/adjust`, {
    method: "POST",
    body: JSON.stringify(request),
  });
}

/** Records a direct issue to a named recipient - no approval step, refused (422) if on-hand can't cover it. */
export function issueStock(request: IssueStockRequest): Promise<StockMovementView> {
  return apiFetch<StockMovementView>(`${STOCK_BASE}/movements/issue`, {
    method: "POST",
    body: JSON.stringify(request),
  });
}

// ============ requisitions ============

export function listRequisitions(branchId?: string, status?: string): Promise<RequisitionSummaryView[]> {
  const params = new URLSearchParams();
  if (branchId) params.set("branchId", branchId);
  if (status) params.set("status", status);
  const query = params.toString();
  return apiFetch<RequisitionSummaryView[]>(query ? `${REQUISITIONS_BASE}?${query}` : REQUISITIONS_BASE);
}

export function getRequisition(requisitionId: string): Promise<RequisitionView> {
  return apiFetch<RequisitionView>(`${REQUISITIONS_BASE}/${requisitionId}`);
}

export function createRequisition(request: SaveRequisitionRequest): Promise<RequisitionView> {
  return apiFetch<RequisitionView>(REQUISITIONS_BASE, { method: "POST", body: JSON.stringify(request) });
}

export function updateRequisition(requisitionId: string, request: SaveRequisitionRequest): Promise<RequisitionView> {
  return apiFetch<RequisitionView>(`${REQUISITIONS_BASE}/${requisitionId}`, {
    method: "PUT",
    body: JSON.stringify(request),
  });
}

export function deleteRequisition(requisitionId: string): Promise<void> {
  return apiFetch<void>(`${REQUISITIONS_BASE}/${requisitionId}`, { method: "DELETE" });
}

export function submitRequisition(requisitionId: string): Promise<RequisitionView> {
  return apiFetch<RequisitionView>(`${REQUISITIONS_BASE}/${requisitionId}/submit`, { method: "POST" });
}

export function withdrawRequisition(requisitionId: string): Promise<RequisitionView> {
  return apiFetch<RequisitionView>(`${REQUISITIONS_BASE}/${requisitionId}/withdraw`, { method: "POST" });
}

export function approveRequisition(requisitionId: string, request: ApproveRequisitionRequest): Promise<RequisitionView> {
  return apiFetch<RequisitionView>(`${REQUISITIONS_BASE}/${requisitionId}/approve`, {
    method: "POST",
    body: JSON.stringify(request),
  });
}

export function rejectRequisition(requisitionId: string, reviewNote: string): Promise<RequisitionView> {
  return apiFetch<RequisitionView>(`${REQUISITIONS_BASE}/${requisitionId}/reject`, {
    method: "POST",
    body: JSON.stringify({ reviewNote }),
  });
}

/** Marks an APPROVED requisition FULFILLED - the purchase was made or the money released. Moves no stock. */
export function fulfilRequisition(requisitionId: string): Promise<RequisitionView> {
  return apiFetch<RequisitionView>(`${REQUISITIONS_BASE}/${requisitionId}/fulfil`, { method: "POST" });
}

export function cancelRequisition(requisitionId: string): Promise<RequisitionView> {
  return apiFetch<RequisitionView>(`${REQUISITIONS_BASE}/${requisitionId}/cancel`, { method: "POST" });
}
