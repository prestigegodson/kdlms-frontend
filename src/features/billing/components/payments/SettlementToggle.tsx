import { useId } from "react";
import type { Settlement } from "@/api/feePayments";
import { Alert } from "@/components/ui/Alert";

interface SettlementToggleProps {
  value: Settlement;
  onChange: (settlement: Settlement) => void;
  /** What the balance suggests (backend `Settlement.suggest`) - a different choice shows a warning, never a block (D5). */
  suggested: Settlement;
  /** False with no bill (D2) - there's no balance to disagree with, so no mismatch warning. */
  hasBill: boolean;
  disabled?: boolean;
}

const OPTIONS: { value: Settlement; label: string }[] = [
  { value: "PARTIAL", label: "Part payment" },
  { value: "FULL", label: "Paid in full" },
];

/**
 * The Partial/Full choice every confirm makes (D5) - pre-selected from the live balance by the
 * caller, but the admin's choice always wins; a mismatch is flagged, not refused. Shared by the
 * review modal, Record & confirm, and Correct amount.
 */
export function SettlementToggle({
  value,
  onChange,
  suggested,
  hasBill,
  disabled = false,
}: SettlementToggleProps) {
  const name = useId();
  const mismatch = hasBill && value !== suggested;
  return (
    <div className="space-y-2">
      <div role="radiogroup" aria-label="Settlement" className="grid grid-cols-2 gap-2">
        {OPTIONS.map((option) => (
          <label
            key={option.value}
            className={`flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-control border px-3 py-2 text-sm font-medium ${
              value === option.value
                ? "border-brand-500 bg-brand-50 text-brand-700"
                : "border-slate-300 text-slate-700 hover:bg-slate-50"
            } ${disabled ? "cursor-not-allowed opacity-60" : ""}`}
          >
            <input
              type="radio"
              name={name}
              className="sr-only"
              value={option.value}
              checked={value === option.value}
              disabled={disabled}
              onChange={() => onChange(option.value)}
            />
            {option.label}
          </label>
        ))}
      </div>
      {mismatch && (
        <Alert variant="warning">
          {value === "FULL"
            ? "The balance isn't fully covered yet - marking this paid in full will close the term anyway."
            : "This covers the whole balance - it will still be recorded as a part payment."}
        </Alert>
      )}
    </div>
  );
}
