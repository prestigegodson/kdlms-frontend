import { Pencil, Receipt } from "lucide-react";
import { useEffect, useState } from "react";
import { type BillSummaryView, type BranchBillingSummaryView, getBillingSummary, getLevelBills } from "@/api/billing";
import { ApiError } from "@/api/client";
import { can } from "@/auth/permissions";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { StatTile } from "@/components/ui/StatTile";
import { StickySubHeader } from "@/components/ui/StickySubHeader";
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from "@/components/ui/Table";
import { BillExportCard } from "@/features/billing/components/BillExportCard";
import { LevelTermPicker } from "@/features/billing/components/LevelTermPicker";
import { PublishBillsCard } from "@/features/billing/components/PublishBillsCard";
import { StudentBillModals } from "@/features/billing/components/StudentBillModals";
import { TermPaymentStatusBadge } from "@/features/billing/components/TermPaymentStatusBadge";
import { useStudentBillEditing } from "@/features/billing/useStudentBillEditing";
import { BranchFilter } from "@/features/branches/components/BranchFilter";
import { useBranchScope } from "@/features/branches/useBranchScope";
import { useAuthStore } from "@/stores/authStore";
import { useFeatureStore } from "@/stores/featureStore";
import { formatMoney } from "@/utils/currency";

/**
 * A branch's derived bills for one level + term - roster + summary. Level-scoped throughout
 * (Phase 31, replacing the original class picker) since a bill is priced off the student's level,
 * never their class - a level spanning several classes shows every one of them in one roster, each
 * row carrying its own `className` to disambiguate. Mirrors AdminResultsPanel's shape (branch/
 * session/term/level selection, StickySubHeader collapsible).
 */
export function BillsTab() {
  const { ready: branchReady, branchId } = useBranchScope();
  const role = useAuthStore((state) => state.user?.role);
  const entitled = useFeatureStore((state) => state.billing);
  const canEditStudentBills = can.editStudentBills(role, entitled);

  const [levelId, setLevelId] = useState("");
  const [sessionId, setSessionId] = useState("");
  const [termId, setTermId] = useState("");

  const [summary, setSummary] = useState<BranchBillingSummaryView | null>(null);
  const [roster, setRoster] = useState<BillSummaryView[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  function refreshRoster() {
    if (levelId) {
      getLevelBills(levelId, termId, branchId).then(setRoster).catch(() => undefined);
    }
  }

  const editing = useStudentBillEditing(termId, refreshRoster);

  // A branch change clears the level selection during render (the AdminResultsPanel idiom) - a
  // level's roster from the previous branch would otherwise 404 once the branch has re-scoped.
  const [lastBranchId, setLastBranchId] = useState(branchId);
  if (branchId !== lastBranchId) {
    setLastBranchId(branchId);
    setLevelId("");
  }

  const selectionKey = `${branchId ?? ""}|${levelId}|${termId}`;
  const [lastSelectionKey, setLastSelectionKey] = useState(selectionKey);
  if (selectionKey !== lastSelectionKey) {
    setLastSelectionKey(selectionKey);
    setSummary(null);
    setRoster(null);
    setLoadError(null);
  }

  useEffect(() => {
    if (!termId) return;
    getBillingSummary(termId, branchId)
      .then(setSummary)
      .catch((error: unknown) => setLoadError(error instanceof ApiError ? error.message : "Failed to load billing summary"));
    if (levelId) {
      getLevelBills(levelId, termId, branchId)
        .then(setRoster)
        .catch((error: unknown) => setLoadError(error instanceof ApiError ? error.message : "Failed to load class bills"));
    }
  }, [levelId, termId, branchId]);

  return (
    <div className="space-y-6">
      {!branchReady ? (
        <Skeleton className="h-10 w-full" />
      ) : (
        <StickySubHeader collapsible>
          <BranchFilter id="bills-branch" />
          <LevelTermPicker
            levelId={levelId}
            onLevelChange={setLevelId}
            sessionId={sessionId}
            onSessionChange={setSessionId}
            termId={termId}
            onTermChange={setTermId}
            defaultCurrentSession
            idPrefix="bills"
          />
        </StickySubHeader>
      )}

      {loadError && <Alert variant="error">{loadError}</Alert>}

      {!termId ? (
        branchReady && (
          <EmptyState
            icon={Receipt}
            title="Select a class and term"
            description="Pick a branch, session, term, and class to see its bills."
          />
        )
      ) : (
        <>
          {summary ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <StatTile
                label="Billable students"
                value={summary.byLevel.reduce((sum, level) => sum + level.billableStudentCount, 0)}
              />
              <StatTile
                label="Expected compulsory revenue"
                value={formatMoney(summary.totalExpectedRevenue, summary.currency)}
              />
              <StatTile label="Currency" value={summary.currency} />
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
            </div>
          )}

          {levelId &&
            (roster === null ? (
              <div className="space-y-2">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : roster.length === 0 ? (
              <EmptyState icon={Receipt} title="No students at this class in this branch" />
            ) : (
              <Table>
                <TableHead>
                  <TableRow>
                    <TableHeaderCell>Student</TableHeaderCell>
                    <TableHeaderCell>Classroom</TableHeaderCell>
                    <TableHeaderCell>Admission no.</TableHeaderCell>
                    <TableHeaderCell>Status</TableHeaderCell>
                    <TableHeaderCell numeric>Total</TableHeaderCell>
                    <TableHeaderCell numeric>Paid</TableHeaderCell>
                    <TableHeaderCell numeric>Balance</TableHeaderCell>
                    {canEditStudentBills && <TableHeaderCell>{/* Edit bill */}</TableHeaderCell>}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {roster.map((row) => (
                    <TableRow
                      key={row.studentId}
                      onClick={() =>
                        editing.openPreview(row.studentId, { name: row.studentName, admissionNumber: row.admissionNumber })
                      }
                    >
                      <TableCell label="Student">{row.studentName}</TableCell>
                      <TableCell label="Classroom">{row.className}</TableCell>
                      <TableCell label="Admission no.">{row.admissionNumber}</TableCell>
                      <TableCell label="Status">
                        <div className="flex flex-wrap gap-1">
                          <Badge variant={row.billable ? "success" : "neutral"}>
                            {row.billable ? "Billed" : "No bill"}
                          </Badge>
                          {row.advance && <Badge variant="info">Advance</Badge>}
                          {(row.billable || row.confirmedPaid > 0 || row.pendingAmount > 0) && (
                            <TermPaymentStatusBadge
                              status={row.termPaymentStatus}
                              hasPending={row.hasPending}
                              inCredit={row.inCredit}
                            />
                          )}
                        </div>
                      </TableCell>
                      <TableCell label="Total" numeric>
                        {row.billable ? formatMoney(row.total, row.currency) : "—"}
                      </TableCell>
                      <TableCell label="Paid" numeric>
                        {formatMoney(row.confirmedPaid, row.currency)}
                        {row.pendingAmount > 0 && (
                          <span className="block text-xs text-slate-500">
                            +{formatMoney(row.pendingAmount, row.currency)} pending
                          </span>
                        )}
                      </TableCell>
                      <TableCell label="Balance" numeric>
                        {row.balance === null
                          ? "—"
                          : row.balance < 0
                            ? `Credit ${formatMoney(Math.abs(row.balance), row.currency)}`
                            : formatMoney(row.balance, row.currency)}
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
            ))}

          <PublishBillsCard branchId={branchId} termId={termId} currency={summary?.currency} />

          {levelId && <BillExportCard levelId={levelId} branchId={branchId} termId={termId} />}
        </>
      )}

      <StudentBillModals termId={termId} editing={editing} branchId={branchId} onPaymentsChanged={refreshRoster} />
    </div>
  );
}
