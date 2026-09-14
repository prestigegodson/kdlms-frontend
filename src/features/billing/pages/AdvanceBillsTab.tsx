import { CalendarClock, Check, Pencil, Receipt } from "lucide-react";
import { useEffect, useState } from "react";
import {
  type AdvanceBillPlanView,
  type AdvanceBillPreviewView,
  getAdvanceBillPlans,
  getAdvanceBillPreview,
  saveAdvanceBillPlans,
} from "@/api/billing";
import { ApiError } from "@/api/client";
import { can } from "@/auth/permissions";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { FormField } from "@/components/ui/FormField";
import { Select } from "@/components/ui/Select";
import { Skeleton } from "@/components/ui/Skeleton";
import { StatTile } from "@/components/ui/StatTile";
import { StickySubHeader } from "@/components/ui/StickySubHeader";
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from "@/components/ui/Table";
import { BillExportCard } from "@/features/billing/components/BillExportCard";
import { CopyAdvanceBillPlansModal } from "@/features/billing/components/CopyAdvanceBillPlansModal";
import { LevelTermPicker } from "@/features/billing/components/LevelTermPicker";
import { PublishBillsCard } from "@/features/billing/components/PublishBillsCard";
import { StudentBillModals } from "@/features/billing/components/StudentBillModals";
import { useStudentBillEditing } from "@/features/billing/useStudentBillEditing";
import { BranchFilter } from "@/features/branches/components/BranchFilter";
import { useBranchScope } from "@/features/branches/useBranchScope";
import { useAuthStore } from "@/stores/authStore";
import { useFeatureStore } from "@/stores/featureStore";
import { formatMoney } from "@/utils/currency";

/**
 * Bill an upcoming session's fees before promotion runs, by mapping a level in the current
 * session to the level its students will be billed at (Phase 27 - replaces the Bills tab's
 * `AdvanceBillPlanCard`/`AdvanceBillPlanModal`). Storage grain and UI grain are now the same
 * thing (`advance_bill_plans` is keyed on `(session, branch, source level)`, not the class), so
 * this reads as one straight-line flow rather than a separate configure-then-go-find-it split:
 * pick a level, pick a session ahead, say what level it bills at, pick a term, see the roster and
 * total that would be generated, then publish right here.
 *
 * The `LevelTermPicker` here is used with `defaultCurrentSession` omitted (false) - it deliberately
 * does NOT default Session to the current one (the `AdvanceBillPlanCard` precedent) - advance
 * billing exists specifically for a session that isn't current yet.
 */
export function AdvanceBillsTab() {
  const { ready: branchReady, branchId } = useBranchScope();
  const role = useAuthStore((state) => state.user?.role);
  const entitled = useFeatureStore((state) => state.billing);
  const canEditStudentBills = can.editStudentBills(role, entitled);

  const [sourceLevelId, setSourceLevelId] = useState("");
  const [sessionId, setSessionId] = useState("");
  const [termId, setTermId] = useState("");

  // A branch/session change clears the plan during render (the AdminResultsPanel idiom) - stale
  // data from the previous branch/session would otherwise flash before the fetch lands. Level is
  // deliberately excluded from this key: `getAdvanceBillPlans` takes no level parameter at all -
  // one read covers every source level for the branch+session - and `planRow` below re-derives
  // synchronously from `plan.rows` on every level change, so there's nothing to clear or refetch.
  const planKey = `${branchId ?? ""}|${sessionId}`;
  const [lastPlanKey, setLastPlanKey] = useState(planKey);
  const [plan, setPlan] = useState<AdvanceBillPlanView | null>(null);
  const [planError, setPlanError] = useState<string | null>(null);
  if (planKey !== lastPlanKey) {
    setLastPlanKey(planKey);
    setPlan(null);
    setPlanError(null);
  }

  function reloadPlan() {
    if (!sessionId) return;
    getAdvanceBillPlans(sessionId, branchId)
      .then(setPlan)
      .catch((err: unknown) => setPlanError(err instanceof ApiError ? err.message : "Failed to load the advance-bill plan"));
  }

  useEffect(reloadPlan, [sessionId, branchId]);

  const planRow = plan?.rows.find((row) => row.sourceLevelId === sourceLevelId) ?? null;

  const [billingLevelId, setBillingLevelId] = useState("");
  const [lastPlanRowKey, setLastPlanRowKey] = useState<string | null>(null);
  const planRowKey = planRow ? `${planRow.sourceLevelId}|${planRow.billingLevelId ?? ""}` : null;
  if (planRowKey !== lastPlanRowKey) {
    setLastPlanRowKey(planRowKey);
    setBillingLevelId(planRow?.billingLevelId ?? "");
  }

  // "" means no plan row at all for this source level - a deliberate "Exclude", not an unsaved
  // edit - so it compares correctly against `billingLevelId`'s own "" (the Select's "Exclude"
  // option value).
  const savedBillingLevelId = planRow?.billingLevelId ?? "";
  const dirty = billingLevelId !== savedBillingLevelId;

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [copyOpen, setCopyOpen] = useState(false);

  async function handleSave() {
    if (!sourceLevelId) return;
    setSaving(true);
    setSaveError(null);
    try {
      const outcome = await saveAdvanceBillPlans(
        sessionId,
        [{ sourceLevelId, billingLevelId: billingLevelId || null }],
        branchId,
      );
      const failed = outcome.outcomes.find((row) => !row.success);
      if (failed) {
        setSaveError(failed.message ?? "Failed to save.");
        return;
      }
      reloadPlan();
      loadPreview();
    } catch (err) {
      setSaveError(err instanceof ApiError ? err.message : "Failed to save the advance-bill plan");
    } finally {
      setSaving(false);
    }
  }

  // ---------------- Preview ----------------
  const [preview, setPreview] = useState<AdvanceBillPreviewView | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);

  const previewKey = `${branchId ?? ""}|${sourceLevelId}|${sessionId}|${termId}`;
  const [lastPreviewKey, setLastPreviewKey] = useState(previewKey);
  if (previewKey !== lastPreviewKey) {
    setLastPreviewKey(previewKey);
    setPreview(null);
    setPreviewError(null);
  }

  function loadPreview() {
    if (!sessionId || !termId || !sourceLevelId) return;
    getAdvanceBillPreview(sessionId, termId, sourceLevelId, branchId)
      .then(setPreview)
      .catch((err: unknown) => setPreviewError(err instanceof ApiError ? err.message : "Failed to load the preview"));
  }

  useEffect(loadPreview, [sourceLevelId, sessionId, termId, branchId]);

  // A save changes what's charged, which changes the preview's own totals/billable flags.
  const editing = useStudentBillEditing(termId, loadPreview);

  const showsBranchFilter = branchReady;

  return (
    <div className="space-y-6">
      <StickySubHeader collapsible>
        <BranchFilter id="advance-bills-branch" />
        <LevelTermPicker
          levelId={sourceLevelId}
          onLevelChange={setSourceLevelId}
          sessionId={sessionId}
          onSessionChange={setSessionId}
          termId={termId}
          onTermChange={setTermId}
          sessionLabel="Session to advance-bill"
          idPrefix="advance-bills"
        />
      </StickySubHeader>

      {!sourceLevelId || !sessionId ? (
        showsBranchFilter && (
          <EmptyState
            icon={CalendarClock}
            title="Select a level and a session"
            description="Pick a branch, a level in the current session, and the upcoming session you want to bill it for."
          />
        )
      ) : (
        <>
          <Card>
            <div className="flex items-start gap-3">
              <CalendarClock className="mt-0.5 h-5 w-5 shrink-0 text-slate-400" aria-hidden="true" />
              <div className="min-w-0 flex-1 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="text-sm font-semibold text-slate-900">Billing level</h2>
                  {/*{plan && (*/}
                  {/*  <Button type="button" variant="secondary" onClick={() => setCopyOpen(true)}>*/}
                  {/*    Copy from another session*/}
                  {/*  </Button>*/}
                  {/*)}*/}
                </div>

                {planError && <Alert variant="error">{planError}</Alert>}
                {!plan && !planError && <Skeleton className="h-10 w-full" />}

                {plan &&
                  (planRow ? (
                    <>
                      <p className="text-sm text-slate-600">
                        {planRow.activeStudents} student{planRow.activeStudents === 1 ? "" : "s"} at this level ·{" "}
                        {planRow.alreadyEnrolled} already promoted into {plan.sessionName}.
                      </p>
                      <FormField label="Bills at" htmlFor="advance-bills-billing-level" className="max-w-xs">
                        <Select
                          id="advance-bills-billing-level"
                          value={billingLevelId}
                          onChange={(event) => setBillingLevelId(event.target.value)}
                        >
                          <option value="">Exclude</option>
                          {plan.levels.map((level) => (
                            <option key={level.levelId} value={level.levelId}>
                              {level.displayName}
                            </option>
                          ))}
                        </Select>
                      </FormField>
                      {saveError && <Alert variant="error">{saveError}</Alert>}
                      <div className="flex flex-wrap items-center gap-3">
                        <Button
                          type="button"
                          variant="primary"
                          onClick={handleSave}
                          loading={saving}
                          disabled={!dirty}
                        >
                          Save
                        </Button>
                        {dirty ? (
                          <span className="text-sm text-amber-700">Unsaved change</span>
                        ) : savedBillingLevelId ? (
                          <span className="inline-flex items-center gap-1.5 text-sm text-green-700">
                            <Check className="h-4 w-4" aria-hidden="true" />
                            Saved — bills at {planRow.billingLevelName}
                          </span>
                        ) : (
                          <span className="text-sm text-slate-500">Not advance-billed for this session</span>
                        )}
                      </div>
                    </>
                  ) : (
                    <Alert variant="error">This level has no classes in this branch to advance-bill.</Alert>
                  ))}
              </div>
            </div>
          </Card>

          <Card>
            <div className="flex items-start gap-3">
              <Receipt className="mt-0.5 h-5 w-5 shrink-0 text-slate-400" aria-hidden="true" />
              <div className="min-w-0 flex-1 space-y-3">
                <h2 className="text-sm font-semibold text-slate-900">Bills to be generated</h2>

                {!termId ? (
                  <EmptyState
                    icon={Receipt}
                    title="Select a term"
                    description="Pick a term of the session above to see the bills it would generate."
                  />
                ) : (
                  <>
                    {previewError && <Alert variant="error">{previewError}</Alert>}
                    {!preview && !previewError && <Skeleton className="h-24 w-full" />}
                    {preview &&
                      (!preview.billingLevelId ? (
                        <EmptyState
                          icon={Receipt}
                          title="No billing level set yet"
                          description="Set a billing level above and save it to generate bills for this level."
                        />
                      ) : preview.students.length === 0 ? (
                        <EmptyState
                          icon={Receipt}
                          title="Nothing to bill"
                          description="Every student at this level is already promoted into this session, so there's nothing left to advance-bill."
                        />
                      ) : (
                        <>
                          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <StatTile label="Students to bill" value={preview.billableStudents} />
                            <StatTile
                              label="Expected total"
                              value={formatMoney(preview.expectedTotal, preview.currency)}
                            />
                          </div>
                          <Table>
                            <TableHead>
                              <TableRow>
                                <TableHeaderCell>Student</TableHeaderCell>
                                <TableHeaderCell>Class</TableHeaderCell>
                                <TableHeaderCell>Admission no.</TableHeaderCell>
                                <TableHeaderCell numeric>Total</TableHeaderCell>
                                {canEditStudentBills && <TableHeaderCell>{/* Edit bill */}</TableHeaderCell>}
                              </TableRow>
                            </TableHead>
                            <TableBody>
                              {preview.students.map((row) => (
                                <TableRow key={row.studentId} onClick={() => editing.openPreview(row.studentId)}>
                                  <TableCell label="Student">{row.studentName}</TableCell>
                                  <TableCell label="Class">{row.className}</TableCell>
                                  <TableCell label="Admission no.">{row.admissionNumber}</TableCell>
                                  <TableCell label="Total" numeric>
                                    {row.billable ? formatMoney(row.total, row.currency) : "—"}
                                  </TableCell>
                                  {canEditStudentBills && (
                                    <TableCell label="Edit bill">
                                      <Button
                                        type="button"
                                        variant="secondary"
                                        size="sm"
                                        onClick={(event) => {
                                          event.stopPropagation();
                                          editing.openAdjustments(row.studentId);
                                        }}
                                      >
                                        <Pencil className="h-4 w-4" aria-hidden="true" /> Edit bill
                                      </Button>
                                    </TableCell>
                                  )}
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </>
                      ))}
                  </>
                )}
              </div>
            </div>
          </Card>

          {termId && (
            <>
              <p className="text-sm text-slate-500">
                Publishing sends every bill for this branch and term - advance bills for unpromoted
                students at every planned level, plus ordinary bills for anyone already enrolled.
              </p>
              <PublishBillsCard branchId={branchId} termId={termId} currency={preview?.currency} />
              <BillExportCard levelId={sourceLevelId} branchId={branchId} termId={termId} />
            </>
          )}
        </>
      )}

      {sessionId && (
        <CopyAdvanceBillPlansModal
          open={copyOpen}
          onClose={() => setCopyOpen(false)}
          targetSessionId={sessionId}
          onCopied={() => {
            setCopyOpen(false);
            reloadPlan();
            loadPreview();
          }}
        />
      )}

      <StudentBillModals termId={termId} editing={editing} />
    </div>
  );
}
