import { RefreshCw, Settings, Users } from "lucide-react";
import { useState } from "react";
import { Link, useSearchParams } from "react-router";
import { getErrorMessage } from "@/api/client";
import { recomputeClassInsights, type ClassInsightsView, type ClassSummary } from "@/api/insights";
import { can } from "@/auth/permissions";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { FormField } from "@/components/ui/FormField";
import { PageHeader } from "@/components/ui/PageHeader";
import { Select } from "@/components/ui/Select";
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from "@/components/ui/Table";
import { TableSkeleton } from "@/components/ui/TableSkeleton";
import { useBranchFilter } from "@/features/branches/useBranchFilter";
import { InsightsUpgradeNotice } from "@/features/insights/components/InsightsUpgradeNotice";
import { ReasonList } from "@/features/insights/components/ReasonList";
import { SEVERITY_BADGE } from "@/features/insights/format";
import { useClassInsights, useInsightsSummary } from "@/features/insights/hooks";
import { useAuthStore } from "@/stores/authStore";
import { useFeatureStore } from "@/stores/featureStore";
import { formatInstantDate, formatUpdated } from "@/utils/date";

const TITLE = "Student insights";

/** The first class with flags (most at-risk first), else the first class at all. */
function defaultClassId(classes: ClassSummary[]): string | null {
  const flagged = [...classes]
    .filter((row) => row.atRisk + row.watch > 0)
    .sort((a, b) => b.atRisk - a.atRisk || b.watch - a.watch);
  return flagged[0]?.classId ?? classes[0]?.classId ?? null;
}

/** Classes grouped by level name, in first-seen order, for the picker's `<optgroup>`s. */
function groupByLevel(classes: ClassSummary[]): Array<[string, ClassSummary[]]> {
  const groups = new Map<string, ClassSummary[]>();
  for (const row of classes) {
    const level = row.levelName ?? "Other";
    groups.set(level, [...(groups.get(level) ?? []), row]);
  }
  return [...groups.entries()];
}

/**
 * Student insights (insights Phase I4): pick a class, see who is flagged and why. Every number is
 * a nightly snapshot read straight from the backend - nothing is computed here - so the page always
 * says when it was computed. The class list comes from the summary, already narrowed to the
 * caller's slice server-side; a SCHOOL_ADMIN of a multi-branch school can narrow it further to
 * one branch (`?branch=`, absent = all branches), client-side off each class's `branchId`.
 */
export function InsightsPage() {
  const role = useAuthStore((state) => state.user?.role);
  const entitled = useFeatureStore((state) => state.studentInsights);
  const featuresStatus = useFeatureStore((state) => state.status);
  const [searchParams, setSearchParams] = useSearchParams();
  const summary = useInsightsSummary();
  // Seeded with "" rather than null, so the page opens on every branch instead of the main one.
  const { ready: branchReady, branches, branchId, setBranchId } = useBranchFilter(searchParams.get("branch") ?? "");
  const showBranchFilter = can.selectBranch(role) && branches.length > 1;

  const allClasses = summary.state.kind === "loaded" ? summary.state.data.classes : [];
  const classes = branchId ? allClasses.filter((row) => row.branchId === branchId) : allClasses;
  const requestedClassId = searchParams.get("classId");
  const classId =
    requestedClassId && classes.some((row) => row.classId === requestedClassId)
      ? requestedClassId
      : defaultClassId(classes);
  const classInsights = useClassInsights(summary.state.kind === "loaded" && branchReady ? classId : null);

  const notIncluded =
    (featuresStatus === "loaded" && !can.viewInsights(role, entitled)) ||
    (summary.state.kind === "error" && summary.state.notIncluded) ||
    (classInsights.state.kind === "error" && classInsights.state.notIncluded);

  if (notIncluded) {
    return (
      <div className="space-y-6">
        <PageHeader title={TITLE} />
        <InsightsUpgradeNotice />
      </div>
    );
  }

  function selectBranch(next: string) {
    setBranchId(next);
    setSearchParams(
      (params) => {
        if (next) {
          params.set("branch", next);
        } else {
          params.delete("branch");
        }
        // The old class may not be in the new branch - fall back to its default.
        params.delete("classId");
        return params;
      },
      { replace: true },
    );
  }

  function selectClass(next: string) {
    setSearchParams(
      (params) => {
        params.set("classId", next);
        return params;
      },
      { replace: true },
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={TITLE}
        description="Which students are slipping, and why - checked every night from results, attendance, quizzes and learning."
        actions={
          <>
            {showBranchFilter && (
              <FormField label="Branch" htmlFor="insights-branch" className="min-w-[12rem]">
                <Select id="insights-branch" value={branchId} onChange={(event) => selectBranch(event.target.value)}>
                  <option value="">All branches</option>
                  {branches.map((branch) => (
                    <option key={branch.id} value={branch.id}>
                      {branch.name}
                    </option>
                  ))}
                </Select>
              </FormField>
            )}
            {classes.length > 0 && classId && (
              <FormField label="Class" htmlFor="insights-class" className="min-w-[14rem]">
                <Select id="insights-class" value={classId} onChange={(event) => selectClass(event.target.value)}>
                  {groupByLevel(classes).map(([level, rows]) => (
                    <optgroup key={level} label={level}>
                      {rows.map((row) => (
                        <option key={row.classId} value={row.classId}>
                          {row.className}
                          {row.atRisk + row.watch > 0 ? ` (${row.atRisk + row.watch} flagged)` : ""}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </Select>
              </FormField>
            )}
            {can.manageInsightSettings(role, entitled) && (
              <Link
                to="/school/insights/settings"
                className="inline-flex min-h-11 items-center gap-1.5 rounded-control px-3 text-sm font-medium text-slate-700 hover:bg-slate-100"
              >
                <Settings className="h-4 w-4" aria-hidden="true" /> Settings
              </Link>
            )}
          </>
        }
      />

      {summary.state.kind === "loading" && <TableSkeleton rows={5} columns={4} />}
      {summary.state.kind === "error" && <ErrorState message={summary.state.message} onRetry={summary.reload} />}
      {summary.state.kind === "loaded" && !summary.state.data.termId && (
        <EmptyState
          icon={Users}
          title="No current term"
          description="Insights are computed for the current term. Set one up under Academics to start seeing them."
        />
      )}
      {summary.state.kind === "loaded" && summary.state.data.termId && classes.length === 0 && (
        <EmptyState
          icon={Users}
          title="No classes to show"
          description={
            branchId
              ? "No classes in this branch are in your insights scope."
              : "You don't have any classes in your insights scope yet."
          }
        />
      )}

      {classId && branchReady && summary.state.kind === "loaded" && summary.state.data.termId && (
        <ClassSection key={classId} classId={classId} canRecompute={can.recomputeInsights(role, entitled)} state={classInsights.state} />
      )}
    </div>
  );
}

interface ClassSectionProps {
  classId: string;
  canRecompute: boolean;
  state: ReturnType<typeof useClassInsights>["state"];
}

function ClassSection({ classId, canRecompute, state }: ClassSectionProps) {
  const [recomputing, setRecomputing] = useState(false);
  const [message, setMessage] = useState<{ kind: "success" | "error"; text: string } | null>(null);

  async function handleRecompute() {
    setRecomputing(true);
    setMessage(null);
    try {
      await recomputeClassInsights(classId);
      // The worker refreshes snapshots on its next poll, so don't refetch and pretend they're new.
      setMessage({ kind: "success", text: "Recompute queued. Updated insights appear within a few minutes." });
    } catch (error) {
      setMessage({ kind: "error", text: getErrorMessage(error, "Couldn't queue a recompute. Please try again.") });
    } finally {
      setRecomputing(false);
    }
  }

  return (
    <section className="space-y-4" aria-label="Class insights">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-slate-900">
            {state.kind === "loaded" ? (state.data.className ?? "Class") : "Class"}
            {state.kind === "loaded" && state.data.termName && (
              <span className="font-normal text-slate-500"> · {state.data.termName}</span>
            )}
          </h2>
          {state.kind === "loaded" && <p className="text-xs text-slate-500">{formatUpdated(state.data.computedAt)}</p>}
        </div>
        {canRecompute && (
          <Button variant="secondary" onClick={handleRecompute} loading={recomputing}>
            <RefreshCw className="h-4 w-4" aria-hidden="true" /> Recompute now
          </Button>
        )}
      </div>

      {message && <Alert variant={message.kind}>{message.text}</Alert>}

      {state.kind === "loading" && <TableSkeleton rows={5} columns={4} />}
      {state.kind === "error" && <Alert variant="error">{state.message}</Alert>}
      {state.kind === "loaded" && <FlaggedStudentsTable view={state.data} />}
    </section>
  );
}

function FlaggedStudentsTable({ view }: { view: ClassInsightsView }) {
  if (!view.computedAt) {
    return (
      <EmptyState
        icon={Users}
        title="Not computed yet"
        description="This class's insights are computed overnight. Check back tomorrow."
      />
    );
  }
  if (view.students.length === 0) {
    return (
      <EmptyState
        icon={Users}
        title={`No students flagged in ${view.className ?? "this class"}`}
        description={`${view.totalStudents} student${view.totalStudents === 1 ? "" : "s"} checked.`}
      />
    );
  }

  const atRisk = view.students.filter((student) => student.severity === "AT_RISK").length;
  const watch = view.students.length - atRisk;

  return (
    <Card className="p-0 sm:p-0">
      <p className="px-4 pt-4 text-sm text-slate-600 sm:px-6">
        {atRisk} at risk · {watch} on watch · {view.totalStudents} checked
      </p>
      <Table containerClassName="mt-3">
        <TableHead>
          <tr>
            <TableHeaderCell>Student</TableHeaderCell>
            <TableHeaderCell>Severity</TableHeaderCell>
            <TableHeaderCell>Reasons</TableHeaderCell>
            <TableHeaderCell>At risk since</TableHeaderCell>
            <th aria-hidden="true" />
          </tr>
        </TableHead>
        <TableBody>
          {view.students.map((student) => {
            const severity = SEVERITY_BADGE[student.severity];
            return (
              <TableRow key={student.studentId} to={`/school/insights/students/${student.studentId}`}>
                <TableCell label="Student">
                  <span className="font-medium text-slate-900">{student.fullName ?? "Unnamed student"}</span>
                  {student.admissionNumber && (
                    <span className="block text-xs text-slate-500">{student.admissionNumber}</span>
                  )}
                </TableCell>
                <TableCell label="Severity">
                  <Badge variant={severity.variant}>{severity.label}</Badge>
                </TableCell>
                <TableCell label="Reasons">
                  <ReasonList reasons={student.reasons} />
                </TableCell>
                <TableCell label="At risk since">
                  {student.firstAtRiskAt ? formatInstantDate(student.firstAtRiskAt) : "—"}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </Card>
  );
}
