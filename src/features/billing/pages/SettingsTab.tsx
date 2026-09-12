import { type FormEvent, useEffect, useState } from "react";
import { type BankAccountRequest, getBillingSettings, saveBillingSettings } from "@/api/billing";
import { ApiError } from "@/api/client";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { FormField } from "@/components/ui/FormField";
import { Input } from "@/components/ui/Input";
import { Skeleton } from "@/components/ui/Skeleton";
import { Textarea } from "@/components/ui/Textarea";
import { BankAccountsEditor } from "@/features/billing/components/BankAccountsEditor";

/** Currency, ordered bank accounts, and free-text instructions - printed on every bill. SCHOOL_ADMIN only (BillingPage gates the tab itself). */
export function SettingsTab() {
  const [currency, setCurrency] = useState("");
  const [instructions, setInstructions] = useState("");
  const [accounts, setAccounts] = useState<BankAccountRequest[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    getBillingSettings()
      .then((settings) => {
        setCurrency(settings.currency);
        setInstructions(settings.instructions ?? "");
        setAccounts(
          settings.accounts.map((account) => ({
            bankName: account.bankName,
            accountName: account.accountName,
            accountNumber: account.accountNumber,
          })),
        );
      })
      .catch((err: unknown) => setLoadError(err instanceof ApiError ? err.message : "Failed to load settings"))
      .finally(() => setLoaded(true));
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    setSaved(false);
    try {
      await saveBillingSettings({ currency, instructions: instructions || null, accounts });
      setSaved(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to save settings");
    } finally {
      setSubmitting(false);
    }
  }

  if (!loaded) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }

  if (loadError) {
    return <Alert variant="error">{loadError}</Alert>;
  }

  return (
    <Card>
      <form className="space-y-6" onSubmit={handleSubmit}>
        {error && <Alert variant="error">{error}</Alert>}
        {saved && !error && <Alert variant="success">Settings saved.</Alert>}

        <FormField
          label="Currency"
          htmlFor="billing-currency"
          description="An ISO-4217 code, e.g. NGN, USD - printed on every bill."
        >
          <Input
            id="billing-currency"
            required
            maxLength={3}
            value={currency}
            onChange={(event) => setCurrency(event.target.value.toUpperCase())}
            className="max-w-24 uppercase"
          />
        </FormField>

        <div>
          <h3 className="font-display text-base font-medium text-slate-900">Bank accounts</h3>
          <p className="mt-1 text-sm text-slate-500">
            Printed on every bill, in the order shown here.
          </p>
          <div className="mt-3">
            <BankAccountsEditor accounts={accounts} onChange={setAccounts} />
          </div>
        </div>

        <FormField
          label="Instructions"
          htmlFor="billing-instructions"
          description="Free text printed under the bank accounts - payment deadlines, reference format, etc."
        >
          <Textarea
            id="billing-instructions"
            rows={4}
            value={instructions}
            onChange={(event) => setInstructions(event.target.value)}
          />
        </FormField>

        <div className="flex items-center gap-3">
          <Button type="submit" variant="primary" disabled={submitting}>
            {submitting ? "Saving…" : "Save settings"}
          </Button>
        </div>
      </form>
    </Card>
  );
}
