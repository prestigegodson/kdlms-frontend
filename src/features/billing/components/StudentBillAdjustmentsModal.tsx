import { ChevronDown, ChevronUp, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import {
  TRANSPORT_DIRECTION_LABELS,
  type ExtraRequest,
  type FeeAdjustmentRequest,
  type StudentBillAdjustmentsView,
  type TransportDirection,
  saveStudentBillAdjustments,
} from "@/api/billing";
import { ApiError } from "@/api/client";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { FormField } from "@/components/ui/FormField";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Select } from "@/components/ui/Select";
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from "@/components/ui/Table";
import { formatMoney } from "@/utils/currency";

interface StudentBillAdjustmentsModalProps {
  studentId: string;
  termId: string;
  view: StudentBillAdjustmentsView;
  onClose: () => void;
  /** Called once the save succeeds - the parent refetches the roster and any open bill preview. */
  onSaved: () => void;
}

/** One editable fee row's local state - `amount` is the raw text field, kept separate from the numeric `overrideAmount` the request eventually carries. */
interface FeeDraft {
  feeId: string;
  feeName: string;
  compulsory: boolean;
  applicableThisTerm: boolean;
  standardAmount: number | null;
  selected: boolean;
  amount: string;
  thisTermOnly: boolean;
}

interface ExtraDraft {
  label: string;
  amount: string;
  thisTermOnly: boolean;
}

function toFeeDrafts(view: StudentBillAdjustmentsView): FeeDraft[] {
  return view.fees.map((row) => ({
    feeId: row.feeId,
    feeName: row.feeName,
    compulsory: row.compulsory,
    applicableThisTerm: row.applicableThisTerm,
    standardAmount: row.standardAmount,
    selected: row.selected,
    amount: row.overrideAmount != null ? String(row.overrideAmount) : "",
    thisTermOnly: row.thisTermOnly,
  }));
}

function toExtraDrafts(view: StudentBillAdjustmentsView): ExtraDraft[] {
  return [...view.extras]
    .sort((a, b) => a.position - b.position)
    .map((extra) => ({ label: extra.label, amount: String(extra.amount), thisTermOnly: extra.thisTermOnly }));
}

/**
 * One student's editable optional-fee opt-ins, per-fee overrides, custom charges (Phase 25), and
 * school-bus assignment (Phase 26) for one term - opened from a trailing "Edit bill" column on the
 * `BillsTab` roster, since `getStudentBill` 404s a non-billable student and an admin must be able
 * to open exactly that student to make them billable. A save failure keeps the modal open (the
 * `FeePricesModal` convention) rather than closing behind a `ResultDialog`.
 * <p>
 * A compulsory row has no selection checkbox - it's always charged when applicable - but still
 * carries an editable override amount. An optional row adds the checkbox; selecting it is what
 * makes the fee enter the bill's total. Each row's own scope toggle defaults to "this term only"
 * for a new override and "recurring" for a new optional-fee opt-in, the safer default in each
 * direction, per this phase's locked decision - it only flips once the admin actually touches the
 * row, never merely from re-rendering the server's resolved state.
 * <p>
 * The school bus (Phase 26) is a separate route + direction picker, not a fee row - a TRANSPORT
 * fee is priced per route, not per level, so it's never one of `view.fees`. The route select
 * offers every route in `view.transport.routes`; the direction select narrows to whichever
 * legs that route actually prices, the `TransportRidersTable` pattern. The resolved fare folds
 * into the running total exactly like an extra. When `view.transport.assignable` is `false` (the
 * student has no enrollment in the billed term's own session yet), the picker is replaced by
 * `unassignableReason` and nothing is submitted for it.
 */
export function StudentBillAdjustmentsModal({
  studentId,
  termId,
  view,
  onClose,
  onSaved,
}: StudentBillAdjustmentsModalProps) {
  const [fees, setFees] = useState<FeeDraft[]>(() => toFeeDrafts(view));
  const [extras, setExtras] = useState<ExtraDraft[]>(() => toExtraDrafts(view));
  const [transportRouteId, setTransportRouteId] = useState<string | null>(view.transport.routeId);
  const [transportDirection, setTransportDirection] = useState<TransportDirection | null>(view.transport.direction);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const selectedRoute = view.transport.routes.find((route) => route.routeId === transportRouteId) ?? null;
  const transportFare =
    selectedRoute == null || transportDirection == null
      ? null
      : transportDirection === "ONE_WAY"
        ? selectedRoute.oneWayAmount
        : selectedRoute.toAndFroAmount;

  function updateTransportRoute(routeId: string) {
    const route = view.transport.routes.find((r) => r.routeId === routeId) ?? null;
    const directionStillOffered =
      route != null &&
      transportDirection != null &&
      ((transportDirection === "ONE_WAY" && route.oneWayAmount != null) ||
        (transportDirection === "TO_AND_FRO" && route.toAndFroAmount != null));
    setTransportRouteId(routeId || null);
    setTransportDirection(routeId ? (directionStillOffered ? transportDirection : null) : null);
  }

  function updateFee(feeId: string, patch: Partial<FeeDraft>) {
    setFees((current) => current.map((fee) => (fee.feeId === feeId ? { ...fee, ...patch } : fee)));
  }

  function toggleSelected(feeId: string, selected: boolean) {
    // A fresh opt-in defaults to recurring (thisTermOnly: false) - the safer default for a
    // standing selection; an existing row's own scope is left untouched.
    updateFee(feeId, { selected });
  }

  function updateExtra(index: number, patch: Partial<ExtraDraft>) {
    setExtras((current) => current.map((extra, i) => (i === index ? { ...extra, ...patch } : extra)));
  }

  function removeExtra(index: number) {
    setExtras((current) => current.filter((_, i) => i !== index));
  }

  function moveExtra(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= extras.length) return;
    setExtras((current) => {
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  function addExtra() {
    // A fresh custom charge defaults to this-term-only - the safer default for a one-off charge.
    setExtras((current) => [...current, { label: "", amount: "", thisTermOnly: true }]);
  }

  const runningTotal = fees.reduce((sum, fee) => {
    if (!fee.applicableThisTerm) return sum;
    const amount = fee.amount.trim() !== "" ? Number(fee.amount) : fee.standardAmount;
    if (amount == null || !Number.isFinite(amount)) return sum;
    if (!fee.compulsory && !fee.selected) return sum;
    return sum + amount;
  }, extras.reduce((sum, extra) => {
    const amount = Number(extra.amount);
    return Number.isFinite(amount) ? sum + amount : sum;
  }, transportFare ?? 0));

  async function handleSubmit() {
    setError(null);

    const feeRequests: FeeAdjustmentRequest[] = [];
    for (const fee of fees) {
      const trimmed = fee.amount.trim();
      let overrideAmount: number | null = null;
      if (trimmed !== "") {
        const parsed = Number(trimmed);
        if (!Number.isFinite(parsed) || parsed < 0) {
          setError(`${fee.feeName}: enter a number 0 or greater, or leave the amount blank.`);
          return;
        }
        overrideAmount = parsed;
      }
      if (!fee.selected && overrideAmount == null) {
        // Neither selected nor overridden - no adjustment desired, so this fee is simply omitted.
        continue;
      }
      feeRequests.push({ feeId: fee.feeId, selected: fee.selected, overrideAmount, thisTermOnly: fee.thisTermOnly });
    }

    const extraRequests: ExtraRequest[] = [];
    for (const extra of extras) {
      if (extra.label.trim() === "") {
        setError("Every custom charge needs a label.");
        return;
      }
      const amount = Number(extra.amount);
      if (!Number.isFinite(amount) || amount < 0) {
        setError(`${extra.label}: enter a number 0 or greater.`);
        return;
      }
      extraRequests.push({ label: extra.label.trim(), amount, thisTermOnly: extra.thisTermOnly });
    }

    if (transportRouteId && !transportDirection) {
      setError("Choose a direction for the school bus, or clear the route.");
      return;
    }

    setSubmitting(true);
    try {
      await saveStudentBillAdjustments(
        studentId,
        termId,
        feeRequests,
        extraRequests,
        transportRouteId,
        transportDirection,
      );
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to save bill adjustments");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal open onClose={onClose} title={`Edit bill · ${view.studentName}`} size="xl">
      <div className="space-y-4">
        {view.published && (
          <Alert variant="warning" title="This term's bills are already published">
            Guardians may already have been emailed a bill for {view.termName}. Changing these adjustments changes
            what the live portal and a re-downloaded PDF show, but not what was already sent.
          </Alert>
        )}
        {!view.billable && (
          <Alert variant="info">
            This student currently has no bill - no compulsory fee applies with a price or override set.
          </Alert>
        )}
        {error && <Alert variant="error">{error}</Alert>}

        <div>
          <Table>
            <TableHead>
              <TableRow>
                <TableHeaderCell>Fee</TableHeaderCell>
                <TableHeaderCell>Charge</TableHeaderCell>
                <TableHeaderCell numeric>Standard</TableHeaderCell>
                <TableHeaderCell numeric>Amount</TableHeaderCell>
                {/*<TableHeaderCell>Applies</TableHeaderCell>*/}
              </TableRow>
            </TableHead>
            <TableBody>
              {fees.map((fee) => (
                <TableRow key={fee.feeId}>
                  <TableCell label="Fee">
                    <div className="flex items-center gap-2">
                      <span className={fee.applicableThisTerm ? "" : "text-slate-400"}>{fee.feeName}</span>
                      <Badge variant={fee.compulsory ? "brand" : "neutral"}>
                        {fee.compulsory ? "Compulsory" : "Optional"}
                      </Badge>
                    </div>
                  </TableCell>
                  <TableCell label="Charge">
                    {fee.compulsory ? (
                      <span className="text-xs text-slate-400">Always</span>
                    ) : (
                      <Checkbox
                        aria-label={`Charge ${fee.feeName}`}
                        checked={fee.selected}
                        onChange={(event) => toggleSelected(fee.feeId, event.target.checked)}
                      />
                    )}
                  </TableCell>
                  <TableCell label="Standard" numeric>
                    <span className="text-slate-500">
                      {fee.standardAmount != null ? formatMoney(fee.standardAmount, view.currency) : "—"}
                    </span>
                  </TableCell>
                  <TableCell label="Amount" numeric>
                    <div className="flex items-center justify-end gap-2">
                      <Input
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        aria-label={`Override amount for ${fee.feeName}`}
                        placeholder={fee.standardAmount != null ? String(fee.standardAmount) : "No price"}
                        className="w-28 text-right tabular-nums"
                        value={fee.amount}
                        onChange={(event) => updateFee(fee.feeId, { amount: event.target.value, thisTermOnly: true })}
                      />
                      {/*<Select*/}
                      {/*  aria-label={`Scope for ${fee.feeName}`}*/}
                      {/*  className="w-32"*/}
                      {/*  value={fee.thisTermOnly ? "term" : "standing"}*/}
                      {/*  onChange={(event) => updateFee(fee.feeId, { thisTermOnly: event.target.value === "term" })}*/}
                      {/*>*/}
                      {/*  <option value="term">This term</option>*/}
                      {/*  <option value="standing">Recurring</option>*/}
                      {/*</Select>*/}
                    </div>
                  </TableCell>
                  {/*<TableCell label="Applies">*/}
                  {/*  {fee.applicableThisTerm ? (*/}
                  {/*    <span className="text-xs text-slate-400">This term</span>*/}
                  {/*  ) : (*/}
                  {/*    <span className="text-xs text-slate-400">Not this term</span>*/}
                  {/*  )}*/}
                  {/*</TableCell>*/}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <div>
          <h3 className="mb-2 text-sm font-medium text-slate-700">School bus</h3>
          {!view.transport.assignable ? (
            <p className="text-sm text-slate-500">{view.transport.unassignableReason}</p>
          ) : (
            <div className="flex flex-wrap items-end gap-2">
              <FormField label="Route" htmlFor="transport-route" className="min-w-[10rem]">
                <Select
                  id="transport-route"
                  value={transportRouteId ?? ""}
                  onChange={(event) => updateTransportRoute(event.target.value)}
                >
                  <option value="">Not riding</option>
                  {view.transport.routes.map((route) => (
                    <option key={route.routeId} value={route.routeId}>
                      {route.routeName}
                    </option>
                  ))}
                </Select>
              </FormField>
              <FormField label="Direction" htmlFor="transport-direction">
                <Select
                  id="transport-direction"
                  disabled={!transportRouteId}
                  value={transportDirection ?? ""}
                  onChange={(event) =>
                    setTransportDirection((event.target.value || null) as TransportDirection | null)
                  }
                >
                  <option value="">Select…</option>
                  <option value="ONE_WAY" disabled={selectedRoute != null && selectedRoute.oneWayAmount == null}>
                    {TRANSPORT_DIRECTION_LABELS.ONE_WAY}
                    {selectedRoute != null && selectedRoute.oneWayAmount == null ? " (not priced)" : ""}
                  </option>
                  <option
                    value="TO_AND_FRO"
                    disabled={selectedRoute != null && selectedRoute.toAndFroAmount == null}
                  >
                    {TRANSPORT_DIRECTION_LABELS.TO_AND_FRO}
                    {selectedRoute != null && selectedRoute.toAndFroAmount == null ? " (not priced)" : ""}
                  </option>
                </Select>
              </FormField>
              <div className="pb-2 text-sm text-slate-500">
                Fare: {transportFare != null ? formatMoney(transportFare, view.currency) : "—"}
              </div>
            </div>
          )}
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-sm font-medium text-slate-700">Other charges</h3>
            <Button type="button" variant="secondary" size="sm" onClick={addExtra}>
              <Plus className="h-4 w-4" aria-hidden="true" /> Add charge
            </Button>
          </div>
          {extras.length === 0 && <p className="text-sm text-slate-500">No custom charges added.</p>}
          <div className="space-y-2">
            {extras.map((extra, index) => (
              <div key={index} className="flex flex-wrap items-end gap-2 rounded-panel border border-slate-200 p-3">
                <FormField label="Label" htmlFor={`extra-label-${index}`} className="min-w-[10rem] flex-1">
                  <Input
                    id={`extra-label-${index}`}
                    value={extra.label}
                    onChange={(event) => updateExtra(index, { label: event.target.value })}
                  />
                </FormField>
                <FormField label="Amount" htmlFor={`extra-amount-${index}`}>
                  <Input
                    id={`extra-amount-${index}`}
                    type="number"
                    inputMode="decimal"
                    step="any"
                    min="0"
                    className="w-28 text-right tabular-nums"
                    value={extra.amount}
                    onChange={(event) => updateExtra(index, { amount: event.target.value })}
                  />
                </FormField>
                <FormField label="Scope" htmlFor={`extra-scope-${index}`}>
                  <Select
                    id={`extra-scope-${index}`}
                    className="w-32"
                    value={extra.thisTermOnly ? "term" : "standing"}
                    onChange={(event) => updateExtra(index, { thisTermOnly: event.target.value === "term" })}
                  >
                    <option value="term">This term</option>
                    <option value="standing">Recurring</option>
                  </Select>
                </FormField>
                <div className="flex gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={index === 0}
                    onClick={() => moveExtra(index, -1)}
                    aria-label="Move up"
                  >
                    <ChevronUp className="h-4 w-4" aria-hidden="true" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={index === extras.length - 1}
                    onClick={() => moveExtra(index, 1)}
                    aria-label="Move down"
                  >
                    <ChevronDown className="h-4 w-4" aria-hidden="true" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeExtra(index)}
                    aria-label="Remove charge"
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-slate-200 pt-3">
          <span className="text-sm font-medium text-slate-700">Charged total</span>
          <span className="text-sm font-semibold tabular-nums text-slate-900">
            {formatMoney(runningTotal, view.currency)}
          </span>
        </div>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" onClick={handleSubmit} loading={submitting}>
            Save
          </Button>
        </div>
      </div>
    </Modal>
  );
}
