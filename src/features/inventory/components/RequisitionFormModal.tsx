import { Plus, Trash2 } from "lucide-react";
import { type FormEvent, useState } from "react";
import { ApiError } from "@/api/client";
import { createRequisition, type RequisitionView, updateRequisition } from "@/api/inventory";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { FormField } from "@/components/ui/FormField";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Textarea } from "@/components/ui/Textarea";
import { formatAmount } from "@/utils/currency";

interface DraftLine {
  description: string;
  estimatedUnitCost: string;
  quantityRequested: string;
  note: string;
}

interface RequisitionFormModalProps {
  requisition?: RequisitionView;
  branchId?: string;
  onClose: () => void;
  onSaved: () => void;
}

function draftLinesFrom(requisition: RequisitionView | undefined): DraftLine[] {
  const blankLine = { description: "", estimatedUnitCost: "", quantityRequested: "1", note: "" };
  if (!requisition) {
    return [blankLine];
  }
  // A historic (pre-Phase-40) requisition may still carry an item line - itemId set, description
  // null - which isn't editable here (Requisition.save rejects any item line on a new write); its
  // own read-only presentation lives in RequisitionDetailModal, not this form.
  const adHocLines = requisition.lines
    .filter((line) => line.itemId == null)
    .map((line) => ({
      description: line.description ?? "",
      estimatedUnitCost: line.estimatedUnitCost != null ? String(line.estimatedUnitCost) : "",
      quantityRequested: String(line.quantityRequested),
      note: line.note ?? "",
    }));
  return adHocLines.length > 0 ? adHocLines : [blankLine];
}

function lineAmount(line: DraftLine): number | null {
  const cost = Number(line.estimatedUnitCost);
  const quantity = Number(line.quantityRequested);
  if (!Number.isFinite(cost) || !Number.isFinite(quantity)) {
    return null;
  }
  return cost * quantity;
}

function totalRequestedAmount(lines: DraftLine[]): number | null {
  const amounts = lines.map(lineAmount).filter((amount): amount is number => amount != null);
  if (amounts.length === 0) {
    return null;
  }
  return amounts.reduce((sum, amount) => sum + amount, 0);
}

function isLineIncomplete(line: DraftLine): boolean {
  return (
    line.description.trim() === "" ||
    line.estimatedUnitCost.trim() === "" ||
    Number(line.estimatedUnitCost) < 0 ||
    !(Number(line.quantityRequested) > 0)
  );
}

/** Create/edit a DRAFT requisition - a header plus a repeating list of described-purchase + cost + quantity + note lines. */
export function RequisitionFormModal({ requisition, branchId, onClose, onSaved }: RequisitionFormModalProps) {
  const isEdit = requisition != null;
  const [purpose, setPurpose] = useState(requisition?.purpose ?? "");
  const [neededBy, setNeededBy] = useState(requisition?.neededBy ?? "");
  const [lines, setLines] = useState<DraftLine[]>(draftLinesFrom(requisition));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function addLine() {
    setLines((current) => [...current, { description: "", estimatedUnitCost: "", quantityRequested: "1", note: "" }]);
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
        description: line.description.trim(),
        estimatedUnitCost: Number(line.estimatedUnitCost),
        quantityRequested: Number(line.quantityRequested),
        note: line.note || null,
      }));
      if (isEdit) {
        await updateRequisition(requisition.id, {
          purpose: purpose || null,
          neededBy: neededBy || null,
          lines: lineRequests,
        });
      } else {
        await createRequisition({
          branchId,
          purpose: purpose || null,
          neededBy: neededBy || null,
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

  const hasIncompleteLine = lines.length === 0 || lines.some(isLineIncomplete);
  const total = totalRequestedAmount(lines);

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

        <div className="space-y-2">
          <span className="block text-sm font-medium text-slate-700">Lines</span>
          {lines.map((line, index) => {
            const amount = lineAmount(line);
            return (
              <div key={index} className="flex flex-col gap-2 rounded-control border border-slate-200 p-3">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
                  <div className="min-w-0 flex-1">
                    <Input
                      aria-label="Description"
                      placeholder="What is this purchase for?"
                      required
                      value={line.description}
                      onChange={(event) => updateLine(index, { description: event.target.value })}
                    />
                  </div>
                  <div className="w-full sm:w-40">
                    <Input
                      aria-label="Estimated unit cost"
                      type="number"
                      min={0}
                      step="0.01"
                      placeholder="Unit cost"
                      required
                      value={line.estimatedUnitCost}
                      onChange={(event) => updateLine(index, { estimatedUnitCost: event.target.value })}
                    />
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
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
                  <div className="min-w-0 flex-1">
                    <Input
                      aria-label="Note"
                      placeholder="Note / justification (optional)"
                      value={line.note}
                      onChange={(event) => updateLine(index, { note: event.target.value })}
                    />
                  </div>
                  {amount != null && (
                    <span className="whitespace-nowrap pt-2 text-sm text-slate-500 sm:pt-0 sm:self-center">
                      = {formatAmount(amount)}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
          <Button type="button" variant="secondary" size="sm" onClick={addLine}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            Add line
          </Button>
        </div>

        {total != null && (
          <div className="flex justify-end border-t border-slate-200 pt-3 text-sm">
            <span className="font-medium text-slate-700">Total amount requested: {formatAmount(total)}</span>
          </div>
        )}

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
