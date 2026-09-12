import { CalendarClock } from "lucide-react";
import { useEffect, useState } from "react";
import { type AdvanceBillPlanView, getAdvanceBillPlans } from "@/api/billing";
import { ApiError } from "@/api/client";
import { type AcademicSessionView, listSessions } from "@/api/sessions";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { FormField } from "@/components/ui/FormField";
import { ResultDialog } from "@/components/ui/ResultDialog";
import { Select } from "@/components/ui/Select";
import { Skeleton } from "@/components/ui/Skeleton";
import { AdvanceBillPlanModal } from "@/features/billing/components/AdvanceBillPlanModal";
import { CopyAdvanceBillPlansModal } from "@/features/billing/components/CopyAdvanceBillPlansModal";

interface AdvanceBillPlanCardProps {
  /** Omitted for a BRANCH_ADMIN - their own branch is derived server-side. */
  branchId?: string;
}

/**
 * Bill an upcoming session's fees before promotion runs, by mapping each level to the level its
 * students will be billed at - a summary card, not the editor itself (`AdvanceBillPlanModal`
 * opens on "Configure"). Owns its own session select rather than reusing `BillsTab`'s
 * `ClassTermPicker`, the same reason `PricesTab`/`TransportTab` each own theirs: this feature is
 * session-scoped, not term-scoped, and there's no reason to default to the *current* session -
 * advance billing is specifically for one that isn't current yet.
 */
export function AdvanceBillPlanCard({ branchId }: AdvanceBillPlanCardProps) {
  const [sessions, setSessions] = useState<AcademicSessionView[]>([]);
  const [sessionId, setSessionId] = useState("");

  useEffect(() => {
    listSessions(0, 50).then((page) => setSessions(page.content));
  }, []);

  const [view, setView] = useState<AdvanceBillPlanView | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [configureOpen, setConfigureOpen] = useState(false);
  const [copyOpen, setCopyOpen] = useState(false);
  const [result, setResult] = useState<{ variant: "success" | "error"; message: string } | null>(null);

  const selectionKey = `${branchId ?? ""}|${sessionId}`;
  const [lastSelectionKey, setLastSelectionKey] = useState(selectionKey);
  if (selectionKey !== lastSelectionKey) {
    setLastSelectionKey(selectionKey);
    setView(null);
    setLoadError(null);
  }

  function reload() {
    if (!sessionId) return;
    getAdvanceBillPlans(sessionId, branchId)
      .then(setView)
      .catch((err: unknown) => setLoadError(err instanceof ApiError ? err.message : "Failed to load the advance-bill plan"));
  }

  useEffect(reload, [sessionId, branchId]);

  function handleSaved(message: string) {
    setConfigureOpen(false);
    reload();
    setResult({ variant: "success", message });
  }

  function handleCopied() {
    setCopyOpen(false);
    reload();
  }

  // Rolled up by currentLevelId, not class - a plan is per level (AdvanceBillPlanModal's own
  // grouping). A level counts as "planned" only when every one of its classes already has a
  // billing level; a partially-planned level (a leftover per-class save) reads as unplanned,
  // which nudges the admin into Configure where it shows as "Mixed" rather than looking settled.
  const levelPlannedByLevelId = new Map<string, boolean>();
  for (const row of view?.classes ?? []) {
    const planned = row.billingLevelId !== null;
    const existing = levelPlannedByLevelId.get(row.currentLevelId);
    levelPlannedByLevelId.set(row.currentLevelId, existing === undefined ? planned : existing && planned);
  }
  const totalCount = levelPlannedByLevelId.size;
  const plannedCount = Array.from(levelPlannedByLevelId.values()).filter(Boolean).length;

  return (
    <Card>
      <div className="flex items-start gap-3">
        <CalendarClock className="mt-0.5 h-5 w-5 shrink-0 text-slate-400" aria-hidden="true" />
        <div className="min-w-0 flex-1 space-y-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Advance bills</h2>
            <p className="text-sm text-slate-500">
              Bill an upcoming session's fees before promotion, by mapping each level to the level its students
              will be billed at.
            </p>
          </div>

          <FormField label="Session to advance-bill" htmlFor="advance-bill-plan-session" className="max-w-xs">
            <Select
              id="advance-bill-plan-session"
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

          {loadError && <Alert variant="error">{loadError}</Alert>}

          {sessionId && !view && !loadError && <Skeleton className="h-10 w-full" />}

          {sessionId && view && (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm text-slate-600">
                {plannedCount} of {totalCount} {totalCount === 1 ? "level" : "levels"} planned for {view.sessionName}
                .
              </p>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="secondary" onClick={() => setCopyOpen(true)}>
                  Copy from another session
                </Button>
                <Button type="button" variant="primary" onClick={() => setConfigureOpen(true)}>
                  Configure
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {configureOpen && view && (
        <AdvanceBillPlanModal view={view} branchId={branchId} onClose={() => setConfigureOpen(false)} onSaved={handleSaved} />
      )}

      {sessionId && (
        <CopyAdvanceBillPlansModal
          open={copyOpen}
          onClose={() => setCopyOpen(false)}
          targetSessionId={sessionId}
          onCopied={handleCopied}
        />
      )}

      {result && <ResultDialog variant={result.variant} message={result.message} onClose={() => setResult(null)} />}
    </Card>
  );
}
