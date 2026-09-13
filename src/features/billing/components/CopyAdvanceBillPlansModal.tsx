import { CheckCircle2, XCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { type AdvanceBillPlanBranchCopyOutcome, copyAdvanceBillPlans } from "@/api/billing";
import { ApiError } from "@/api/client";
import { type AcademicSessionView, listSessions } from "@/api/sessions";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { FormField } from "@/components/ui/FormField";
import { Modal } from "@/components/ui/Modal";
import { Select } from "@/components/ui/Select";
import { useAuthStore } from "@/stores/authStore";
import { useBranchStore } from "@/stores/branchStore";

interface CopyAdvanceBillPlansModalProps {
  open: boolean;
  onClose: () => void;
  /** The session currently being configured - always the copy's target. */
  targetSessionId: string;
  onCopied: () => void;
}

/**
 * Lets an admin pick a source session and one or more branches, then copies each selected
 * branch's advance-bill plan (which level bills at which level) from that session into the
 * currently-configured (target) session in one action - `ManageAdvanceBillPlansUseCase.
 * copyFromSession`'s bulk contract. Mirrors `CopyPricesModal`/`CopyFaresModal` verbatim, with a
 * plan row (a level) copied rather than a price cell or a fare.
 */
export function CopyAdvanceBillPlansModal({ open, onClose, targetSessionId, onCopied }: CopyAdvanceBillPlansModalProps) {
  const role = useAuthStore((state) => state.user?.role);
  const ownBranchId = useAuthStore((state) => state.user?.branchId);
  const allBranches = useBranchStore((state) => state.branches);
  const fetchBranches = useBranchStore((state) => state.fetchIfNeeded);

  const branchOptions = role === "BRANCH_ADMIN" ? allBranches.filter((branch) => branch.id === ownBranchId) : allBranches;

  const [sessions, setSessions] = useState<AcademicSessionView[]>([]);
  const [sourceSessionId, setSourceSessionId] = useState("");
  const [selectedBranchIds, setSelectedBranchIds] = useState<Set<string>>(
    () => new Set(role === "BRANCH_ADMIN" && ownBranchId ? [ownBranchId] : []),
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [outcomes, setOutcomes] = useState<AdvanceBillPlanBranchCopyOutcome[] | null>(null);

  useEffect(() => {
    if (!open) return;
    if (role === "SCHOOL_ADMIN") fetchBranches();
    listSessions(0, 50).then((page) => setSessions(page.content));
  }, [open, role, fetchBranches]);

  function toggleBranch(branchId: string) {
    if (role === "BRANCH_ADMIN") return;
    setSelectedBranchIds((current) => {
      const next = new Set(current);
      if (next.has(branchId)) next.delete(branchId);
      else next.add(branchId);
      return next;
    });
  }

  async function handleCopy() {
    setSubmitting(true);
    setError(null);
    try {
      const result = await copyAdvanceBillPlans(sourceSessionId, targetSessionId, Array.from(selectedBranchIds));
      setOutcomes(result.outcomes);
      if (result.outcomes.some((outcome) => outcome.success)) {
        onCopied();
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to copy the advance-bill plan");
    } finally {
      setSubmitting(false);
    }
  }

  function handleClose() {
    setOutcomes(null);
    setError(null);
    onClose();
  }

  const canCopy = Boolean(sourceSessionId) && sourceSessionId !== targetSessionId && selectedBranchIds.size > 0;

  return (
    <Modal open={open} onClose={handleClose} title="Copy from another session">
      <div className="space-y-4">
        {error && <Alert variant="error">{error}</Alert>}

        {outcomes ? (
          <div className="space-y-2">
            {outcomes.map((outcome) => (
              <div
                key={outcome.branchId}
                className={`flex items-start gap-2 rounded-control border px-3 py-2 text-sm ${
                  outcome.success ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50"
                }`}
              >
                {outcome.success ? (
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-600" aria-hidden="true" />
                ) : (
                  <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" aria-hidden="true" />
                )}
                <span>
                  <span className="font-medium">{outcome.branchName ?? "Branch"}</span>
                  {outcome.success ? (
                    <span className="text-slate-600">
                      {" "}
                      &mdash; {outcome.copied} level{outcome.copied === 1 ? "" : "s"} copied
                      {outcome.skipped > 0 ? `, ${outcome.skipped} already planned skipped` : ""}
                    </span>
                  ) : (
                    outcome.message && <span className="text-slate-600"> &mdash; {outcome.message}</span>
                  )}
                </span>
              </div>
            ))}
            <div className="flex justify-end pt-2">
              <Button type="button" variant="secondary" onClick={handleClose}>
                Close
              </Button>
            </div>
          </div>
        ) : (
          <>
            <FormField label="Source session" htmlFor="copy-advance-plans-session">
              <Select
                id="copy-advance-plans-session"
                value={sourceSessionId}
                onChange={(event) => setSourceSessionId(event.target.value)}
              >
                <option value="">Select a session…</option>
                {sessions.map((session) => (
                  <option key={session.id} value={session.id} disabled={session.id === targetSessionId}>
                    {session.name}
                  </option>
                ))}
              </Select>
            </FormField>

            <FormField label="Branches to copy" htmlFor="copy-advance-plans-branches">
              <div
                id="copy-advance-plans-branches"
                className="max-h-48 space-y-1 overflow-y-auto overscroll-contain rounded-control border border-slate-200 p-2"
              >
                {branchOptions.map((branch) => (
                  <label key={branch.id} className="flex items-center gap-2 rounded px-1 py-1 text-sm hover:bg-slate-50">
                    <Checkbox
                      checked={selectedBranchIds.has(branch.id)}
                      disabled={role === "BRANCH_ADMIN"}
                      onChange={() => toggleBranch(branch.id)}
                    />
                    {branch.name}
                  </label>
                ))}
              </div>
            </FormField>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="ghost" onClick={handleClose}>
                Cancel
              </Button>
              <Button type="button" variant="accent" loading={submitting} disabled={!canCopy} onClick={handleCopy}>
                Copy plan
              </Button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
