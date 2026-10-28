import { type FormEvent, useEffect, useState } from "react";
import { getErrorMessage } from "@/api/client";
import { getTutorCurrencies, updateTutorCurrencies } from "@/api/tutorCurrencies";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Checkbox } from "@/components/ui/Checkbox";
import { FormField } from "@/components/ui/FormField";
import { Select } from "@/components/ui/Select";
import { Spinner } from "@/components/ui/Spinner";
import { SUPPORTED_CURRENCIES, type SupportedCurrency } from "@/utils/currency";

type State =
  | { kind: "loading" }
  | { kind: "loaded"; enabled: SupportedCurrency[]; defaultCurrency: SupportedCurrency }
  | { kind: "error"; message: string };

/**
 * Which currencies tutors see at sign-up and on their Plan & billing page, and which one those
 * start on. Switching a currency off only stops new use - a tutor's saved profile or running
 * subscription in it is left alone.
 */
export function TutorCurrenciesCard() {
  const [state, setState] = useState<State>({ kind: "loading" });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getTutorCurrencies()
      .then((view) => {
        if (!cancelled)
          setState({
            kind: "loaded",
            enabled: view.enabled,
            defaultCurrency: view.defaultCurrency,
          });
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setState({
            kind: "error",
            message: getErrorMessage(error, "Failed to load the tutor currencies"),
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (state.kind === "loading") {
    return (
      <Card>
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Spinner /> Loading tutor currencies…
        </div>
      </Card>
    );
  }
  if (state.kind === "error") {
    return <Alert variant="error">{state.message}</Alert>;
  }

  const { enabled, defaultCurrency } = state;

  function toggle(code: SupportedCurrency) {
    const next = SUPPORTED_CURRENCIES.filter((c) =>
      c === code ? !enabled.includes(c) : enabled.includes(c),
    );
    // The default must stay one of the enabled currencies.
    const nextDefault = next.includes(defaultCurrency)
      ? defaultCurrency
      : (next[0] ?? defaultCurrency);
    setState({ kind: "loaded", enabled: next, defaultCurrency: nextDefault });
    setSaved(false);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setSaveError(null);
    setSaved(false);
    try {
      const view = await updateTutorCurrencies({ enabled, defaultCurrency });
      setState({ kind: "loaded", enabled: view.enabled, defaultCurrency: view.defaultCurrency });
      setSaved(true);
    } catch (error) {
      setSaveError(getErrorMessage(error, "Failed to save the tutor currencies"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <form className="space-y-4" onSubmit={handleSubmit}>
        <div>
          <h2 className="text-sm font-semibold text-slate-900">Tutor currencies</h2>
          <p className="mt-1 text-sm text-slate-500">
            The currencies tutors can choose when they sign up and pay for a plan. Turning one off
            doesn't affect tutors already using it.
          </p>
        </div>
        {saveError && <Alert variant="error">{saveError}</Alert>}
        {saved && <Alert variant="success">Tutor currencies updated.</Alert>}
        <fieldset>
          <legend className="sr-only">Enabled currencies</legend>
          <div className="flex flex-wrap gap-x-6 gap-y-3">
            {SUPPORTED_CURRENCIES.map((code) => (
              <label
                key={code}
                htmlFor={`tutor-currency-${code}`}
                className="flex items-center gap-2 text-sm text-slate-700"
              >
                <Checkbox
                  id={`tutor-currency-${code}`}
                  checked={enabled.includes(code)}
                  onChange={() => toggle(code)}
                />
                {code}
              </label>
            ))}
          </div>
        </fieldset>
        {enabled.length === 0 && (
          <p className="text-xs text-red-600">Enable at least one currency.</p>
        )}
        <FormField label="Default currency" htmlFor="tutor-currency-default" className="w-40">
          <Select
            id="tutor-currency-default"
            value={defaultCurrency}
            disabled={enabled.length === 0}
            onChange={(event) => {
              setState({
                kind: "loaded",
                enabled,
                defaultCurrency: event.target.value as SupportedCurrency,
              });
              setSaved(false);
            }}
          >
            {enabled.map((code) => (
              <option key={code} value={code}>
                {code}
              </option>
            ))}
          </Select>
        </FormField>
        <Button type="submit" disabled={saving || enabled.length === 0}>
          {saving ? "Saving…" : "Save currencies"}
        </Button>
      </form>
    </Card>
  );
}
