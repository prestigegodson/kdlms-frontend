import { Plus, Ticket } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { getErrorMessage } from "@/api/client";
import {
  type CouponStatus,
  type CouponView,
  deleteCoupon,
  listCoupons,
  updateCoupon,
} from "@/api/coupons";
import type { Page } from "@/api/types";
import { ActionMenu, type ActionMenuItem } from "@/components/ui/ActionMenu";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { FormField } from "@/components/ui/FormField";
import { PageHeader } from "@/components/ui/PageHeader";
import { Pagination } from "@/components/ui/Pagination";
import { SearchInput } from "@/components/ui/SearchInput";
import { Select } from "@/components/ui/Select";
import { StickySubHeader } from "@/components/ui/StickySubHeader";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
} from "@/components/ui/Table";
import { TableSkeleton } from "@/components/ui/TableSkeleton";
import { formatLongDate, instantToLocalDate } from "@/utils/date";
import { discountLabel, durationLabel } from "../subscriptionBilling/couponText";
import { CouponFormModal } from "./components/CouponFormModal";
import { CouponRedemptionsModal } from "./components/CouponRedemptionsModal";

const PAGE_SIZE = 20;

type State =
  | { kind: "loading" }
  | { kind: "loaded"; page: Page<CouponView> }
  | { kind: "error"; message: string };

type Dialog =
  | { kind: "create" }
  | { kind: "edit"; coupon: CouponView }
  | { kind: "redemptions"; coupon: CouponView }
  | { kind: "delete"; coupon: CouponView };

const AUDIENCE_LABEL: Record<CouponView["audience"], string> = {
  CREATOR: "Creators",
  SCHOOL: "Schools",
  ANY: "Everyone",
};

function validity(coupon: CouponView): string {
  const until = coupon.validUntil
    ? `until ${formatLongDate(instantToLocalDate(coupon.validUntil))}`
    : "no end date";
  return `From ${formatLongDate(instantToLocalDate(coupon.validFrom))}, ${until}`;
}

/** The system admin's coupons (creators.md §6.2, Phase C9): issue, edit, disable, and see who used them. */
export function CouponsPage() {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<CouponStatus | "">("");
  const [pageIndex, setPageIndex] = useState(0);
  const [state, setState] = useState<State>({ kind: "loading" });
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const reload = useCallback(() => setReloadKey((key) => key + 1), []);

  useEffect(() => {
    let cancelled = false;
    listCoupons(query, status, pageIndex, PAGE_SIZE)
      .then((page) => {
        if (!cancelled) setState({ kind: "loaded", page });
      })
      .catch((caught: unknown) => {
        if (!cancelled)
          setState({ kind: "error", message: getErrorMessage(caught, "Failed to load coupons") });
      });
    return () => {
      cancelled = true;
    };
  }, [query, status, pageIndex, reloadKey]);

  async function setCouponStatus(coupon: CouponView, next: CouponStatus) {
    setError(null);
    try {
      await updateCoupon(coupon.id, {
        description: coupon.description,
        validFrom: coupon.validFrom,
        validUntil: coupon.validUntil,
        maxRedemptions: coupon.maxRedemptions,
        status: next,
        packageIds: coupon.packages.map((p) => p.id),
      });
      reload();
    } catch (caught) {
      setError(getErrorMessage(caught, "Couldn't update the coupon."));
    }
  }

  function actions(coupon: CouponView): ActionMenuItem[] {
    const items: ActionMenuItem[] = [
      { label: "Edit", onSelect: () => setDialog({ kind: "edit", coupon }) },
      { label: "Redemptions", onSelect: () => setDialog({ kind: "redemptions", coupon }) },
      coupon.status === "ACTIVE"
        ? { label: "Disable", onSelect: () => void setCouponStatus(coupon, "DISABLED") }
        : { label: "Enable", onSelect: () => void setCouponStatus(coupon, "ACTIVE") },
    ];
    if (coupon.deletable) {
      items.push({
        label: "Delete",
        variant: "danger",
        separated: true,
        onSelect: () => setDialog({ kind: "delete", coupon }),
      });
    }
    return items;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Coupons"
        description="Discounts creators and schools can apply when they pay for a plan."
        actions={
          <Button onClick={() => setDialog({ kind: "create" })}>
            <Plus className="h-4 w-4" aria-hidden /> New coupon
          </Button>
        }
      />

      <StickySubHeader>
        <SearchInput
          value={query}
          onChange={(next) => {
            setQuery(next);
            setPageIndex(0);
          }}
          placeholder="Search by code"
          className="w-full sm:w-64"
        />
        <FormField
          label="Status"
          htmlFor="coupon-status-filter"
          className="w-40"
          labelClassName="sr-only"
        >
          <Select
            id="coupon-status-filter"
            value={status}
            onChange={(event) => {
              setStatus(event.target.value as CouponStatus | "");
              setPageIndex(0);
            }}
          >
            <option value="">All statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="DISABLED">Disabled</option>
          </Select>
        </FormField>
      </StickySubHeader>

      {error && <Alert variant="error">{error}</Alert>}
      {state.kind === "loading" && (
        <Card className="p-0">
          <TableSkeleton columns={6} />
        </Card>
      )}
      {state.kind === "error" && <Alert variant="error">{state.message}</Alert>}
      {state.kind === "loaded" && state.page.content.length === 0 && (
        <EmptyState
          icon={Ticket}
          title="No coupons"
          description={
            query || status ? "No coupons match." : "Create a coupon to offer a discount on plans."
          }
        />
      )}
      {state.kind === "loaded" && state.page.content.length > 0 && (
        <>
          <Card className="p-0">
            <Table>
              <TableHead>
                <TableRow>
                  <TableHeaderCell>Code</TableHeaderCell>
                  <TableHeaderCell>Discount</TableHeaderCell>
                  <TableHeaderCell>For</TableHeaderCell>
                  <TableHeaderCell>Valid</TableHeaderCell>
                  <TableHeaderCell numeric>Used</TableHeaderCell>
                  <TableHeaderCell>Status</TableHeaderCell>
                  <TableHeaderCell>
                    <span className="sr-only">Actions</span>
                  </TableHeaderCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {state.page.content.map((coupon) => (
                  <TableRow key={coupon.id}>
                    <TableCell label="Code">
                      <span className="font-mono font-medium text-slate-900">{coupon.code}</span>
                      {coupon.description && (
                        <p className="text-xs text-slate-500">{coupon.description}</p>
                      )}
                    </TableCell>
                    <TableCell label="Discount">
                      {discountLabel(coupon.type, coupon.value, coupon.currency)}
                      <p className="text-xs text-slate-500">
                        {durationLabel(coupon.duration, coupon.durationPeriods)}
                      </p>
                    </TableCell>
                    <TableCell label="For">
                      {AUDIENCE_LABEL[coupon.audience]}
                      <p className="text-xs text-slate-500">
                        {coupon.packages.length === 0
                          ? "Any plan"
                          : coupon.packages.map((p) => p.name ?? "Unknown plan").join(", ")}
                      </p>
                    </TableCell>
                    <TableCell label="Valid" className="text-sm text-slate-600">
                      {validity(coupon)}
                    </TableCell>
                    <TableCell label="Used" numeric>
                      {coupon.redeemedRedemptions}
                      {coupon.maxRedemptions != null && ` / ${coupon.maxRedemptions}`}
                      {coupon.pendingRedemptions > 0 && (
                        <p className="text-xs text-slate-500">
                          {coupon.pendingRedemptions} awaiting payment
                        </p>
                      )}
                    </TableCell>
                    <TableCell label="Status">
                      <Badge variant={coupon.status === "ACTIVE" ? "success" : "neutral"}>
                        {coupon.status === "ACTIVE" ? "Active" : "Disabled"}
                      </Badge>
                    </TableCell>
                    <TableCell label="Actions">
                      <ActionMenu
                        items={actions(coupon)}
                        ariaLabel={`Actions for ${coupon.code}`}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
          <Pagination page={state.page} onPageChange={setPageIndex} />
        </>
      )}

      {(dialog?.kind === "create" || dialog?.kind === "edit") && (
        <CouponFormModal
          coupon={dialog.kind === "edit" ? dialog.coupon : undefined}
          onClose={() => setDialog(null)}
          onSaved={() => {
            setDialog(null);
            reload();
          }}
        />
      )}
      {dialog?.kind === "redemptions" && (
        <CouponRedemptionsModal coupon={dialog.coupon} onClose={() => setDialog(null)} />
      )}
      {dialog?.kind === "delete" && (
        <ConfirmDialog
          title={`Delete ${dialog.coupon.code}?`}
          message="Nobody has used this coupon, so it can be deleted for good."
          confirmLabel="Delete"
          variant="danger"
          onConfirm={async () => {
            await deleteCoupon(dialog.coupon.id);
            setDialog(null);
            reload();
          }}
          onClose={() => setDialog(null)}
        />
      )}
    </div>
  );
}
