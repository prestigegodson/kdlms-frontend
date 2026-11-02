import { useParams, useSearchParams } from "react-router";
import { PageHeader } from "@/components/ui/PageHeader";
import { WardBreadcrumb } from "@/features/guardian/components/WardBreadcrumb";
import { WardResultReport } from "@/features/guardian/components/WardResultReport";
import { useWardResultsContext } from "@/features/guardian/WardResultsLayout";

/**
 * One past report, opened from the Past results tab of `WardResultsHomePage`.
 * `studentId`/`termId` come from the URL and `?scope=MIDTERM` picks the
 * mid-term result. Back returns to the Past results tab.
 */
export function WardTermResultPage() {
  const { ward, terms } = useWardResultsContext();
  const { termId } = useParams<{ sessionId: string; termId: string }>();
  const [searchParams] = useSearchParams();
  const scope = searchParams.get("scope") === "MIDTERM" ? "MIDTERM" : "TERM";

  const term = terms.find((candidate) => candidate.termId === termId);
  const scopeSuffix = scope === "MIDTERM" ? " · Mid-term" : "";
  const title = term ? `${term.termName} · ${term.sessionName}${scopeSuffix}` : "Result";
  const pastResultsPath = `/guardian/results/${ward.studentId}?tab=past`;

  return (
    <div className="space-y-6">
      <PageHeader title={title} description={term?.className} backTo={pastResultsPath} />
      <WardBreadcrumb
        steps={[
          { label: ward.fullName, to: `/guardian/results/${ward.studentId}` },
          { label: "Past results", to: pastResultsPath },
          { label: term ? `${term.termName}${scopeSuffix}` : "Result" },
        ]}
      />
      {termId && <WardResultReport studentId={ward.studentId} termId={termId} scope={scope} />}
    </div>
  );
}
