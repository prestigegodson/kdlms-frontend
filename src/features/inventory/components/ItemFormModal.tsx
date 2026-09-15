import { type FormEvent, useState } from "react";
import { ApiError } from "@/api/client";
import { createItem, type InventoryItemTypeView, type InventoryItemView, updateItem } from "@/api/inventory";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { FormField } from "@/components/ui/FormField";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";

interface ItemFormModalProps {
  item?: InventoryItemView;
  itemTypes: InventoryItemTypeView[];
  defaultItemTypeId?: string;
  onClose: () => void;
  onSaved: () => void;
}

/** Create/edit an inventory item - one component handles both, the FeeFormModal shape. itemTypeId is fixed once created. */
export function ItemFormModal({ item, itemTypes, defaultItemTypeId, onClose, onSaved }: ItemFormModalProps) {
  const isEdit = item != null;
  const [itemTypeId, setItemTypeId] = useState(item?.itemTypeId ?? defaultItemTypeId ?? itemTypes[0]?.id ?? "");
  const [name, setName] = useState(item?.name ?? "");
  const [code, setCode] = useState(item?.code ?? "");
  const [description, setDescription] = useState(item?.description ?? "");
  const [unit, setUnit] = useState(item?.unit ?? "piece");
  const [unitPrice, setUnitPrice] = useState(item?.unitPrice != null ? String(item.unitPrice) : "");
  const [reorderLevel, setReorderLevel] = useState(item?.reorderLevel ?? 0);
  const [active, setActive] = useState(item?.active ?? true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const request = {
        itemTypeId: isEdit ? null : itemTypeId,
        name,
        code: code || null,
        description: description || null,
        unit,
        unitPrice: unitPrice.trim() === "" ? null : Number(unitPrice),
        reorderLevel,
        active,
      };
      if (isEdit) {
        await updateItem(item.id, request);
      } else {
        await createItem(request);
      }
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to save item");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal open onClose={onClose} title={isEdit ? "Edit item" : "Add item"}>
      <form className="space-y-4" onSubmit={handleSubmit}>
        {error && <Alert variant="error">{error}</Alert>}

        <FormField label="Item type" htmlFor="item-type-id" description={isEdit ? "Fixed once an item is created." : undefined}>
          <Select
            id="item-type-id"
            required
            disabled={isEdit}
            value={isEdit ? item.itemTypeId : itemTypeId}
            onChange={(event) => setItemTypeId(event.target.value)}
          >
            {itemTypes.map((type) => (
              <option key={type.id} value={type.id}>
                {type.name}
              </option>
            ))}
          </Select>
        </FormField>

        <FormField label="Name" htmlFor="item-name">
          <Input id="item-name" required value={name} onChange={(event) => setName(event.target.value)} />
        </FormField>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField label="Code / SKU" htmlFor="item-code" description="Optional, unique per school.">
            <Input id="item-code" value={code} onChange={(event) => setCode(event.target.value)} />
          </FormField>
          <FormField label="Unit of measure" htmlFor="item-unit">
            <Input
              id="item-unit"
              placeholder="piece"
              value={unit}
              onChange={(event) => setUnit(event.target.value)}
            />
          </FormField>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField label="Unit price" htmlFor="item-unit-price" description="Informational only.">
            <Input
              id="item-unit-price"
              type="number"
              min="0"
              step="0.01"
              value={unitPrice}
              onChange={(event) => setUnitPrice(event.target.value)}
            />
          </FormField>
          <FormField label="Reorder level" htmlFor="item-reorder-level" description="Flags low stock at or below this.">
            <Input
              id="item-reorder-level"
              type="number"
              min="0"
              required
              value={reorderLevel}
              onChange={(event) => setReorderLevel(Number(event.target.value))}
            />
          </FormField>
        </div>

        <FormField label="Description" htmlFor="item-description">
          <Textarea
            id="item-description"
            rows={2}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
        </FormField>

        <label className="flex items-center gap-2 text-sm text-slate-700">
          <Checkbox checked={active} onChange={(event) => setActive(event.target.checked)} /> Active
        </label>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={submitting || (!isEdit && itemTypeId === "")}>
            {submitting ? "Saving…" : isEdit ? "Save changes" : "Add item"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
