import { useEffect, useState } from "react";
import { type FeePriceGridView, type FeePriceRow, getBillingSettings, getFeePriceGrid } from "@/api/billing";
import { ApiError } from "@/api/client";
import { type AcademicSessionView, listSessions } from "@/api/sessions";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { FormField } from "@/components/ui/FormField";
import { ResultDialog } from "@/components/ui/ResultDialog";
import { Select } from "@/components/ui/Select";
import { Skeleton } from "@/components/ui/Skeleton";
import { StickySubHeader, useFilterChip } from "@/components/ui/StickySubHeader";
import { BranchFilter } from "@/features/branches/components/BranchFilter";
import { useBranchScope } from "@/features/branches/useBranchScope";
import { CopyPricesModal } from "@/features/billing/components/CopyPricesModal";
import { FeePriceListTable } from "@/features/billing/components/FeePriceListTable";
import { FeePricesModal } from "@/features/billing/components/FeePricesModal";

/**
 * A branch's fee price list for one session - SCHOOL_ADMIN (any branch) or BRANCH_ADMIN (own
 * branch, derived server-side) - `BillingPage` already gates this tab to exactly that pair via
 * `can.manageFeePrices`, so there's no narrower read-only sub-scope to check here (unlike
 * `FeesTab`, which BRANCH_ADMIN also reaches, read-only). A plain (two-control) `StickySubHeader`
 * for Branch + Session, per that component's own "one or two controls stays plain" guidance - the
 * `AdminTimetablePanel` shape.
 *
 * Pricing itself happens per fee in `FeePricesModal`, not inline on this page - a fee×level grid
 * of bare inputs scaled horizontally with the school's level count and forced a scroll that
 * separated the fee name from the cell being typed into. `FeePriceListTable` here is a fixed,
 * level-count-independent set of columns.
 */
export function PricesTab() {
  const { ready: branchReady, branchId } = useBranchScope();

  const [sessions, setSessions] = useState<AcademicSessionView[]>([]);
  const [sessionId, setSessionId] = useState("");

  useEffect(() => {
    listSessions(0, 50).then((page) => {
      setSessions(page.content);
      const current = page.content.find((session) => session.current);
      if (current) setSessionId(current.id);
    });
  }, []);

  // Currency is school-wide config (BillingSettingsView), not part of the price grid itself -
  // fetched once, independently of branch/session, purely to format amounts. A rejected fetch
  // leaves this null and amounts render as plain grouped numbers rather than blanking the page.
  const [currency, setCurrency] = useState<string | null>(null);
  useEffect(() => {
    getBillingSettings()
      .then((settings) => setCurrency(settings.currency))
      .catch(() => {});
  }, []);

  const [grid, setGrid] = useState<FeePriceGridView | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [result, setResult] = useState<{ variant: "success" | "error"; message: string } | null>(null);
  const [copyOpen, setCopyOpen] = useState(false);
  const [editingFee, setEditingFee] = useState<FeePriceRow | null>(null);

  useFilterChip("session", sessions.find((session) => session.id === sessionId)?.name);

  // Branch/session selection resets downstream state during render (the
  // ScoreEntryGrid/AdminTimetablePanel idiom) rather than inside an effect.
  const selectionKey = `${branchId ?? ""}|${sessionId}`;
  const [lastSelectionKey, setLastSelectionKey] = useState(selectionKey);
  if (selectionKey !== lastSelectionKey) {
    setLastSelectionKey(selectionKey);
    setGrid(null);
    setLoadError(null);
    setResult(null);
  }

  function reload() {
    if (!branchReady || !sessionId) return;
    getFeePriceGrid(sessionId, branchId)
      .then((view) => setGrid(view))
      .catch((err: unknown) => setLoadError(err instanceof ApiError ? err.message : "Failed to load prices"));
  }

  useEffect(reload, [branchReady, branchId, sessionId]);

  function handleCopied() {
    setCopyOpen(false);
    reload();
  }

  function handleSaved(message: string) {
    reload();
    setResult({ variant: "success", message });
  }

  return (
    <div className="space-y-6">
      <StickySubHeader>
        <BranchFilter id="billing-prices-branch" />
        <FormField label="Session" htmlFor="billing-prices-session" className="min-w-0 flex-1 lg:max-w-[14rem]">
          <Select
            id="billing-prices-session"
            value={sessionId}
            onChange={(event) => setSessionId(event.target.value)}
          >
            <option value="">Select a session…</option>
            {sessions.map((session) => (
              <option key={session.id} value={session.id}>
                {session.name}
              </option>
            ))}
          </Select>
        </FormField>
      </StickySubHeader>

      {sessionId && (
        <div className="flex justify-end">
          <Button type="button" variant="secondary" onClick={() => setCopyOpen(true)}>
            Copy from another session
          </Button>
        </div>
      )}

      {loadError && <Alert variant="error">{loadError}</Alert>}

      {!sessionId ? (
        <EmptyState title="Select a session" description="Pick a session to view or price its fees." />
      ) : !grid ? (
        <div className="space-y-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : grid.fees.length === 0 ? (
        <EmptyState title="No fees yet" description="Add a fee in the Fees tab before pricing it." />
      ) : (
        <FeePriceListTable grid={grid} currency={currency} onEdit={setEditingFee} />
      )}

      {sessionId && (
        <CopyPricesModal
          open={copyOpen}
          onClose={() => setCopyOpen(false)}
          targetSessionId={sessionId}
          onCopied={handleCopied}
        />
      )}

      {grid && editingFee && (
        <FeePricesModal
          key={editingFee.feeId}
          fee={editingFee}
          levels={grid.levels}
          branchName={grid.branchName}
          sessionName={grid.sessionName}
          sessionId={sessionId}
          branchId={branchId}
          currency={currency}
          onClose={() => setEditingFee(null)}
          onSaved={handleSaved}
        />
      )}

      {result && <ResultDialog variant={result.variant} message={result.message} onClose={() => setResult(null)} />}
    </div>
  );
}
