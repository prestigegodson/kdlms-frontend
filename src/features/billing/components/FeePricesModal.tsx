import { type FormEvent, useState } from "react";
import { type FeePriceLevelColumn, type FeePriceRow, type SavePriceRow, saveFeePrices } from "@/api/billing";
import { ApiError } from "@/api/client";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { FormField } from "@/components/ui/FormField";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { formatMoney } from "@/utils/currency";
import { applicabilityLabel } from "./FeePriceListTable";

interface FeePricesModalProps {
  fee: FeePriceRow;
  /** grid.levels - the school's canonical level order, not the fee's own applicableLevelIds order. */
  levels: FeePriceLevelColumn[];
  branchName: string;
  sessionName: string;
  sessionId: string;
  branchId?: string;
  currency: string | null;
  onClose: () => void;
  /** Called once every row saved successfully; the parent refetches the grid and shows its own ResultDialog. */
  onSaved: (message: string) => void;
}

/**
 * The one key both the read side (`seedAmounts`) and the write side (`handleSubmit`) use for a
 * priced cell - `null` for a uniform fee's one slot per level, a real 1-3 term number for a
 * per-term one (Phase 23). One shape for both modes, so nothing else in this component forks on
 * `priceVariesByTerm`.
 */
function slotKey(levelId: string, termNumber: number | null): string {
  return `${levelId}#${termNumber ?? ""}`;
}

/** Every slot this fee needs priced - one per level for a uniform fee, one per (level, term) for a per-term one. */
function slotsFor(fee: FeePriceRow, applicableLevels: FeePriceLevelColumn[]): Array<{ levelId: string; termNumber: number | null }> {
  const termNumbers = fee.priceVariesByTerm && fee.termNumbers ? fee.termNumbers : [null];
  return applicableLevels.flatMap((level) => termNumbers.map((termNumber) => ({ levelId: level.levelId, termNumber })));
}

function seedAmounts(fee: FeePriceRow): Record<string, string> {
  const amounts: Record<string, string> = {};
  for (const cell of fee.prices) {
    amounts[slotKey(cell.levelId, cell.termNumber)] = String(cell.amount);
  }
  return amounts;
}

/**
 * Prices one fee across every level it applies to - one clearly-labelled amount field per level
 * (replacing the old grid's cramped, aria-label-only column cells), a "set all" bulk helper, and a
 * live formatted echo of each typed value. Follows the `FeeFormModal` idiom in this same folder:
 * no `open` prop, mounted conditionally, a real `<form onSubmit>`.
 * <p>
 * A per-term fee (Phase 23, `fee.priceVariesByTerm`) renders one visibly-labelled input per term
 * under each level instead of a single amount - the slot key (`slotKey`) is the one thing both
 * modes share, so nothing else here branches on the flag.
 *
 * A save failure keeps the modal open with the failing slot(s) highlighted, rather than closing
 * behind a `ResultDialog` the way the old grid did - the whole point of this redesign is that a
 * user editing prices should never have to hunt a highlighted cell after dismissing a dialog.
 */
export function FeePricesModal({
  fee,
  levels,
  branchName,
  sessionName,
  sessionId,
  branchId,
  currency,
  onClose,
  onSaved,
}: FeePricesModalProps) {
  const applicableLevels = levels.filter((level) => fee.applicableLevelIds.includes(level.levelId));
  const slots = slotsFor(fee, applicableLevels);
  const [initial] = useState(() => seedAmounts(fee));
  const [amounts, setAmounts] = useState<Record<string, string>>(initial);
  const [bulkValue, setBulkValue] = useState("");
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dirty = slots.some((slot) => {
    const key = slotKey(slot.levelId, slot.termNumber);
    return (amounts[key] ?? "") !== (initial[key] ?? "");
  });

  function updateAmount(key: string, value: string) {
    setAmounts((current) => ({ ...current, [key]: value }));
    setRowErrors((current) => {
      if (!(key in current)) return current;
      const next = { ...current };
      delete next[key];
      return next;
    });
  }

  function applyBulk() {
    if (bulkValue.trim() === "") return;
    setAmounts((current) => {
      const next = { ...current };
      for (const slot of slots) {
        next[slotKey(slot.levelId, slot.termNumber)] = bulkValue;
      }
      return next;
    });
    setRowErrors({});
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const nextRowErrors: Record<string, string> = {};
    const prices: SavePriceRow[] = [];
    for (const slot of slots) {
      const key = slotKey(slot.levelId, slot.termNumber);
      const raw = amounts[key] ?? "";
      const previousRaw = initial[key] ?? "";
      if (raw === previousRaw) continue;
      if (raw.trim() === "") {
        prices.push({ feeId: fee.feeId, levelId: slot.levelId, termNumber: slot.termNumber, amount: null });
        continue;
      }
      const amount = Number(raw);
      if (!Number.isFinite(amount) || amount < 0) {
        nextRowErrors[key] = "Enter a number 0 or greater.";
        continue;
      }
      prices.push({ feeId: fee.feeId, levelId: slot.levelId, termNumber: slot.termNumber, amount });
    }

    if (Object.keys(nextRowErrors).length > 0) {
      setRowErrors(nextRowErrors);
      return;
    }
    if (prices.length === 0) return;

    setSubmitting(true);
    try {
      const outcome = await saveFeePrices(sessionId, prices, branchId);
      const failed = outcome.outcomes.filter((row) => !row.success);
      if (failed.length === 0) {
        onSaved(`${prices.length} price${prices.length === 1 ? "" : "s"} saved.`);
        onClose();
        return;
      }
      const failedBySlot: Record<string, string> = {};
      for (const row of failed) {
        failedBySlot[slotKey(row.levelId, row.termNumber)] = row.message ?? "Failed to save.";
      }
      setRowErrors(failedBySlot);
      setError(
        `${prices.length - failed.length} of ${prices.length} price${prices.length === 1 ? "" : "s"} saved; ${failed.length} failed - see the highlighted field${failed.length === 1 ? "" : "s"}.`,
      );
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to save prices");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal open onClose={onClose} title={`Edit prices · ${fee.feeName}`}>
      <form className="space-y-4" noValidate onSubmit={handleSubmit}>
        {error && <Alert variant="error">{error}</Alert>}

        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm text-slate-500">
            {branchName} · {sessionName}
          </p>
          <Badge variant={fee.compulsory ? "brand" : "neutral"}>{fee.compulsory ? "Compulsory" : "Optional"}</Badge>
          {fee.priceVariesByTerm && <Badge variant="neutral">Per term</Badge>}
          <span className="text-sm text-slate-500">{applicabilityLabel(fee)}</span>
        </div>

        {applicableLevels.length === 0 ? (
          <Alert variant="warning">
            This fee has no active levels to price - add one to it from the Fees tab first.
          </Alert>
        ) : (
          <>
            {slots.length > 1 && (
              <FormField label="Set all to" htmlFor="fee-price-bulk">
                <div className="flex gap-2">
                  <Input
                    id="fee-price-bulk"
                    type="number"
                    inputMode="decimal"
                    step="any"
                    min="0"
                    className="text-right tabular-nums"
                    value={bulkValue}
                    onChange={(event) => setBulkValue(event.target.value)}
                  />
                  <Button type="button" variant="secondary" onClick={applyBulk}>
                    Apply
                  </Button>
                </div>
              </FormField>
            )}

            <div className="space-y-3">
              {applicableLevels.map((level) =>
                fee.priceVariesByTerm && fee.termNumbers ? (
                  <div key={level.levelId} className="rounded-[--radius-panel] border border-slate-200 p-3">
                    <p className="mb-2 text-sm font-medium text-slate-700">{level.levelName}</p>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                      {fee.termNumbers.map((termNumber) => {
                        const key = slotKey(level.levelId, termNumber);
                        const value = amounts[key] ?? "";
                        const rowError = rowErrors[key];
                        return (
                          <FormField
                            key={termNumber}
                            label={`Term ${termNumber}`}
                            htmlFor={`fee-price-${level.levelId}-${termNumber}`}
                            error={rowError}
                          >
                            <Input
                              id={`fee-price-${level.levelId}-${termNumber}`}
                              type="number"
                              inputMode="decimal"
                              step="any"
                              min="0"
                              aria-invalid={rowError ? "true" : undefined}
                              className="text-right tabular-nums"
                              value={value}
                              onChange={(event) => updateAmount(key, event.target.value)}
                            />
                          </FormField>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  (() => {
                    const key = slotKey(level.levelId, null);
                    const value = amounts[key] ?? "";
                    const numericValue = value.trim() === "" ? null : Number(value);
                    const rowError = rowErrors[key];
                    return (
                      <FormField
                        key={level.levelId}
                        label={level.levelName}
                        htmlFor={`fee-price-${level.levelId}`}
                        error={rowError}
                      >
                        <div className="flex items-center gap-3">
                          <Input
                            id={`fee-price-${level.levelId}`}
                            type="number"
                            inputMode="decimal"
                            step="any"
                            min="0"
                            aria-label={`${fee.feeName} price for ${level.levelName}`}
                            aria-invalid={rowError ? "true" : undefined}
                            className="text-right tabular-nums"
                            value={value}
                            onChange={(event) => updateAmount(key, event.target.value)}
                          />
                          <span className="w-28 shrink-0 text-sm tabular-nums text-slate-500">
                            {numericValue != null && Number.isFinite(numericValue)
                              ? formatMoney(numericValue, currency)
                              : "—"}
                          </span>
                        </div>
                      </FormField>
                    );
                  })()
                ),
              )}
            </div>

            <p className="text-xs text-slate-500">
              Leave a field blank to stop charging this fee there - it won't appear on that bill.
            </p>
          </>
        )}

        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={submitting || applicableLevels.length === 0 || !dirty}>
            {submitting ? "Saving…" : "Save prices"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
