import { type FormEvent, useEffect, useState } from "react";
import { ApiError } from "@/api/client";
import {
  type AiSettingsView,
  getAiSettings,
  getAiUsage,
  type SchoolUsageView,
  updateAiSettings,
} from "@/api/aiSettings";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { FormField } from "@/components/ui/FormField";
import { Input } from "@/components/ui/Input";
import { PageHeader } from "@/components/ui/PageHeader";
import { Select } from "@/components/ui/Select";
import { Spinner } from "@/components/ui/Spinner";
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from "@/components/ui/Table";

type LoadState =
  | { kind: "loading" }
  | { kind: "loaded"; settings: AiSettingsView }
  | { kind: "error"; message: string };

/** System-admin editor for the platform's AI provider settings, plus this month's usage rollup. */
export function AdminAiSettingsPage() {
  const [state, setState] = useState<LoadState>({ kind: "loading" });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [usage, setUsage] = useState<SchoolUsageView[] | null>(null);
  const [usageError, setUsageError] = useState<string | null>(null);

  useEffect(() => {
    getAiSettings()
      .then((settings) => setState({ kind: "loaded", settings }))
      .catch((error: unknown) =>
        setState({
          kind: "error",
          message: error instanceof ApiError ? error.message : "Failed to load AI settings",
        }),
      );
    getAiUsage()
      .then(setUsage)
      .catch((error: unknown) =>
        setUsageError(error instanceof ApiError ? error.message : "Failed to load AI usage"),
      );
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (state.kind !== "loaded") return;
    setSaving(true);
    setSaveError(null);
    setSaved(false);
    try {
      const updated = await updateAiSettings({
        provider: state.settings.provider,
        model: state.settings.model,
        maxTokens: state.settings.maxTokens,
        temperature: state.settings.temperature,
      });
      setState({ kind: "loaded", settings: updated });
      setSaved(true);
    } catch (error) {
      setSaveError(error instanceof ApiError ? error.message : "Failed to save AI settings");
    } finally {
      setSaving(false);
    }
  }

  function updateField<K extends keyof AiSettingsView>(key: K, value: AiSettingsView[K]) {
    setState((prev) => (prev.kind === "loaded" ? { kind: "loaded", settings: { ...prev.settings, [key]: value } } : prev));
  }

  if (state.kind === "loading") {
    return (
      <div className="max-w-2xl space-y-6">
        <PageHeader title="AI settings" description="Which language-model provider powers AI lesson-note generation." />
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Spinner /> Loading AI settings…
        </div>
      </div>
    );
  }

  if (state.kind === "error") {
    return (
      <div className="max-w-2xl space-y-6">
        <PageHeader title="AI settings" description="Which language-model provider powers AI lesson-note generation." />
        <Alert variant="error">{state.message}</Alert>
      </div>
    );
  }

  const { settings } = state;

  return (
    <div className="max-w-2xl space-y-6">
      <PageHeader title="AI settings" description="Which language-model provider powers AI lesson-note generation." />

      <Card>
        <form className="space-y-4" onSubmit={handleSubmit}>
          {saveError && <Alert variant="error">{saveError}</Alert>}
          {saved && <Alert variant="success">AI settings updated.</Alert>}

          <p className="text-sm text-slate-500">
            Provider credentials are set by environment variable on the server and are never stored here or shown
            back to you. Only a provider this deployment already holds a key for can be selected.
          </p>

          <FormField label="Provider" htmlFor="ai-provider">
            <Select
              id="ai-provider"
              value={settings.provider ?? ""}
              onChange={(event) => updateField("provider", event.target.value === "" ? null : event.target.value)}
            >
              <option value="">Use deployment default ({settings.effectiveProvider})</option>
              {settings.availableProviders.map((provider) => (
                <option key={provider} value={provider}>
                  {provider}
                </option>
              ))}
            </Select>
          </FormField>

          <FormField label="Model" htmlFor="ai-model">
            <Input
              id="ai-model"
              placeholder={settings.effectiveModel ?? "Not configured"}
              value={settings.model ?? ""}
              onChange={(event) => updateField("model", event.target.value === "" ? null : event.target.value)}
            />
          </FormField>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField label="Max tokens" htmlFor="ai-max-tokens">
              <Input
                id="ai-max-tokens"
                type="number"
                min={1}
                placeholder={String(settings.effectiveMaxTokens)}
                value={settings.maxTokens ?? ""}
                onChange={(event) =>
                  updateField("maxTokens", event.target.value === "" ? null : Number(event.target.value))
                }
              />
            </FormField>
            <FormField label="Temperature" htmlFor="ai-temperature">
              <Input
                id="ai-temperature"
                type="number"
                min={0}
                max={2}
                step={0.1}
                placeholder={settings.effectiveTemperature === null ? "Provider default" : String(settings.effectiveTemperature)}
                value={settings.temperature ?? ""}
                onChange={(event) =>
                  updateField("temperature", event.target.value === "" ? null : Number(event.target.value))
                }
              />
            </FormField>
          </div>

          <p className="text-xs text-slate-500">
            An empty Provider/Model/Max tokens field falls back to the deployment default shown as its
            placeholder above. An empty Temperature field sends none at all, letting the model use its own
            default - required for GPT-5 and the o-series reasoning models, which reject any other value.
          </p>

          <Button type="submit" disabled={saving}>
            {saving ? "Saving…" : "Save changes"}
          </Button>
        </form>
      </Card>

      <Card>
        <h2 className="mb-4 text-sm font-semibold text-slate-900">This month's AI usage</h2>
        {usageError && <Alert variant="error">{usageError}</Alert>}
        {!usageError && usage === null && (
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Spinner /> Loading usage…
          </div>
        )}
        {!usageError && usage !== null && usage.length === 0 && (
          <EmptyState title="No AI generations yet" description="Usage for the current calendar month will appear here." />
        )}
        {!usageError && usage !== null && usage.length > 0 && (
          <Table>
            <TableHead>
              <TableRow>
                <TableHeaderCell>School</TableHeaderCell>
                <TableHeaderCell numeric>Generations</TableHeaderCell>
                <TableHeaderCell numeric>Succeeded</TableHeaderCell>
                <TableHeaderCell numeric>Failed</TableHeaderCell>
                <TableHeaderCell numeric>Input tokens</TableHeaderCell>
                <TableHeaderCell numeric>Output tokens</TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {usage.map((row) => (
                <TableRow key={row.schoolId}>
                  <TableCell label="School">{row.schoolName}</TableCell>
                  <TableCell label="Generations" numeric>
                    {row.totalGenerations}
                  </TableCell>
                  <TableCell label="Succeeded" numeric>
                    {row.succeeded}
                  </TableCell>
                  <TableCell label="Failed" numeric>
                    {row.failed}
                  </TableCell>
                  <TableCell label="Input tokens" numeric>
                    {row.inputTokens}
                  </TableCell>
                  <TableCell label="Output tokens" numeric>
                    {row.outputTokens}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
