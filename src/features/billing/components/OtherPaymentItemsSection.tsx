import { Plus } from "lucide-react";
import { type FormEvent, useEffect, useState } from "react";
import { getBillingSettings } from "@/api/billing";
import { ApiError } from "@/api/client";
import type { OtherPaymentItemView } from "@/api/feePayments";
import {
  createOtherPaymentItem,
  listOtherPaymentItems,
  updateOtherPaymentItem,
} from "@/api/staffFeePayments";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { EmptyState } from "@/components/ui/EmptyState";
import { FormField } from "@/components/ui/FormField";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Skeleton } from "@/components/ui/Skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
} from "@/components/ui/Table";
import { MoneyInput } from "@/features/billing/components/paymentForm/MoneyInput";
import { MAX_PURPOSE_LABEL_LENGTH } from "@/features/billing/components/paymentForm/otherPurpose";
import {
  formatAmountInput,
  parseAmount,
} from "@/features/billing/components/paymentForm/paymentAmounts";
import { formatMoney } from "@/utils/currency";

interface OtherPaymentItemsSectionProps {
  /** SCHOOL_ADMIN - a BRANCH_ADMIN only reads the list. */
  canManage: boolean;
}

/**
 * The school's "other payment" items (D24) - what guardians can log a payment for outside any
 * bill: an excursion, the Christmas party, a club trip. The fee catalogue's shape (school-wide,
 * SCHOOL_ADMIN writes); an item is retired by unticking Active, never deleted, so past payments
 * keep the label they were logged under. Guardians can always pick "Something else" too.
 */
export function OtherPaymentItemsSection({ canManage }: OtherPaymentItemsSectionProps) {
  const [items, setItems] = useState<OtherPaymentItemView[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [editing, setEditing] = useState<OtherPaymentItemView | "new" | null>(null);
  const [currency, setCurrency] = useState("NGN");

  useEffect(() => {
    getBillingSettings()
      .then((settings) => setCurrency(settings.currency))
      .catch(() => undefined); // amounts just show in NGN
  }, []);

  function load() {
    listOtherPaymentItems()
      .then(setItems)
      .catch((err: unknown) =>
        setLoadError(err instanceof ApiError ? err.message : "Failed to load other payment items"),
      );
  }

  useEffect(load, []);

  return (
    <section aria-labelledby="other-payment-items-heading" className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 id="other-payment-items-heading" className="text-base font-semibold text-slate-900">
            Other payments
          </h2>
          <p className="text-sm text-slate-500">
            Things guardians can pay for outside the bill - excursions, parties, clubs. They never
            change a pupil's fee balance.
          </p>
        </div>
        {canManage && (
          <Button variant="secondary" onClick={() => setEditing("new")}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            Add item
          </Button>
        )}
      </div>

      {loadError && <Alert variant="error">{loadError}</Alert>}
      {!loadError && items === null && <Skeleton className="h-10 w-full" />}
      {items !== null &&
        (items.length === 0 ? (
          <EmptyState
            title="No other payment items yet"
            description={
              canManage
                ? "Add one so guardians can pick it - they can still describe anything else themselves."
                : "Guardians describe what an other payment was for themselves."
            }
          />
        ) : (
          <Table aria-label="Other payment items">
            <TableHead>
              <TableRow>
                <TableHeaderCell>Name</TableHeaderCell>
                <TableHeaderCell numeric>Suggested amount</TableHeaderCell>
                <TableHeaderCell>Status</TableHeaderCell>
                {canManage && <TableHeaderCell>Actions</TableHeaderCell>}
              </TableRow>
            </TableHead>
            <TableBody>
              {items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell label="Name">
                    <span className="break-words">{item.name}</span>
                  </TableCell>
                  <TableCell label="Suggested amount" numeric>
                    {item.amount == null ? "—" : formatMoney(item.amount, currency)}
                  </TableCell>
                  <TableCell label="Status">
                    <Badge variant={item.active ? "success" : "neutral"}>
                      {item.active ? "Active" : "Retired"}
                    </Badge>
                  </TableCell>
                  {canManage && (
                    <TableCell label="Actions">
                      <Button variant="ghost" size="sm" onClick={() => setEditing(item)}>
                        Edit
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ))}

      {editing && (
        <OtherPaymentItemFormModal
          item={editing === "new" ? undefined : editing}
          nextPosition={items?.length ?? 0}
          currency={currency}
          onClose={() => setEditing(null)}
          onSaved={load}
        />
      )}
    </section>
  );
}

interface OtherPaymentItemFormModalProps {
  item?: OtherPaymentItemView;
  nextPosition: number;
  currency: string;
  onClose: () => void;
  onSaved: () => void;
}

/** Create-and-edit form for one item - the `FeeFormModal` shape. */
function OtherPaymentItemFormModal({
  item,
  nextPosition,
  currency,
  onClose,
  onSaved,
}: OtherPaymentItemFormModalProps) {
  const isEdit = item != null;
  const [name, setName] = useState(item?.name ?? "");
  const [amountText, setAmountText] = useState(
    item?.amount == null ? "" : formatAmountInput(item.amount),
  );
  const [active, setActive] = useState(item?.active ?? true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const amountMinor = amountText.trim() === "" ? null : parseAmount(amountText);
  const amountInvalid = amountText.trim() !== "" && amountMinor === null;
  const valid = name.trim() !== "" && !amountInvalid;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!valid) return;
    setSubmitting(true);
    setError(null);
    try {
      const request = {
        name: name.trim(),
        amount: amountMinor === null ? null : amountMinor / 100,
        active,
        position: item?.position ?? nextPosition,
      };
      if (isEdit) {
        await updateOtherPaymentItem(item.id, request);
      } else {
        await createOtherPaymentItem(request);
      }
      onSaved();
      onClose();
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : `Failed to ${isEdit ? "update" : "add"} the item`,
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal open onClose={onClose} title={isEdit ? "Edit item" : "Add other payment item"}>
      <form className="space-y-4" onSubmit={handleSubmit}>
        {error && <Alert variant="error">{error}</Alert>}
        <FormField label="Name" htmlFor="other-item-name">
          <Input
            id="other-item-name"
            value={name}
            maxLength={MAX_PURPOSE_LABEL_LENGTH}
            placeholder="e.g. Christmas party"
            onChange={(event) => setName(event.target.value)}
            required
          />
        </FormField>
        <FormField
          label="Suggested amount per child (optional)"
          htmlFor="other-item-amount"
          error={
            amountInvalid
              ? "Enter an amount above zero, with at most two decimal places."
              : undefined
          }
        >
          <MoneyInput
            id="other-item-amount"
            currency={currency}
            value={amountText}
            placeholder="Guardians enter their own"
            aria-invalid={amountInvalid || undefined}
            onChange={(event) => setAmountText(event.target.value)}
          />
        </FormField>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <Checkbox checked={active} onChange={(event) => setActive(event.target.checked)} />
          Active - guardians can pick it
        </label>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={submitting || !valid}>
            {submitting ? "Saving…" : isEdit ? "Save changes" : "Add item"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
