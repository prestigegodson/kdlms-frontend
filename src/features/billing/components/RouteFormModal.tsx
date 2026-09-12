import { type FormEvent, useState } from "react";
import { createTransportRoute, type TransportRouteView, updateTransportRoute } from "@/api/billing";
import { ApiError } from "@/api/client";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { FormField } from "@/components/ui/FormField";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Textarea } from "@/components/ui/Textarea";

interface RouteFormModalProps {
  /** Present -> edit an existing route. Absent -> create a new one. */
  route?: TransportRouteView;
  branchId?: string;
  nextPosition: number;
  onClose: () => void;
  onSaved: () => void;
}

/** Create-and-edit form for one branch's school-bus route - the `FeeFormModal` shape, much smaller (a route carries no amount at all; fares are a separate screen). */
export function RouteFormModal({ route, branchId, nextPosition, onClose, onSaved }: RouteFormModalProps) {
  const isEdit = route != null;
  const [name, setName] = useState(route?.name ?? "");
  const [description, setDescription] = useState(route?.description ?? "");
  const [active, setActive] = useState(route?.active ?? true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const request = {
        name,
        description: description || null,
        active,
        position: route?.position ?? nextPosition,
      };
      if (isEdit) {
        await updateTransportRoute(route.id, request, branchId);
      } else {
        await createTransportRoute(request, branchId);
      }
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : `Failed to ${isEdit ? "update" : "create"} route`);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal open onClose={onClose} title={isEdit ? "Edit route" : "Add route"}>
      <form className="space-y-4" onSubmit={handleSubmit}>
        {error && <Alert variant="error">{error}</Alert>}

        <FormField label="Name" htmlFor="route-name" description="The pickup area riders are grouped by, e.g. &quot;Ikeja&quot;.">
          <Input id="route-name" required value={name} onChange={(event) => setName(event.target.value)} />
        </FormField>

        <FormField label="Description" htmlFor="route-description">
          <Textarea
            id="route-description"
            rows={2}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
        </FormField>

        <label className="flex items-center gap-2 text-sm text-slate-700">
          <Checkbox checked={active} onChange={(event) => setActive(event.target.checked)} />
          Active
        </label>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={submitting || !name.trim()}>
            {submitting ? "Saving…" : isEdit ? "Save changes" : "Add route"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
