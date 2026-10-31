import { LineChart } from "lucide-react";
import { useParams } from "react-router";
import { can } from "@/auth/permissions";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { PageHeader } from "@/components/ui/PageHeader";
import { Skeleton } from "@/components/ui/Skeleton";
import { InsightTrendChart } from "@/features/insights/components/InsightTrendChart";
import { InsightsUpgradeNotice } from "@/features/insights/components/InsightsUpgradeNotice";
import { ReasonList } from "@/features/insights/components/ReasonList";
import { SEVERITY_BADGE } from "@/features/insights/format";
import { useStudentInsightTrend } from "@/features/insights/hooks";
import { useAuthStore } from "@/stores/authStore";
import { useFeatureStore } from "@/stores/featureStore";
import { formatUpdated } from "@/utils/date";

/**
 * One student's insights (insights Phase I4): the latest term's severity and reasons, and the
 * term-over-term trend built from that student's per-term snapshot rows. Reached from the
 * insights table (every staff role) and from the student profile (admins and heads).
 */
export function StudentInsightPage() {
  const { studentId } = useParams<{ studentId: string }>();
  const role = useAuthStore((state) => state.user?.role);
  const entitled = useFeatureStore((state) => state.studentInsights);
  const featuresStatus = useFeatureStore((state) => state.status);
  const { state, reload } = useStudentInsightTrend(studentId);

  const title = state.kind === "loaded" ? (state.data.fullName ?? "Student insights") : "Student insights";

  if ((featuresStatus === "loaded" && !can.viewInsights(role, entitled)) || (state.kind === "error" && state.notIncluded)) {
    return (
      <div className="space-y-6">
        <PageHeader title="Student insights" backTo="/school/insights" backLabel="Student insights" />
        <InsightsUpgradeNotice />
      </div>
    );
  }

  const latest = state.kind === "loaded" ? state.data.terms[state.data.terms.length - 1] : undefined;

  return (
    <div className="space-y-6">
      <PageHeader
        title={title}
        description={
          state.kind === "loaded"
            ? [state.data.admissionNumber, formatUpdated(state.data.computedAt)].filter(Boolean).join(" · ")
            : undefined
        }
        backTo="/school/insights"
        backLabel="Student insights"
      />

      {state.kind === "loading" && <Skeleton className="h-48 w-full" />}
      {state.kind === "error" && <ErrorState message={state.message} onRetry={reload} />}

      {state.kind === "loaded" && !latest && (
        <EmptyState
          icon={LineChart}
          title="No insights yet"
          description="This student's insights are computed overnight. Check back tomorrow."
        />
      )}

      {latest && (
        <Card>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-slate-900">
              {[latest.termName, latest.sessionName].filter(Boolean).join(" · ") || "Latest term"}
              {latest.className && <span className="font-normal text-slate-500"> · {latest.className}</span>}
            </h2>
            <Badge variant={SEVERITY_BADGE[latest.severity].variant}>{SEVERITY_BADGE[latest.severity].label}</Badge>
          </div>
          <div className="mt-3">
            <ReasonList reasons={latest.reasons} />
          </div>
          <p className="mt-3 text-xs text-slate-500">{formatUpdated(latest.computedAt)}</p>
        </Card>
      )}

      {state.kind === "loaded" && state.data.terms.length > 0 && (
        <Card>
          <h2 className="text-sm font-semibold text-slate-900">Term by term</h2>
          <p className="mt-1 text-xs text-slate-500">
            Results only count once a term&rsquo;s results are published.
          </p>
          <div className="mt-3">
            <InsightTrendChart terms={state.data.terms} />
          </div>
        </Card>
      )}
    </div>
  );
}
