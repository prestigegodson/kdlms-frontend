import { type FormEvent, useState } from "react";
import { createItemType, type InventoryItemTypeView, updateItemType } from "@/api/inventory";
import { ApiError } from "@/api/client";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { FormField } from "@/components/ui/FormField";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Textarea } from "@/components/ui/Textarea";

interface ItemTypeFormModalProps {
  itemType?: InventoryItemTypeView;
  nextPosition: number;
  onClose: () => void;
  onSaved: () => void;
}

/** Create/edit an item type - one component handles both, the FeeFormModal shape. */
export function ItemTypeFormModal({ itemType, nextPosition, onClose, onSaved }: ItemTypeFormModalProps) {
  const isEdit = itemType != null;
  const [name, setName] = useState(itemType?.name ?? "");
  const [description, setDescription] = useState(itemType?.description ?? "");
  const [active, setActive] = useState(itemType?.active ?? true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const request = { name, description: description || null, active, position: itemType?.position ?? nextPosition };
      if (isEdit) {
        await updateItemType(itemType.id, request);
      } else {
        await createItemType(request);
      }
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to save item type");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal open onClose={onClose} title={isEdit ? "Edit item type" : "Add item type"}>
      <form className="space-y-4" onSubmit={handleSubmit}>
        {error && <Alert variant="error">{error}</Alert>}

        <FormField label="Name" htmlFor="item-type-name">
          <Input id="item-type-name" required value={name} onChange={(event) => setName(event.target.value)} />
        </FormField>

        <FormField label="Description" htmlFor="item-type-description">
          <Textarea
            id="item-type-description"
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
          <Button type="submit" disabled={submitting}>
            {submitting ? "Saving…" : isEdit ? "Save changes" : "Add item type"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
