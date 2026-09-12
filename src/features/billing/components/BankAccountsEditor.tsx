import { ChevronDown, ChevronUp, Plus, Trash2 } from "lucide-react";
import type { BankAccountRequest } from "@/api/billing";
import { Button } from "@/components/ui/Button";
import { FormField } from "@/components/ui/FormField";
import { Input } from "@/components/ui/Input";

interface BankAccountsEditorProps {
  accounts: BankAccountRequest[];
  onChange: (accounts: BankAccountRequest[]) => void;
}

const EMPTY_ACCOUNT: BankAccountRequest = { bankName: "", accountName: "", accountNumber: "" };

/** Add/remove/reorder rows for a school's ordered bank-account list - order is display order only, sent as the array's own index. */
export function BankAccountsEditor({ accounts, onChange }: BankAccountsEditorProps) {
  function updateAccount(index: number, patch: Partial<BankAccountRequest>) {
    onChange(accounts.map((account, i) => (i === index ? { ...account, ...patch } : account)));
  }

  function removeAccount(index: number) {
    onChange(accounts.filter((_, i) => i !== index));
  }

  function moveAccount(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= accounts.length) {
      return;
    }
    const next = [...accounts];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  }

  return (
    <div className="space-y-4">
      {accounts.length === 0 && <p className="text-sm text-slate-500">No bank accounts added yet.</p>}

      {accounts.map((account, index) => (
        <div key={index} className="rounded-panel border border-slate-200 p-4">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Account {index + 1}
            </span>
            <div className="flex gap-1">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={index === 0}
                onClick={() => moveAccount(index, -1)}
                aria-label="Move up"
              >
                <ChevronUp className="h-4 w-4" aria-hidden="true" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={index === accounts.length - 1}
                onClick={() => moveAccount(index, 1)}
                aria-label="Move down"
              >
                <ChevronDown className="h-4 w-4" aria-hidden="true" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => removeAccount(index)}
                aria-label="Remove account"
              >
                <Trash2 className="h-4 w-4" aria-hidden="true" />
              </Button>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <FormField label="Bank name" htmlFor={`bank-name-${index}`}>
              <Input
                id={`bank-name-${index}`}
                required
                value={account.bankName}
                onChange={(event) => updateAccount(index, { bankName: event.target.value })}
              />
            </FormField>
            <FormField label="Account name" htmlFor={`account-name-${index}`}>
              <Input
                id={`account-name-${index}`}
                required
                value={account.accountName}
                onChange={(event) => updateAccount(index, { accountName: event.target.value })}
              />
            </FormField>
            <FormField label="Account number" htmlFor={`account-number-${index}`}>
              <Input
                id={`account-number-${index}`}
                required
                value={account.accountNumber}
                onChange={(event) => updateAccount(index, { accountNumber: event.target.value })}
              />
            </FormField>
          </div>
        </div>
      ))}

      <Button type="button" variant="secondary" onClick={() => onChange([...accounts, { ...EMPTY_ACCOUNT }])}>
        <Plus className="h-4 w-4" aria-hidden="true" />
        Add bank account
      </Button>
    </div>
  );
}
