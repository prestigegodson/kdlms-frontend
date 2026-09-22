import { type FormEvent, useState } from "react";
import { adjustStock, type InventoryItemView, receiveStock } from "@/api/inventory";
import { ApiError } from "@/api/client";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { FormField } from "@/components/ui/FormField";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";

interface StockMovementModalProps {
  kind: "receive" | "adjust";
  branchId?: string;
  items: InventoryItemView[];
  defaultItemId?: string;
  onClose: () => void;
  onSaved: () => void;
}

/** Records a RECEIPT or ADJUSTMENT movement into a branch - one component for both, the field set diverging by kind. */
export function StockMovementModal({ kind, branchId, items, defaultItemId, onClose, onSaved }: StockMovementModalProps) {
  const isAdjust = kind === "adjust";
  const [itemId, setItemId] = useState(defaultItemId ?? items[0]?.id ?? "");
  const [quantity, setQuantity] = useState(isAdjust ? "" : "1");
  const [reference, setReference] = useState("");
  const [reason, setReason] = useState("");
  const [occurredOn, setOccurredOn] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const quantityValue = Number(quantity);
      if (isAdjust) {
        await adjustStock({
          branchId,
          itemId,
          quantity: quantityValue,
          reason,
          occurredOn: occurredOn || null,
        });
      } else {
        await receiveStock({
          branchId,
          itemId,
          quantity: quantityValue,
          reference: reference || null,
          occurredOn: occurredOn || null,
        });
      }
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to save stock movement");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal open onClose={onClose} title={isAdjust ? "Adjust stock" : "Receive stock"}>
      <form className="space-y-4" onSubmit={handleSubmit}>
        {error && <Alert variant="error">{error}</Alert>}

        <FormField label="Item" htmlFor="movement-item">
          <Select id="movement-item" required value={itemId} onChange={(event) => setItemId(event.target.value)}>
            {items.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </Select>
        </FormField>

        <FormField
          label="Quantity"
          htmlFor="movement-quantity"
          description={isAdjust ? "Positive to add stock, negative to remove it." : undefined}
        >
          <Input
            id="movement-quantity"
            type="number"
            required
            step={1}
            min={isAdjust ? undefined : 1}
            value={quantity}
            onChange={(event) => setQuantity(event.target.value)}
          />
        </FormField>

        {isAdjust ? (
          <FormField label="Reason" htmlFor="movement-reason" description="Required for every adjustment.">
            <Textarea
              id="movement-reason"
              required
              rows={2}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            />
          </FormField>
        ) : (
          <FormField label="Reference" htmlFor="movement-reference" description="Optional - supplier invoice no, waybill no">
            <Input id="movement-reference" value={reference} onChange={(event) => setReference(event.target.value)} />
          </FormField>
        )}

        <FormField label="Date" htmlFor="movement-occurred-on" description="Defaults to today.">
          <Input
            id="movement-occurred-on"
            type="date"
            value={occurredOn}
            onChange={(event) => setOccurredOn(event.target.value)}
          />
        </FormField>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={submitting || itemId === ""}>
            {submitting ? "Saving…" : isAdjust ? "Adjust stock" : "Receive stock"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
