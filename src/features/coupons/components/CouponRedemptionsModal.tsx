import { useEffect, useState } from "react";
import { getErrorMessage } from "@/api/client";
import { type CouponRedemptionView, type CouponView, listCouponRedemptions } from "@/api/coupons";
import type { Page } from "@/api/types";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { Pagination } from "@/components/ui/Pagination";
import { Spinner } from "@/components/ui/Spinner";
import { formatInstant } from "@/utils/date";

const STATUS_LABEL: Record<CouponRedemptionView["status"], string> = {
  PENDING: "Awaiting payment",
  REDEEMED: "Redeemed",
  RELEASED: "Not completed",
};

const STATUS_VARIANT: Record<CouponRedemptionView["status"], "success" | "warning" | "neutral"> = {
  PENDING: "warning",
  REDEEMED: "success",
  RELEASED: "neutral",
};

function remaining(redemption: CouponRedemptionView): string {
  if (redemption.status !== "REDEEMED") return "—";
  if (redemption.periodsRemaining == null) return "Every renewal";
  return String(redemption.periodsRemaining);
}

/** Who has used a coupon - one row per school or creator, the system admin's redemption list. */
export function CouponRedemptionsModal({
  coupon,
  onClose,
}: {
  coupon: CouponView;
  onClose: () => void;
}) {
  const [pageIndex, setPageIndex] = useState(0);
  const [page, setPage] = useState<Page<CouponRedemptionView> | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    listCouponRedemptions(coupon.id, pageIndex)
      .then((result) => {
        if (!cancelled) setPage(result);
      })
      .catch((caught: unknown) => {
        if (!cancelled) setError(getErrorMessage(caught, "Failed to load redemptions"));
      });
    return () => {
      cancelled = true;
    };
  }, [coupon.id, pageIndex]);

  return (
    <Modal open onClose={onClose} title={`${coupon.code} redemptions`} size="xl">
      {error && <Alert variant="error">{error}</Alert>}
      {!error && page === null && (
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Spinner /> Loading…
        </div>
      )}
      {page && page.content.length === 0 && (
        <p className="text-sm text-slate-500">Nobody has used this coupon yet.</p>
      )}
      {page && page.content.length > 0 && (
        <div className="space-y-3">
          <ul className="divide-y divide-slate-100">
            {page.content.map((redemption) => (
              <li
                key={redemption.id}
                className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm"
              >
                <div>
                  <p className="font-medium text-slate-900">{redemption.schoolName ?? "—"}</p>
                  <p className="text-xs text-slate-500">
                    {formatInstant(redemption.redeemedAt ?? redemption.createdAt)} · Renewals left:{" "}
                    {remaining(redemption)}
                  </p>
                </div>
                <Badge variant={STATUS_VARIANT[redemption.status]}>
                  {STATUS_LABEL[redemption.status]}
                </Badge>
              </li>
            ))}
          </ul>
          <Pagination page={page} onPageChange={setPageIndex} />
        </div>
      )}
    </Modal>
  );
}
