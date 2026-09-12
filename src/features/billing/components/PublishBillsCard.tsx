import { Receipt } from "lucide-react";
import { useEffect, useState } from "react";
import {
  type BillPublicationPreflightView,
  type BillPublicationView,
  getBillPublication,
  getBillPublicationPreflight,
  issueMissingBillDeliveries,
  publishBills,
  unpublishBills,
} from "@/api/billing";
import { ApiError } from "@/api/client";
import { can } from "@/auth/permissions";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Checkbox } from "@/components/ui/Checkbox";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Modal } from "@/components/ui/Modal";
import { Spinner } from "@/components/ui/Spinner";
import { useAuthStore } from "@/stores/authStore";
import { useFeatureStore } from "@/stores/featureStore";
import { formatMoney } from "@/utils/currency";

interface PublishBillsCardProps {
  /** Omitted for a BRANCH_ADMIN - their own branch is derived server-side; a SCHOOL_ADMIN must have one selected (the `getBillingSummary`/`getClassBills` contract). */
  branchId?: string;
  termId: string;
  /** For formatting the preflight's expected total - the branch summary's own currency, since the preflight view itself carries none. */
  currency?: string;
}

/**
 * Publication state + preflight + Publish/Unpublish + "Send bills to new students" - the {@code
 * assessment}'s `AdminResultsPanel` publish toggle precedent, but with a preflight step (the
 * `PublishResultsModal` take-home-quiz precedent) since publishing a branch's bills is a
 * destructive, guardian-facing action worth a confirmation naming what's about to happen. Publish
 * is this screen's one accent - `BillExportCard`'s own actions are `primary`, not `accent`, so the
 * two cards never compete for the one-amber-per-view budget when both render together.
 */
export function PublishBillsCard({ branchId, termId, currency = "NGN" }: PublishBillsCardProps) {
  const role = useAuthStore((state) => state.user?.role);
  const entitled = useFeatureStore((state) => state.billing);
  const canPublish = can.publishBills(role, entitled);

  const [publication, setPublication] = useState<BillPublicationView | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [showPublishModal, setShowPublishModal] = useState(false);
  const [preflight, setPreflight] = useState<BillPublicationPreflightView | null>(null);
  const [preflightError, setPreflightError] = useState<string | null>(null);
  const [gapsAcknowledged, setGapsAcknowledged] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);

  const [showUnpublishConfirm, setShowUnpublishConfirm] = useState(false);

  const [issuingMissing, setIssuingMissing] = useState(false);
  const [issueMissingError, setIssueMissingError] = useState<string | null>(null);
  const [issueMissingMessage, setIssueMissingMessage] = useState<string | null>(null);

  useEffect(() => {
    // branchId is deliberately not required here - it's omitted for a BRANCH_ADMIN, whose own
    // branch is derived server-side (see this component's own branchId prop doc).
    if (!canPublish || !termId) {
      return;
    }
    let cancelled = false;

    async function load() {
      setLoading(true);
      setLoadError(null);
      try {
        const view = await getBillPublication(termId, branchId);
        if (!cancelled) setPublication(view);
      } catch (error) {
        if (!cancelled) setLoadError(error instanceof ApiError ? error.message : "Failed to load publication status");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();

    return () => {
      cancelled = true;
    };
  }, [canPublish, branchId, termId]);

  function refresh() {
    getBillPublication(termId, branchId)
      .then(setPublication)
      .catch(() => undefined);
  }

  function openPublishModal() {
    setShowPublishModal(true);
    setGapsAcknowledged(false);
    setPublishError(null);
    setPreflight(null);
    setPreflightError(null);
    getBillPublicationPreflight(termId, branchId)
      .then(setPreflight)
      .catch((error: unknown) =>
        setPreflightError(error instanceof ApiError ? error.message : "Failed to load the publish preview"),
      );
  }

  async function confirmPublish() {
    setPublishing(true);
    setPublishError(null);
    try {
      await publishBills(termId, branchId);
      setShowPublishModal(false);
      refresh();
    } catch (error) {
      setPublishError(error instanceof ApiError ? error.message : "Failed to publish bills");
    } finally {
      setPublishing(false);
    }
  }

  async function confirmUnpublish() {
    await unpublishBills(termId, branchId);
    refresh();
  }

  async function issueMissing() {
    setIssuingMissing(true);
    setIssueMissingError(null);
    setIssueMissingMessage(null);
    try {
      const result = await issueMissingBillDeliveries(termId, branchId);
      setIssueMissingMessage(
        result.queued === 0
          ? "Every billable student already has a bill queued."
          : `Queued ${result.queued} new ${result.queued === 1 ? "bill" : "bills"}.`,
      );
      refresh();
    } catch (error) {
      setIssueMissingError(error instanceof ApiError ? error.message : "Failed to issue missing bills");
    } finally {
      setIssuingMissing(false);
    }
  }

  if (!canPublish || !termId) {
    return null;
  }

  const hasGaps = (preflight?.unpricedCompulsoryFees.length ?? 0) > 0;
  const canConfirmPublish = Boolean(preflight) && !preflightError && (!hasGaps || gapsAcknowledged);

  return (
    <Card>
      <div className="flex items-start gap-3">
        <Receipt className="mt-0.5 h-5 w-5 shrink-0 text-slate-400" aria-hidden="true" />
        <div className="min-w-0 flex-1 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-slate-900">Bill publication</h2>
            {publication && (
              <Badge variant={publication.published ? "success" : "neutral"}>
                {publication.published ? "Published" : "Not yet published"}
              </Badge>
            )}
          </div>

          {loading && (
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <Spinner /> Checking publication status…
            </div>
          )}
          {loadError && <Alert variant="error">{loadError}</Alert>}

          {publication && (
            <p className="text-sm text-slate-500">
              {publication.published
                ? `Guardians on this branch can see and download their ward's bill for ${publication.termName}.`
                : `Bills for ${publication.termName} are not yet visible to guardians.`}
            </p>
          )}

          {publication?.published && (
            <p className="text-xs text-slate-400">
              Delivered {publication.deliveries.sent} · sending {publication.deliveries.pending
                + publication.deliveries.processing} · without a bill {publication.deliveries.sentWithoutBill} ·
              failed {publication.deliveries.failed}
            </p>
          )}

          {issueMissingError && <Alert variant="error">{issueMissingError}</Alert>}
          {issueMissingMessage && <Alert variant="success">{issueMissingMessage}</Alert>}

          <div className="flex flex-wrap gap-2">
            {!publication?.published && (
              <Button variant="accent" onClick={openPublishModal} loading={publishing}>
                Publish bills
              </Button>
            )}
            {publication?.published && (
              <>
                <Button variant="secondary" onClick={() => setShowUnpublishConfirm(true)}>
                  Unpublish
                </Button>
                <Button variant="secondary" onClick={issueMissing} loading={issuingMissing}>
                  Send bills to new students
                </Button>
              </>
            )}
          </div>
        </div>
      </div>

      <Modal open={showPublishModal} onClose={() => setShowPublishModal(false)} title="Publish bills" size="lg">
        <div className="space-y-4">
          {preflightError && <Alert variant="error">{preflightError}</Alert>}
          {!preflight && !preflightError && (
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <Spinner /> Checking readiness…
            </div>
          )}
          {preflight && (
            <>
              <p className="text-sm text-slate-600">
                {preflight.billableStudents} {preflight.billableStudents === 1 ? "student" : "students"} on this
                branch will get a bill, totalling {formatMoney(preflight.expectedTotal, currency)}.
                {preflight.studentsWithoutBill > 0 && (
                  <>
                    {" "}
                    {preflight.studentsWithoutBill} {preflight.studentsWithoutBill === 1 ? "student has" : "students have"}
                    {" "}no compulsory fees and will not receive a bill.
                  </>
                )}
                {preflight.advanceStudents > 0 && (
                  <>
                    {" "}
                    {preflight.advanceStudents} {preflight.advanceStudents === 1 ? "of these is an" : "of these are"}
                    {" "}advance bill{preflight.advanceStudents === 1 ? "" : "s"} for student{preflight.advanceStudents === 1 ? "" : "s"}
                    {" "}not yet promoted into this session.
                  </>
                )}
              </p>
              {hasGaps && (
                <Alert variant="warning" title="Some compulsory fees have no price for this branch/session">
                  <ul className="list-inside list-disc space-y-1">
                    {preflight.unpricedCompulsoryFees.map((gap) => (
                      <li key={`${gap.feeId}-${gap.levelId}`}>
                        {gap.feeName} - {gap.levelName} ({gap.affectedStudents}{" "}
                        {gap.affectedStudents === 1 ? "student" : "students"} affected)
                      </li>
                    ))}
                  </ul>
                </Alert>
              )}
              {hasGaps && (
                <label className="flex items-start gap-2 text-sm text-slate-700">
                  <Checkbox
                    checked={gapsAcknowledged}
                    onChange={(event) => setGapsAcknowledged(event.target.checked)}
                  />
                  Publish anyway - the affected students will simply not be billed for these fees.
                </label>
              )}
              {preflight.unpricedSelectedFees.length > 0 && (
                <Alert variant="warning" title="Some students are opted into an optional fee with no price set">
                  <p className="mb-1">
                    A missing optional price never blocks publishing - these students will simply not be charged
                    for it until it's priced or their opt-in is removed.
                  </p>
                  <ul className="list-inside list-disc space-y-1">
                    {preflight.unpricedSelectedFees.map((gap) => (
                      <li key={`${gap.feeId}-${gap.levelId}`}>
                        {gap.feeName} - {gap.levelName} ({gap.affectedStudents}{" "}
                        {gap.affectedStudents === 1 ? "student" : "students"} affected)
                      </li>
                    ))}
                  </ul>
                </Alert>
              )}
              {preflight.unpricedTransportRoutes.length > 0 && (
                <Alert variant="info" title="Some assigned bus riders have no fare priced for their route">
                  <p className="mb-1">
                    A school-bus charge is always optional, so this never blocks publishing - these riders will
                    simply not be charged for their bus until their direction is priced on the Transport tab.
                  </p>
                  <ul className="list-inside list-disc space-y-1">
                    {preflight.unpricedTransportRoutes.map((gap) => (
                      <li key={`${gap.routeId}-${gap.direction}`}>
                        {gap.routeName} - {gap.direction === "ONE_WAY" ? "One way" : "Two ways"} (
                        {gap.affectedStudents} {gap.affectedStudents === 1 ? "student" : "students"} affected)
                      </li>
                    ))}
                  </ul>
                </Alert>
              )}
              {preflight.unplannedClasses.length > 0 && (
                <Alert variant="info" title="Some classes have unpromoted students but no advance-bill plan">
                  <p className="mb-1">
                    This never blocks publishing - these students simply won't get a bill until their class is
                    mapped on the Advance bills card above.
                  </p>
                  <ul className="list-inside list-disc space-y-1">
                    {preflight.unplannedClasses.map((unplanned) => (
                      <li key={unplanned.classId}>
                        {unplanned.className} ({unplanned.levelName}) - {unplanned.activeStudents}{" "}
                        {unplanned.activeStudents === 1 ? "student" : "students"}
                      </li>
                    ))}
                  </ul>
                </Alert>
              )}
              {publishError && <Alert variant="error">{publishError}</Alert>}
              <div className="flex justify-end gap-2">
                <Button variant="secondary" onClick={() => setShowPublishModal(false)}>
                  Cancel
                </Button>
                <Button variant="accent" onClick={confirmPublish} loading={publishing} disabled={!canConfirmPublish}>
                  Publish
                </Button>
              </div>
            </>
          )}
        </div>
      </Modal>

      {showUnpublishConfirm && (
        <ConfirmDialog
          title="Unpublish these bills?"
          message="Guardians on this branch will no longer be able to see or download their ward's bill for this term."
          confirmLabel="Unpublish"
          variant="danger"
          onConfirm={confirmUnpublish}
          onClose={() => setShowUnpublishConfirm(false)}
        />
      )}
    </Card>
  );
}
