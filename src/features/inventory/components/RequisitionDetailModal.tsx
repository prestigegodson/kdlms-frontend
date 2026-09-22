import { useState } from "react";
import { ApiError } from "@/api/client";
import {
  approveRequisition,
  cancelRequisition,
  deleteRequisition,
  issueRequisition,
  rejectRequisition,
  type RequisitionView,
  submitRequisition,
  withdrawRequisition,
} from "@/api/inventory";
import { can } from "@/auth/permissions";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { FormField } from "@/components/ui/FormField";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from "@/components/ui/Table";
import { Textarea } from "@/components/ui/Textarea";
import { RequisitionStatusBadge } from "@/features/inventory/components/RequisitionStatusBadge";
import { useAuthStore } from "@/stores/authStore";

interface RequisitionDetailModalProps {
  requisition: RequisitionView;
  onClose: () => void;
  onChanged: () => void;
  onEdit: () => void;
}

type InlineAction = "approve" | "reject" | null;

/** A requisition's detail read plus every status transition it may take right now. */
export function RequisitionDetailModal({ requisition, onClose, onChanged, onEdit }: RequisitionDetailModalProps) {
  const role = useAuthStore((state) => state.user?.role);
  const canManage = can.manageRequisitions(role);
  const canReview = can.reviewRequisitions(role);

  const [inlineAction, setInlineAction] = useState<InlineAction>(null);
  const [approvedByLine, setApprovedByLine] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      requisition.lines.map((line) => [line.id, String(line.quantityApproved ?? line.quantityRequested)]),
    ),
  );
  const [reviewNote, setReviewNote] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const showApprovedColumn =
    inlineAction === "approve" || (requisition.status !== "DRAFT" && requisition.status !== "SUBMITTED");

  async function run(action: () => Promise<unknown>) {
    setSubmitting(true);
    setError(null);
    try {
      await action();
      onChanged();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to update requisition");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleApprove() {
    const quantityApprovedByLineId = Object.fromEntries(
      Object.entries(approvedByLine).map(([lineId, value]) => [lineId, Number(value)]),
    );
    await run(async () => {
      await approveRequisition(requisition.id, { quantityApprovedByLineId, reviewNote: reviewNote || null });
      setInlineAction(null);
    });
  }

  async function handleReject() {
    await run(async () => {
      await rejectRequisition(requisition.id, reviewNote);
      setInlineAction(null);
    });
  }

  async function confirmDelete() {
    await deleteRequisition(requisition.id);
    setDeleting(false);
    onChanged();
    onClose();
  }

  return (
    <Modal open onClose={onClose} title={requisition.reference} size="lg">
      <div className="space-y-4">
        {error && <Alert variant="error">{error}</Alert>}

        <div className="flex flex-wrap items-center gap-2">
          <RequisitionStatusBadge status={requisition.status} />
          {requisition.branchName && <span className="text-sm text-slate-500">{requisition.branchName}</span>}
        </div>

        <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-slate-500">Requested by</dt>
            <dd className="text-slate-900">{requisition.requestedByName ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Needed by</dt>
            <dd className="text-slate-900">{requisition.neededBy ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Student</dt>
            <dd className="text-slate-900">
              {requisition.studentName
                ? requisition.studentAdmissionNumber
                  ? `${requisition.studentName} (${requisition.studentAdmissionNumber})`
                  : requisition.studentName
                : "—"}
            </dd>
          </div>
          {requisition.purpose && (
            <div className="sm:col-span-2">
              <dt className="text-slate-500">Purpose</dt>
              <dd className="text-slate-900">{requisition.purpose}</dd>
            </div>
          )}
        </dl>

        <Table>
          <TableHead>
            <TableRow>
              <TableHeaderCell>Item</TableHeaderCell>
              <TableHeaderCell numeric>Requested</TableHeaderCell>
              {showApprovedColumn && <TableHeaderCell numeric>Approved</TableHeaderCell>}
            </TableRow>
          </TableHead>
          <TableBody>
            {requisition.lines.map((line) => (
              <TableRow key={line.id}>
                <TableCell label="Item">
                  {line.itemName}
                  {line.note && <span className="block text-xs text-slate-500">{line.note}</span>}
                </TableCell>
                <TableCell label="Requested" numeric>
                  {line.quantityRequested} {line.unit}
                </TableCell>
                {showApprovedColumn && (
                  <TableCell label="Approved" numeric>
                    {inlineAction === "approve" ? (
                      <Input
                        aria-label={`Approved quantity for ${line.itemName}`}
                        type="number"
                        min={0}
                        max={line.quantityRequested}
                        className="w-20 text-right"
                        value={approvedByLine[line.id] ?? ""}
                        onChange={(event) =>
                          setApprovedByLine((current) => ({ ...current, [line.id]: event.target.value }))
                        }
                      />
                    ) : (
                      (line.quantityApproved ?? "—")
                    )}
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>

        {requisition.reviewNote && (
          <Alert variant={requisition.status === "REJECTED" ? "error" : "info"} title="Review note">
            {requisition.reviewNote}
          </Alert>
        )}

        {inlineAction === "approve" && (
          <FormField label="Review note" htmlFor="approve-review-note" description="Optional.">
            <Textarea
              id="approve-review-note"
              rows={2}
              value={reviewNote}
              onChange={(event) => setReviewNote(event.target.value)}
            />
          </FormField>
        )}
        {inlineAction === "reject" && (
          <FormField label="Reason" htmlFor="reject-review-note" description="Required.">
            <Textarea
              id="reject-review-note"
              required
              rows={2}
              value={reviewNote}
              onChange={(event) => setReviewNote(event.target.value)}
            />
          </FormField>
        )}

        <div className="flex flex-wrap justify-end gap-2">
          {inlineAction && (
            <Button type="button" variant="secondary" onClick={() => setInlineAction(null)}>
              Cancel
            </Button>
          )}
          {!inlineAction && canManage && requisition.status === "DRAFT" && (
            <>
              <Button variant="ghost" onClick={() => setDeleting(true)} disabled={submitting}>
                Delete
              </Button>
              <Button variant="secondary" onClick={onEdit} disabled={submitting}>
                Edit
              </Button>
              <Button variant="accent" onClick={() => run(() => submitRequisition(requisition.id))} disabled={submitting}>
                Submit
              </Button>
            </>
          )}
          {!inlineAction && canManage && requisition.status === "SUBMITTED" && (
            <Button variant="secondary" onClick={() => run(() => withdrawRequisition(requisition.id))} disabled={submitting}>
              Withdraw
            </Button>
          )}
          {!inlineAction && canReview && requisition.status === "SUBMITTED" && (
            <>
              <Button variant="ghost" onClick={() => setInlineAction("reject")} disabled={submitting}>
                Reject
              </Button>
              <Button variant="accent" onClick={() => setInlineAction("approve")} disabled={submitting}>
                Approve
              </Button>
            </>
          )}
          {inlineAction === "approve" && (
            <Button variant="accent" onClick={handleApprove} disabled={submitting}>
              {submitting ? "Approving…" : "Confirm approval"}
            </Button>
          )}
          {inlineAction === "reject" && (
            <Button variant="accent" onClick={handleReject} disabled={submitting || reviewNote.trim() === ""}>
              {submitting ? "Rejecting…" : "Confirm rejection"}
            </Button>
          )}
          {/*
            Cancel is an author action, not a review decision - the backend's RequisitionStatusPolicy
            allows it from DRAFT/SUBMITTED/APPROVED alike, and ManageRequisitionsService routes it
            through requireVisibleRequisition rather than requireReviewableRequisition, so it's
            gated on canManage (which an INVENTORY_MANAGER has for their own requisition) at every
            status, not canReview. Issue stays canReview-only - only SCHOOL_ADMIN/BRANCH_ADMIN may
            actually fulfil a requisition.
          */}
          {!inlineAction && canManage && requisition.status === "APPROVED" && (
            <Button variant="ghost" onClick={() => run(() => cancelRequisition(requisition.id))} disabled={submitting}>
              Cancel requisition
            </Button>
          )}
          {!inlineAction && canReview && requisition.status === "APPROVED" && (
            <Button variant="accent" onClick={() => run(() => issueRequisition(requisition.id))} disabled={submitting}>
              Issue
            </Button>
          )}
          {!inlineAction && canManage && requisition.status === "SUBMITTED" && (
            <Button variant="ghost" onClick={() => run(() => cancelRequisition(requisition.id))} disabled={submitting}>
              Cancel requisition
            </Button>
          )}
        </div>
      </div>

      {deleting && (
        <ConfirmDialog
          title="Delete requisition"
          message={`Delete "${requisition.reference}"? This can't be undone.`}
          confirmLabel="Delete"
          variant="danger"
          onConfirm={confirmDelete}
          onClose={() => setDeleting(false)}
        />
      )}
    </Modal>
  );
}
