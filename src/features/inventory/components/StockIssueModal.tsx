import { type FormEvent, useState } from "react";
import { ApiError } from "@/api/client";
import { issueStock, type StockLevelView } from "@/api/inventory";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { FormField } from "@/components/ui/FormField";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Textarea } from "@/components/ui/Textarea";
import { StudentSearchField, type StudentSearchSelection } from "@/features/students/components/StudentSearchField";

interface StockIssueModalProps {
  level: StockLevelView;
  branchId?: string;
  onClose: () => void;
  onSaved: () => void;
}

type Recipient = "student" | "general";

/** Records a direct stock ISSUE (Phase 40/41) - to a named student, or as general usage (not tied to anyone), never both at once, no approval step. */
export function StockIssueModal({ level, branchId, onClose, onSaved }: StockIssueModalProps) {
  const [recipient, setRecipient] = useState<Recipient>("student");
  const [student, setStudent] = useState<StudentSearchSelection | null>(null);
  const [issuedTo, setIssuedTo] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [note, setNote] = useState("");
  const [occurredOn, setOccurredOn] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const recipientNamed = recipient === "general" || student != null;
  const quantityValue = Number(quantity);
  const quantityValid = Number.isFinite(quantityValue) && quantityValue > 0;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await issueStock({
        branchId,
        itemId: level.itemId,
        quantity: quantityValue,
        studentId: recipient === "student" ? (student?.id ?? null) : null,
        issuedTo: recipient === "general" ? issuedTo.trim() || null : null,
        note: note || null,
        occurredOn: occurredOn || null,
      });
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to issue stock");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal open onClose={onClose} title={`Issue ${level.itemName}`}>
      <form className="space-y-4" onSubmit={handleSubmit}>
        {error && <Alert variant="error">{error}</Alert>}

        <p className="text-sm text-slate-500">
          {level.onHand} {level.unit} on hand.
        </p>

        <FormField label="Quantity" htmlFor="issue-quantity">
          <Input
            id="issue-quantity"
            type="number"
            required
            step={1}
            min={1}
            max={level.onHand}
            value={quantity}
            onChange={(event) => setQuantity(event.target.value)}
          />
        </FormField>

        <FormField label="Recipient" htmlFor="issue-recipient-student">
          <div
            role="radiogroup"
            aria-label="Recipient type"
            className="mb-2 inline-flex rounded-control border border-slate-200 bg-white p-1"
          >
            {(["student", "general"] as const).map((option) => {
              const selected = recipient === option;
              return (
                <button
                  key={option}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => setRecipient(option)}
                  className={`cursor-pointer rounded-control px-3 py-1.5 text-sm font-medium mobile:min-h-11 ${
                    selected ? "bg-brand-50 text-brand-800" : "text-slate-600 hover:text-slate-800"
                  }`}
                >
                  {option === "student" ? "Student" : "General usage"}
                </button>
              );
            })}
          </div>
          {recipient === "student" ? (
            <StudentSearchField id="issue-recipient-student" value={student} onChange={setStudent} branchId={branchId} />
          ) : (
            <Input
              id="issue-recipient-general"
              aria-label="Used for"
              placeholder="Used for (optional, e.g. PE department, Front office)"
              value={issuedTo}
              onChange={(event) => setIssuedTo(event.target.value)}
            />
          )}
        </FormField>

        <FormField label="Note" htmlFor="issue-note" description="Optional.">
          <Textarea id="issue-note" rows={2} value={note} onChange={(event) => setNote(event.target.value)} />
        </FormField>

        <FormField label="Date" htmlFor="issue-occurred-on" description="Defaults to today.">
          <Input
            id="issue-occurred-on"
            type="date"
            value={occurredOn}
            onChange={(event) => setOccurredOn(event.target.value)}
          />
        </FormField>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={submitting || !recipientNamed || !quantityValid}>
            {submitting ? "Issuing…" : "Issue stock"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
