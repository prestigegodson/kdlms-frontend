import { Plus, Trash2 } from "lucide-react";
import { type FormEvent, useState } from "react";
import { ApiError } from "@/api/client";
import {
  createRequisition,
  type InventoryItemView,
  type RequisitionView,
  updateRequisition,
} from "@/api/inventory";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { FormField } from "@/components/ui/FormField";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { StudentSearchField, type StudentSearchSelection } from "@/features/students/components/StudentSearchField";
import { useAuthStore } from "@/stores/authStore";

interface DraftLine {
  itemId: string;
  quantityRequested: string;
  note: string;
}

interface RequisitionFormModalProps {
  requisition?: RequisitionView;
  branchId?: string;
  items: InventoryItemView[];
  onClose: () => void;
  onSaved: () => void;
}

function draftLinesFrom(requisition: RequisitionView | undefined): DraftLine[] {
  if (!requisition) {
    return [{ itemId: "", quantityRequested: "1", note: "" }];
  }
  return requisition.lines.map((line) => ({
    itemId: line.itemId,
    quantityRequested: String(line.quantityRequested),
    note: line.note ?? "",
  }));
}

function studentSelectionFrom(requisition: RequisitionView | undefined): StudentSearchSelection | null {
  if (!requisition?.studentId || !requisition.studentName) {
    return null;
  }
  // Denormalized straight off the view - the requestedByName/itemName precedent - so pre-filling
  // the field in edit mode needs no extra round trip.
  return {
    id: requisition.studentId,
    name: requisition.studentName,
    admissionNumber: requisition.studentAdmissionNumber ?? "",
  };
}

/** Create/edit a DRAFT requisition - a header plus a repeating list of item + quantity + note lines. */
export function RequisitionFormModal({ requisition, branchId, items, onClose, onSaved }: RequisitionFormModalProps) {
  const isEdit = requisition != null;
  const [purpose, setPurpose] = useState(requisition?.purpose ?? "");
  const [neededBy, setNeededBy] = useState(requisition?.neededBy ?? "");
  const [student, setStudent] = useState<StudentSearchSelection | null>(studentSelectionFrom(requisition));
  const [lines, setLines] = useState<DraftLine[]>(draftLinesFrom(requisition));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // On edit, RequisitionsTab omits `branchId` (a requisition's branch is immutable), so the
  // requisition's own branchId covers that case. On create, `branchId` is the tab's own filter -
  // present for a SCHOOL_ADMIN, but `undefined` for a BRANCH_ADMIN/INVENTORY_MANAGER
  // (useBranchScope() deliberately leaves their own branch for the server to derive from the
  // token), so the caller's own branchId from the auth store is the last fallback.
  const ownBranchId = useAuthStore((state) => state.user?.branchId);
  const studentSearchBranchId = requisition?.branchId ?? branchId ?? ownBranchId;

  function addLine() {
    setLines((current) => [...current, { itemId: items[0]?.id ?? "", quantityRequested: "1", note: "" }]);
  }

  function removeLine(index: number) {
    setLines((current) => current.filter((_, i) => i !== index));
  }

  function updateLine(index: number, patch: Partial<DraftLine>) {
    setLines((current) => current.map((line, i) => (i === index ? { ...line, ...patch } : line)));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const lineRequests = lines.map((line) => ({
        itemId: line.itemId,
        quantityRequested: Number(line.quantityRequested),
        note: line.note || null,
      }));
      if (isEdit) {
        await updateRequisition(requisition.id, {
          purpose: purpose || null,
          neededBy: neededBy || null,
          studentId: student?.id ?? null,
          lines: lineRequests,
        });
      } else {
        await createRequisition({
          branchId,
          purpose: purpose || null,
          neededBy: neededBy || null,
          studentId: student?.id ?? null,
          lines: lineRequests,
        });
      }
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to save requisition");
    } finally {
      setSubmitting(false);
    }
  }

  const hasIncompleteLine = lines.some((line) => line.itemId === "" || Number(line.quantityRequested) <= 0);

  return (
    <Modal open onClose={onClose} title={isEdit ? "Edit requisition" : "New requisition"} size="lg">
      <form className="space-y-4" onSubmit={handleSubmit}>
        {error && <Alert variant="error">{error}</Alert>}

        <FormField label="Purpose" htmlFor="requisition-purpose">
          <Textarea
            id="requisition-purpose"
            rows={2}
            value={purpose}
            onChange={(event) => setPurpose(event.target.value)}
          />
        </FormField>

        <FormField label="Needed by" htmlFor="requisition-needed-by" description="Optional.">
          <Input
            id="requisition-needed-by"
            type="date"
            value={neededBy}
            onChange={(event) => setNeededBy(event.target.value)}
          />
        </FormField>

        <FormField label="Student" htmlFor="requisition-student" description="Optional - who the goods are for.">
          <StudentSearchField
            id="requisition-student"
            value={student}
            onChange={setStudent}
            branchId={studentSearchBranchId}
          />
        </FormField>

        <div className="space-y-2">
          <span className="block text-sm font-medium text-slate-700">Lines</span>
          {lines.map((line, index) => (
            <div key={index} className="flex flex-col gap-2 rounded-control border border-slate-200 p-3 sm:flex-row sm:items-start">
              <div className="min-w-0 flex-1">
                <Select
                  aria-label="Item"
                  required
                  value={line.itemId}
                  onChange={(event) => updateLine(index, { itemId: event.target.value })}
                >
                  <option value="">Select an item…</option>
                  {items.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="w-full sm:w-24">
                <Input
                  aria-label="Quantity"
                  type="number"
                  min={1}
                  required
                  value={line.quantityRequested}
                  onChange={(event) => updateLine(index, { quantityRequested: event.target.value })}
                />
              </div>
              <div className="min-w-0 flex-1">
                <Input
                  aria-label="Note"
                  placeholder="Note (optional)"
                  value={line.note}
                  onChange={(event) => updateLine(index, { note: event.target.value })}
                />
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={lines.length <= 1}
                onClick={() => removeLine(index)}
                aria-label="Remove line"
              >
                <Trash2 className="h-4 w-4" aria-hidden="true" />
              </Button>
            </div>
          ))}
          <Button type="button" variant="secondary" size="sm" onClick={addLine}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            Add line
          </Button>
        </div>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={submitting || hasIncompleteLine}>
            {submitting ? "Saving…" : isEdit ? "Save changes" : "Create requisition"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
