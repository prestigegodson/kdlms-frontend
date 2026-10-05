import { type FormEvent, useEffect, useState } from "react";
import { getErrorMessage } from "@/api/client";
import {
  type CouponAudience,
  type CouponStatus,
  type CouponView,
  createCoupon,
  updateCoupon,
} from "@/api/coupons";
import { listPackages, type PackageView } from "@/api/packages";
import type { CouponDuration, CouponType } from "@/api/subscriptionBilling";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { DateInput } from "@/components/ui/DateInput";
import { FormField } from "@/components/ui/FormField";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Select } from "@/components/ui/Select";
import { fromMinor, SUPPORTED_CURRENCIES, type SupportedCurrency, toMinor } from "@/utils/currency";
import { instantToLocalDate, localDateToEndInstant, localDateToStartInstant } from "@/utils/date";

interface CouponFormModalProps {
  /** The coupon being edited; absent to create one. */
  coupon?: CouponView;
  onClose: () => void;
  onSaved: (coupon: CouponView) => void;
}

const AUDIENCE_LABEL: Record<CouponAudience, string> = {
  CREATOR: "Creators",
  SCHOOL: "Schools",
  ANY: "Creators and schools",
};

function optionalInt(value: string): number | null {
  const trimmed = value.trim();
  return trimmed === "" ? null : Number.parseInt(trimmed, 10);
}

/**
 * Create or edit a coupon (creators.md §6.2). A coupon's terms - code, discount, duration and
 * audience - are fixed once created, since tenants may already be paying under them; editing
 * changes only its description, validity, cap, status and plans.
 */
export function CouponFormModal({ coupon, onClose, onSaved }: CouponFormModalProps) {
  const editing = coupon !== undefined;
  const [code, setCode] = useState(coupon?.code ?? "");
  const [description, setDescription] = useState(coupon?.description ?? "");
  const [type, setType] = useState<CouponType>(coupon?.type ?? "PERCENT");
  const [value, setValue] = useState(() => {
    if (!coupon) return "";
    return coupon.type === "FIXED" ? String(fromMinor(coupon.value)) : String(coupon.value);
  });
  const [currency, setCurrency] = useState<SupportedCurrency>(coupon?.currency ?? "NGN");
  const [duration, setDuration] = useState<CouponDuration>(coupon?.duration ?? "ONCE");
  const [periods, setPeriods] = useState(
    coupon?.durationPeriods ? String(coupon.durationPeriods) : "3",
  );
  const [audience, setAudience] = useState<CouponAudience>(coupon?.audience ?? "CREATOR");
  const [validFrom, setValidFrom] = useState(instantToLocalDate(coupon?.validFrom));
  const [validUntil, setValidUntil] = useState(instantToLocalDate(coupon?.validUntil));
  const [maxRedemptions, setMaxRedemptions] = useState(
    coupon?.maxRedemptions == null ? "" : String(coupon.maxRedemptions),
  );
  const [status, setStatus] = useState<CouponStatus>(coupon?.status ?? "ACTIVE");
  const [packageIds, setPackageIds] = useState<string[]>(coupon?.packages.map((p) => p.id) ?? []);
  const [plans, setPlans] = useState<PackageView[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    listPackages(0, 200)
      .then((page) => {
        if (!cancelled) setPlans(page.content.filter((plan) => !plan.free));
      })
      .catch(() => {
        // The plan picker is optional - without it the coupon simply applies to every plan.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const eligiblePlans = plans.filter(
    (plan) =>
      (audience === "ANY" || plan.audience === audience) &&
      (plan.status === "ACTIVE" || packageIds.includes(plan.id)),
  );

  function togglePlan(id: string, checked: boolean) {
    setPackageIds((current) =>
      checked ? [...current, id] : current.filter((existing) => existing !== id),
    );
  }

  /** An untouched date keeps the stored instant exactly, rather than snapping it to a day boundary. */
  function instantFor(
    date: string,
    original: string | null | undefined,
    end: boolean,
  ): string | null {
    if (!date) return null;
    if (original && instantToLocalDate(original) === date) return original;
    return end ? localDateToEndInstant(date) : localDateToStartInstant(date);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    const visiblePlanIds = packageIds.filter((id) => eligiblePlans.some((plan) => plan.id === id));
    const settings = {
      description: description.trim() || null,
      validFrom: instantFor(validFrom, coupon?.validFrom, false),
      validUntil: instantFor(validUntil, coupon?.validUntil, true),
      maxRedemptions: optionalInt(maxRedemptions),
      status,
      packageIds: plans.length > 0 ? visiblePlanIds : packageIds,
    };
    try {
      const saved = editing
        ? await updateCoupon(coupon.id, settings)
        : await createCoupon({
            ...settings,
            code: code.trim(),
            type,
            value: type === "FIXED" ? toMinor(Number(value)) : Number.parseInt(value, 10),
            currency: type === "FIXED" ? currency : null,
            duration,
            durationPeriods: duration === "REPEATING" ? optionalInt(periods) : null,
            audience,
          });
      onSaved(saved);
    } catch (caught) {
      setError(getErrorMessage(caught, "Couldn't save the coupon."));
      setSaving(false);
    }
  }

  return (
    <Modal open onClose={onClose} title={editing ? `Edit ${coupon.code}` : "New coupon"} size="lg">
      <form onSubmit={submit} className="space-y-4">
        {editing && (
          <Alert variant="info">
            A coupon's code, discount, duration and audience can't change once it's created. To
            offer different terms, disable this coupon and create a new one.
          </Alert>
        )}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField label="Code" htmlFor="coupon-code">
            <Input
              id="coupon-code"
              value={code}
              onChange={(event) => setCode(event.target.value.toUpperCase())}
              disabled={editing}
              required
              maxLength={32}
              className="font-mono"
              placeholder="LAUNCH20"
            />
          </FormField>
          <FormField label="Who can use it" htmlFor="coupon-audience">
            <Select
              id="coupon-audience"
              value={audience}
              onChange={(event) => setAudience(event.target.value as CouponAudience)}
              disabled={editing}
            >
              {(Object.keys(AUDIENCE_LABEL) as CouponAudience[]).map((option) => (
                <option key={option} value={option}>
                  {AUDIENCE_LABEL[option]}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label="Discount type" htmlFor="coupon-type">
            <Select
              id="coupon-type"
              value={type}
              onChange={(event) => setType(event.target.value as CouponType)}
              disabled={editing}
            >
              <option value="PERCENT">Percentage off</option>
              <option value="FIXED">Fixed amount off</option>
            </Select>
          </FormField>
          <div className="flex items-end gap-2">
            <FormField
              label={type === "PERCENT" ? "Percent off" : "Amount off"}
              htmlFor="coupon-value"
              className="flex-1"
            >
              <Input
                id="coupon-value"
                type="number"
                inputMode="decimal"
                min={type === "PERCENT" ? 1 : 0.01}
                max={type === "PERCENT" ? 100 : undefined}
                step={type === "PERCENT" ? 1 : 0.01}
                value={value}
                onChange={(event) => setValue(event.target.value)}
                disabled={editing}
                required
              />
            </FormField>
            {type === "FIXED" && (
              <FormField label="Currency" htmlFor="coupon-currency" className="w-28">
                <Select
                  id="coupon-currency"
                  value={currency}
                  onChange={(event) => setCurrency(event.target.value as SupportedCurrency)}
                  disabled={editing}
                >
                  {SUPPORTED_CURRENCIES.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </Select>
              </FormField>
            )}
          </div>
          <FormField label="Applies to" htmlFor="coupon-duration">
            <Select
              id="coupon-duration"
              value={duration}
              onChange={(event) => setDuration(event.target.value as CouponDuration)}
              disabled={editing}
            >
              <option value="ONCE">The first payment only</option>
              <option value="REPEATING">The first few payments</option>
              <option value="FOREVER">Every payment</option>
            </Select>
          </FormField>
          {duration === "REPEATING" && (
            <FormField label="Number of payments" htmlFor="coupon-periods">
              <Input
                id="coupon-periods"
                type="number"
                min={2}
                max={120}
                value={periods}
                onChange={(event) => setPeriods(event.target.value)}
                disabled={editing}
                required
              />
            </FormField>
          )}
        </div>

        <FormField label="Description" htmlFor="coupon-description">
          <Input
            id="coupon-description"
            value={description}
            maxLength={200}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Shown to the customer, e.g. Launch offer"
          />
        </FormField>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <FormField label="Valid from" htmlFor="coupon-from">
            <DateInput id="coupon-from" value={validFrom} onChange={setValidFrom} />
          </FormField>
          <FormField label="Valid until" htmlFor="coupon-until">
            <DateInput
              id="coupon-until"
              value={validUntil}
              onChange={setValidUntil}
              min={validFrom || undefined}
            />
          </FormField>
          <FormField label="Redemption limit" htmlFor="coupon-max">
            <Input
              id="coupon-max"
              type="number"
              min={1}
              value={maxRedemptions}
              onChange={(event) => setMaxRedemptions(event.target.value)}
              placeholder="Unlimited"
            />
          </FormField>
        </div>

        <fieldset className="space-y-2">
          <legend className="text-sm font-medium text-slate-700">Plans</legend>
          <p className="text-xs text-slate-500">Leave every plan unticked to allow any plan.</p>
          {eligiblePlans.length === 0 ? (
            <p className="text-sm text-slate-500">No paid plans for this audience yet.</p>
          ) : (
            <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {eligiblePlans.map((plan) => (
                <li key={plan.id}>
                  <label className="flex items-center gap-2 text-sm text-slate-700">
                    <Checkbox
                      checked={packageIds.includes(plan.id)}
                      onChange={(event) => togglePlan(plan.id, event.target.checked)}
                    />
                    {plan.name}
                    <span className="text-xs text-slate-500">
                      {plan.billingCycle === "ANNUAL" ? "annual" : "monthly"}
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          )}
        </fieldset>

        <FormField label="Status" htmlFor="coupon-status">
          <Select
            id="coupon-status"
            value={status}
            onChange={(event) => setStatus(event.target.value as CouponStatus)}
          >
            <option value="ACTIVE">Active</option>
            <option value="DISABLED">Disabled</option>
          </Select>
        </FormField>

        {error && <Alert variant="error">{error}</Alert>}

        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" loading={saving}>
            {editing ? "Save changes" : "Create coupon"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
