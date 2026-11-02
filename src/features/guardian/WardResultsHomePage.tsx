import { Link, useNavigate, useSearchParams } from "react-router";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { Pagination } from "@/components/ui/Pagination";
import { StickySubHeader } from "@/components/ui/StickySubHeader";
import { Tabs } from "@/components/ui/Tabs";
import { WardResultReport } from "@/features/guardian/components/WardResultReport";
import { WardSelector } from "@/features/guardian/components/WardSelector";
import { useWardResultsContext } from "@/features/guardian/WardResultsLayout";
import {
  latestPublished,
  pastResultGroups,
  type LatestResult,
  type PastSessionGroup,
} from "@/features/guardian/wardResultHistory";
import { usePageParam } from "@/hooks/usePageParam";
import { useWardStore } from "@/stores/wardStore";
import { paginate } from "@/utils/paginate";

type ResultsTab = "latest" | "past";

const TABS: Array<{ value: ResultsTab; label: string }> = [
  { value: "latest", label: "Latest result" },
  { value: "past", label: "Past results" },
];

const SESSIONS_PER_PAGE = 10;

const CHIP_CLASSES =
  "inline-flex items-center rounded-full border border-slate-300 bg-white px-3 py-1 text-sm font-medium text-slate-900 hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700 mobile:min-h-11";

/**
 * A ward's results: the latest published result on screen straight away, and
 * every other published result one tab over. The tab lives in `?tab=past` so
 * Back from a past report (`WardTermResultPage`) lands on the Past tab.
 * Switching ward navigates (the URL carries the ward) and keeps the tab;
 * `WardResultsLayout` syncs `wardStore` from the URL.
 */
export function WardResultsHomePage() {
  const { ward, terms } = useWardResultsContext();
  const wardCount = useWardStore((state) => state.wards.length);
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const tab: ResultsTab = searchParams.get("tab") === "past" ? "past" : "latest";

  const latest = latestPublished(terms);

  function changeTab(next: ResultsTab) {
    // Drops `?page=` too - a page index means nothing on the other tab.
    setSearchParams(next === "past" ? { tab: "past" } : {});
  }

  function changeWard(studentId: string) {
    navigate(`/guardian/results/${studentId}${tab === "past" ? "?tab=past" : ""}`);
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Results" description={`${ward.fullName} · ${ward.schoolName}`} />

      {wardCount > 1 && (
        <StickySubHeader>
          <WardSelector onSelect={changeWard} />
        </StickySubHeader>
      )}

      <Tabs ariaLabel="Results" value={tab} onChange={changeTab} items={TABS} />

      {tab === "latest" ? (
        <LatestTab studentId={ward.studentId} wardName={ward.fullName} latest={latest} />
      ) : (
        <PastTab studentId={ward.studentId} groups={pastResultGroups(terms, latest)} />
      )}
    </div>
  );
}

function LatestTab({
  studentId,
  wardName,
  latest,
}: {
  studentId: string;
  wardName: string;
  latest: LatestResult | null;
}) {
  if (!latest) {
    return (
      <EmptyState
        title="No results published yet"
        description={`${wardName}'s results will appear here as soon as the school publishes them.`}
      />
    );
  }

  const { term, scope } = latest;
  const scopeLabel = scope === "MIDTERM" ? "Mid-term" : "End of term";

  return (
    <WardResultReport
      key={`${studentId}|${term.termId}|${scope}`}
      studentId={studentId}
      termId={term.termId}
      scope={scope}
      heading={
        <>
          <h2 className="font-display text-lg font-semibold text-slate-900">
            {term.termName} · {term.sessionName}
          </h2>
          <p className="text-sm text-slate-500">
            {scopeLabel}
            {term.className ? ` · ${term.className}` : ""}
          </p>
        </>
      }
    />
  );
}

function PastTab({ studentId, groups }: { studentId: string; groups: PastSessionGroup[] }) {
  const [pageIndex, setPageIndex] = usePageParam();
  const page = paginate(groups, pageIndex, SESSIONS_PER_PAGE);

  if (groups.length === 0) {
    return (
      <EmptyState title="No past results yet" description="Older results will be listed here once there are some." />
    );
  }

  return (
    <div className="space-y-6">
      {page.content.map((group) => (
        <section key={group.sessionId} aria-labelledby={`session-${group.sessionId}`} className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h2
              id={`session-${group.sessionId}`}
              className="font-display text-sm font-semibold uppercase tracking-wide text-slate-500"
            >
              {group.sessionName}
            </h2>
            {group.currentSession && <Badge variant="brand">Current</Badge>}
            {group.className && <span className="text-sm text-slate-500">· {group.className}</span>}
          </div>
          <Card className="divide-y divide-slate-100 !p-0">
            {group.terms.map(({ term, endOfTerm, midterm }) => {
              const base = `/guardian/results/${studentId}/${term.sessionId}/${term.termId}`;
              const published = endOfTerm || midterm;
              return (
                <div
                  key={term.termId}
                  className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3"
                >
                  <span className={`text-sm font-medium ${published ? "text-slate-900" : "text-slate-400"}`}>
                    {term.termName}
                  </span>
                  {published ? (
                    <div className="flex flex-wrap gap-2">
                      {endOfTerm && (
                        <Link to={base} className={CHIP_CLASSES} aria-label={`${term.termName} end of term result`}>
                          End of term
                        </Link>
                      )}
                      {midterm && (
                        <Link
                          to={`${base}?scope=MIDTERM`}
                          className={CHIP_CLASSES}
                          aria-label={`${term.termName} mid-term result`}
                        >
                          Mid-term
                        </Link>
                      )}
                    </div>
                  ) : (
                    <span className="text-sm text-slate-400">Not published yet</span>
                  )}
                </div>
              );
            })}
          </Card>
        </section>
      ))}

      {page.totalPages > 1 && <Pagination page={page} onPageChange={setPageIndex} />}
    </div>
  );
}
